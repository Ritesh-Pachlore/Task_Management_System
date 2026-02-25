USE [DButilities]
GO

IF EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_generate_recurring_tasks' AND type = 'P')
    DROP PROCEDURE [dbo].[sp_generate_recurring_tasks];
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

CREATE PROCEDURE [dbo].[sp_generate_recurring_tasks]
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

        -- ════════════════════════════════════════════════════════
        -- DAILY (type '1' or 'DAILY')
        -- Logic: Assign every working day. Simply skip holidays.
        -- ════════════════════════════════════════════════════════
        IF @recurrence_type IN ('1', 'DAILY')
        BEGIN
            -- Only assign if today is a working day
            IF dbo.fn_is_non_working_day(@target_date) = 0
                SET @should_create = 1;
        END

        -- ════════════════════════════════════════════════════════
        -- WEEKLY (type '2' or 'WEEKLY')
        -- Logic: Check if today is the selected day. If the 
        --   selected day was a holiday, today might be the
        --   shifted working day for it.
        --
        -- Example: Task is "every Monday"
        --   - Normal Monday (working day): Assign ✓
        --   - Monday is holiday → shift to Tuesday
        --     Tuesday: fn_get_next_working_day('Monday date') = Tuesday → Assign ✓
        --   - Next Monday (working day): Assign normally ✓
        -- ════════════════════════════════════════════════════════
        ELSE IF @recurrence_type IN ('2', 'WEEKLY')
        BEGIN
            -- Find the most recent occurrence of the selected day
            -- within the last 7 days (including today)
            DECLARE @check_day INT = 0;
            WHILE @check_day < 7
            BEGIN
                DECLARE @candidate_date DATE = DATEADD(DAY, -@check_day, @target_date);
                DECLARE @candidate_day_name VARCHAR(20) = DATENAME(WEEKDAY, @candidate_date);
                
                IF @weekly_days IS NOT NULL AND CHARINDEX(@candidate_day_name, @weekly_days) > 0
                BEGIN
                    -- Found the scheduled day. Now check:
                    -- If the scheduled day IS today AND it's a working day → assign
                    -- If the scheduled day WAS a holiday, is today the shifted day?
                    IF @check_day = 0 AND dbo.fn_is_non_working_day(@target_date) = 0
                    BEGIN
                        SET @should_create = 1;
                    END
                    ELSE IF @check_day > 0
                    BEGIN
                        -- The scheduled day was @check_day days ago
                        -- Check if that day was a holiday
                        IF dbo.fn_is_non_working_day(@candidate_date) = 1
                        BEGIN
                            -- It was a holiday! Is today the next working day after it?
                            IF @target_date = dbo.fn_get_next_working_day(@candidate_date)
                                SET @should_create = 1;
                        END
                    END
                    BREAK; -- Found the match, stop looking
                END
                SET @check_day = @check_day + 1;
            END
        END

        -- ════════════════════════════════════════════════════════
        -- MONTHLY (type '3' or 'MONTHLY')
        -- Logic: Check if today is the selected date. If the 
        --   selected date was a holiday, check if today is the
        --   shifted working day.
        --
        -- Example: Task is "every 15th"
        --   - Mar 15 is working day: Assign ✓
        --   - Apr 15 is holiday → shift to Apr 16
        --     Apr 16: fn_get_next_working_day('Apr 15') = Apr 16 → Assign ✓
        --   - May 15 is working day: Assign normally ✓
        -- ════════════════════════════════════════════════════════
        ELSE IF @recurrence_type IN ('3', 'MONTHLY')
        BEGIN
            IF DAY(@target_date) = @monthly_day
            BEGIN
                -- Today IS the scheduled date
                IF dbo.fn_is_non_working_day(@target_date) = 0
                    SET @should_create = 1;
                -- If today is the scheduled date but it's a holiday,
                -- do nothing — fn_get_next_working_day will handle it on the shifted day
            END
            ELSE
            BEGIN
                -- Today is NOT the scheduled date, but maybe it's the shifted version
                -- Build the scheduled date for this month
                DECLARE @scheduled_day INT = @monthly_day;
                -- Handle months with fewer days (e.g., Feb 30 → Feb 28)
                DECLARE @days_in_month INT = DAY(EOMONTH(@target_date));
                IF @scheduled_day > @days_in_month
                    SET @scheduled_day = @days_in_month;
                
                DECLARE @scheduled_date DATE = DATEFROMPARTS(
                    YEAR(@target_date), MONTH(@target_date), @scheduled_day
                );
                
                -- Check if the scheduled date was a holiday AND today is the shifted day
                IF @scheduled_date < @target_date  -- scheduled date has passed
                   AND dbo.fn_is_non_working_day(@scheduled_date) = 1
                   AND @target_date = dbo.fn_get_next_working_day(@scheduled_date)
                   AND dbo.fn_is_non_working_day(@target_date) = 0
                BEGIN
                    SET @should_create = 1;
                END
            END
        END

        -- ════════════════════════════════════════════════════════
        -- CREATE INSTANCES with per-instance deadlines
        -- ════════════════════════════════════════════════════════
        IF @should_create = 1
        BEGIN
            -- Check if we already created entries for this task today
            IF NOT EXISTS (
                SELECT 1 FROM task_execution_log 
                WHERE task_id = @task_id 
                  AND CAST(created_at AS DATE) = @target_date
            )
            BEGIN
                -- Calculate deadline: today at 23:59:59
                DECLARE @instance_deadline DATETIME = CAST(
                    CAST(@target_date AS VARCHAR) + ' 23:59:59' AS DATETIME
                );

                -- Update the task_details end_date to this instance's deadline
                -- so that overdue calculation works correctly
                UPDATE task_details 
                SET task_end_date = @instance_deadline
                WHERE task_id = @task_id;

                -- Insert new execution log for ALL assigned employees
                INSERT INTO task_execution_log (
                    task_id, emp_id, assigned_by, status,
                    started_at, extended_date, rejection_count,
                    created_at, updated_at
                )
                SELECT DISTINCT
                    @task_id, 
                    orig.emp_id, 
                    orig.assigned_by, 
                    0,          -- ASSIGNED status
                    NULL, NULL, 0,
                    @now, @now
                FROM task_execution_log orig
                WHERE orig.task_id = @task_id
                  AND orig.id IN (
                      SELECT MIN(id) 
                      FROM task_execution_log 
                      WHERE task_id = @task_id 
                      GROUP BY emp_id
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM task_execution_log dup
                      WHERE dup.task_id = @task_id 
                        AND dup.emp_id = orig.emp_id
                        AND CAST(dup.created_at AS DATE) = @target_date
                  );

                -- Create audit history entries
                INSERT INTO task_execution_history (
                    execution_log_id, action_type, action_by,
                    remarks, extended_date, action_at
                )
                SELECT 
                    el.id, 0, el.assigned_by,
                    'Auto-assigned by recurring task scheduler',
                    NULL, @now
                FROM task_execution_log el
                WHERE el.task_id = @task_id
                  AND CAST(el.created_at AS DATE) = @target_date
                  AND NOT EXISTS (
                      SELECT 1 FROM task_execution_history h
                      WHERE h.execution_log_id = el.id
                  );

                SET @tasks_created = @tasks_created + 1;
            END
            ELSE
            BEGIN
                SET @tasks_skipped = @tasks_skipped + 1;
            END
        END

        FETCH NEXT FROM pattern_cursor INTO @task_id, @recurrence_type, @weekly_days, @monthly_day, @created_by, @task_start_date;
    END

    CLOSE pattern_cursor;
    DEALLOCATE pattern_cursor;

    SELECT 
        @tasks_created AS tasks_created, 
        @tasks_skipped AS tasks_skipped,
        'Recurring task generation complete for ' + CONVERT(VARCHAR, @target_date, 23) AS message;
END
GO
