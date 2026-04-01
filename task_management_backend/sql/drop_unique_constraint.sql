USE [DButilities]
GO

-- ═══════════════════════════════════════════════════════════════
-- Drop UNIQUE constraint on task_execution_log (task_id, emp_id)
-- This is needed to allow recurring tasks to create multiple
-- assignments for the same employee on different days.
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Find and drop any UNIQUE constraint on (task_id, emp_id)
DECLARE @constraint_name NVARCHAR(256);

SELECT @constraint_name = kc.name
FROM sys.key_constraints kc
JOIN sys.index_columns ic1 ON kc.unique_index_id = ic1.index_id AND kc.parent_object_id = ic1.object_id
JOIN sys.columns c1 ON ic1.column_id = c1.column_id AND ic1.object_id = c1.object_id
JOIN sys.index_columns ic2 ON kc.unique_index_id = ic2.index_id AND kc.parent_object_id = ic2.object_id
JOIN sys.columns c2 ON ic2.column_id = c2.column_id AND ic2.object_id = c2.object_id
WHERE kc.parent_object_id = OBJECT_ID('task_execution_log')
  AND kc.type = 'UQ'
  AND c1.name = 'task_id'
  AND c2.name = 'emp_id'
  AND ic1.column_id <> ic2.column_id;

IF @constraint_name IS NOT NULL
BEGIN
    PRINT 'Dropping constraint: ' + @constraint_name;
    EXEC('ALTER TABLE task_execution_log DROP CONSTRAINT [' + @constraint_name + ']');
    PRINT 'Constraint dropped successfully.';
END
ELSE
BEGIN
    PRINT 'No UNIQUE constraint found on (task_id, emp_id). Nothing to drop.';
END
GO

-- Step 2: Also check for any UNIQUE INDEX (not constraint)
DECLARE @index_name NVARCHAR(256);

SELECT @index_name = i.name
FROM sys.indexes i
JOIN sys.index_columns ic1 ON i.index_id = ic1.index_id AND i.object_id = ic1.object_id
JOIN sys.columns c1 ON ic1.column_id = c1.column_id AND ic1.object_id = c1.object_id
JOIN sys.index_columns ic2 ON i.index_id = ic2.index_id AND i.object_id = ic2.object_id
JOIN sys.columns c2 ON ic2.column_id = c2.column_id AND ic2.object_id = c2.object_id
WHERE i.object_id = OBJECT_ID('task_execution_log')
  AND i.is_unique = 1
  AND i.is_primary_key = 0
  AND c1.name = 'task_id'
  AND c2.name = 'emp_id'
  AND ic1.column_id <> ic2.column_id;

IF @index_name IS NOT NULL
BEGIN
    PRINT 'Dropping unique index: ' + @index_name;
    EXEC('DROP INDEX [' + @index_name + '] ON task_execution_log');
    PRINT 'Unique index dropped successfully.';
END
ELSE
BEGIN
    PRINT 'No UNIQUE index found on (task_id, emp_id). Nothing to drop.';
END
GO

PRINT 'Done. task_execution_log is now ready for recurring task assignments.';
GO
