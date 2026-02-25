USE [msdb]
GO

-- ═══════════════════════════════════════════════════════════════
-- SQL AGENT JOB: Auto-Generate Recurring Tasks
--
-- This creates a scheduled job that runs every day at 12:01 AM
-- and calls sp_generate_recurring_tasks to assign Daily, Weekly,
-- and Monthly tasks automatically.
--
-- PREREQUISITE: SQL Server Agent service must be RUNNING.
-- (Check: Services → SQL Server Agent → Start)
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Delete existing job if it exists
IF EXISTS (SELECT * FROM msdb.dbo.sysjobs WHERE name = N'Auto_Generate_Recurring_Tasks')
BEGIN
    EXEC msdb.dbo.sp_delete_job @job_name = N'Auto_Generate_Recurring_Tasks';
END
GO

-- Step 2: Create the job
EXEC msdb.dbo.sp_add_job 
    @job_name = N'Auto_Generate_Recurring_Tasks',
    @description = N'Runs daily at 12:01 AM to generate recurring task assignments (Daily, Weekly, Monthly)',
    @enabled = 1;
GO

-- Step 3: Add the job step (what to execute)
EXEC msdb.dbo.sp_add_jobstep 
    @job_name = N'Auto_Generate_Recurring_Tasks',
    @step_name = N'Execute sp_generate_recurring_tasks',
    @subsystem = N'TSQL',
    @command = N'EXEC [DButilities].[dbo].[sp_generate_recurring_tasks]',
    @database_name = N'DButilities',
    @retry_attempts = 3,
    @retry_interval = 5;  -- Retry every 5 minutes if failed
GO

-- Step 4: Create the schedule (Daily at 12:01 AM)
EXEC msdb.dbo.sp_add_jobschedule 
    @job_name = N'Auto_Generate_Recurring_Tasks',
    @name = N'Daily_12_01_AM',
    @freq_type = 4,          -- 4 = Daily
    @freq_interval = 1,      -- Every 1 day
    @active_start_time = 100; -- 00:01:00 (12:01 AM in HHMMSS format)
GO

-- Step 5: Assign to the local server
EXEC msdb.dbo.sp_add_jobserver 
    @job_name = N'Auto_Generate_Recurring_Tasks',
    @server_name = N'(LOCAL)';
GO

PRINT '✅ SQL Agent Job "Auto_Generate_Recurring_Tasks" created successfully!';
PRINT '    Schedule: Daily at 12:01 AM';
PRINT '    Action:   EXEC [DButilities].[dbo].[sp_generate_recurring_tasks]';
PRINT '';
PRINT '⚠️  Make sure SQL Server Agent service is RUNNING:';
PRINT '    1. Open Services (Win+R → services.msc)';
PRINT '    2. Find "SQL Server Agent (MSSQLSERVER)"';
PRINT '    3. Right-click → Start (or set to Automatic)';
GO
