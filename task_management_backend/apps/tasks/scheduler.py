"""
scheduler.py — APScheduler with DjangoJobStore
────────────────────────────────────────────────
Runs sp_generate_recurring_tasks every day at 12:01 AM (Asia/Kolkata).
Writes job + execution history to SQL Server (django_apscheduler tables).

PREREQUISITE: Run fix_apscheduler_tables.sql in SSMS first, then:
  python manage.py migrate django_apscheduler --fake
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from django_apscheduler.jobstores import DjangoJobStore
from django.db import connection

logger = logging.getLogger(__name__)

# Global — prevent double-start on dev server reload
_scheduler = None


def generate_recurring_tasks():
    """
    Calls sp_generate_recurring_tasks for today's date.
    Replaces the SQL Server Agent job at 12:01 AM.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("EXEC [DButilities].[dbo].[sp_generate_recurring_tasks]")
            try:
                rows = cursor.fetchall()
                if rows:
                    logger.info(f"✅ Recurring tasks generated: {rows[0]}")
                else:
                    logger.info("✅ sp_generate_recurring_tasks ran successfully.")
            except Exception:
                logger.info("✅ sp_generate_recurring_tasks ran successfully.")
    except Exception as e:
        logger.error(f"❌ Error running sp_generate_recurring_tasks: {e}")


def start():
    global _scheduler

    # Prevent double-start
    if _scheduler and _scheduler.running:
        logger.info("Scheduler already running — skipping start.")
        return

    _scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    _scheduler.add_jobstore(DjangoJobStore(), "default")

    _scheduler.add_job(
        generate_recurring_tasks,
        trigger=CronTrigger(hour=0, minute=1),   # 12:01 AM every day
        id="generate_recurring_tasks",
        name="Generate Recurring Tasks Daily",
        jobstore="default",
        replace_existing=True,                   # no ConflictingIdError on reload
    )

    logger.info("⏰ Scheduler started — recurring task generation at 12:01 AM daily.")
    _scheduler.start()
