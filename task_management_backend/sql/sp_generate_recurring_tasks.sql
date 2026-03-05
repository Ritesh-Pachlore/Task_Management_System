USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_generate_recurring_tasks]    Script Date: 02-03-2026 11:13:42 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ═══════════════════════════════════════════════════════════════
-- sp_generate_recurring_tasks (v3)
--
-- Called daily via SQL Agent Job at 12:01 AM.
-- Creates new task_execution_log entries for each recurring task
-- whose pattern matches today.
--
-- KEY BEHAVIORS:
--   1. DAILY   — Assigns every working day. Skips holidays.
--   2. WEEKLY  — Assigns on the selected day. If that day is a 
--                holiday, SHIFTS to next working day. Future 
--                weeks stay on the originally selected day.
--   3. MONTHLY — Assigns on the selected date. If that date is 
--                a holiday, SHIFTS to next working day. Future 
--                months stay on the original date.
--   4. Each instance gets a deadline of 23:59:59 on assigned day.
--   5. Assigns to ALL originally assigned employees.
-- ═══════════════════════════════════════════════════════════════

ALTER PROCEDURE [dbo].[sp_generate_recurring_tasks]
    @target_date DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @target_date IS NULL SET @target_date = CAST(GETDATE() AS DATE);

    DECLARE @tasks_created INT = 0;
    DECLARE @tasks_skipped INT = 0;
    DECLARE @now DATETIME = GETDATE();

    -- ── NOTE: We do NOT exit on holidays anymore! ──────────────
    -- Instead, we check per-pattern whether today is the shifted
    -- day for a pattern that was supposed to run on a holiday.
    -- DAILY tasks still skip holidays (they just don't run).
    -- WEEKLY/MONTHLY tasks SHIFT to the next working day.

    -- ── Process each active recurrence pattern ─────────────────
    DECLARE @task_id          BIGINT;
    DECLARE @recurrence_type  VARCHAR(10);
    DECLARE @weekly_days      VARCHAR(100);
    DECLARE @monthly_day      INT;
    DECLARE @created_by       BIGINT;
    DECLARE @task_start_date  DATE;

    DECLARE pattern_cursor CURSOR FOR
        SELECT 
            rp.task_id, 
            rp.recurrence_type, 
            rp.weekly_days, 
            rp.monthly_day_of_month, 
            td.created_by,
            CAST(td.task_start_date AS DATE)
        FROM recurrence_pattern rp
        INNER JOIN task_details td ON rp.task_id = td.task_id
        WHERE td.is_active = 1
          AND rp.start_date <= @target_date
          AND (rp.end_date IS NULL OR rp.end_date >= @target_date);

    OPEN pattern_cursor;
    FETCH NEXT FROM pattern_cursor INTO @task_id, @recurrence_type, @weekly_days, @monthly_day, @created_by, @task_start_date;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @should_create BIT = 0;

        -- ── 1. Identify Reference Employee (Lead or Single Member) ──
        DECLARE @ref_emp_id BIGINT;
        DECLARE @new_group_id_val BIGINT = NULL;
        DECLARE @is_group_task BIT = 0;

        -- Find the Team Lead if it exists, otherwise any active member
        SELECT TOP 1 @ref_emp_id = emp_id 
        FROM task_execution_log 
        WHERE task_id = @task_id AND is_active = 1
        ORDER BY is_team_lead DESC; -- Team Lead (is_team_lead=1) comes first

        -- Check if it's a group task (more than 1 active member)
        IF (SELECT COUNT(*) FROM task_execution_log WHERE task_id = @task_id AND is_active = 1) > 1
        BEGIN
            SET @is_group_task = 1;
        END

        IF @ref_emp_id IS NOT NULL
        BEGIN
            SET @should_create = 0;

            -- ── 2. Calculate Assignment for Reference Employee ──

            -- 1. DAILY
            IF @recurrence_type IN ('1', 'DAILY')
            BEGIN
                IF dbo.fn_is_non_working_day(@target_date, @ref_emp_id) = 0
                    SET @should_create = 1;
            END

            -- 2. WEEKLY
            ELSE IF @recurrence_type IN ('2', 'WEEKLY')
            BEGIN
                -- NEW LOGIC: Look forward to see if today is the "Designated Working Day" 
                -- for a scheduled day that happens on a holiday.
                DECLARE @day_offset INT = 0;
                WHILE @day_offset < 7
                BEGIN
                    DECLARE @scheduled_date DATE = DATEADD(DAY, @day_offset, @target_date);
                    DECLARE @scheduled_day_name VARCHAR(20) = DATENAME(WEEKDAY, @scheduled_date);
                    
                    -- Is this date (@scheduled_date) one of the target days?
                    IF @weekly_days IS NOT NULL AND CHARINDEX(@scheduled_day_name, @weekly_days) > 0
                    BEGIN
                        -- If scheduled_date is a working day, it MUST be assigned ON scheduled_date
                        IF dbo.fn_is_non_working_day(@scheduled_date, @ref_emp_id) = 0
                        BEGIN
                            IF @day_offset = 0 SET @should_create = 1;
                        END
                        -- If scheduled_date IS a holiday, find the EARLIER working day
                        ELSE
                        BEGIN
                            -- Today is the designated day if Today is working AND all days between Today and Scheduled are holidays
                            IF dbo.fn_is_non_working_day(@target_date, @ref_emp_id) = 0
                                AND @target_date = dbo.fn_get_previous_working_day(@scheduled_date, @ref_emp_id)
                                SET @should_create = 1;
                        END
                        
                        IF @should_create = 1 BREAK;
                    END
                    SET @day_offset = @day_offset + 1;
                END
            END

            -- 3. MONTHLY
            ELSE IF @recurrence_type IN ('3', 'MONTHLY')
            BEGIN
                DECLARE @scheduled_day_num INT = @monthly_day;
                DECLARE @days_in_month INT = DAY(EOMONTH(@target_date));
                IF @scheduled_day_num > @days_in_month SET @scheduled_day_num = @days_in_month;
                
                DECLARE @scheduled_date_m DATE = DATEFROMPARTS(YEAR(@target_date), MONTH(@target_date), @scheduled_day_num);
                
                -- IF scheduled date is working day, assign ON that day
                IF dbo.fn_is_non_working_day(@scheduled_date_m, @ref_emp_id) = 0
                BEGIN
                    IF @target_date = @scheduled_date_m SET @should_create = 1;
                END
                -- IF scheduled date is holiday, find the EARLIER working day
                ELSE
                BEGIN
                    IF dbo.fn_is_non_working_day(@target_date, @ref_emp_id) = 0
                        AND @target_date = dbo.fn_get_previous_working_day(@scheduled_date_m, @ref_emp_id)
                        SET @should_create = 1;
                END
            END

            -- Don't duplicate the original start date task
            IF @target_date = @task_start_date SET @should_create = 0;

            -- ── 3. Create Instance for ALL Members ──
            IF @should_create = 1
            BEGIN
                -- Generate ONE new numeric group_id per task instance
                IF @is_group_task = 1
                BEGIN
                    SELECT @new_group_id_val = ISNULL(MAX(group_id), 0) + 1 FROM task_execution_log;
                END

                DECLARE @instance_deadline DATETIME = DATEADD(SECOND, 86399, CAST(@target_date AS DATETIME));
                -- REMOVED: UPDATE task_details SET task_end_date = @instance_deadline WHERE task_id = @task_id;

                -- Insert for ALL active members originally on this task
                INSERT INTO task_execution_log (
                    task_id, emp_id, assigned_by, task_status,
                    started_at, extended_date, instance_deadline, rejection_count,
                    group_id, is_team_lead, is_active,
                    created_at, updated_at
                )
                SELECT 
                    @task_id, emp_id, assigned_by, 0,
                    NULL, NULL, @instance_deadline, 0,
                    @new_group_id_val, is_team_lead, 1,
                    @now, @now
                FROM task_execution_log
                WHERE task_id = @task_id 
                  AND is_active = 1
                  -- Ensure no duplicates for this specific target date
                  AND emp_id NOT IN (
                      SELECT emp_id FROM task_execution_log 
                      WHERE task_id = @task_id AND CAST(created_at AS DATE) = @target_date
                  );

                -- Log History for new rows
                INSERT INTO task_execution_history (execution_log_id, action_type, action_by, remarks, action_at)
                SELECT id, 0, assigned_by, 'Auto-assigned by recurring task scheduler (Lead-centric)', @now
                FROM task_execution_log
                WHERE task_id = @task_id 
                  AND CAST(created_at AS DATE) = @target_date;

                SET @tasks_created = @tasks_created + @@ROWCOUNT;
            END
        END

        FETCH NEXT FROM pattern_cursor INTO @task_id, @recurrence_type, @weekly_days, @monthly_day, @created_by, @task_start_date;
    END

    -- ── 4. PROACTIVE SHIFT ──────────────────────────────────────
    -- If a holiday was declared AFTER an instance was created but 
    -- BEFORE it is due, move it to the earlier working day.
    UPDATE tel
    SET instance_deadline = DATEADD(SECOND, 86399, CAST(dbo.fn_get_previous_working_day(CAST(tel.instance_deadline AS DATE), tel.emp_id) AS DATETIME)),
        updated_at = @now
    FROM task_execution_log tel
    INNER JOIN task_details td ON tel.task_id = td.task_id
    WHERE td.task_type IN (2, 3) -- WEEKLY, MONTHLY
      AND tel.task_status = 0 -- Pending
      AND CAST(tel.instance_deadline AS DATE) > @target_date -- Future tasks
      AND dbo.fn_is_non_working_day(CAST(tel.instance_deadline AS DATE), tel.emp_id) = 1;

    CLOSE pattern_cursor;
    DEALLOCATE pattern_cursor;

    SELECT 
        @tasks_created AS tasks_created, 
        @tasks_skipped AS tasks_skipped,
        'Recurring task generation complete for ' + CONVERT(VARCHAR, @target_date, 23) AS message;
END
