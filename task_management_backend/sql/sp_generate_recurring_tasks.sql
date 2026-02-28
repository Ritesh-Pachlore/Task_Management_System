USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_generate_recurring_tasks]    Script Date: 27-02-2026 12:46:26 ******/
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

        -- ════════════════════════════════════════════════════════
        -- DAILY (type '1' or 'DAILY')
        -- Logic: Assign every working day. Simply skip holidays.
        -- ════════════════════════════════════════════════════════
        -- ═══════════════════════════════════════════════════════════════
        -- REFACTORED: Iterate through each assigned employee to check 
        -- their specific working day schedule.
        -- ═══════════════════════════════════════════════════════════════
        DECLARE @emp_id_cur BIGINT;
        DECLARE @assigned_by_cur BIGINT;

        DECLARE emp_assign_cursor CURSOR FOR
            SELECT DISTINCT emp_id, assigned_by
            FROM task_execution_log
            WHERE task_id = @task_id
              AND id IN (
                  SELECT MIN(id) 
                  FROM task_execution_log 
                  WHERE task_id = @task_id 
                  GROUP BY emp_id
              );

        OPEN emp_assign_cursor;
        FETCH NEXT FROM emp_assign_cursor INTO @emp_id_cur, @assigned_by_cur;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @should_create = 0;

            -- ════════════════════════════════════════════════════════
            -- DAILY (type '1' or 'DAILY')
            -- ════════════════════════════════════════════════════════
            IF @recurrence_type IN ('1', 'DAILY')
            BEGIN
                IF dbo.fn_is_non_working_day(@target_date, @emp_id_cur) = 0
                    SET @should_create = 1;
            END

            -- ════════════════════════════════════════════════════════
            -- WEEKLY (type '2' or 'WEEKLY')
            -- ════════════════════════════════════════════════════════
            ELSE IF @recurrence_type IN ('2', 'WEEKLY')
            BEGIN
                DECLARE @check_day INT = 0;
                WHILE @check_day < 7
                BEGIN
                    DECLARE @candidate_date DATE = DATEADD(DAY, -@check_day, @target_date);
                    DECLARE @candidate_day_name VARCHAR(20) = DATENAME(WEEKDAY, @candidate_date);
                    
                    IF @weekly_days IS NOT NULL AND CHARINDEX(@candidate_day_name, @weekly_days) > 0
                    BEGIN
                        IF @check_day = 0 AND dbo.fn_is_non_working_day(@target_date, @emp_id_cur) = 0
                        BEGIN
                            SET @should_create = 1;
                        END
                        ELSE IF @check_day > 0
                        BEGIN
                            IF dbo.fn_is_non_working_day(@candidate_date, @emp_id_cur) = 1
                            BEGIN
                                IF @target_date = dbo.fn_get_next_working_day(@candidate_date, @emp_id_cur)
                                    SET @should_create = 1;
                            END
                        END
                        BREAK;
                    END
                    SET @check_day = @check_day + 1;
                END
            END

            -- ════════════════════════════════════════════════════════
            -- MONTHLY (type '3' or 'MONTHLY')
            -- ════════════════════════════════════════════════════════
            ELSE IF @recurrence_type IN ('3', 'MONTHLY')
            BEGIN
                DECLARE @scheduled_day INT = @monthly_day;
                DECLARE @days_in_month INT = DAY(EOMONTH(@target_date));
                IF @scheduled_day > @days_in_month SET @scheduled_day = @days_in_month;
                
                DECLARE @scheduled_date DATE = DATEFROMPARTS(YEAR(@target_date), MONTH(@target_date), @scheduled_day);
                
                IF @target_date = @scheduled_date
                BEGIN
                    IF dbo.fn_is_non_working_day(@target_date, @emp_id_cur) = 0
                        SET @should_create = 1;
                END
                ELSE IF @scheduled_date < @target_date
                   AND dbo.fn_is_non_working_day(@scheduled_date, @emp_id_cur) = 1
                   AND @target_date = dbo.fn_get_next_working_day(@scheduled_date, @emp_id_cur)
                BEGIN
                    SET @should_create = 1;
                END
            END

            -- Prevent duplicates on start date
            IF @target_date = @task_start_date SET @should_create = 0;

            -- ════════════════════════════════════════════════════════
            -- CREATE INSTANCE
            -- ════════════════════════════════════════════════════════
            IF @should_create = 1
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM task_execution_log 
                    WHERE task_id = @task_id 
                      AND emp_id = @emp_id_cur
                      AND CAST(created_at AS DATE) = @target_date
                )
                BEGIN
                    -- Deadline: today at 23:59:59 (Fixed lifecycle)
                    DECLARE @instance_deadline DATETIME = CAST(CAST(@target_date AS VARCHAR) + ' 23:59:59' AS DATETIME);

                    -- Update core task record end_date for audit/visibility
                    UPDATE task_details SET task_end_date = @instance_deadline WHERE task_id = @task_id;

                    INSERT INTO task_execution_log (
                        task_id, emp_id, assigned_by, status,
                        started_at, extended_date, rejection_count,
                        created_at, updated_at
                    )
                    VALUES (
                        @task_id, @emp_id_cur, @assigned_by_cur, 0,
                        NULL, NULL, 0, @now, @now
                    );

                    DECLARE @new_exec_id BIGINT = SCOPE_IDENTITY();

                    INSERT INTO task_execution_history (execution_log_id, action_type, action_by, remarks, action_at)
                    VALUES (@new_exec_id, 0, @assigned_by_cur, 'Auto-assigned by recurring task scheduler', @now);

                    SET @tasks_created = @tasks_created + 1;
                END
                ELSE
                BEGIN
                    SET @tasks_skipped = @tasks_skipped + 1;
                END
            END

            FETCH NEXT FROM emp_assign_cursor INTO @emp_id_cur, @assigned_by_cur;
        END

        CLOSE emp_assign_cursor;
        DEALLOCATE emp_assign_cursor;

        FETCH NEXT FROM pattern_cursor INTO @task_id, @recurrence_type, @weekly_days, @monthly_day, @created_by, @task_start_date;
    END

    CLOSE pattern_cursor;
    DEALLOCATE pattern_cursor;

    SELECT 
        @tasks_created AS tasks_created, 
        @tasks_skipped AS tasks_skipped,
        'Recurring task generation complete for ' + CONVERT(VARCHAR, @target_date, 23) AS message;
END
