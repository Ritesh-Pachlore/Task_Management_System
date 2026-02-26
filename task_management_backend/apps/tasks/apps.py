from django.apps import AppConfig


class TasksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # name = 'tasks'

    name = 'apps.tasks'

    # def ready(self):
    #     import os
    #     # Ensure scheduler only starts once (avoid double start in dev reload)
    #     if os.environ.get('RUN_MAIN') == 'true':
    #         from . import scheduler
    #         scheduler.start()
