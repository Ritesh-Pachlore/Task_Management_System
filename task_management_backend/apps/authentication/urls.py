"""
Auth URLs — No login endpoint. Dev token only.
"""

from django.urls import path
#from . import views
from .views import DevTokenView, EmployeeListView


urlpatterns = [
    # GET /api/auth/dev-token/?emp_id=102201
    path('dev-token/',  DevTokenView.as_view()),

    # GET /api/auth/employees/
    # GET /api/auth/employees/?search=rahul
    path('employees/',  EmployeeListView.as_view()),
]


# urlpatterns = [
#     path('dev-token/', views.DevTokenView.as_view()),
#     path('me/', views.MeView.as_view()),
#     path('employees/', views.EmployeeListView.as_view()),
# ]
