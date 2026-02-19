"""
Auth URLs — No login endpoint. Dev token only.
"""

from django.urls import path
from . import views

urlpatterns = [
    path('dev-token/', views.DevTokenView.as_view()),
    path('me/', views.MeView.as_view()),
    path('employees/', views.EmployeeListView.as_view()),
]

