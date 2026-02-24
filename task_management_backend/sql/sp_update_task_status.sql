USE [DButilities]
GO

ALTER PROCEDURE [dbo].[sp_update_task_status]
    @execution_log_id  BIGINT,
    @action_type       INT,
    @action_by         BIGINT,
    @remarks           NVARCHAR(MAX),
    @extended_date     DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @now DATETIME = GETDATE();
    DECLARE @current_status INT;
    DECLARE @new_status INT;
    DECLARE @task_id BIGINT;
    DECLARE @emp_id BIGINT;
    DECLARE @assigned_by BIGINT;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @current_status = status,
            @task_id = task_id,
            @emp_id = emp_id,
            @assigned_by = assigned_by
        FROM task_execution_log
        WHERE id = @execution_log_id;

        IF @current_status IS NULL
        BEGIN
            SELECT 'Execution log not found' AS message, 0 AS success,
                   NULL AS task_id, NULL AS emp_id, NULL AS assigned_by,
                   NULL AS action_type, NULL AS new_status;
            ROLLBACK;
            RETURN;
        END

        -- Determine new status
        SET @new_status = CASE @action_type
            WHEN 1 THEN 1  -- Started
            WHEN 2 THEN 2
            WHEN 3 THEN 3  -- Completed
            WHEN 4 THEN 4  -- Rejected
            WHEN 5 THEN 5
            WHEN 6 THEN 6
            WHEN 7 THEN 7
            WHEN 8 THEN @current_status -- Extended (status unchanged)
            ELSE -1
        END;

        IF @new_status = -1
        BEGIN
            SELECT 'Invalid action type' AS message, 0 AS success,
                   NULL AS task_id, NULL AS emp_id, NULL AS assigned_by,
                   NULL AS action_type, NULL AS new_status;
            ROLLBACK;
            RETURN;
        END

        -- STARTED
        IF @action_type = 1  
        BEGIN
            UPDATE task_execution_log
            SET status = @new_status,
                started_at = CASE WHEN started_at IS NULL THEN @now ELSE started_at END,
                updated_at = @now
            WHERE id = @execution_log_id;
        END

        -- REJECTED
        ELSE IF @action_type = 4  
        BEGIN
            UPDATE task_execution_log
            SET status = @new_status,
                rejection_count = rejection_count + 1,
                updated_at = @now
            WHERE id = @execution_log_id;
        END

        -- EXTENDED
        ELSE IF @action_type = 8  
        BEGIN
            IF @extended_date IS NULL
            BEGIN
                SELECT 'Extended date required' AS message, 0 AS success,
                       NULL AS task_id, NULL AS emp_id, NULL AS assigned_by,
                       NULL AS action_type, NULL AS new_status;
                ROLLBACK;
                RETURN;
            END

            UPDATE task_execution_log
            SET extended_date = @extended_date,
                updated_at = @now
            WHERE id = @execution_log_id;
        END

        -- ALL OTHER STATUS CHANGES
        ELSE
        BEGIN
            UPDATE task_execution_log
            SET status = @new_status,
                updated_at = @now
            WHERE id = @execution_log_id;
        END

        -- Insert into history with smart default remarks
        INSERT INTO task_execution_history (
            execution_log_id,
            action_type,
            action_by,
            remarks,
            action_at
        )
        VALUES (
            @execution_log_id,
            @action_type,
            @action_by,
            CASE
                -- EXTENDED
                WHEN @action_type = 8 THEN
                    CONCAT('Deadline extended to ',
                           CONVERT(VARCHAR, @extended_date, 120),
                           CASE WHEN @remarks IS NOT NULL
                                    AND LTRIM(RTRIM(@remarks)) <> ''
                                THEN CONCAT(' - ', @remarks)
                                ELSE ''
                           END)

                -- STARTED default
                WHEN @action_type = 1
                     AND (@remarks IS NULL OR LTRIM(RTRIM(@remarks)) = '')
                     THEN 'Task started'

                -- REJECTED default
                WHEN @action_type = 4
                     AND (@remarks IS NULL OR LTRIM(RTRIM(@remarks)) = '')
                     THEN 'Task rejected'

                -- COMPLETED default
                WHEN @action_type = 3
                     AND (@remarks IS NULL OR LTRIM(RTRIM(@remarks)) = '')
                     THEN 'Task completed'

                -- Default
                ELSE @remarks
            END,
            @now
        );

        COMMIT;

        SELECT 'Status updated successfully' AS message, 1 AS success,
               @task_id AS task_id,
               @emp_id AS emp_id,
               @assigned_by AS assigned_by,
               @action_type AS action_type,
               @new_status AS new_status;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK;

        SELECT ERROR_MESSAGE() AS message, 0 AS success,
               NULL AS task_id, NULL AS emp_id, NULL AS assigned_by,
               NULL AS action_type, NULL AS new_status;
    END CATCH
END
GO