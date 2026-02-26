// src/components/tasks/TaskCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../common/StatusBadge';
import PriorityBadge from '../common/PriorityBadge';
import { STATUS_MAP, PRIORITY_MAP } from '../../utils/constants';
import { formatDate, getDaysText } from '../../utils/formatters';
import { MdAccessTime, MdPerson, MdHistory } from 'react-icons/md';
import './TaskCard.css';

// Helper: get ordinal suffix (1st, 2nd, 3rd, etc.)
const getSuffix = (day) => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
};

const TaskCard = ({ task, viewType, onAction }) => {
    const navigate = useNavigate();

    const status = task.status;
    // Overdue only if status is not Approved (3) or Cancelled (6)
    const isOverdue = (task.is_overdue === 1 || task.is_overdue === true) && ![3, 6].includes(status);
    const daysText = getDaysText(task.days_remaining);
    const days = task.days_remaining;

    // We consider 3000-12-31 as an "infinite" date that shouldn't be shown as a real deadline
    const isInfinite = task.effective_deadline && task.effective_deadline.startsWith('3000');

    const getDueDateColor = () => {
        if (isOverdue) return 'text-danger';
        if (isInfinite) return 'text-muted';
        if (days === 0) return 'text-due-orange'; // Due today
        if (days === 1) return 'text-due-yellow'; // 1 day left
        if (days >= 2) return 'text-due-green';   // 2+ days left
        return 'text-muted';
    };

    const getActions = () => {
        const status = task.status;
        const actions = [];

        if (viewType === 'SELF') {
            if (status === 0) actions.push({ type: 1, label: 'Start', cls: 'btn-primary' });
            if (status === 1) actions.push({ type: 2, label: 'Submit', cls: 'btn-success' });
            if (status === 4) actions.push({ type: 5, label: 'Resubmit', cls: 'btn-warning' });
            if (status === 7) actions.push({ type: 1, label: 'Resume', cls: 'btn-primary' });
        }

        if (viewType === 'ASSIGNED_BY_ME') {
            // Manager actions
            if (status === 2 || status === 5) {
                actions.push({ type: 3, label: 'Approve', cls: 'btn-success' });
                actions.push({ type: 4, label: 'Reject', cls: 'btn-danger' });
            }
            if (![3, 6].includes(status)) {
                actions.push({ type: 'extend', label: 'Extend', cls: 'btn-warning' });
                actions.push({ type: 6, label: 'Cancel', cls: 'btn-outline' });
            }
            // NEW: Edit button added
            actions.push({ type: 'edit', label: 'Edit', cls: 'btn-info' });
        }

        return actions;
    };

    const editAction = getActions().find(a => a.type === 'edit');
    const otherActions = getActions().filter(a => a.type !== 'edit');

    return (
        <div
            className={`task-card ${isOverdue ? 'task-card-overdue' : ''}`}
        >
            <div className="task-card-top">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <PriorityBadge priority={task.priority_type} />
                        <StatusBadge status={task.status} />
                        {task.extended_date && <span className="task-extended-tag">Extended</span>}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                        {PRIORITY_MAP[task.priority_type]?.name || ''}{', '}{STATUS_MAP[task.status]?.name || ''}
                    </div>
                </div>

                {/* Edit button top-right */}
                {editAction && (
                    <button
                        className="task-edit-btn"
                        onClick={(e) => { e.stopPropagation(); onAction(task, editAction.type); }}
                    >
                        {editAction.label}
                    </button>
                )}
            </div>

            <h3 className="task-card-title">{task.task_title}</h3>

            {task.task_description && (
                <p className="task-card-desc">{task.task_description}</p>
            )}
            {/* Attachments Section */}
{task.attachments && task.attachments.length > 0 && (
    <div className="task-attachments" style={{ marginTop: 10 }}>
        <strong style={{ fontSize: 13 }}>Attachments:</strong>
        {task.attachments.map((file, index) => (
            <div key={index} style={{ marginTop: 4 }}>
                <a
                    href={`http://localhost:8001${file.file_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, color: '#007bff' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    📎 {file.file_name}
                </a>
            </div>
        ))}
    </div>
)}

            <div className="task-card-meta">
                <div className="task-meta-item">
                    <MdPerson />
                    <span>
                        {viewType === 'SELF'
                            ? `By: ${task.assigned_by_name || 'Unknown'}`
                            : `To: ${task.emp_name || 'Unknown'}`
                        }
                    </span>
                </div>
                <div className="task-meta-item">
                    <MdAccessTime />
                    <span>
                        {task.task_type === 1
                            ? `Daily Task${!isInfinite ? ' | Due: ' + formatDate(task.effective_deadline) : ''}`
                            : task.task_type === 2
                                ? `Weekly task on ${task.weekly_days || 'N/A'}${(!isInfinite && task.effective_deadline) ? ' | Due: ' + formatDate(task.effective_deadline) : ''}`
                                : task.task_type === 3
                                    ? `Monthly task on ${task.monthly_day_of_month ? task.monthly_day_of_month + getSuffix(task.monthly_day_of_month) : 'N/A'}${(!isInfinite && task.effective_deadline) ? ' | Due: ' + formatDate(task.effective_deadline) : ''}`
                                    : formatDate(task.effective_deadline)
                        }
                        {!isInfinite && daysText && (
                            <span className={getDueDateColor()}>
                                {' '}({daysText})
                            </span>
                        )}
                    </span>
                </div>
            </div>

            <div className="task-card-actions">
                <div className="btn-group">
                    {otherActions.map((action, idx) => (
                        <button
                            key={idx}
                            className={`btn btn-sm ${action.cls}`}
                            onClick={(e) => { e.stopPropagation(); onAction(task, action.type); }}
                        >
                            {action.label}
                        </button>
                    ))}

                    {/* Always visible History button */}
                    <button
                        className="btn btn-sm btn-outline"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/task/${task.execution_log_id}`);
                        }}
                    >
                        <MdHistory /> History
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskCard;