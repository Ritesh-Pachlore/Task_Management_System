USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_get_employees]    Script Date: 28-02-2026 17:30:39 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER PROCEDURE [dbo].[sp_get_employees]
    @exclude_emp_id BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
   
    -- Return employees with department info
    SELECT
        s.EMP_ID AS emp_id,
        s.STF_FRNAME + ' ' + s.STF_LSNAME AS emp_name,
        ISNULL(d.DEP_NAME, 'N/A') AS emp_department
    FROM inout_aems..staffmst s
    LEFT JOIN inout_aems..deptmst d ON s.DEP_ID = d.DEP_ID
    WHERE (@exclude_emp_id IS NULL OR s.EMP_ID != @exclude_emp_id) AND s.REP_STATUS = 1
    ORDER BY s.STF_FRNAME;
END
