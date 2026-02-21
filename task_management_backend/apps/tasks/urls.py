from django.urls import path
from . import views

urlpatterns = [
    path('create/',              views.CreateTaskView.as_view()),
    path('my-tasks/',            views.MyTasksView.as_view()),
    path('assigned-by-me/',      views.AssignedByMeView.as_view()),
    path('update-status/',       views.UpdateTaskStatusView.as_view()),
    path('extend/',              views.ExtendTaskView.as_view()),
    path('history/<int:execution_log_id>/', views.TaskHistoryView.as_view()),
    path('dashboard/',           views.DashboardView.as_view()),
    path('check-date/',          views.CheckDateView.as_view()),
    path('affected-by-holiday/', views.AffectedByHolidayView.as_view()),
]