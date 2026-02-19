"""
Task Services — Business logic layer
Views call services → services call SPs.
No auto-shifting. Frontend asks permission first.
"""

from utils.db_helper import call_sp, call_sp_multiple_results
from utils.constants import ActionType


def create_task(task_data, created_by, created_by_name=""):
    """Create task. Saves whatever date frontend sends."""
    required = ['task_title', 'task_type', 'priority_type',
                'task_start_date', 'task_end_date', 'emp_list']
    for field in required:
        if field not in task_data or not task_data[field]:
            return [{"success": 0, "message": f"{field} is required", "task_id": 0}]
    
    return call_sp('sp_create_task', [
        task_data['task_title'],
        task_data.get('task_description', ''),
        int(task_data['task_type']),
        int(task_data['priority_type']),
        task_data['task_start_date'],
        task_data['task_end_date'],
        created_by,
        task_data['emp_list'],
    ])


def get_tasks(emp_id, view_type, filters=None):
    """Fetch tasks with optional filters."""
    if filters and any(v is not None for v in filters.values()):
        return call_sp('sp_fetch_task_list', [
            emp_id, view_type,
            filters.get('status'), filters.get('priority'),
            filters.get('task_type'), filters.get('employee_id'),
            filters.get('date_from'), filters.get('date_to'),
            1 if filters.get('overdue_only') else 0,
            1 if filters.get('extended_only') else 0,
            filters.get('search'),
        ])
    return call_sp('sp_fetch_task_list', [
        emp_id, view_type, None, None, None, None, None, None, 0, 0, None
    ])


def update_task_status(execution_log_id, action_type, action_by,
                       remarks, action_by_name=""):
    """Update status (not extend — use extend_task for that)."""
    return call_sp('sp_update_task_status', [
        execution_log_id, int(action_type), action_by, remarks, None,
    ])


def extend_task(execution_log_id, action_by, extended_date,
                remarks, action_by_name=""):
    """Extend deadline. Saves whatever date frontend sends."""
    if not extended_date:
        return [{"success": 0, "message": "Extended date is required"}]
    return call_sp('sp_update_task_status', [
        execution_log_id, ActionType.EXTENDED, action_by, remarks, extended_date,
    ])


def get_task_history(execution_log_id):
    return call_sp('sp_get_task_history', [execution_log_id])


def get_dashboard_counts(emp_id, view_type):
    """Dashboard — 5 result sets."""
    results = call_sp_multiple_results('sp_dashboard_counts', [emp_id, view_type])
    return {
        "view_type": view_type,
        "overall_counts": results[0][0] if len(results) > 0 and results[0] else {},
        "employee_summary": results[1] if len(results) > 1 and results[1] else [],
        "status_chart": results[2] if len(results) > 2 and results[2] else [],
        "priority_chart": results[3] if len(results) > 3 and results[3] else [],
        "monthly_trend": results[4] if len(results) > 4 and results[4] else [],
    }


def get_affected_tasks(emp_id, view_type):
    """Tasks on holidays — for dashboard warning."""
    return call_sp('sp_get_affected_tasks', [emp_id, view_type])