export const STATUS_MAP = {
    0: { name: 'ASSIGNED', color: '#8884d8', bg: '#E8E5F5' },
    1: { name: 'STARTED', color: '#2196F3', bg: '#E3F2FD' },
    2: { name: 'SUBMITTED', color: '#FF9800', bg: '#FFF3E0' },
    3: { name: 'APPROVED', color: '#4CAF50', bg: '#E8F5E9' },
    4: { name: 'REJECTED', color: '#F44336', bg: '#FFEBEE' },
    5: { name: 'RESUBMITTED', color: '#FFC107', bg: '#FFF8E1' },
    6: { name: 'CANCELLED', color: '#9E9E9E', bg: '#F5F5F5' },
    7: { name: 'ON_HOLD', color: '#795548', bg: '#EFEBE9' },
};

export const PRIORITY_MAP = {
    1: { name: 'LOW', color: '#4CAF50', bg: '#E8F5E9' },
    2: { name: 'MEDIUM', color: '#FF9800', bg: '#FFF3E0' },
    3: { name: 'HIGH', color: '#F44336', bg: '#FFEBEE' },
};

export const TASK_TYPE_MAP = {
    4: 'RANDOM',
    5: 'TIME_BOUND',
};

export const STATUS_OPTIONS = [
    { value: '', label: 'All Status' },
    { value: 0, label: 'Assigned' },
    { value: 1, label: 'Started' },
    { value: 2, label: 'Submitted' },
    { value: 3, label: 'Approved' },
    { value: 4, label: 'Rejected' },
    { value: 5, label: 'Resubmitted' },
    { value: 6, label: 'Cancelled' },
    { value: 7, label: 'On Hold' },
];

export const PRIORITY_OPTIONS = [
    { value: '', label: 'All Priority' },
    { value: 1, label: 'Low' },
    { value: 2, label: 'Medium' },
    { value: 3, label: 'High' },
];

export const TASK_TYPE_OPTIONS = [
    { value: '', label: 'All Types' },
    { value: 4, label: 'Random' },
    { value: 5, label: 'Time Bound' },
];