# Group Task Feature — Updated Design (v2)

---

## Review Comments Answered First

### ❓ Comment 1: "Manager should see ONE card for a group task, not one per employee"

**Answer:** ✅ Correct. On the **"Assigned By Me"** view, a group task should show as **one grouped card** with all member statuses listed inside it — not 3 separate cards.

The fetch SP (`sp_fetch_task_list`) returns one row per `execution_log_id`. For group tasks, we will group by `group_id` on the **frontend** and render a single `GroupTaskCard` component that lists all members inside it.

**No DB change needed for this.** It's a frontend grouping change only.

---

### ❓ Comment 2: "is_active for task_execution_log — new column for soft delete? And what does is_active in task_details do?"

**Two separate things:**

| Column | Table | What It Controls |
|---|---|---|
| `is_active` | `task_details` | **Whole task** — if 0, task is hidden from ALL employees. Soft-deletes the entire task. |
| `is_active` *(NEW)* | `task_execution_log` | **One employee's assignment** — if 0, that employee is removed from a group task only. Other members still see it. |

> [!IMPORTANT]
> `is_active` in `task_details` is already coded. **The problem:** it is NOT currently working because `sp_fetch_task_list` already has `WHERE td.is_active = 1` and `sp_dashboard_counts` also has `WHERE td.is_active = 1`. So toggle it to 0 and the task disappears from all views. It may not be hooked up via a UI button yet — that is the gap.

**Fix needed:** Add a "Delete Task" or "Deactivate Task" button on the manager's task card that calls an API → sets `task_details.is_active = 0`. The SQL already filters it — just the UI trigger is missing.

---

### ❓ Comment 3: "Dashboard counts — how does a group task count? Employee summary? Charts?"

**Decision (what you said you want):**

> "1 group task = 1 count"

This affects both the top stat cards and the charts. Here is exactly what changes:

#### Total Count Cards (Manager View)
Right now: 1 group task with 3 employees = **3 rows** counted = total shows **3**.
After fix: same group task = **1 count** (counted once by `group_id`).

**How:** `sp_dashboard_counts` needs to use `COUNT(DISTINCT CASE WHEN group_id IS NOT NULL THEN group_id ELSE CAST(id AS NVARCHAR) END)` for group-aware counting.

#### Employee Summary Table
Each employee still shows their **own row** in the summary table. For a group task, the team lead's row shows the action count. Regular members show same task reflected on their row too.

**Recommended:** Add a `[G]` indicator next to the task count for group tasks in the summary table.

#### Status Distribution Chart (Pie Chart)
Group task = 1 slice contribution (not 3). Same DISTINCT logic applied.

#### Priority Chart & Monthly Trend
Same — group task = 1 unit. Use DISTINCT by `group_id` or task_id level aggregation.

---

## DB Changes Required (Final)

### 2 columns in `task_execution_log`

```sql
ALTER TABLE task_execution_log
  ADD group_id       UNIQUEIDENTIFIER NULL DEFAULT NULL,
      is_team_lead   BIT NOT NULL DEFAULT 0;
```

### 1 new column in `task_execution_log` for employee soft-delete from group

```sql
ALTER TABLE task_execution_log
  ADD is_active      BIT NOT NULL DEFAULT 1;
```

> Already exists in `task_details`. This new one is only for execution_log rows.
> When you remove an employee from a group task: `UPDATE task_execution_log SET is_active = 0 WHERE id = @exec_log_id`

---

## Full Example With DB Entries

### Scenario
Task: **"March Audit Report"** (task_id = 55)  
Employees: Ravi (101) = Team Lead, Priya (102), Neha (103)  
Assigned by Manager Suresh (emp_id = 10)

---

### `task_details` — 1 row (no change)

| task_id | task_title | task_type | priority_type | task_start_date | task_end_date | created_by | is_active |
|---|---|---|---|---|---|---|---|
| 55 | March Audit Report | 4 | 3 (HIGH) | 2026-03-01 | 2026-03-10 | 10 | 1 |

---

### `task_execution_log` — 3 rows (shared group_id)

| id | task_id | emp_id | assigned_by | status | group_id | is_team_lead | is_active |
|---|---|---|---|---|---|---|---|
| 201 | 55 | 101 (Ravi) | 10 | 0 | `abc-guid` | **1** | 1 |
| 202 | 55 | 102 (Priya) | 10 | 0 | `abc-guid` | 0 | 1 |
| 203 | 55 | 103 (Neha) | 10 | 0 | `abc-guid` | 0 | 1 |

---

### After Ravi clicks "Start Task" → All 3 rows sync

| id | emp_id | status | started_at |
|---|---|---|---|
| 201 | Ravi | **1 (STARTED)** | 2026-03-02 09:00 |
| 202 | Priya | **1 (STARTED)** | 2026-03-02 09:00 |
| 203 | Neha | **1 (STARTED)** | 2026-03-02 09:00 |

### `task_execution_history` — entries for ALL 3

