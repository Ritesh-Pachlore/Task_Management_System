// src/components/tasks/TaskCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../common/StatusBadge';
import PriorityBadge from '../common/PriorityBadge';
import { STATUS_MAP, PRIORITY_MAP } from '../../utils/constants';
import { formatDate, getDaysText } from '../../utils/formatters';
import { MdAccessTime, MdPerson, MdHistory } from 'react-icons/md';
import './TaskCard.css';

const TaskCard = ({ task, viewType, onAction }) => {
    const navigate = useNavigate();

    const isOverdue = task.is_overdue === 1 || task.is_overdue === true;
    const daysText = getDaysText(task.days_remaining);

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
            // onClick={() => navigate(`/task/${task.execution_log_id}`)}
            // style={{ cursor: 'pointer' }}
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
                        {formatDate(task.effective_deadline)}
                        {daysText && (
                            <span className={isOverdue ? 'text-danger' : 'text-muted'}>
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