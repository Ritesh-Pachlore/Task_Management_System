# apps/tasks/views.py

from rest_framework.views import APIView
from rest_framework.decorators import authentication_classes
from rest_framework.permissions import IsAuthenticated
from utils.response_handler import success_response, error_response
from utils.constants import TaskType
from . import services
from .holiday_helper import get_shift_info
from apps.authentication.token_auth import StandaloneTokenAuthentication


@authentication_classes([StandaloneTokenAuthentication])
class CreateTaskView(APIView):
    """
    POST /api/tasks/create/

    Expected body (TIME_BOUND):
    {
        "task_title":      "Morning Meeting",
        "task_description":"...",
        "task_type":       5,
        "priority_type":   2,
        "task_start_date": "2025-07-15",   # date only
        "start_time":      "09:00",         # time only
        "task_end_date":   "2025-07-15",   # date only
        "end_time":        "09:30",         # time only
        "emp_list":        "25,30"
    }

    Expected body (RANDOM):
    {
        "task_title":      "Fix Bug",
        "task_type":       4,
        "priority_type":   3,
        "task_start_date": "2025-07-15",   # date only
        "task_end_date":   "2025-07-20",   # date only (no times)
        "emp_list":        "25"
    }
    """
    authentication_classes = [StandaloneTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            data      = request.data
            task_type = int(data.get('task_type', 0))

            # ── Validate required base fields ────────────────────
            if not data.get('task_title', '').strip():
                return error_response("task_title is required")

            if not data.get('task_start_date'):
                return error_response("task_start_date is required")

            if not data.get('emp_list'):
                return error_response("emp_list is required")

            # ── Task-type-aware validation ───────────────────────
            if task_type == TaskType.TIME_BOUND:
                # TIME_BOUND needs end date AND both times
                if not data.get('task_end_date'):
                    return error_response(
                        "task_end_date is required for Time Bound tasks")
                if not data.get('start_time'):
                    return error_response(
                        "start_time is required for Time Bound tasks")
                if not data.get('end_time'):
                    return error_response(
                        "end_time is required for Time Bound tasks")
                # Time logic check: same day → end_time must be after start_time
                if (data.get('task_start_date') == data.get('task_end_date') and
                        data.get('end_time') <= data.get('start_time')):
                    return error_response(
                        "end_time must be after start_time on the same day")

            elif task_type in [TaskType.DAILY, TaskType.WEEKLY, TaskType.MONTHLY]:
                # Recurring tasks MUST have end_date
                if not data.get('task_end_date'):
                    return error_response(f"task_end_date is required for {TaskType.CHOICES[task_type]} tasks")
                
                # Check for recurrence_end_date (optional but recommended)
                # Actually, in our scheme, task_end_date is the date of the FIRST instance, 
                # but for recurring, we'll use it as the pattern start if start_date is used.
                # Let's keep it simple.
                
                if task_type == TaskType.WEEKLY:
                    if not data.get('weekly_days'):
                        return error_response("weekly_days is required for Weekly tasks")
                
                elif task_type == TaskType.MONTHLY:
                    if not data.get('monthly_day_of_month'):
                        return error_response("monthly_day_of_month is required for Monthly tasks")

            elif task_type == TaskType.RANDOM:
                # RANDOM: end_date optional, times not needed
                pass

            else:
                # Unknown task type
                return error_response(
                    f"Invalid task_type: {task_type}. "
                    f"Valid: 1(Daily), 2(Weekly), 3(Monthly), 4(Random), 5(Time Bound)")
            # ────────────────────────────────────────────────────

            result = services.create_task(
                task_data       = data,
                created_by      = request.user.emp_id,
                created_by_name = request.user.emp_name,
            )
            return success_response(
                data    = result,
                message = "Task created successfully",
            )
        except Exception as e:
            return error_response(message=str(e))


@authentication_classes([StandaloneTokenAuthentication])
class MyTasksView(APIView):
    """GET /api/tasks/my-tasks/"""
    authentication_classes = [StandaloneTokenAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try:
            filters = {}
            for key in [
                'status', 'priority', 'task_type',
                'date_from', 'date_to',
                'overdue_only', 'extended_only', 'search',
            ]:
                filters[key] = request.query_params.get(key)
            for key in ['status', 'priority', 'task_type']:
                if filters.get(key):
                    filters[key] = int(filters[key])
            has_filters = any(v is not None for v in filters.values())
            result = services.get_tasks(
                request.user.emp_id, 'SELF',
                filters if has_filters else None,
            )
            return success_response(data=result)
        except Exception as e:
            return error_response(message=str(e))


@authentication_classes([StandaloneTokenAuthentication])
class AssignedByMeView(APIView):
    """GET /api/tasks/assigned-by-me/"""
    authentication_classes = [StandaloneTokenAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try:
            filters = {}
            for key in [
                'status', 'priority', 'task_type',
                'employee_id', 'date_from', 'date_to',
                'overdue_only', 'extended_only', 'search',
            ]:
                filters[key] = request.query_params.get(key)
            for key in ['status', 'priority', 'task_type', 'employee_id']:
                if filters.get(key):
                    filters[key] = int(filters[key])
            has_filters = any(v is not None for v in filters.values())
            result = services.get_tasks(
                request.user.emp_id, 'ASSIGNED_BY_ME',
                filters if has_filters else None,
            )
            return success_response(data=result)
        except Exception as e:
            return error_response(message=str(e))


@authentication_classes([StandaloneTokenAuthentication])
class UpdateTaskStatusView(APIView):
    """POST /api/tasks/update-status/"""
    authentication_classes = [StandaloneTokenAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            data = request.data
            if 'execution_log_id' not in data:
                return error_response("execution_log_id required")
            if 'action_type' not in data:
                return error_response("action_type required")
            result = services.update_task_status(
                data['execution_log_id'],
                data['action_type'],
                request.user.emp_id,
                data.get('remarks', ''),
                request.user.emp_name,
            )
            return success_response(data=result, message="Status updated")
        except Exception as e:
            return error_response(message=str(e))


@authentication_classes([StandaloneTokenAuthentication])
class ExtendTaskView(APIView):
    """POST /api/tasks/extend/"""
    authentication_classes = [StandaloneTokenAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            data = request.data
            if 'execution_log_id' not in data:
                return error_response("execution_log_id required")
            if 'extended_date' not in data:
                return error_response("extended_date required")
            result = services.extend_task(
                data['execution_log_id'],
                request.user.emp_id,
                data['extended_date'],
                data.get('remarks', ''),
                request.user.emp_name,
            )
            return success_response(data=result, message="Deadline extended")
        except Exception as e:
            return error_response(message=str(e))


@authentication_classes([StandaloneTokenAuthentication])
class TaskHistoryView(APIView):
    """GET /api/tasks/history/<id>/"""
    authentication_classes = [StandaloneTokenAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self, request, execution_log_id):
        try:
            return success_response(
                data=services.get_task_history(execution_log_id))
        except Exception as e:
            return error_response(message=str(e))


@authentication_classes([StandaloneTokenAuthentication])
class DashboardView(APIView):
    """GET /api/tasks/dashboard/?view=SELF|ASSIGNED_BY_ME"""
    def get(self, request):
        try:
            view_type = request.query_params.get('view', 'SELF')
            if view_type not in ['SELF', 'ASSIGNED_BY_ME']:
                view_type = 'SELF'
            result = services.get_dashboard_counts(
                request.user.emp_id, view_type)
            return success_response(data=result)
        except Exception as e:
            return error_response(message=str(e))


class CheckDateView(APIView):
    """GET /api/tasks/check-date/?date=2025-07-06"""
    def get(self, request):
        try:
            d = request.query_params.get('date')
            if not d:
                return error_response("date parameter required")
            return success_response(data=get_shift_info(d))
        except Exception as e:
            return error_response(message=str(e))


@authentication_classes([StandaloneTokenAuthentication])
class AffectedByHolidayView(APIView):
    """GET /api/tasks/affected-by-holiday/?view=ASSIGNED_BY_ME"""
    authentication_classes = [StandaloneTokenAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try:
            view_type = request.query_params.get('view', 'ASSIGNED_BY_ME')
            if view_type not in ['SELF', 'ASSIGNED_BY_ME']:
                view_type = 'ASSIGNED_BY_ME'
            result = services.get_affected_tasks(
                request.user.emp_id, view_type)
            return success_response(data=result)
        except Exception as e:
            return error_response(message=str(e))