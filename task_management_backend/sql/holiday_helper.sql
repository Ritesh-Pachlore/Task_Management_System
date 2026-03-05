USE DButilities;
GO

PRINT '════════════════════════════════════════════════════';
PRINT '  CREATING HELPER FUNCTIONS';
PRINT '════════════════════════════════════════════════════';

-- ====================================================
-- Function 1: Is date Off-day or Holiday for Employee?
-- ====================================================
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'fn_is_non_working_day')
    DROP FUNCTION fn_is_non_working_day;
GO

CREATE FUNCTION [dbo].[fn_is_non_working_day](@check_date DATE, @emp_id BIGINT = NULL)
RETURNS BIT
AS
BEGIN
    -- 1. Check for specific week-off in inout_aems..weekoffmst
    IF @emp_id IS NOT NULL
    BEGIN
        DECLARE @week_off_name VARCHAR(20);
        SELECT @week_off_name = WEEK_OFF 
        FROM inout_aems..weekoffmst 
        WHERE EMP_ID = @emp_id 
          AND @check_date BETWEEN DATE_FROM AND DATE_TO;

        IF @week_off_name IS NOT NULL
        BEGIN
            IF DATENAME(WEEKDAY, @check_date) = @week_off_name
                RETURN 1;
        END
        ELSE
        BEGIN
            -- Fallback to default Sunday if no record exists for employee
            IF DATENAME(WEEKDAY, @check_date) = 'Sunday'
                RETURN 1;
        END
    END
    ELSE
    BEGIN
        -- Original global logic (e.g. for general task checks)
        IF DATENAME(WEEKDAY, @check_date) = 'Sunday'
            RETURN 1;
    END

    -- 2. Check for public holidays from LPDATA..holiday_master
    IF EXISTS (
        SELECT 1 
        FROM LPDATA..holiday_master
        WHERE Holiday_Date = @check_date 
          AND Status = 1
    )
        RETURN 1;

    RETURN 0;
END
GO

PRINT '  ✅ fn_is_non_working_day UPDATED (Emp-aware)';
GO


-- ====================================================
-- Function 2: Get next working day (Emp-aware)
-- ====================================================
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'fn_get_next_working_day')
    DROP FUNCTION fn_get_next_working_day;
GO

CREATE FUNCTION [dbo].[fn_get_next_working_day](@check_date DATE, @emp_id BIGINT = NULL)
RETURNS DATE
AS
BEGIN
    DECLARE @result DATE = DATEADD(DAY, 1, @check_date);
    DECLARE @safety INT = 0;

    WHILE dbo.fn_is_non_working_day(@result, @emp_id) = 1 AND @safety < 10
    BEGIN
        SET @result = DATEADD(DAY, 1, @result);
        SET @safety = @safety + 1;
    END

    RETURN @result;
END
GO

PRINT '  ✅ fn_get_next_working_day UPDATED (Emp-aware)';
GO


-- ====================================================
-- Function 3: Get previous working day (Emp-aware)
-- ====================================================
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'fn_get_previous_working_day')
    DROP FUNCTION fn_get_previous_working_day;
GO

CREATE FUNCTION [dbo].[fn_get_previous_working_day](@check_date DATE, @emp_id BIGINT = NULL)
RETURNS DATE
AS
BEGIN
    DECLARE @result DATE = DATEADD(DAY, -1, @check_date);
    DECLARE @safety INT = 0;

    WHILE dbo.fn_is_non_working_day(@result, @emp_id) = 1 AND @safety < 10
    BEGIN
        SET @result = DATEADD(DAY, -1, @result);
        SET @safety = @safety + 1;
    END

    RETURN @result;
END
GO

PRINT '  ✅ fn_get_previous_working_day CREATED (Emp-aware)';
GO


-- ====================================================
-- TEST
-- ====================================================
SELECT 'Sunday Jul 6' AS test,
       dbo.fn_is_non_working_day('2025-07-06') AS is_non_working,
       dbo.fn_get_next_working_day('2025-07-06') AS next_working;

SELECT 'Monday Jul 7' AS test,
       dbo.fn_is_non_working_day('2025-07-07') AS is_non_working,
       dbo.fn_get_next_working_day('2025-07-07') AS next_working;

PRINT '  ✅ FUNCTIONS COMPLETE';