| id | execution_log_id | action_type | action_by | remarks |
|---|---|---|---|---|
| 301 | 201 | 0 (ASSIGNED) | 10 (Suresh) | Task assigned (Group — Team Lead) |
| 302 | 202 | 0 (ASSIGNED) | 10 (Suresh) | Task assigned (Group — Member) |
| 303 | 203 | 0 (ASSIGNED) | 10 (Suresh) | Task assigned (Group — Member) |
| 304 | 201 | 1 (STARTED) | 101 (Ravi) | Task started |
| 305 | 202 | 1 (STARTED) | 101 (Ravi) | Task started by Team Lead (Ravi) |
| 306 | 203 | 1 (STARTED) | 101 (Ravi) | Task started by Team Lead (Ravi) |

---

### After Manager Removes Priya from group (soft-delete)

```sql
UPDATE task_execution_log SET is_active = 0 WHERE id = 202;
```

| id | emp_id | is_active |
|---|---|---|
| 201 | Ravi | 1 |
| **202** | **Priya** | **0** ← hidden |
| 203 | Neha | 1 |

Priya no longer sees the task. Ravi and Neha still do.

---

## Dashboard Count Logic (Group-Aware)

### For Total Tasks Count (Manager View)
```sql
-- Current (wrong for groups): counts 3 for 1 group task
COUNT(*) AS total_tasks

-- New (correct): count only 1 per group, and 1 per individual
COUNT(DISTINCT 
    CASE 
        WHEN el.group_id IS NOT NULL THEN CAST(el.group_id AS NVARCHAR(50))
        ELSE CAST(el.id AS NVARCHAR(50))
    END
) AS total_tasks
```

### For Status Counts (Pending, In Progress, etc.)
Since ALL members in a group share the same status, we count DISTINCT group_ids:
```sql
-- Example for in_progress_count:
SUM(CASE WHEN el.status IN (1,5) 
    AND (el.is_team_lead = 1 OR el.group_id IS NULL) 
    THEN 1 ELSE 0 END) AS in_progress_count
```
> Key: for group tasks, only count the **team lead row** (is_team_lead = 1) for the aggregation. Regular members are excluded from counts. Individual tasks (`group_id IS NULL`) count normally.

### Employee Summary Table
Still shows one row per employee. For employee Ravi:
- total_tasks = 5 (includes the group task once, because he is team lead)

For Priya and Neha (group members, not team leads):
- They are NOT counted in status-level aggregation, but still appear in their own summary row to show the task exists.

---

## Action Rules

| Role | Can Do |
|---|---|
| Team Lead | Start, Submit, Resubmit (all synced to all members) |
| Regular Member | View only — NO action buttons |
| Manager (Assigner) | Approve, Reject, Extend, Cancel (applied to all members by group_id) |

---

## Complete Code Change List

### 1. `create_table.sql` / DB Migration
**What:** Add 3 columns to `task_execution_log`
```sql
ALTER TABLE task_execution_log
    ADD group_id     UNIQUEIDENTIFIER NULL DEFAULT NULL,
        is_team_lead BIT NOT NULL DEFAULT 0,
        is_active    BIT NOT NULL DEFAULT 1;
```
**Logic:** `group_id` links all members of a group. `is_team_lead` flags the volunteer. `is_active` enables soft-remove of one member.

---

### 2. `sp_create_task.sql`
**File:** `task_management_backend/sql/sp_create_task.sql`  
**What:** Accept 2 new params: `@assign_mode` ('GROUP' or 'INDIVIDUAL') and `@team_lead_emp_id`

**New params:**
```sql
@assign_mode        NVARCHAR(10) = 'INDIVIDUAL',  -- 'GROUP' or 'INDIVIDUAL'
@team_lead_emp_id   BIGINT = NULL
```

**New logic in the cursor loop:**
```sql
-- Generate ONE group_id for the entire group
DECLARE @group_guid UNIQUEIDENTIFIER = NEWID();

-- In the cursor loop:
INSERT INTO task_execution_log (task_id, emp_id, assigned_by, status,
    group_id, is_team_lead, is_active, created_at, updated_at)
VALUES (
    @task_id, @emp_id, @created_by, 0,
    CASE WHEN @assign_mode = 'GROUP' THEN @group_guid ELSE NULL END,
    CASE WHEN @assign_mode = 'GROUP' AND @emp_id = @team_lead_emp_id THEN 1 ELSE 0 END,
    1, @now, @now
);
```

---

### 3. `sp_update_task_status.sql`
**File:** `task_management_backend/sql/sp_update_task_status.sql`  
**What:** When team lead takes action, sync ALL members with same group_id

**New logic after the existing UPDATE block:**
```sql
-- After updating the team lead's own row:
DECLARE @group_id_val UNIQUEIDENTIFIER;
SELECT @group_id_val = group_id FROM task_execution_log WHERE id = @execution_log_id;

IF @group_id_val IS NOT NULL
BEGIN
    -- Sync status to all other active group members
    UPDATE task_execution_log
    SET status = @new_status,
        started_at = CASE WHEN @action_type = 1 AND started_at IS NULL THEN @now ELSE started_at END,
        updated_at = @now
    WHERE group_id = @group_id_val
      AND id <> @execution_log_id
      AND is_active = 1;

    -- Insert history for each member
    INSERT INTO task_execution_history (execution_log_id, action_type, action_by, remarks, action_at)
    SELECT id,
        @action_type,
        @action_by,
        'Synced from Team Lead action: ' + ISNULL(@remarks, ''),
        @now
    FROM task_execution_log
    WHERE group_id = @group_id_val
      AND id <> @execution_log_id
      AND is_active = 1;
END
```

