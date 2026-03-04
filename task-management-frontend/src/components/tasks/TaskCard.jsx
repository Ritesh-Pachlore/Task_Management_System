// src/components/tasks/TaskCard.jsx
import React from 'react';
import api, { API_BASE_URL } from '../../api/axios';
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

    const status = Number(task.task_status !== undefined ? task.task_status : task.status);
    // Overdue only if status is not Approved (3) or Cancelled (6)
    const isOverdue = (task.is_overdue === 1 || task.is_overdue === true) && ![3, 6].includes(status);
    const daysText = getDaysText(task.days_remaining);
    const days = task.days_remaining;

    // We consider 3000-12-31 as an "infinite" date that shouldn't be shown as a real deadline
    const isInfinite = task.effective_deadline && task.effective_deadline.startsWith('3000');

    // Calculate Start Date differences
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parse task_start_date robustly
    const startDate = new Date(task.task_start_date);
    startDate.setHours(0, 0, 0, 0);

    const isFutureStart = startDate > today;
    const diffDaysToStart = Math.ceil(Math.abs(startDate - today) / (1000 * 60 * 60 * 24));

    const getDueDateColor = () => {
        if (isOverdue) return 'text-danger';
        if (isInfinite) return 'text-muted';
        if (days === 0) return 'text-due-orange'; // Due today
        if (days === 1) return 'text-due-yellow'; // 1 day left
        if (days >= 2) return 'text-due-green';   // 2+ days left
        return 'text-muted';
    };

    const getActions = () => {
        const actions = [];

        if (viewType === 'SELF') {
            const isGroup = !!task.group_id;
            // Use Number() for robustness against string/int types from backend
            const isLead = Number(task.is_team_lead) === 1;

            // Only Lead or Individual Task can take actions
            if (!isGroup || isLead) {
                if (status === 0 && !isFutureStart) {
                    actions.push({ type: 1, label: 'Start', cls: 'btn-primary' });
                }
                if (status === 1) actions.push({ type: 2, label: 'Submit', cls: 'btn-success' });
                if (status === 4) actions.push({ type: 5, label: 'Resubmit', cls: 'btn-warning' });
                if (status === 7) actions.push({ type: 1, label: 'Resume', cls: 'btn-primary' });
            }
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
            className={`task - card ${isOverdue ? 'task-card-overdue' : ''} `}
        >
            <div className="task-card-top">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <PriorityBadge priority={task.priority_type} />
                        <StatusBadge status={status} />
                        {task.extended_date && <span className="task-extended-tag">Extended</span>}
                        {task.group_id && (
                            <span className={`task - group - badge ${task.is_team_lead ? 'lead' : 'member'} `} style={{
                                fontSize: '12px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: task.is_team_lead ? '#e3f2fd' : '#f8f9fa',
                                color: task.is_team_lead ? '#0d47a1' : '#616161',
                                border: `1px solid ${task.is_team_lead ? '#90caf9' : '#eeeeee'} `,
                                boxShadow: task.is_team_lead ? '0 2px 4px rgba(13, 71, 161, 0.1)' : 'none',
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px'
                            }}>
                                {task.is_team_lead ? '⭐' : '👥'} Lead: {task.team_lead_name || 'N/A'}
                            </span>
                        )}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                        {PRIORITY_MAP[task.priority_type]?.name || ''}{', '}{STATUS_MAP[status]?.name || ''}
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

            {/* Group Members Section */}
            {task.group_id && task.emp_names && (
                <div style={{
                    marginTop: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#555' }}>members:-</span>
                    {task.emp_names.split(',').map((name, index) => (
                        <span key={index} style={{
                            padding: '4px 10px',
                            background: 'rgba(67, 97, 238, 0.05)',
                            border: '1px solid #4361ee',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: '#4361ee',
                            fontWeight: '500',
                            whiteSpace: 'nowrap'
                        }}>
                            {name.trim()}
                        </span>
                    ))}
                </div>
            )}
            {/* Attachments Section */}
            {task.attachments && task.attachments.length > 0 && (() => {
                const managerFiles = task.attachments.filter(f => !f.is_employee_upload);
                const employeeFiles = task.attachments.filter(f => f.is_employee_upload);

                return (
                    <div className="task-attachments" style={{ marginTop: 10 }}>
                        {managerFiles.length > 0 && (
                            <div style={{ marginBottom: employeeFiles.length > 0 ? 8 : 0 }}>
                                <strong style={{ fontSize: 13, display: 'block' }}>Attachments (Manager):</strong>
                                {managerFiles.map((file, index) => (
                                    <div key={index} style={{ marginTop: 4 }}>
                                        <a
                                            href={`${API_BASE_URL}${file.file_url}`}
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

                        {employeeFiles.length > 0 && (
                            <div>
                                <strong style={{ fontSize: 13, display: 'block' }}>Attachments (Employee - {employeeFiles[0].uploaded_by}):</strong>
                                {employeeFiles.map((file, index) => (
                                    <div key={index} style={{ marginTop: 4 }}>
                                        <a
                                            href={`${API_BASE_URL}${file.file_url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ fontSize: 13, color: '#28a745' }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            📎 {file.file_name}
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })()}

            <div className="task-card-meta">
                <div className="task-meta-item">
                    <MdPerson />
                    <span>
                        {viewType === 'SELF'
                            ? `By: ${task.assigned_by_name || 'Unknown'} `
                            : `To: ${task.emp_name || 'Unknown'} `
                        }
                    </span>
                </div>
                <div className="task-meta-item">
                    <MdAccessTime />
                    <span>
                        {task.task_type === 1
                            ? `Daily Task${!isInfinite ? ' | Due: ' + formatDate(task.effective_deadline) : ''} `
                            : task.task_type === 2
                                ? `Weekly task on ${task.weekly_days || 'N/A'}${(!isInfinite && task.effective_deadline) ? ' | Due: ' + formatDate(task.effective_deadline) : ''} `
                                : task.task_type === 3
                                    ? `Monthly task on ${task.monthly_day_of_month ? task.monthly_day_of_month + getSuffix(task.monthly_day_of_month) : 'N/A'}${(!isInfinite && task.effective_deadline) ? ' | Due: ' + formatDate(task.effective_deadline) : ''} `
                                    : formatDate(task.effective_deadline)
                        }
                        {/* // Display "Starts in X days" */}
                        {!isInfinite && daysText && !isFutureStart && (
                            <span className={getDueDateColor()}>
                                {' '}({daysText})
                            </span>
                        )}
                        {isFutureStart && status === 0 && (
                            <span className="text-info" style={{ marginLeft: '5px', fontWeight: 'bold' }}>
                                (Starts in {diffDaysToStart} day{diffDaysToStart > 1 ? 's' : ''})
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
                            className={`btn btn - sm ${action.cls} `}
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
                            navigate(`/ task / ${task.execution_log_id} `);
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