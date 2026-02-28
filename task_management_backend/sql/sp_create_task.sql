USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_create_task]    Script Date: 27-02-2026 12:42:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[sp_create_task]
    @task_title            NVARCHAR(255),
    @task_description      NVARCHAR(MAX),
    @task_type             INT,
    @priority_type         INT,
    @task_start_date       DATE,
    @task_start_time       NVARCHAR(10) = NULL,
    @task_end_date         DATE,
    @task_end_time         NVARCHAR(10) = NULL,
    @created_by            BIGINT,
    @emp_list              NVARCHAR(MAX),

    -- Recurrence parameters
    @recurrence_type       VARCHAR(10)  = NULL,
    @recurrence_end_date   DATE         = NULL,
    @weekly_days           VARCHAR(100) = NULL,
    @monthly_day_of_month  INT          = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @task_id          BIGINT;
    DECLARE @exec_log_id      BIGINT;
    DECLARE @now              DATETIME = GETDATE();
    DECLARE @emp_id           BIGINT;
    DECLARE @final_start_dt   DATETIME;
    DECLARE @final_end_dt     DATETIME;

    -- ─────────────────────────────────────────────
    -- Combine date + time
    -- ─────────────────────────────────────────────
    IF @task_type = 5  -- TIME_BOUND
    BEGIN
        SET @final_start_dt = CAST(@task_start_date AS DATETIME)
                            + ISNULL(CAST(@task_start_time AS DATETIME), 0);

        SET @final_end_dt   = CAST(@task_end_date AS DATETIME)
                            + ISNULL(CAST(@task_end_time AS DATETIME), 0);
    END
    ELSE IF @task_type = 1 -- DAILY
    BEGIN
        SET @final_start_dt = CAST(@task_start_date AS DATETIME);
        SET @final_end_dt   = DATEADD(SECOND, 86399, CAST(@task_start_date AS DATETIME));
    END
    ELSE
    BEGIN
        SET @final_start_dt = CAST(@task_start_date AS DATETIME);
        SET @final_end_dt   = CAST(@task_end_date   AS DATETIME);
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        -- ─────────────────────────────────────────────
        -- Insert Task Master
        -- ─────────────────────────────────────────────
        INSERT INTO task_details (
            task_title, task_description, task_type,
            priority_type, task_start_date, task_end_date,
            created_by, is_active, created_at, updated_at
        )
        VALUES (
            @task_title, @task_description, @task_type,
            @priority_type, @final_start_dt, @final_end_dt,
            @created_by, 1, @now, @now
        );

        SET @task_id = SCOPE_IDENTITY();

        -- ─────────────────────────────────────────────
        -- Insert Recurrence Pattern (if applicable)
        -- ─────────────────────────────────────────────
        IF @task_type IN (1,2,3) AND @recurrence_type IS NOT NULL
        BEGIN
            INSERT INTO recurrence_pattern (
                task_id, recurrence_type, start_date, end_date,
                weekly_days, monthly_day_of_month,
                created_at, updated_at
            )
            VALUES (
                @task_id, @recurrence_type,
                @task_start_date, @recurrence_end_date,
                @weekly_days, @monthly_day_of_month,
                @now, @now
            );
        END

        -- ─────────────────────────────────────────────
        -- First Instance Assignment Logic
        -- ─────────────────────────────────────────────
       -- DECLARE @should_assign BIT = 0;
		 DECLARE @should_assign BIT = 1;

     --   IF @task_type NOT IN (1,2,3)
     --       SET @should_assign = 1;
     --   ELSE IF CAST(GETDATE() AS DATE) >= @task_start_date
     --           AND dbo.fn_is_non_working_day(CAST(GETDATE() AS DATE)) = 0
     --       SET @should_assign = 1;

        IF @should_assign = 1
        BEGIN
            DECLARE emp_cursor CURSOR FOR
                SELECT CAST(TRIM(value) AS BIGINT)
                FROM STRING_SPLIT(@emp_list, ',')
                WHERE TRIM(value) <> '';

            OPEN emp_cursor;
            FETCH NEXT FROM emp_cursor INTO @emp_id;

            WHILE @@FETCH_STATUS = 0
            BEGIN
                INSERT INTO task_execution_log (
                    task_id, emp_id, assigned_by, status,
                    started_at, extended_date, rejection_count,
                    created_at, updated_at
                )
                VALUES (
                    @task_id, @emp_id, @created_by, 0,
                    NULL, NULL, 0, @now, @now
                );

                SET @exec_log_id = SCOPE_IDENTITY();

                INSERT INTO task_execution_history (
                    execution_log_id,
                    action_type,
                    action_by,
                    remarks,
                    --extended_date,
                    action_at
                )
                VALUES (
                    @exec_log_id,
                    0,
                    @created_by,
                    'Task assigned',
                 --   NULL,
                    @now
                );

                FETCH NEXT FROM emp_cursor INTO @emp_id;
            END

            CLOSE emp_cursor;
            DEALLOCATE emp_cursor;
        END

        COMMIT TRANSACTION;

        SELECT 
            @task_id        AS task_id,
            'Task created successfully' AS message,
            1               AS success,
            @final_start_dt AS saved_start_datetime,
            @final_end_dt   AS saved_end_datetime;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        IF CURSOR_STATUS('global','emp_cursor') >= 0
        BEGIN
            CLOSE emp_cursor;
            DEALLOCATE emp_cursor;
        END

        SELECT 
            0               AS task_id,
            ERROR_MESSAGE() AS message,
            0               AS success,
            NULL            AS saved_start_datetime,
            NULL            AS saved_end_datetime;
    END CATCH
END
    
