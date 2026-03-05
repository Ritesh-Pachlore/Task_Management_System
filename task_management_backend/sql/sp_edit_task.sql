USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_edit_task]    Script Date: 02-03-2026 11:13:07 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER PROCEDURE [dbo].[sp_edit_task]
    @execution_log_id BIGINT,
    @title NVARCHAR(255),
    @description NVARCHAR(MAX),
    @emp_list NVARCHAR(MAX) = NULL,
    @deadline DATETIME = NULL,
    @team_lead_emp_id BIGINT = NULL -- NEW: 6th parameter
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @task_id BIGINT;

        -- ✅ Correct column name (id)
        SELECT @task_id = task_id
        FROM dbo.task_execution_log
        WHERE id = @execution_log_id;

        IF @task_id IS NULL
        BEGIN
            RAISERROR('Execution log not found', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- ✅ Correct column names in task_details
        UPDATE dbo.task_details
        SET task_title = @title,
            task_description = @description,
            updated_at = GETDATE()
        WHERE task_id = @task_id;

        -- ✅ Update deadline properly
        IF @deadline IS NOT NULL
        BEGIN
            UPDATE dbo.task_execution_log
            SET extended_date = @deadline,
                instance_deadline = @deadline, -- Sync with instance_deadline
                updated_at = GETDATE()
            WHERE id = @execution_log_id;

            -- Update main task boundary ONLY if it's NOT a recurring task
            -- For types 1, 2, 3, task_end_date is the "Task Life" (reassignment boundary)
            UPDATE td
            SET td.task_end_date = @deadline,
                td.updated_at = GETDATE()
            FROM dbo.task_details td
            INNER JOIN dbo.task_execution_log el ON td.task_id = el.task_id
            WHERE el.id = @execution_log_id
              AND td.task_type NOT IN (1, 2, 3);
        END

        -- ✅ Handle employee assignment changes
        IF @emp_list IS NOT NULL
        BEGIN
            DECLARE @emp_table TABLE (emp_id BIGINT);
            
            IF LTRIM(RTRIM(@emp_list)) <> ''
            BEGIN
                INSERT INTO @emp_table (emp_id)
                SELECT CAST(TRIM(value) AS BIGINT)
                FROM STRING_SPLIT(@emp_list, ',')
                WHERE TRIM(value) <> '';
            END

            -- Set is_active = 0 AND is_team_lead = 0 for employees removed from the task
            UPDATE dbo.task_execution_log
            SET is_active = 0,
                is_team_lead = 0, -- Ensure they are no longer lead if removed
                updated_at = GETDATE()
            WHERE task_id = @task_id
              AND emp_id NOT IN (SELECT emp_id FROM @emp_table)
              AND is_active = 1;

            -- Set is_active = 1 for employees re-added to the task
            UPDATE dbo.task_execution_log
            SET is_active = 1,
                updated_at = GETDATE()
            WHERE task_id = @task_id
              AND emp_id IN (SELECT emp_id FROM @emp_table)
              AND is_active = 0;

            -- Get manager ID from the current execution_log
            DECLARE @manager_id BIGINT;
            SELECT @manager_id = assigned_by FROM dbo.task_execution_log WHERE id = @execution_log_id;

            -- Insert brand new employees into task_execution_log
            INSERT INTO dbo.task_execution_log (task_id, emp_id, assigned_by, task_status, is_active, is_team_lead)
            SELECT @task_id, e.emp_id, @manager_id, 0, 1, 0
            FROM @emp_table e
            WHERE NOT EXISTS (
                SELECT 1 FROM dbo.task_execution_log t 
                WHERE t.task_id = @task_id AND t.emp_id = e.emp_id
            );
        END

        -- ✅ Handle Team Lead reassignment
        IF @team_lead_emp_id IS NOT NULL
        BEGIN
            -- Reset all leads for this task
            UPDATE dbo.task_execution_log
            SET is_team_lead = 0
            WHERE task_id = @task_id;

            -- Set new lead
            UPDATE dbo.task_execution_log
            SET is_team_lead = 1,
                is_active = 1 -- Ensure lead is active
            WHERE task_id = @task_id 
              AND emp_id = @team_lead_emp_id;
        END

        COMMIT TRANSACTION;

        SELECT 'Task edited successfully' AS message, 1 AS success;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;

        SELECT ERROR_MESSAGE() AS message, 0 AS success;
    END CATCH
END
