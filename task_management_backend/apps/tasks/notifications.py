# apps/tasks/notifications.py

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def send_notification(emp_id, data):
    """Send WebSocket notification to a specific employee."""
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"task_updates_{emp_id}",
            {
                "type": "task_notification",
                "data": data,
            }
        )
    except Exception:
        # If Redis is not running, skip silently
        pass


def notify_task_assigned(emp_id, task_title, assigned_by_name):
    send_notification(emp_id, {
        "type":    "TASK_ASSIGNED",
        "message": f"'{task_title}' assigned by {assigned_by_name}",
        "action":  "refresh",
    })


def notify_status_changed(emp_id, task_title, new_status, action_by_name):
    send_notification(emp_id, {
        "type":    "STATUS_CHANGED",
        "message": f"'{task_title}' — {new_status} by {action_by_name}",
        "action":  "refresh",
    })


def notify_task_extended(emp_id, task_title, extended_date, action_by_name):
    send_notification(emp_id, {
        "type":    "EXTENDED",
        "message": f"'{task_title}' extended to {extended_date} by {action_by_name}",
        "action":  "refresh",
    })