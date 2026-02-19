"""
Auth Views — No Login, Dev Token Only
──────────────────────────────────────
GET /api/auth/dev-token/?emp_id=102201 → Get JWT token
GET /api/auth/me/ → Current user from token
GET /api/auth/employees/ → Employee list from staffmst
"""

from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from utils.db_helper import call_sp, run_query
from utils.response_handler import success_response, error_response
from .token_auth import generate_token


class DevTokenView(APIView):
    """
    GET /api/auth/dev-token/?emp_id=380988
    
    No password needed. Gets real name from staffmst.
    Generates JWT token valid for 24 hours.
    
    Response:
    {
        "success": true,
        "message": "Dev token generated for Amit Kumar",
        "data": {
            "token": "eyJ0eXAi...",
            "user": {"emp_id": 380988, "full_name": "Ritesh Pachlore"}
        }
    }
    """
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            emp_id = request.query_params.get('emp_id')

            if not emp_id:
                return error_response(
                    "emp_id parameter is required. "
                    "Example: /api/auth/dev-token/?emp_id=380988"
                )

            emp_id = int(emp_id)

            # Get REAL name from staffmst
            result = run_query(
                """
                SELECT 
                    EMP_ID AS emp_id,
                    STF_FRNAME AS first_name,
                    STF_LSNAME AS last_name,
                    STF_FRNAME + ' ' + STF_LSNAME AS full_name
                FROM inout_aems..staffmst
                WHERE EMP_ID = %s
                """,
                [emp_id]
            )

            if not result:
                return error_response(
                    f"Employee ID {emp_id} not found in staffmst."
                )

            user_data = result[0]

            token = generate_token(
                emp_id=user_data['emp_id'],
                emp_name=user_data['full_name'],
            )

            return success_response(
                data={
                    "token": token,
                    "user": {
                        "emp_id": user_data['emp_id'],
                        "full_name": user_data['full_name'],
                        "first_name": user_data['first_name'],
                        "last_name": user_data['last_name'],
                    }
                },
                message="Dev token generated for " + user_data['full_name']
            )

        except ValueError:
            return error_response("emp_id must be a number")
        except Exception as e:
            return error_response(message=str(e))


class MeView(APIView):
    """GET /api/auth/me/ — Current user info from token"""

    def get(self, request):
        return success_response(
            data={
                "emp_id": request.user.emp_id,
                "emp_name": request.user.emp_name,
            }
        )


class EmployeeListView(APIView):
    """
    GET /api/auth/employees/              → All employees
    GET /api/auth/employees/?search=rahul → Search by name
    GET /api/auth/employees/?search=3809  → Search by ID
    
    Single search input works for BOTH ID and Name.
    """

    def get(self, request):
        try:
            search = request.query_params.get('search', '').strip()

            if search:
                # Search by ID or Name using single input
                result = run_query(
                    """
                    SELECT
                        EMP_ID AS emp_id,
                        STF_FRNAME + ' ' + STF_LSNAME AS emp_name
                    FROM inout_aems..staffmst
                    WHERE
                        CAST(EMP_ID AS NVARCHAR(20)) LIKE %s
                        OR STF_FRNAME + ' ' + STF_LSNAME LIKE %s
                    ORDER BY STF_FRNAME, STF_LSNAME
                    """,
                    [f'%{search}%', f'%{search}%']
                )
            else:
                # No search — use existing SP
                result = call_sp('sp_get_employees', [request.user.emp_id])

            return success_response(data=result or [])
        except Exception as e:
            return error_response(message=str(e))








# from django.shortcuts import render

# Create your views here.
# """
# Authentication Views — Standalone Mode
# ────────────────────────────────────────
# Login with emp_id + password against local employees table.
# No Java app needed. No is_manager.
# """

# from rest_framework.views import APIView
# from rest_framework.permissions import AllowAny
# from utils.db_helper import call_sp
# from utils.response_handler import success_response, error_response
# from .token_auth import generate_token


# class LoginView(APIView):
#     """
#     POST /api/auth/login/
    
#     Body: {"emp_id": 10, "password": "password123"}
    
#     This is the ONLY endpoint that doesn't require a token.
#     (permission_classes = [AllowAny])
    
#     Success Response:
#     {
#         "success": true,
#         "message": "Login successful",
#         "data": {
#             "token": "eyJ0eXAi...",
#             "user": {
#                 "emp_id": 10,
#                 "full_name": "Amit Kumar",
#                 "email": "amit@company.com",
#                 "department": "IT"
#             }
#         }
#     }
    
#     Error Response:
#     {
#         "success": false,
#         "message": "Invalid employee ID or password"
#     }
#     """
#     permission_classes = [AllowAny]    # No token needed for login
    
#     def post(self, request):
#         try:
#             emp_id = request.data.get('emp_id')
#             password = request.data.get('password')
            
#             # Validate input
#             if not emp_id:
#                 return error_response("Employee ID is required")
#             if not password:
#                 return error_response("Password is required")
            
#             # Call login stored procedure
#             result = call_sp('sp_login', [int(emp_id), password])
            
#             # Check if login succeeded
#             if not result or not result[0].get('success'):
#                 return error_response(
#                     "Invalid employee ID or password",
#                     status_code=401
#                 )
            
#             user_data = result[0]
            
#             # Generate JWT token (no is_manager)
#             token = generate_token(
#                 emp_id=user_data['emp_id'],
#                 emp_name=user_data['full_name'],
#             )
            
#             return success_response(
#                 data={
#                     "token": token,
#                     "user": {
#                         "emp_id": user_data['emp_id'],
#                         "full_name": user_data['full_name'],
#                         "first_name": user_data['first_name'],
#                         "last_name": user_data['last_name'],
#                         "email": user_data['email'],
#                         "department": user_data['department'],
#                     }
#                 },
#                 message="Login successful"
#             )
            
#         except Exception as e:
#             return error_response(message=str(e))


# class MeView(APIView):
#     """
#     GET /api/auth/me/
    
#     Returns current user info extracted from JWT token.
#     Used by React to check if user is still logged in
#     and to display user name in navbar.
    
#     Requires: Authorization: Bearer <token>
#     """
    
#     def get(self, request):
#         return success_response(
#             data={
#                 "emp_id": request.user.emp_id,
#                 "emp_name": request.user.emp_name,
#             }
#         )


# class EmployeeListView(APIView):
#     """
#     GET /api/auth/employees/
    
#     Returns list of all active employees except current user.
#     Used for the "Assign To" dropdown when creating a task.
    
#     Response:
#     {
#         "success": true,
#         "data": [
#             {"emp_id": 25, "emp_name": "Rahul Sharma", "department": "IT"},
#             {"emp_id": 30, "emp_name": "Priya Singh", "department": "IT"},
#             ...
#         ]
#     }
#     """
    
#     def get(self, request):
#         try:
#             result = call_sp('sp_get_employees', [request.user.emp_id])
#             return success_response(data=result)
#         except Exception as e:
#             return error_response(message=str(e))