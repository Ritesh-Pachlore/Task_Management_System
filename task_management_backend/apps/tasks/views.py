# apps/tasks/views.py

from rest_framework.views import APIView
from rest_framework.decorators import authentication_classes
from rest_framework.permissions import IsAuthenticated
from utils.response_handler import success_response, error_response
from utils.constants import TaskType
from . import services
from .holiday_helper import get_shift_info
from apps.authentication.token_auth import StandaloneTokenAuthentication

from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator


# Convert cursor results to list of dicts
def dictfetchall(cursor):
    "Return all rows from a cursor as a list of dicts"
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


@authentication_classes([StandaloneTokenAuthentication])
class CreateTaskView(APIView):
    """
    POST /api/tasks/create/
    """
    authentication_classes = [StandaloneTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            data = request.data
            files = request.FILES.getlist('attachments')
            task_type = int(data.get('task_type', 0))

            # ── Validate required base fields ────────────────────
            if not data.get('task_title', '').strip():
                return error_response("task_title is required")

            if not data.get('task_start_date') and task_type != TaskType.DAILY:
                return error_response("task_start_date is required")

            if not data.get('emp_list'):
                return error_response("emp_list is required")

            # ── Task-type-aware validation ───────────────────────
            if task_type == TaskType.TIME_BOUND:
                if not data.get('task_end_date'):
                    return error_response(
                        "task_end_date is required for Time Bound tasks")
                if not data.get('start_time'):
                    return error_response(
                        "start_time is required for Time Bound tasks")
                if not data.get('end_time'):
                    return error_response(
                        "end_time is required for Time Bound tasks")
                if (data.get('task_start_date') == data.get('task_end_date') and
                        data.get('end_time') <= data.get('start_time')):
                    return error_response(
                        "end_time must be after start_time on the same day")

            elif task_type in [TaskType.DAILY, TaskType.WEEKLY, TaskType.MONTHLY]:
                if task_type == TaskType.WEEKLY:
                    if not data.get('weekly_days'):
                        return error_response("weekly_days is required for Weekly tasks")
                elif task_type == TaskType.MONTHLY:
                    if not data.get('monthly_day_of_month'):
                        return error_response("monthly_day_of_month is required for Monthly tasks")

            elif task_type == TaskType.RANDOM:
                pass

            else:
                return error_response(
                    f"Invalid task_type: {task_type}. "
                    f"Valid: 1(Daily), 2(Weekly), 3(Monthly), 4(Random), 5(Time Bound)")

            result = services.create_task(
                task_data=data,
                created_by=request.user.emp_id,
                created_by_name=request.user.emp_name,
                attachments=files,
            )

            if result and result[0].get('success') == 0:
                return error_response(result[0].get('message', 'Failed to create task'))

            return success_response(
                data=result,
                message="Task created successfully",
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
                'filter_group',
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
                'filter_group',
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
            files = request.FILES.getlist('attachments')

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
                files,
            )
            
            if result and result[0].get('success') == 0:
                return error_response(result[0].get('message', 'Failed to update status'))
                
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
            
            if result and result[0].get('success') == 0:
                return error_response(result[0].get('message', 'Failed to extend deadline'))
                
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
    authentication_classes = [StandaloneTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            view_type = request.query_params.get('view', 'SELF')
            if view_type not in ['SELF', 'ASSIGNED_BY_ME']:
                view_type = 'SELF'

            date_from = request.query_params.get('date_from') or None
            date_to = request.query_params.get('date_to') or None
            employee_id = request.query_params.get('employee_id')
            if employee_id:
                employee_id = int(employee_id)

            result = services.get_dashboard_counts(
                request.user.emp_id,
                view_type,
                date_from=date_from,
                date_to=date_to,
                employee_id=employee_id
            )
            return success_response(data=result)
        except Exception as e:
            return error_response(message=str(e))


class CheckDateView(APIView):
    """GET /api/tasks/check-date/?date=2025-07-06"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            d = request.query_params.get('date')
            emp_id = request.query_params.get('emp_id')
            emp_list = request.query_params.get('emp_list')

            if not d:
                return error_response("date parameter required")

            target_emp = emp_id
            if not target_emp and emp_list:
                target_emp = emp_list.split(',')[0]

            return success_response(data=get_shift_info(d, target_emp))
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


# ✅ SINGLE EditTaskView — uses services layer, supports team_lead_emp_id
@authentication_classes([StandaloneTokenAuthentication])
class EditTaskView(APIView):
    """POST /api/tasks/edit/"""
    authentication_classes = [StandaloneTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            data = request.data

            # Required fields
            if 'execution_log_id' not in data:
                return error_response("execution_log_id required")
            if 'title' not in data:
                return error_response("title required")
            if 'description' not in data:
                return error_response("description required")

            # Execute via services layer
            result = services.edit_task(
                execution_log_id=data['execution_log_id'],
                title=data['title'],
                description=data['description'],
                emp_list=data.get('emp_list'),
                deadline=data.get('deadline'),
                team_lead_emp_id=data.get('team_lead_emp_id'),  # NEW
            )
            
            if result and result[0].get('success') == 0:
                return error_response(result[0].get('message', 'Failed to edit task'))

            return success_response(data=result, message="Task edited successfully")
        except Exception as e:
            return error_response(message=str(e))