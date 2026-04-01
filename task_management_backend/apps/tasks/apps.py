from django.apps import AppConfig
import os
import sys


class TasksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.tasks'

    # def ready(self):
    #     # Only start scheduler when running the actual web server
    #     # Skip during: makemigrations, migrate, shell, test, etc.
    #     is_runserver = 'runserver' in sys.argv
    #     if not is_runserver:
    #         return

    #     # In dev mode, Django launches 2 processes (file watcher + main).
    #     # RUN_MAIN == 'true' only in the actual main server process.
    #     if os.environ.get('RUN_MAIN') != 'true':
    #         return

    #     from . import scheduler
    #     scheduler.start()
