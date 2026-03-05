USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_dashboard_counts]    Script Date: 02-03-2026 11:12:52 ******/
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

    ------------------------------------------------------------
    -- RESULT SET 1: Overall counts
    ------------------------------------------------------------
    SELECT
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN el.task_status IN (0, 8) THEN 1 ELSE 0 END) AS assigned_count,
        SUM(CASE WHEN el.task_status = 1 THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN el.task_status = 2 THEN 1 ELSE 0 END) AS submitted_count,
        SUM(CASE WHEN el.task_status = 3 THEN 1 ELSE 0 END) AS approved_count,
        SUM(CASE WHEN el.task_status = 4 THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN el.task_status = 6 THEN 1 ELSE 0 END) AS cancelled_count,
        SUM(CASE WHEN el.task_status IN (0, 4, 5, 8) THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN el.extended_date IS NOT NULL THEN 1 ELSE 0 END) AS extended_count,
        SUM(CASE WHEN COALESCE(el.extended_date, CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) < GETDATE()
                 AND el.task_status NOT IN (3, 6) THEN 1 ELSE 0 END) AS overdue_count,
        SUM(CASE WHEN el.task_status NOT IN (3, 6)
                 AND COALESCE(el.extended_date, CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) >= GETDATE()
                 AND dbo.fn_is_non_working_day(CAST(COALESCE(el.extended_date, CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) AS DATE), el.emp_id) = 1
                 THEN 1 ELSE 0 END) AS holiday_affected_count
    FROM task_execution_log el
    INNER JOIN task_details td ON el.task_id = td.task_id
    WHERE td.is_active = 1
      AND el.is_active = 1 -- ADDED: Filter inactive assignments
      AND el.task_status <> 6
      AND ((@view_type = 'SELF' AND el.emp_id = @emp_id)
           OR (@view_type = 'ASSIGNED_BY_ME' AND el.assigned_by = @emp_id))
      -- DE-DUPLICATE GROUP TASKS FOR MANAGER VIEW (Count as 1 if no employee filter)
      AND (@view_type <> 'ASSIGNED_BY_ME' OR @employee_id IS NOT NULL OR el.group_id IS NULL OR el.is_team_lead = 1
           OR (el.id = (SELECT MIN(el2.id) FROM task_execution_log el2 WHERE el2.task_id = el.task_id AND el2.group_id = el.group_id AND el2.is_active = 1)
               AND NOT EXISTS (SELECT 1 FROM task_execution_log el3 WHERE el3.task_id = el.task_id AND el3.group_id = el.group_id AND el3.is_team_lead = 1 AND el3.is_active = 1))
          )
      AND (@date_from IS NULL OR CAST(COALESCE(CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) AS DATE) >= @date_from)
      AND (@date_to   IS NULL OR CAST(COALESCE(CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) AS DATE) <= @date_to)
      AND (@employee_id IS NULL OR el.emp_id = @employee_id);


    ------------------------------------------------------------
    -- RESULT SET 2: Employee summary (ASSIGNED_BY_ME)
    ------------------------------------------------------------
    IF @view_type = 'ASSIGNED_BY_ME'
    BEGIN
        SELECT 
            el.emp_id,
            (SELECT STF_FRNAME + ' ' + STF_LSNAME 
             FROM inout_aems..staffmst 
             WHERE EMP_ID = el.emp_id) AS emp_name,

            COUNT(*) AS total_tasks,
            SUM(CASE WHEN el.task_status = 3 THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN el.task_status = 0 THEN 1 ELSE 0 END) AS pending,

            SUM(CASE 
                    WHEN COALESCE(el.extended_date, CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) < GETDATE()
                         AND el.task_status NOT IN (3,6)
                    THEN 1 ELSE 0
                END) AS overdue,

            SUM(CASE WHEN el.task_status = 4 THEN 1 ELSE 0 END) AS rejected,
            SUM(CASE WHEN el.extended_date IS NOT NULL THEN 1 ELSE 0 END) AS extended

        FROM task_execution_log el
        INNER JOIN task_details td ON el.task_id = td.task_id
        WHERE el.assigned_by = @emp_id 
          AND td.is_active = 1 
          AND el.is_active = 1 -- ADDED: Filter inactive assignments
          AND el.task_status <> 6
          AND (@date_from    IS NULL OR CAST(COALESCE(CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) AS DATE) >= @date_from)
          AND (@date_to      IS NULL OR CAST(COALESCE(CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) AS DATE) <= @date_to)
          AND (@employee_id  IS NULL OR el.emp_id = @employee_id)
        GROUP BY el.emp_id ORDER BY overdue DESC;
    END
    ELSE
    BEGIN
        SELECT NULL AS emp_id, NULL AS emp_name, NULL AS total_tasks,
               NULL AS completed, NULL AS pending, NULL AS overdue,
               NULL AS rejected, NULL AS extended WHERE 1 = 0;
    END

    ------------------------------------------------------------
    -- RESULT SET 3: Status chart (status 8 merged with status 0 as 'ASSIGNED')
    ------------------------------------------------------------
    SELECT
        CASE el.task_status WHEN 8 THEN 0 ELSE el.task_status END AS status,
        CASE CASE el.task_status WHEN 8 THEN 0 ELSE el.task_status END
            WHEN 0 THEN 'ASSIGNED'
            WHEN 1 THEN 'STARTED'
            WHEN 2 THEN 'SUBMITTED'
            WHEN 3 THEN 'APPROVED'
            WHEN 4 THEN 'REJECTED'
            WHEN 5 THEN 'RESUBMITTED'
            WHEN 6 THEN 'CANCELLED'
            WHEN 7 THEN 'ON HOLD'
        END AS status_name,
        COUNT(*) AS value,
        CASE CASE el.task_status WHEN 8 THEN 0 ELSE el.task_status END
            WHEN 0 THEN '#8884d8' WHEN 1 THEN '#82ca9d' WHEN 2 THEN '#ffc658'
            WHEN 3 THEN '#00C49F' WHEN 4 THEN '#FF6B6B' WHEN 5 THEN '#FFBB28'
            WHEN 6 THEN '#999999' WHEN 7 THEN '#673AB7' END AS color
    FROM task_execution_log el
    INNER JOIN task_details td ON el.task_id = td.task_id
    WHERE td.is_active = 1 AND el.task_status <> 6
      AND ((@view_type = 'SELF' AND el.emp_id = @emp_id)
           OR (@view_type = 'ASSIGNED_BY_ME' AND el.assigned_by = @emp_id))
      -- DE-DUPLICATE GROUP TASKS FOR MANAGER VIEW
      AND (@view_type <> 'ASSIGNED_BY_ME' OR @employee_id IS NOT NULL OR el.group_id IS NULL OR el.is_team_lead = 1
           OR (el.id = (SELECT MIN(el2.id) FROM task_execution_log el2 WHERE el2.task_id = el.task_id AND el2.group_id = el.group_id AND el2.is_active = 1)
               AND NOT EXISTS (SELECT 1 FROM task_execution_log el3 WHERE el3.task_id = el.task_id AND el3.group_id = el.group_id AND el3.is_team_lead = 1 AND el3.is_active = 1))
          )
      AND (@date_from   IS NULL OR CAST(COALESCE(CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) AS DATE) >= @date_from)
      AND (@date_to     IS NULL OR CAST(COALESCE(CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) AS DATE) <= @date_to)
      AND (@employee_id IS NULL OR el.emp_id = @employee_id)
    GROUP BY CASE el.task_status WHEN 8 THEN 0 ELSE el.task_status END;


    ------------------------------------------------------------
    -- RESULT SET 4: Priority chart
    ------------------------------------------------------------
    SELECT
        CASE td.priority_type
            WHEN 1 THEN 'Low'
            WHEN 2 THEN 'Medium'
            WHEN 3 THEN 'High'
        END AS name,

        COUNT(*) AS total,
        SUM(CASE WHEN el.task_status = 3 THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN el.task_status NOT IN (3,6) THEN 1 ELSE 0 END) AS pending

    FROM task_execution_log el
    INNER JOIN task_details td ON el.task_id = td.task_id
    WHERE td.is_active = 1 AND el.task_status <> 6
      AND ((@view_type = 'SELF' AND el.emp_id = @emp_id)
           OR (@view_type = 'ASSIGNED_BY_ME' AND el.assigned_by = @emp_id))
      -- DE-DUPLICATE GROUP TASKS FOR MANAGER VIEW
      AND (@view_type <> 'ASSIGNED_BY_ME' OR @employee_id IS NOT NULL OR el.group_id IS NULL OR el.is_team_lead = 1
           OR (el.id = (SELECT MIN(el2.id) FROM task_execution_log el2 WHERE el2.task_id = el.task_id AND el2.group_id = el.group_id AND el2.is_active = 1)
               AND NOT EXISTS (SELECT 1 FROM task_execution_log el3 WHERE el3.task_id = el.task_id AND el3.group_id = el.group_id AND el3.is_team_lead = 1 AND el3.is_active = 1))
          )
      AND (@date_from   IS NULL OR CAST(COALESCE(CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) AS DATE) >= @date_from)
      AND (@date_to     IS NULL OR CAST(COALESCE(CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) AS DATE) <= @date_to)
      AND (@employee_id IS NULL OR el.emp_id = @employee_id)
    GROUP BY td.priority_type
    ORDER BY td.priority_type;


    ------------------------------------------------------------
    -- RESULT SET 5: Monthly trend
    ------------------------------------------------------------
    SELECT
        FORMAT(el.created_at, 'MMM yyyy') AS name,
        FORMAT(el.created_at, 'yyyy-MM') AS sort_key,

        COUNT(*) AS assigned,
        SUM(CASE WHEN el.task_status = 3 THEN 1 ELSE 0 END) AS completed,

        SUM(CASE 
                WHEN COALESCE(el.extended_date, CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) < GETDATE()
                     AND el.task_status NOT IN (3,6)
                THEN 1 ELSE 0
            END) AS overdue

    FROM task_execution_log el
    INNER JOIN task_details td ON el.task_id = td.task_id
    WHERE td.is_active = 1 AND el.task_status <> 6
      AND ((@view_type = 'SELF' AND el.emp_id = @emp_id)
           OR (@view_type = 'ASSIGNED_BY_ME' AND el.assigned_by = @emp_id))
      -- DE-DUPLICATE GROUP TASKS FOR MANAGER VIEW
      AND (@view_type <> 'ASSIGNED_BY_ME' OR @employee_id IS NOT NULL OR el.group_id IS NULL OR el.is_team_lead = 1
           OR (el.id = (SELECT MIN(el2.id) FROM task_execution_log el2 WHERE el2.task_id = el.task_id AND el2.group_id = el.group_id AND el2.is_active = 1)
               AND NOT EXISTS (SELECT 1 FROM task_execution_log el3 WHERE el3.task_id = el.task_id AND el3.group_id = el.group_id AND el3.is_team_lead = 1 AND el3.is_active = 1))
          )
      AND (@date_from   IS NULL OR CAST(COALESCE(CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) AS DATE) >= @date_from)
      AND (@date_to     IS NULL OR CAST(COALESCE(CASE WHEN el.instance_deadline > '2099-12-31' THEN NULL ELSE el.instance_deadline END, CASE WHEN td.task_type IN (1,2,3) THEN DATEADD(SECOND, 86399, CAST(CAST(el.created_at AS DATE) AS DATETIME)) ELSE td.task_end_date END) AS DATE) <= @date_to)
      AND (@employee_id IS NULL OR el.emp_id = @employee_id)
    GROUP BY FORMAT(el.created_at, 'MMM yyyy'),
             FORMAT(el.created_at, 'yyyy-MM')
    ORDER BY sort_key;

END