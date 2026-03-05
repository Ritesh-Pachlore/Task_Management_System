USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_create_task]    Script Date: 02-03-2026 11:12:32 ******/
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
    @monthly_day_of_month  INT          = NULL,

    -- Group Task parameters
    @assign_mode           NVARCHAR(10) = 'INDIVIDUAL', -- 'GROUP' or 'INDIVIDUAL'
    @team_lead_emp_id      BIGINT       = NULL
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
    DECLARE @instance_deadline DATETIME = NULL;

    IF @task_type = 5  -- TIME_BOUND
    BEGIN
        SET @final_start_dt = CAST(@task_start_date AS DATETIME)
                            + ISNULL(CAST(@task_start_time AS DATETIME), 0);

        SET @final_end_dt   = CAST(@task_end_date AS DATETIME)
                            + ISNULL(CAST(@task_end_time AS DATETIME), 0);
        
        SET @instance_deadline = NULL; -- Type 5 uses task_end_date logic
    END
    ELSE IF @task_type IN (1, 2, 3) -- DAILY, WEEKLY, MONTHLY
    BEGIN
        SET @final_start_dt = CAST(@task_start_date AS DATETIME);
        -- Task Life: Use @task_end_date if provided, else Infinite
        SET @final_end_dt   = COALESCE(CAST(@task_end_date AS DATETIME), '3000-12-31 23:59:59');
        -- Instance Life: Strict same-day deadline
        SET @instance_deadline = DATEADD(SECOND, 86399, CAST(@task_start_date AS DATETIME));
    END
    ELSE -- RANDOM (4)
    BEGIN
        SET @final_start_dt = CAST(@task_start_date AS DATETIME);
        SET @final_end_dt   = CAST(@task_end_date   AS DATETIME);
        SET @instance_deadline = NULL; -- Type 4 uses task_end_date logic
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
     --           AND dbo.fn_is_non_working_day(CAST(GETDATE() AS DATE), @emp_id) = 0
     --       SET @should_assign = 1;

        IF @should_assign = 1
        BEGIN
            -- Generate ONE numeric group_id for the entire group
            DECLARE @group_id_val BIGINT = NULL;

            IF @assign_mode = 'GROUP'
            BEGIN
                SELECT @group_id_val = ISNULL(MAX(group_id), 0) + 1 FROM task_execution_log;
            END

            DECLARE emp_cursor CURSOR FOR
                SELECT CAST(TRIM(value) AS BIGINT)
                FROM STRING_SPLIT(@emp_list, ',')
                WHERE TRIM(value) <> '';

            OPEN emp_cursor;
            FETCH NEXT FROM emp_cursor INTO @emp_id;

            WHILE @@FETCH_STATUS = 0
            BEGIN
                INSERT INTO task_execution_log (
                    task_id, emp_id, assigned_by, task_status,
                    started_at, extended_date, instance_deadline, rejection_count,
                    group_id, is_team_lead, is_active,
                    created_at, updated_at
                )
                VALUES (
                    @task_id, @emp_id, @created_by, 0,
                    NULL, NULL, @instance_deadline, 0,
                    @group_id_val,
                    CASE WHEN @assign_mode = 'GROUP' AND @emp_id = @team_lead_emp_id THEN 1 ELSE 0 END,
                    1,
                    @now, @now
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
    
