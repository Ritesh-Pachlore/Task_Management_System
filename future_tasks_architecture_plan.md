# Detailed Implementation Plan: Simplified Architecture 🚀

We **DO NOT** need the `task_assignment` table. Since the current stored procedures already need a first instance in `task_execution_log` to act as a "seed" anyway, we can simply insert the task unconditionally without creating a whole new table.

By making the execution log unconditional, the task becomes immediately visible on the dashboard, and the scheduler has the employee seed it needs for the future! We just have to protect the "Start" state.

Here is the exact **Before and After** code demonstrating this approach:

---

### 1. File: `sp_create_task.sql`
**Goal:** Unconditionally insert the initial task execution log.

**BEFORE (Current Logic):**
```sql
-- ── Assign First Instance ───────────────────────────────────
DECLARE @should_assign BIT = 0;
IF @task_type NOT IN (1, 2, 3) SET @should_assign = 1;
-- Assign only if today is >= start date AND it's a working day
ELSE IF @task_type IN (1, 2, 3) 
        AND CAST(GETDATE() AS DATE) >= @task_start_date
        AND dbo.fn_is_non_working_day(CAST(GETDATE() AS DATE)) = 0
    SET @should_assign = 1; 

IF @should_assign = 1
BEGIN
    -- loop and insert into task_execution_log
END
```

**AFTER (Updated Logic):**
```sql
-- ── Assign First Instance ───────────────────────────────────
-- Unconditionally assign the first instance! 
-- This immediately shows the task on the UI and stores the employees for the recurrence scheduler.
DECLARE @should_assign BIT = 1; 

IF @should_assign = 1
BEGIN
    -- loop and insert into task_execution_log
END
```

---

### 2. File: `sp_generate_recurring_tasks.sql`
**Goal:** Prevent the scheduler from creating a duplicate on the task's start date, because `sp_create_task` already generated the initial instance!

**BEFORE (Current Logic):**
```sql
-- ════════════════════════════════════════════════════════
-- CREATE INSTANCES with per-instance deadlines
-- ════════════════════════════════════════════════════════
IF @should_create = 1
BEGIN
    -- Insert new execution log for ALL assigned employees
```

**AFTER (Updated Logic):**
```sql
-- ════════════════════════════════════════════════════════
-- NEW: PREVENT DUPLICATES ON INITIAL START DATE
-- ════════════════════════════════════════════════════════
-- sp_create_task already created the initial UI instance! 
-- If today is the exact start date, do not spawn another one.
IF @target_date = @task_start_date
BEGIN
    SET @should_create = 0;
END

-- ════════════════════════════════════════════════════════
-- CREATE INSTANCES with per-instance deadlines
-- ════════════════════════════════════════════════════════
IF @should_create = 1
BEGIN
    -- Insert new execution log for ALL assigned employees
```

---

### 3. File: `sp_update_task_status.sql`
**Goal:** Prevent the user from bypassing the UI and using API tools to start a task before the planned start date.

**BEFORE (Current Logic):**
```sql
-- STARTED
IF @action_type = 1
BEGIN
    UPDATE task_execution_log
    SET status = @new_status,
        started_at = CASE 
                        WHEN started_at IS NULL THEN @now 
                        ELSE started_at 
                     END,
        updated_at = @now
    WHERE id = @execution_log_id;
END
```

**AFTER (Updated Logic):**
```sql
-- STARTED
IF @action_type = 1
BEGIN
    -- New Logic: Prevent Early Starts
    DECLARE @task_start_date_check DATETIME;
    SELECT @task_start_date_check = task_start_date
    FROM task_details WHERE task_id = @task_id;

    IF @now < @task_start_date_check
    BEGIN
        SELECT 'You cannot start this task before its planned start date.' AS message, 0 AS success,
               NULL AS task_id, NULL AS emp_id, NULL AS assigned_by,
               NULL AS action_type, NULL AS new_status;
        ROLLBACK;
        RETURN;
    END

    UPDATE task_execution_log
    SET status = @new_status,
        started_at = CASE 
                        WHEN started_at IS NULL THEN @now 
                        ELSE started_at 
                     END,
        updated_at = @now
    WHERE id = @execution_log_id;
END
```

---

### 4. File: `TaskCard.jsx` (Frontend UI)
**Goal:** If the start date is in the future, disable the "Start" button and display a message like `Starts in 2 days`.

**BEFORE (Current Logic):**
```javascript
// Shows normal Start button
if (status === 0) actions.push({ type: 1, label: 'Start', cls: 'btn-primary' });

// Shows normal Due Date
{!isInfinite && daysText && (
    <span className={getDueDateColor()}>
        {' '}({daysText})
    </span>
)}
```

**AFTER (Updated Logic):**
```javascript
// Calculate Start Date differences
const today = new Date();
const startDate = new Date(task.task_start_date);
today.setHours(0, 0, 0, 0);
startDate.setHours(0, 0, 0, 0);

const isFutureStart = startDate > today;
const diffDaysToStart = Math.ceil(Math.abs(startDate - today) / (1000 * 60 * 60 * 24));

// Hide Start button if in the future
if (status === 0 && !isFutureStart) {
    actions.push({ type: 1, label: 'Start', cls: 'btn-primary' });
}

// Display "Starts in X days"
{!isInfinite && daysText && !isFutureStart && (
    <span className={getDueDateColor()}>
        {' '}({daysText})
    </span>
)}
{isFutureStart && status === 0 && (
    <span className="text-info" style={{ marginLeft: '5px', fontWeight: 'bold' }}>
        (Starts in {diffDaysToStart} day{diffDaysToStart > 1 ? 's' : ''})
    </span>
)}
```
