USE [DButilities]
GO

/****** Object:  StoredProcedure [dbo].[sp_get_task_history]    Script Date: 20-02-2026 11:38:56 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO


CREATE PROCEDURE [dbo].[sp_get_task_history]
    @execution_log_id BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        h.id,
        h.execution_log_id,
        h.action_type,
        CASE h.action_type
            WHEN 0 THEN 'ASSIGNED' WHEN 1 THEN 'STARTED'
            WHEN 2 THEN 'SUBMITTED' WHEN 3 THEN 'APPROVED'
            WHEN 4 THEN 'REJECTED' WHEN 5 THEN 'RESUBMITTED'
            WHEN 6 THEN 'CANCELLED' WHEN 7 THEN 'EXTENDED'
        END AS action_name,
        h.action_by,
        (SELECT STF_FRNAME + ' ' + STF_LSNAME 
         FROM inout_aems..staffmst WHERE EMP_ID = h.action_by
        ) AS action_by_name,
        h.remarks,
        h.action_at
    FROM task_execution_history h
    INNER JOIN task_execution_log el ON h.execution_log_id = el.id
    INNER JOIN task_details td ON el.task_id = td.task_id
    WHERE h.execution_log_id = @execution_log_id
      AND td.is_active = 1
      AND el.status <> 6
    ORDER BY h.action_at ASC;
END
GO