---

### 4. `sp_fetch_task_list.sql`
**File:** `task_management_backend/sql/sp_fetch_task_list.sql`  
**What:** Return group fields, filter inactive rows, return team lead name

**New SELECT columns:**
```sql
el.group_id,
el.is_team_lead,
el.is_active,
-- Get team lead name for member cards
(SELECT s.STF_FRNAME + ' ' + s.STF_LSNAME
 FROM task_execution_log tl
 JOIN inout_aems..staffmst s ON s.EMP_ID = tl.emp_id
 WHERE tl.group_id = el.group_id AND tl.is_team_lead = 1) AS team_lead_name,
-- Get all member names for team lead card
(SELECT STRING_AGG(s.STF_FRNAME + ' ' + s.STF_LSNAME, ', ')
 FROM task_execution_log tl
 JOIN inout_aems..staffmst s ON s.EMP_ID = tl.emp_id
 WHERE tl.group_id = el.group_id AND tl.emp_id <> el.emp_id
   AND tl.is_active = 1) AS group_member_names
```

**New WHERE clause:**
```sql
AND el.is_active = 1  -- hide soft-deleted members
```

---

### 5. `sp_dashboard_counts.sql`
**File:** `task_management_backend/sql/sp_dashboard_counts.sql`  
**What:** Make all counts group-aware (1 group task = 1 count)

**Strategy:** Only count team lead rows for group tasks:
```sql
-- Add to WHERE in all COUNT/SUM queries:
AND (el.group_id IS NULL OR el.is_team_lead = 1)
```
This means: include all individual tasks + only the team lead row for group tasks. This gives correct counts.

---

### 6. `CreateTaskPage.jsx`
**File:** `task-management-frontend/src/pages/CreateTaskPage.jsx`  
**What:** Show 2 buttons when >1 employee selected; team lead radio picker

**New state:**
```js
const [assignMode, setAssignMode] = useState(null); // 'individual' | 'group'
const [teamLeadEmpId, setTeamLeadEmpId] = useState(null);
```

**New UI after employee selection:**
```jsx
{selectedEmployees.length > 1 && (
  <div className="assign-mode-section">
    <button onClick={() => setAssignMode('individual')}>Assign as Individual</button>
    <button onClick={() => setAssignMode('group')}>Assign as Group</button>
  </div>
)}

{assignMode === 'group' && (
  <div className="team-lead-picker">
    <h4>Select Team Lead</h4>
    {selectedEmployees.map(emp => (
      <label key={emp.emp_id}>
        <input type="radio" name="teamLead"
          checked={teamLeadEmpId === emp.emp_id}
          onChange={() => setTeamLeadEmpId(emp.emp_id)} />
        {emp.emp_name}
      </label>
    ))}
  </div>
)}
```

**API call change:**
```js
assign_mode: assignMode === 'group' ? 'GROUP' : 'INDIVIDUAL',
team_lead_emp_id: assignMode === 'group' ? teamLeadEmpId : null,
```

---

### 7. `TaskCard.jsx`
**File:** `task-management-frontend/src/components/tasks/TaskCard.jsx`  
**What:** Show GROUP badge, hide actions for non-team-leads, show member list

**New logic in `getActions()`:**
```js
// For SELF view, hide action buttons for group members (not team lead)
if (viewType === 'SELF' && task.group_id && !task.is_team_lead) {
    return []; // no actions — view only
}
```

**New GROUP badge (in top section):**
```jsx
{task.group_id && (
  <span className="task-group-tag">👥 GROUP</span>
)}
```

**New group info line:**
```jsx
{task.group_id && task.is_team_lead === 1 && (
  <div className="task-group-info">Team Lead ⭐ | Members: {task.group_member_names}</div>
)}
{task.group_id && task.is_team_lead === 0 && (
  <div className="task-group-info">Team Lead: {task.group_lead_name} (actions by lead only)</div>
)}
```

---

### 8. Manager Dashboard — Group Card (NEW `GroupTaskCard` component)
**File:** NEW `src/components/tasks/GroupTaskCard.jsx`  
**What:** For ASSIGNED_BY_ME view, group all execution_log rows with same `group_id` and render one card

**Frontend grouping logic (in `AssignedByMePage.jsx`):**
```js
// Group tasks by group_id, individual tasks stay separate
const grouped = tasks.reduce((acc, task) => {
    const key = task.group_id || `ind_${task.execution_log_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
}, {});

// Render GroupTaskCard if group, TaskCard if individual
Object.values(grouped).map(group => 
    group[0].group_id 
        ? <GroupTaskCard members={group} /> 
        : <TaskCard task={group[0]} />
)
```
