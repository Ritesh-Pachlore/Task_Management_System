class TaskType:
    DAILY = 1
    WEEKLY = 2
    MONTHLY = 3
    RANDOM = 4
    TIME_BOUND = 5
    CHOICES = {1: 'DAILY',2: 'WEEKLY',3: 'MONTHLY',4: 'RANDOM',5: 'TIME_BOUND',}

class PriorityType:
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CHOICES = {1:'LOW', 2: 'MEDIUM', 3: 'HIGH'}

class TaskStatus:
    ASSIGNED = 0
    STARTED = 1
    SUBMITTED = 2
    APPROVED = 3
    REJECTED = 4
    RESUBMITTED = 5
    CANCELLED = 6
    ON_HOLD = 7
    CHOICES = {0:"ASSIGNED",1:"STARTED",2:"SUBMITTED",3:"APPROVED",
               4:"REJECTED",5:"RESUBMITTED",6:"CANCELLED",7:"ON_HOLD"}
    

class ActionType:
    ASSIGNED = 0
    STARTED = 1
    SUBMITTED = 2
    APPROVED = 3
    REJECTED = 4
    RESUBMITTED = 5
    CANCELLED = 6
    ON_HOLD = 7
    EXTENDED = 8
    CHOICES = {0:"ASSIGNED",1:"STARTED",2:"SUBMITTED",3:"APPROVED",
               4:"REJECTED",5:"RESUBMITTED",6:"CANCELLED",7:"ON_HOLD",8:"EXTENDED"}
    

class ViewType:
    SELF = 'SELF'
    ASSIGNED_BY_ME = 'ASSIGNED_BY_ME'