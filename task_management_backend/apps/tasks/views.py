"""
Task Views — All API endpoints
request.user has: emp_id, emp_name (from JWT token)
"""

from rest_framework.views import APIView
from utils.response_handler import success_response, error_response
from . import services
from .holiday_helper import get_shift_info


class CreateTaskView(APIView):
    """POST /api/tasks/create/"""
    def post(self, request):
        try:
            result = services.create_task(
                task_data=request.data,
                created_by=request.user.emp_id,
                created_by_name=request.user.emp_name,
            )
            if result and result[0].get('success') == 1:
                return success_response(data=result[0], message="Task created successfully")
            msg = result[0].get('message', 'Failed') if result else 'Failed'
            return error_response(message=msg)
        except Exception as e:
            return error_response(message=str(e))


class MyTasksView(APIView):
    """GET /api/tasks/my-tasks/"""
    def get(self, request):
        try:
            filters = {
                'status': request.query_params.get('status'),
                'priority': request.query_params.get('priority'),
                'task_type': request.query_params.get('task_type'),
                'date_from': request.query_params.get('date_from'),
                'date_to': request.query_params.get('date_to'),
                'overdue_only': request.query_params.get('overdue_only'),
                'extended_only': request.query_params.get('extended_only'),
                'search': request.query_params.get('search'),
            }
            for key in ['status', 'priority', 'task_type']:
                if filters.get(key): filters[key] = int(filters[key])
            return success_response(data=services.get_tasks(
                request.user.emp_id, 'SELF', filters))
        except Exception as e:
            return error_response(message=str(e))


class AssignedByMeView(APIView):
    """GET /api/tasks/assigned-by-me/"""
    def get(self, request):
        try:
            filters = {
                'status': request.query_params.get('status'),
                'priority': request.query_params.get('priority'),
                'task_type': request.query_params.get('task_type'),
                'employee_id': request.query_params.get('employee_id'),
                'date_from': request.query_params.get('date_from'),
                'date_to': request.query_params.get('date_to'),
                'overdue_only': request.query_params.get('overdue_only'),
                'extended_only': request.query_params.get('extended_only'),
                'search': request.query_params.get('search'),
            }
            for key in ['status', 'priority', 'task_type', 'employee_id']:
                if filters.get(key): filters[key] = int(filters[key])
            return success_response(data=services.get_tasks(
                request.user.emp_id, 'ASSIGNED_BY_ME', filters))
        except Exception as e:
            return error_response(message=str(e))


class UpdateTaskStatusView(APIView):
    """POST /api/tasks/update-status/"""
    def post(self, request):
        try:
            data = request.data
            if 'execution_log_id' not in data:
                return error_response("execution_log_id is required")
            if 'action_type' not in data:
                return error_response("action_type is required")
            result = services.update_task_status(
                int(data['execution_log_id']), int(data['action_type']),
                request.user.emp_id, data.get('remarks', ''), request.user.emp_name)
            if result and result[0].get('success') == 1:
                return success_response(data=result[0], message="Status updated")
            msg = result[0].get('message', 'Failed') if result else 'Failed'
            return error_response(message=msg)
        except Exception as e:
            return error_response(message=str(e))


class ExtendTaskView(APIView):
    """POST /api/tasks/extend/"""
    def post(self, request):
        try:
            data = request.data
            if 'execution_log_id' not in data:
                return error_response("execution_log_id is required")
            if 'extended_date' not in data:
                return error_response("extended_date is required")
            result = services.extend_task(
                int(data['execution_log_id']), request.user.emp_id,
                data['extended_date'], data.get('remarks', ''), request.user.emp_name)
            if result and result[0].get('success') == 1:
                return success_response(data=result[0], message="Deadline extended")
            msg = result[0].get('message', 'Failed') if result else 'Failed'
            return error_response(message=msg)
        except Exception as e:
            return error_response(message=str(e))


class TaskHistoryView(APIView):
    """GET /api/tasks/history/<execution_log_id>/"""
    def get(self, request, execution_log_id):
        try:
            return success_response(data=services.get_task_history(execution_log_id))
        except Exception as e:
            return error_response(message=str(e))


class DashboardView(APIView):
    """GET /api/tasks/dashboard/?view=SELF or ASSIGNED_BY_ME"""
    def get(self, request):
        try:
            view_type = request.query_params.get('view', 'SELF')
            if view_type not in ['SELF', 'ASSIGNED_BY_ME']:
                view_type = 'SELF'
            return success_response(data=services.get_dashboard_counts(
                request.user.emp_id, view_type))
        except Exception as e:
            return error_response(message=str(e))


class CheckDateView(APIView):
    """GET /api/tasks/check-date/?date=2025-07-06"""
    def get(self, request):
        try:
            date_str = request.query_params.get('date')
            if not date_str:
                return error_response("date parameter is required")
            return success_response(data=get_shift_info(date_str))
        except ValueError:
            return error_response("Invalid date format. Use YYYY-MM-DD")
        except Exception as e:
            return error_response(message=str(e))


class AffectedByHolidayView(APIView):
    """GET /api/tasks/affected-by-holiday/?view=ASSIGNED_BY_ME"""
    def get(self, request):
        try:
            view_type = request.query_params.get('view', 'ASSIGNED_BY_ME')
            if view_type not in ['SELF', 'ASSIGNED_BY_ME']:
                view_type = 'ASSIGNED_BY_ME'
            return success_response(data=services.get_affected_tasks(
                request.user.emp_id, view_type))
        except Exception as e:
            return error_response(message=str(e))