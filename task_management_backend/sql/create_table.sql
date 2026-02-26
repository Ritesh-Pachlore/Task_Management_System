-- ================================================
-- Make sure you're in the right database
-- ================================================
USE DButilities;
GO

-- ================================================
-- TABLE 1: task_details
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'task_details')
BEGIN
    CREATE TABLE task_details (
        task_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
        task_title       NVARCHAR(255)    NOT NULL,
        task_description NVARCHAR(MAX)    NULL,
        task_type        INT              NOT NULL,
        priority_type    INT              NOT NULL,
        task_start_date  DATETIME         NOT NULL,
        task_end_date    DATETIME         NOT NULL,
        created_by       BIGINT           NOT NULL,
        is_active        BIT              NOT NULL DEFAULT 1,
        created_at       DATETIME         NOT NULL DEFAULT GETDATE(),
        updated_at       DATETIME         NOT NULL DEFAULT GETDATE()
    );
    PRINT '✅ task_details created';
END
ELSE
    PRINT '⚠️ task_details already exists';
GO

-- ================================================
-- TABLE 2: task_execution_log
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'task_execution_log')
BEGIN
    CREATE TABLE task_execution_log (
        id               BIGINT IDENTITY(1,1) PRIMARY KEY,
        task_id          BIGINT           NOT NULL,
        emp_id           BIGINT           NOT NULL,
        assigned_by      BIGINT           NOT NULL,
        status           INT              NOT NULL DEFAULT 0,
        started_at       DATETIME         NULL,
        extended_date    DATETIME         NULL,
        rejection_count  INT              NOT NULL DEFAULT 0,
        created_at       DATETIME         NOT NULL DEFAULT GETDATE(),
        updated_at       DATETIME         NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_exec_log_task 
            FOREIGN KEY (task_id) REFERENCES task_details(task_id),

        -- UNIQUE (task_id, emp_id) -- REMOVED to allow recurring instances on different days
    );
    PRINT '✅ task_execution_log created';
END
ELSE
    PRINT '⚠️ task_execution_log already exists';
GO

-- ================================================
-- TABLE 3: task_execution_history
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'task_execution_history')
BEGIN
    CREATE TABLE task_execution_history (
        id                 BIGINT IDENTITY(1,1) PRIMARY KEY,
        execution_log_id   BIGINT           NOT NULL,
        action_type        INT              NOT NULL,
        action_by          BIGINT           NOT NULL,
        remarks            NVARCHAR(MAX)    NULL,

        action_at          DATETIME         NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_history_exec_log 
            FOREIGN KEY (execution_log_id) 
            REFERENCES task_execution_log(id)
    );
    PRINT '✅ task_execution_history created';
END
ELSE
    PRINT '⚠️ task_execution_history already exists';
GO

-- ================================================
-- TABLE 4: recurrence_pattern
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'recurrence_pattern')
BEGIN
    CREATE TABLE recurrence_pattern (
        pattern_id           BIGINT IDENTITY(1,1) PRIMARY KEY,
        task_id              BIGINT NOT NULL,
        recurrence_type      VARCHAR(10) NOT NULL 
            CHECK (recurrence_type IN ('DAILY', 'WEEKLY', 'MONTHLY')),
        start_date           DATE NOT NULL,
        end_date             DATE NULL,
        weekly_days          VARCHAR(20) NULL,  -- e.g. 'Monday,Wednesday,Friday'
        monthly_day_of_month INT NULL,
        created_at           DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at           DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_recurrence_task
            FOREIGN KEY (task_id) REFERENCES task_details(task_id)
            ON DELETE CASCADE
    );
    PRINT '✅ recurrence_pattern created';
END
ELSE
    PRINT '⚠️ recurrence_pattern already exists';
GO

-- ================================================
-- VERIFY: Check all tables exist
-- ================================================
SELECT TABLE_NAME, 
       (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c 
        WHERE c.TABLE_NAME = t.TABLE_NAME) AS column_count
FROM INFORMATION_SCHEMA.TABLES t
WHERE TABLE_NAME IN (
    'task_details', 
    'task_execution_log', 
    'task_execution_history',
    'recurrence_pattern'
)
ORDER BY TABLE_NAME;
-- Should show 3 rows with 11, 10, 7 columns ✅

-- Check structure of each table
EXEC sp_help 'task_details';
EXEC sp_help 'task_execution_log';
EXEC sp_help 'task_execution_history';

SELECT TOP 10 * FROM holiday_master;
