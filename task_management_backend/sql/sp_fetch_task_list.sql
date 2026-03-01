USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_fetch_task_list]    Script Date: 01-03-2026 16:08:07 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[sp_fetch_task_list]
    @emp_id               BIGINT,
    @view_type            NVARCHAR(50),
    @filter_status        INT           = NULL,
    @filter_priority      INT           = NULL,
    @filter_task_type     INT           = NULL,
    @filter_employee_id   BIGINT        = NULL,
    @filter_date_from     DATETIME      = NULL,
    @filter_date_to       DATETIME      = NULL,
    @filter_overdue_only  BIT           = 0,
    @filter_extended_only BIT           = 0,
    @filter_search        NVARCHAR(255) = NULL,
    @filter_group         NVARCHAR(50)  = NULL -- New: 'PENDING', etc.
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        td.task_id,
        td.task_title,
        td.task_description,
        td.task_type,
        CASE td.task_type
            WHEN 1 THEN 'DAILY'
            WHEN 2 THEN 'WEEKLY'
            WHEN 3 THEN 'MONTHLY'
            WHEN 4 THEN 'RANDOM'
            WHEN 5 THEN 'TIME_BOUND'
            ELSE 'UNKNOWN'
        END AS task_type_name,

        td.priority_type,
        CASE td.priority_type
            WHEN 1 THEN 'LOW'
            WHEN 2 THEN 'MEDIUM'
            WHEN 3 THEN 'HIGH'
        END AS priority_name,

        td.task_start_date,
        td.task_end_date,

        CAST(td.task_start_date AS DATE) AS start_date_only,
        CAST(td.task_end_date   AS DATE) AS end_date_only,

        CONVERT(NVARCHAR(8), td.task_start_date, 108) AS start_time_only,
        CONVERT(NVARCHAR(8), td.task_end_date,   108) AS end_time_only,

        el.id AS execution_log_id,
        el.emp_id,

        (SELECT STF_FRNAME + ' ' + STF_LSNAME
         FROM inout_aems..staffmst
         WHERE EMP_ID = el.emp_id) AS emp_name,

        ISNULL(
            (SELECT d.DEP_NAME
             FROM inout_aems..staffmst s
             LEFT JOIN inout_aems..deptmst d ON s.DEP_ID = d.DEP_ID
             WHERE s.EMP_ID = el.emp_id),
            'N/A'
        ) AS emp_department,

        el.assigned_by,

        (SELECT STF_FRNAME + ' ' + STF_LSNAME
         FROM inout_aems..staffmst
         WHERE EMP_ID = el.assigned_by) AS assigned_by_name,

        -- UPDATED: standardized to el.task_status
        el.task_status,
        CASE el.task_status
            WHEN 0 THEN 'ASSIGNED'
            WHEN 1 THEN 'STARTED'
            WHEN 2 THEN 'SUBMITTED'
            WHEN 3 THEN 'APPROVED'
            WHEN 4 THEN 'REJECTED'
            WHEN 5 THEN 'RESUBMITTED'
            WHEN 6 THEN 'CANCELLED'
        END AS status_name,

        el.started_at,
        el.extended_date,
        el.rejection_count,

        COALESCE(el.extended_date, td.task_end_date) AS effective_deadline,

        CASE
            WHEN el.task_status IN (3,6) THEN NULL
            ELSE DATEDIFF(DAY, GETDATE(),
                COALESCE(el.extended_date, td.task_end_date))
        END AS days_remaining,

        CASE
            WHEN COALESCE(el.extended_date, td.task_end_date) < GETDATE()
                 AND el.task_status NOT IN (3,6)
            THEN 1 ELSE 0
        END AS is_overdue,

        STUFF((
            SELECT ',' + CAST(el2.emp_id AS VARCHAR)
            FROM task_execution_log el2
            WHERE el2.task_id = td.task_id AND el2.is_active = 1
            FOR XML PATH('')
        ), 1, 1, '') AS emp_list,

        STUFF((
            SELECT ',' +
                   (SELECT STF_FRNAME + ' ' + STF_LSNAME
                    FROM inout_aems..staffmst
                    WHERE EMP_ID = el2.emp_id)
            FROM task_execution_log el2
            WHERE el2.task_id = td.task_id AND el2.is_active = 1
            FOR XML PATH('')
        ), 1, 1, '') AS emp_names,

        rp.weekly_days,
        rp.monthly_day_of_month,

        -- Group Task Info
        el.group_id,
        el.is_team_lead,
        el.is_active,
        -- Get team lead name for member cards
        (SELECT TOP 1 s.STF_FRNAME + ' ' + s.STF_LSNAME
         FROM task_execution_log tl
         JOIN inout_aems..staffmst s ON s.EMP_ID = tl.emp_id
         WHERE tl.group_id = el.group_id AND tl.is_team_lead = 1) AS team_lead_name,
        -- Get all member names for team lead card
        (SELECT STRING_AGG(s.STF_FRNAME + ' ' + s.STF_LSNAME, ', ')
         FROM task_execution_log tl
         JOIN inout_aems..staffmst s ON s.EMP_ID = tl.emp_id
         WHERE tl.group_id = el.group_id AND tl.emp_id <> el.emp_id
           AND tl.is_active = 1) AS group_member_names,

        @view_type AS view_type

    FROM task_details td
    INNER JOIN task_execution_log el ON td.task_id = el.task_id
    LEFT JOIN recurrence_pattern rp  ON td.task_id = rp.task_id

    WHERE td.is_active = 1
      AND el.task_status <> 6
      AND el.is_active = 1
      AND (
            (@view_type = 'SELF' AND el.emp_id = @emp_id)
         OR (@view_type = 'ASSIGNED_BY_ME' AND el.assigned_by = @emp_id)
          )
      AND (@filter_status        IS NULL OR el.task_status        = @filter_status)
      AND (
            @filter_group IS NULL 
            OR (@filter_group = 'PENDING' AND el.task_status IN (0, 4, 5))
          )
      AND (@filter_priority      IS NULL OR td.priority_type = @filter_priority)
      AND (@filter_task_type     IS NULL OR td.task_type     = @filter_task_type)
      AND (@filter_employee_id   IS NULL OR el.emp_id        = @filter_employee_id)
      AND (@filter_date_from     IS NULL
           OR COALESCE(el.extended_date, td.task_end_date) >= @filter_date_from)
      AND (@filter_date_to       IS NULL
           OR COALESCE(el.extended_date, td.task_end_date) <= @filter_date_to)
      AND (@filter_overdue_only  = 0
           OR (COALESCE(el.extended_date, td.task_end_date) < GETDATE()
               AND el.task_status NOT IN (3,6)))
      AND (@filter_extended_only = 0 OR el.extended_date IS NOT NULL)
      AND (@filter_search        IS NULL
           OR td.task_title LIKE '%' + @filter_search + '%'
           OR (SELECT STF_FRNAME + ' ' + STF_LSNAME
               FROM inout_aems..staffmst
               WHERE EMP_ID = el.emp_id)
              LIKE '%' + @filter_search + '%')

    ORDER BY el.updated_at DESC;
END
