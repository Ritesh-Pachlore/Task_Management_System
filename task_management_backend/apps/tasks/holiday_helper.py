"""
Holiday Helper — Uses REAL data from inout_aems..holiday_master
──────────────────────────────────────────────────────────────
Two functions:
  is_holiday_or_sunday() → Simple yes/no check
  get_shift_info()       → Full info for permission popup
"""

from datetime import date, timedelta
from utils.db_helper import run_query


def is_holiday_or_sunday(check_date, emp_id=None):
    """Check if date is an off-day or holiday for a specific employee."""
    if isinstance(check_date, str):
        check_date = date.fromisoformat(check_date)
    
    # 1. Check for employee-specific week-off or Sunday
    # Only if emp_list/emp_id is provided
    if emp_id and str(emp_id).strip():
        sql_off = """
            SELECT TOP 1 WEEK_OFF 
            FROM inout_aems..weekoffmst
            WHERE EMP_ID = %s AND %s BETWEEN DATE_FROM AND DATE_TO
        """
        off_res = run_query(sql_off, [emp_id, check_date])
        if off_res:
            # Use .strip() and .lower() for robust comparison
            week_off_name = str(off_res[0]['WEEK_OFF']).strip().lower()
            if check_date.strftime('%A').lower() == week_off_name:
                return {"is_non_working": True, "reason": f"Weekly Off ({week_off_name.capitalize()})"}
        else:
            # Fallback to Sunday if no record exists for this employee
            if check_date.weekday() == 6:
                return {"is_non_working": True, "reason": "Sunday (Weekly Off)"}
    
    # 2. ALWAYS check for public holidays from LPDATA..holiday_master
    sql_hol = """
        SELECT TOP 1 Holiday_Desc 
        FROM LPDATA..holiday_master
        WHERE Holiday_Date = %s AND Status = 1
    """
    result = run_query(sql_hol, [check_date])
    
    if result and len(result) > 0:
        return {"is_non_working": True, "reason": result[0]['Holiday_Desc']}
    
    return {"is_non_working": False, "reason": None}


def get_shift_info(check_date, emp_id=None):
    """Full date check with shift suggestion for permission popup."""
    if isinstance(check_date, str):
        check_date = date.fromisoformat(check_date)
    
    check = is_holiday_or_sunday(check_date, emp_id)
    
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
        if not is_holiday_or_sunday(current, emp_id)["is_non_working"]:
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