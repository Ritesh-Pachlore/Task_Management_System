"""
Holiday Helper — Uses REAL data from inout_aems..holiday_master
──────────────────────────────────────────────────────────────
Two functions:
  is_holiday_or_sunday() → Simple yes/no check
  get_shift_info()       → Full info for permission popup
"""

from datetime import date, timedelta
from utils.db_helper import run_query


def is_holiday_or_sunday(check_date):
    """Check if date is Sunday or holiday. Returns {"is_non_working": bool, "reason": str}"""
    if isinstance(check_date, str):
        check_date = date.fromisoformat(check_date)
    
    if check_date.weekday() == 6:
        return {"is_non_working": True, "reason": "Sunday"}
    
    # REAL holidays from inout_aems
    sql = """
        SELECT TOP 1 Holiday_Desc 
        FROM LPDATA..holiday_master
        WHERE Holiday_Date = %s AND Status = 1
    """
    result = run_query(sql, [check_date])
    
    if result and len(result) > 0:
        return {"is_non_working": True, "reason": result[0]['Holiday_Desc']}
    
    return {"is_non_working": False, "reason": None}


def get_shift_info(check_date):
    """Full date check with shift suggestion for permission popup."""
    if isinstance(check_date, str):
        check_date = date.fromisoformat(check_date)
    
    check = is_holiday_or_sunday(check_date)
    
    if not check["is_non_working"]:
        return {
            "needs_shift": False,
            "original_date": str(check_date),
            "suggested_date": str(check_date),
            "reason": None,
            "message": None,
        }
    
    current = check_date
    safety = 0
    while safety < 10:
        current = current + timedelta(days=1)
        if not is_holiday_or_sunday(current)["is_non_working"]:
            break
        safety += 1
    
    return {
        "needs_shift": True,
        "original_date": str(check_date),
        "suggested_date": str(current),
        "reason": check["reason"],
        "message": (
            f"{check_date.strftime('%b %d, %Y')} is {check['reason']}. "
            f"Shift to {current.strftime('%b %d, %Y')}?"
        ),
    }