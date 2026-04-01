USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_remove_employee_from_task]    Script Date: 28-02-2026 17:31:10 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[sp_remove_employee_from_task]
    @task_id BIGINT,
    @emp_id  BIGINT,
    @removed_by BIGINT  -- the manager doing the removal
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1️⃣ Mark the employee's task assignment as inactive
        UPDATE task_execution_log
        SET is_active = 0,
            updated_at = GETDATE()
        WHERE task_id = @task_id
          AND emp_id = @emp_id;

        -- 2️⃣ Optional: Insert a history record for audit
        DECLARE @exec_log_id BIGINT;

        SELECT @exec_log_id = id
        FROM task_execution_log
        WHERE task_id = @task_id
          AND emp_id = @emp_id;

        IF @exec_log_id IS NOT NULL
        BEGIN
            INSERT INTO task_execution_history (
                execution_log_id,
                action_type,    -- 0=assigned, 1=updated, 2=removed, etc.
                action_by,
                remarks,
                action_at
            )
            VALUES (
                @exec_log_id,
                2,             -- 2 = removed
                @removed_by,
                'Task removed by manager',
                GETDATE()
            );
        END

        COMMIT TRANSACTION;

        SELECT 1 AS success, 'Employee removed from task successfully.' AS message;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        SELECT 0 AS success, ERROR_MESSAGE() AS message;
    END CATCH
END