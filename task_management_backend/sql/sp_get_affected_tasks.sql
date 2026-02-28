USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_get_affected_tasks]    Script Date: 28-02-2026 10:09:27 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[sp_get_affected_tasks]
    @emp_id BIGINT,
    @view_type NVARCHAR(50) -- 'SELF' or 'ASSIGNED_BY_ME'
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        td.task_id,
        td.task_title,
        td.priority_type,
        CASE td.priority_type 
            WHEN 1 THEN 'LOW' 
            WHEN 2 THEN 'MEDIUM' 
            WHEN 3 THEN 'HIGH' 
        END AS priority_name,

        el.id AS execution_log_id,
        el.emp_id,
        (SELECT STF_FRNAME + ' ' + STF_LSNAME 
         FROM inout_aems..staffmst 
         WHERE EMP_ID = el.emp_id) AS emp_name,
        el.assigned_by,
        (SELECT STF_FRNAME + ' ' + STF_LSNAME 
         FROM inout_aems..staffmst 
         WHERE EMP_ID = el.assigned_by) AS assigned_by_name,

        el.task_status,
        CASE el.task_status
            WHEN 0 THEN 'ASSIGNED'
            WHEN 1 THEN 'STARTED'
            WHEN 2 THEN 'SUBMITTED'
            WHEN 4 THEN 'REJECTED'
            WHEN 5 THEN 'RESUBMITTED'
            WHEN 7 THEN 'ON_HOLD'
        END AS status_name,

        td.is_active AS task_is_active,
        el.is_active AS execution_is_active,

        COALESCE(el.extended_date, td.task_end_date) AS current_deadline,

        -- Reason why task is affected
        CASE 
            WHEN DATEPART(WEEKDAY, COALESCE(el.extended_date, td.task_end_date)) = 1
                THEN 'Sunday'
            ELSE (
                SELECT TOP 1 hm.Holiday_Desc
                FROM LPDATA..holiday_master hm
                WHERE hm.holiday_date = CAST(COALESCE(el.extended_date, td.task_end_date) AS DATE)
            )
        END AS reason,

        dbo.fn_get_next_working_day(COALESCE(el.extended_date, td.task_end_date)) AS suggested_date,

        DATEDIFF(DAY, GETDATE(), COALESCE(el.extended_date, td.task_end_date)) AS days_until_deadline

    FROM dbo.task_details td
    INNER JOIN dbo.task_execution_log el ON td.task_id = el.task_id
    WHERE td.is_active = 1
      AND el.is_active = 1
      AND el.task_status NOT IN (3,6)
      AND COALESCE(el.extended_date, td.task_end_date) >= GETDATE()
      AND dbo.fn_is_non_working_day(COALESCE(el.extended_date, td.task_end_date)) = 1
      AND (
            (@view_type = 'SELF' AND el.emp_id = @emp_id)
            OR (@view_type = 'ASSIGNED_BY_ME' AND el.assigned_by = @emp_id)
          )
    ORDER BY COALESCE(el.extended_date, td.task_end_date) ASC;
END
