USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_update_task_status]    Script Date: 28-02-2026 10:11:05 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER PROCEDURE [dbo].[sp_update_task_status]
    @task_id BIGINT,
    @emp_id BIGINT,
    @new_status INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Update task_status column
    UPDATE task_execution_log
    SET task_status = @new_status
    WHERE task_id = @task_id
      AND emp_id = @emp_id;

    -- Optional: return updated row
    SELECT *
    FROM task_execution_log
    WHERE task_id = @task_id
      AND emp_id = @emp_id;
END;