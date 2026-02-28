USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_dashboard_counts]    Script Date: 28-02-2026 10:07:01 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[sp_dashboard_counts]
    @emp_id      BIGINT,
    @view_type   NVARCHAR(50),
    @date_from   DATE = NULL,
    @date_to     DATE = NULL,
    @employee_id BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    ----------------------------------------
    -- RESULT SET 1: Overall counts
    ----------------------------------------
    SELECT
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN el.task_status = 0 THEN 1 ELSE 0 END) AS assigned_count,
        SUM(CASE WHEN el.task_status IN (1, 5) THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN el.task_status = 2 THEN 1 ELSE 0 END) AS submitted_count,
        SUM(CASE WHEN el.task_status = 3 THEN 1 ELSE 0 END) AS approved_count,
        SUM(CASE WHEN el.task_status = 4 THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN el.task_status = 6 THEN 1 ELSE 0 END) AS cancelled_count,
        SUM(CASE WHEN el.task_status IN (0, 1, 2, 5, 7) THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN el.extended_date IS NOT NULL THEN 1 ELSE 0 END) AS extended_count,
        SUM(CASE WHEN COALESCE(el.extended_date, td.task_end_date) < GETDATE()
                 AND el.task_status NOT IN (3, 6) THEN 1 ELSE 0 END) AS overdue_count,
        SUM(CASE WHEN el.task_status NOT IN (3, 6)
                 AND COALESCE(el.extended_date, td.task_end_date) >= GETDATE()
                 AND dbo.fn_is_non_working_day(CAST(COALESCE(el.extended_date, td.task_end_date) AS DATE)) = 1
                 THEN 1 ELSE 0 END) AS holiday_affected_count
    FROM task_execution_log el
    INNER JOIN task_details td ON el.task_id = td.task_id
    WHERE td.is_active = 1 AND el.is_active = 1
      AND ((@view_type = 'SELF' AND el.emp_id = @emp_id)
           OR (@view_type = 'ASSIGNED_BY_ME' AND el.assigned_by = @emp_id))
      AND (@date_from IS NULL OR CAST(td.task_end_date AS DATE) >= @date_from)
      AND (@date_to   IS NULL OR CAST(td.task_end_date AS DATE) <= @date_to)
      AND (@employee_id IS NULL OR el.emp_id = @employee_id);

    ----------------------------------------
    -- RESULT SET 2: Employee summary (Assigned by Me)
    ----------------------------------------
    IF @view_type = 'ASSIGNED_BY_ME'
    BEGIN
        SELECT 
            el.emp_id,
            (s.STF_FRNAME + ' ' + s.STF_LSNAME) AS emp_name,
            ISNULL(d.DEP_NAME, 'N/A') AS emp_department,   -- Added department
            COUNT(*) AS total_tasks,
            SUM(CASE WHEN el.task_status = 3 THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN el.task_status IN (0,1,2,5) THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN COALESCE(el.extended_date, td.task_end_date) < GETDATE()
                     AND el.task_status NOT IN (3, 6) THEN 1 ELSE 0 END) AS overdue,
            SUM(CASE WHEN el.task_status = 4 THEN 1 ELSE 0 END) AS rejected,
            SUM(CASE WHEN el.extended_date IS NOT NULL THEN 1 ELSE 0 END) AS extended
        FROM task_execution_log el
        INNER JOIN task_details td ON el.task_id = td.task_id
        INNER JOIN inout_aems..staffmst s ON s.EMP_ID = el.emp_id
        LEFT JOIN inout_aems..deptmst d ON d.DEP_ID = s.DEP_ID
        WHERE el.assigned_by = @emp_id AND td.is_active = 1 AND el.is_active = 1
          AND (@date_from    IS NULL OR CAST(td.task_end_date AS DATE) >= @date_from)
          AND (@date_to      IS NULL OR CAST(td.task_end_date AS DATE) <= @date_to)
          AND (@employee_id  IS NULL OR el.emp_id = @employee_id)
        GROUP BY el.emp_id, s.STF_FRNAME, s.STF_LSNAME, d.DEP_NAME
        ORDER BY overdue DESC;
    END
    ELSE
        SELECT NULL AS emp_id, NULL AS emp_name, NULL AS emp_department, NULL AS total_tasks,
               NULL AS completed, NULL AS pending, NULL AS overdue,
               NULL AS rejected, NULL AS extended WHERE 1 = 0;

    ----------------------------------------
    -- RESULT SET 3: Status chart
    ----------------------------------------
    SELECT
        CASE el.task_status WHEN 0 THEN 'Pending' WHEN 1 THEN 'Started' WHEN 2 THEN 'Submitted'
            WHEN 3 THEN 'Approved' WHEN 4 THEN 'Rejected' WHEN 5 THEN 'Resubmitted'
            WHEN 6 THEN 'Cancelled' WHEN 7 THEN 'On Hold' END AS name,
        COUNT(*) AS value,
        CASE el.task_status WHEN 0 THEN '#8884d8' WHEN 1 THEN '#82ca9d' WHEN 2 THEN '#ffc658'
            WHEN 3 THEN '#00C49F' WHEN 4 THEN '#FF6B6B' WHEN 5 THEN '#FFBB28'
            WHEN 6 THEN '#999999' WHEN 7 THEN '#FF8042' END AS color
    FROM task_execution_log el
    INNER JOIN task_details td ON el.task_id = td.task_id
    WHERE td.is_active = 1 AND el.is_active = 1
      AND ((@view_type = 'SELF' AND el.emp_id = @emp_id)
           OR (@view_type = 'ASSIGNED_BY_ME' AND el.assigned_by = @emp_id))
      AND (@date_from   IS NULL OR CAST(td.task_end_date AS DATE) >= @date_from)
      AND (@date_to     IS NULL OR CAST(td.task_end_date AS DATE) <= @date_to)
      AND (@employee_id IS NULL OR el.emp_id = @employee_id)
    GROUP BY el.task_status;

    ----------------------------------------
    -- RESULT SET 4: Priority chart
    ----------------------------------------
    SELECT
        CASE td.priority_type WHEN 1 THEN 'Low' WHEN 2 THEN 'Medium' WHEN 3 THEN 'High' END AS name,
        COUNT(*) AS total,
        SUM(CASE WHEN el.task_status = 3 THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN el.task_status NOT IN (3, 6) THEN 1 ELSE 0 END) AS pending
    FROM task_execution_log el
    INNER JOIN task_details td ON el.task_id = td.task_id
    WHERE td.is_active = 1 AND el.is_active = 1
      AND ((@view_type = 'SELF' AND el.emp_id = @emp_id)
           OR (@view_type = 'ASSIGNED_BY_ME' AND el.assigned_by = @emp_id))
      AND (@date_from   IS NULL OR CAST(td.task_end_date AS DATE) >= @date_from)
      AND (@date_to     IS NULL OR CAST(td.task_end_date AS DATE) <= @date_to)
      AND (@employee_id IS NULL OR el.emp_id = @employee_id)
    GROUP BY td.priority_type
    ORDER BY td.priority_type;

    ----------------------------------------
    -- RESULT SET 5: Monthly trend
    ----------------------------------------
    SELECT
        FORMAT(el.created_at, 'MMM yyyy') AS name,
        FORMAT(el.created_at, 'yyyy-MM') AS sort_key,
        COUNT(*) AS assigned,
        SUM(CASE WHEN el.task_status = 3 THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN COALESCE(el.extended_date, td.task_end_date) < GETDATE()
                 AND el.task_status NOT IN (3, 6) THEN 1 ELSE 0 END) AS overdue
    FROM task_execution_log el
    INNER JOIN task_details td ON el.task_id = td.task_id
    WHERE td.is_active = 1 AND el.is_active = 1
      AND ((@view_type = 'SELF' AND el.emp_id = @emp_id)
           OR (@view_type = 'ASSIGNED_BY_ME' AND el.assigned_by = @emp_id))
      AND (@date_from   IS NULL OR CAST(td.task_end_date AS DATE) >= @date_from)
      AND (@date_to     IS NULL OR CAST(td.task_end_date AS DATE) <= @date_to)
      AND (@employee_id IS NULL OR el.emp_id = @employee_id)
    GROUP BY FORMAT(el.created_at, 'MMM yyyy'), FORMAT(el.created_at, 'yyyy-MM')
    ORDER BY sort_key;
END