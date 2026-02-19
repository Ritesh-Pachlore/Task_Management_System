"""
Task Services — Business logic layer
Views call services → services call SPs.
No auto-shifting. Frontend asks permission first.
"""
# apps/tasks/services.py

from utils.db_helper import call_sp, call_sp_multiple_results
from utils.constants import ActionType, TaskType
from .notifications import (
    notify_task_assigned,
    notify_status_changed,
    notify_task_extended,
)


def create_task(task_data, created_by, created_by_name=""):
    """
    Create task.

    Date + Time handling:
    ─────────────────────
    Frontend sends them separately:
        task_start_date = "2025-07-15"   (always)
        start_time      = "09:00"        (only TIME_BOUND)
        task_end_date   = "2025-07-15"   (TIME_BOUND + others)
        end_time        = "09:30"        (only TIME_BOUND)

    SP combines them:
        TIME_BOUND → 2025-07-15 09:00:00
        Others     → 2025-07-15 00:00:00
    """
    required = [
        'task_title',
        'task_type',
        'priority_type',
        'task_start_date',
        'task_end_date',
        'emp_list',
    ]
    for field in required:
        if field not in task_data or not task_data[field]:
            return [{"success": 0,
                     "message": f"{field} is required",
                     "task_id": 0}]

    task_type = int(task_data['task_type'])

    # ── Extract time fields (only meaningful for TIME_BOUND) ─────
    # Service passes them to SP regardless of task_type.
    # SP internally nullifies if not TIME_BOUND — double safety.
    if task_type == TaskType.TIME_BOUND:
        start_time = task_data.get('start_time') or None
        end_time   = task_data.get('end_time')   or None
    else:
        # Force None for all non-TIME_BOUND types
        start_time = None
        end_time   = None

    # ── FUTURE: when DAILY/WEEKLY/MONTHLY are implemented ────────
    # if task_type == TaskType.DAILY:
    #     start_time = None   (no time for daily)
    #     end_time   = None
    # if task_type == TaskType.WEEKLY:
    #     weekly_day = task_data.get('day_of_week')
    # if task_type == TaskType.MONTHLY:
    #     start_time = None
    #     end_time   = None
    # ─────────────────────────────────────────────────────────────

    result = call_sp('sp_create_task', [
        task_data['task_title'],
        task_data.get('task_description', ''),
        task_type,
        int(task_data['priority_type']),
        task_data['task_start_date'],    # DATE string  e.g. "2025-07-15"
        start_time,                      # TIME string  e.g. "09:00" or None
        task_data['task_end_date'],      # DATE string  e.g. "2025-07-15"
        end_time,                        # TIME string  e.g. "09:30" or None
        created_by,
        task_data['emp_list'],
    ])

    if result and result[0].get('success') == 1:
        for eid in task_data['emp_list'].split(','):
            eid = eid.strip()
            if eid:
                notify_task_assigned(
                    int(eid),
                    task_data['task_title'],
                    created_by_name,
                )

    return result


def get_tasks(emp_id, view_type, filters=None):
    if filters:
        return call_sp('sp_fetch_task_list', [
            emp_id,
            view_type,
            filters.get('status'),
            filters.get('priority'),
            filters.get('task_type'),
            filters.get('employee_id'),
            filters.get('date_from'),
            filters.get('date_to'),
            1 if filters.get('overdue_only') else 0,
            1 if filters.get('extended_only') else 0,
            filters.get('search'),
        ])
    return call_sp('sp_fetch_task_list', [
        emp_id, view_type,
        None, None, None, None, None, None, 0, 0, None,
    ])


def update_task_status(execution_log_id, action_type,
                       action_by, remarks, action_by_name=""):
    result = call_sp('sp_update_task_status', [
        execution_log_id, action_type, action_by, remarks, None,
    ])
    if result and result[0].get('success') == 1:
        info        = result[0]
        status_name = ActionType.CHOICES.get(action_type, 'UNKNOWN')
        if action_type in [1, 2, 5]:
            notify_status_changed(
                info.get('assigned_by'), remarks,
                status_name, action_by_name,
            )
        elif action_type in [3, 4, 6, 7]:
            notify_status_changed(
                info.get('emp_id'), remarks,
                status_name, action_by_name,
            )
    return result


def extend_task(execution_log_id, action_by,
                extended_date, remarks, action_by_name=""):
    if not extended_date:
        return [{"success": 0, "message": "Extended date is required"}]

    result = call_sp('sp_update_task_status', [
        execution_log_id, ActionType.EXTENDED,
        action_by, remarks, extended_date,
    ])
    if result and result[0].get('success') == 1:
        notify_task_extended(
            result[0].get('emp_id'),
            remarks,
            extended_date,
            action_by_name,
        )
    return result


def get_task_history(execution_log_id):
    return call_sp('sp_get_task_history', [execution_log_id])


def get_dashboard_counts(emp_id, view_type):
    results = call_sp_multiple_results(
        'sp_dashboard_counts', [emp_id, view_type])
    return {
        "view_type":        view_type,
        "overall_counts":   results[0][0] if len(results) > 0 and results[0] else {},
        "employee_summary": results[1]    if len(results) > 1 and results[1] else [],
        "status_chart":     results[2]    if len(results) > 2 and results[2] else [],
        "priority_chart":   results[3]    if len(results) > 3 and results[3] else [],
        "monthly_trend":    results[4]    if len(results) > 4 and results[4] else [],
    }


def get_affected_tasks(emp_id, view_type):
    return call_sp('sp_get_affected_tasks', [emp_id, view_type]) 