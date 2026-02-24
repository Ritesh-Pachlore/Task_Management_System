USE DButilities;
GO

PRINT '════════════════════════════════════════════════════';
PRINT '  CREATING HELPER FUNCTIONS';
PRINT '════════════════════════════════════════════════════';

-- ====================================================
-- Function 1: Is date Sunday or Holiday?
-- ====================================================
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'fn_is_non_working_day')
    DROP FUNCTION fn_is_non_working_day;
GO

CREATE FUNCTION [dbo].[fn_is_non_working_day](@check_date DATE)
RETURNS BIT
AS
BEGIN
    -- Sunday check
    IF DATEPART(WEEKDAY, @check_date) = 1 
        RETURN 1;

    -- Holiday check (Updated table & columns)
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

PRINT '  ✅ fn_is_non_working_day CREATED';
GO


-- ====================================================
-- Function 2: Get next working day
-- ====================================================
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'fn_get_next_working_day')
    DROP FUNCTION fn_get_next_working_day;
GO

CREATE FUNCTION [dbo].[fn_get_next_working_day](@check_date DATE)
RETURNS DATE
AS
BEGIN
    DECLARE @result DATE = @check_date;
    DECLARE @safety INT = 0;

    WHILE (
        DATEPART(WEEKDAY, @result) = 1
        OR EXISTS (
            SELECT 1 
            FROM LPDATA..holiday_master
            WHERE Holiday_Date = @result 
              AND Status = 1
        )
    ) AND @safety < 10
    BEGIN
        SET @result = DATEADD(DAY, 1, @result);
        SET @safety = @safety + 1;
    END

    RETURN @result;
END
GO

PRINT '  ✅ fn_get_next_working_day CREATED';
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
