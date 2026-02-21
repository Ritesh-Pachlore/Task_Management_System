"""
Database Helper — Calls stored procedures and raw queries
All database access goes through these 3 functions.
"""

from django.db import connection
import logging

logger = logging.getLogger(__name__)


def call_sp(sp_name, params=None):
    """Call SP that returns ONE result set."""
    with connection.cursor() as cursor:
        try:
            if params:
                placeholders = ', '.join(['%s'] * len(params))
                cursor.execute(f"EXEC {sp_name} {placeholders}", params)
            else:
                cursor.execute(f"EXEC {sp_name}")
            
            if cursor.description:
                columns = [col[0] for col in cursor.description]
                rows = cursor.fetchall()
                return [dict(zip(columns, row)) for row in rows]
            return []
        except Exception as e:
            logger.error(f"SP Error [{sp_name}]: {str(e)}")
            raise


def call_sp_multiple_results(sp_name, params=None):
    """Call SP that returns MULTIPLE result sets (like dashboard)."""
    with connection.cursor() as cursor:
        try:
            if params:
                placeholders = ', '.join(['%s'] * len(params))
                cursor.execute(f"EXEC {sp_name} {placeholders}", params)
            else:
                cursor.execute(f"EXEC {sp_name}")
            
            result_sets = []
            
            if cursor.description:
                columns = [col[0] for col in cursor.description]
                rows = cursor.fetchall()
                result_sets.append([dict(zip(columns, row)) for row in rows])
            else:
                result_sets.append([])
            
            while cursor.nextset():
                try:
                    if cursor.description:
                        columns = [col[0] for col in cursor.description]
                        rows = cursor.fetchall()
                        result_sets.append([dict(zip(columns, row)) for row in rows])
                    else:
                        result_sets.append([])
                except Exception:
                    result_sets.append([])
            
            return result_sets
        except Exception as e:
            logger.error(f"SP Error [{sp_name}]: {str(e)}")
            raise


def run_query(sql, params=None):
    """Run raw SQL query. Used by holiday_helper."""
    with connection.cursor() as cursor:
        try:
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            
            if cursor.description:
                columns = [col[0] for col in cursor.description]
                rows = cursor.fetchall()
                return [dict(zip(columns, row)) for row in rows]
            return []
        except Exception as e:
            logger.error(f"Query Error: {str(e)}")
            raise