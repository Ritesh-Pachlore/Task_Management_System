USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_generate_recurring_tasks]    Script Date: 28-02-2026 17:30:09 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[sp_generate_recurring_tasks]
    @target_date DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @target_date IS NULL
        SET @target_date = CAST(GETDATE() AS DATE);

    DECLARE @tasks_created INT = 0;
    DECLARE @tasks_skipped INT = 0;
    DECLARE @now DATETIME = GETDATE();

    DECLARE 
        @task_id BIGINT,
        @recurrence_type VARCHAR(10),
        @weekly_days VARCHAR(100),
        @monthly_day INT,
        @task_start_date DATE;

    ------------------------------------------------------------
    -- Cursor for recurrence patterns
    ------------------------------------------------------------
    DECLARE pattern_cursor CURSOR FOR
        SELECT 
            rp.task_id,
            rp.recurrence_type,
            rp.weekly_days,
            rp.monthly_day_of_month,
            CAST(td.task_start_date AS DATE)
        FROM dbo.recurrence_pattern rp
        INNER JOIN dbo.task_details td 
            ON rp.task_id = td.task_id
        WHERE td.is_active = 1
          AND rp.start_date <= @target_date
          AND (rp.end_date IS NULL OR rp.end_date >= @target_date);

    OPEN pattern_cursor;

    FETCH NEXT FROM pattern_cursor 
    INTO @task_id, @recurrence_type, @weekly_days, @monthly_day, @task_start_date;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @should_create BIT = 0;

        ------------------------------------------------------------
        -- DAILY
        ------------------------------------------------------------
        IF @recurrence_type IN ('1','DAILY')
        BEGIN
            IF dbo.fn_is_non_working_day(@target_date) = 0
                SET @should_create = 1;
        END

        ------------------------------------------------------------
        -- WEEKLY
        ------------------------------------------------------------
        ELSE IF @recurrence_type IN ('2','WEEKLY')
        BEGIN
            IF @weekly_days IS NOT NULL
               AND CHARINDEX(DATENAME(WEEKDAY, @target_date), @weekly_days) > 0
               AND dbo.fn_is_non_working_day(@target_date) = 0
            BEGIN
                SET @should_create = 1;
            END
        END

        ------------------------------------------------------------
        -- MONTHLY
        ------------------------------------------------------------
        ELSE IF @recurrence_type IN ('3','MONTHLY')
        BEGIN
            DECLARE @scheduled_day INT = @monthly_day;
            DECLARE @days_in_month INT = DAY(EOMONTH(@target_date));

            IF @scheduled_day > @days_in_month
                SET @scheduled_day = @days_in_month;

            IF DAY(@target_date) = @scheduled_day
               AND dbo.fn_is_non_working_day(@target_date) = 0
            BEGIN
                SET @should_create = 1;
            END
        END

        ------------------------------------------------------------
        -- Prevent duplicate on original start date
        ------------------------------------------------------------
        IF @target_date = @task_start_date
            SET @should_create = 0;

        ------------------------------------------------------------
        -- Create execution log
        ------------------------------------------------------------
        IF @should_create = 1
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.task_execution_log
                WHERE task_id = @task_id
                  AND CAST(created_at AS DATE) = @target_date
            )
            BEGIN
                INSERT INTO dbo.task_execution_log (
                    task_id,
                    emp_id,
                    assigned_by,
                    task_status,
                    started_at,
                    extended_date,
                    rejection_count,
                    created_at,
                    updated_at,
                    is_active
                )
                SELECT DISTINCT
                    @task_id,
                    orig.emp_id,
                    orig.assigned_by,
                    0,              -- ASSIGNED
                    NULL,
                    NULL,
                    0,
                    @now,
                    @now,
                    1
                FROM dbo.task_execution_log orig
                WHERE orig.task_id = @task_id
                  AND orig.id IN (
                        SELECT MIN(id)
                        FROM dbo.task_execution_log
                        WHERE task_id = @task_id
                        GROUP BY emp_id
                  );

                SET @tasks_created = @tasks_created + 1;
            END
            ELSE
            BEGIN
                SET @tasks_skipped = @tasks_skipped + 1;
            END
        END

        FETCH NEXT FROM pattern_cursor 
        INTO @task_id, @recurrence_type, @weekly_days, @monthly_day, @task_start_date;
    END

    CLOSE pattern_cursor;
    DEALLOCATE pattern_cursor;

    ------------------------------------------------------------
    -- Final result
    ------------------------------------------------------------
    SELECT 
        @tasks_created AS tasks_created,
        @tasks_skipped AS tasks_skipped,
        'Recurring task generation complete for '
        + CONVERT(VARCHAR, @target_date, 23) AS message;

END
