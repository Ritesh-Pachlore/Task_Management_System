// src/components/tasks/GroupTaskCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../common/StatusBadge';
import PriorityBadge from '../common/PriorityBadge';
import { formatDate } from '../../utils/formatters';
import { MdAccessTime, MdGroups, MdHistory } from 'react-icons/md';
import { API_BASE_URL } from '../../api/axios';
import './TaskCard.css';

const GroupTaskCard = ({ members, onAction }) => {
    const navigate = useNavigate();
    // Shared task details from any row (all members share task_details)
    const task = members[0];
    const status = Number(task.task_status !== undefined ? task.task_status : task.status);
    const isInfinite = task.effective_deadline && task.effective_deadline.startsWith('3000');

    // Calculate future start for "Allow Early Start" logic
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(task.display_start_date || task.task_start_date);
    startDate.setHours(0, 0, 0, 0);
    const isFutureStart = startDate > today;

    // Manager actions (Cancel, Extend, Approve, Reject, Edit, Allow Early Start)
    const getActions = () => {
        const actions = [];
        // Show 'Allow Early Start' if future-dated and not yet allowed (status != 8)
        if (status === 0 && isFutureStart) {
            actions.push({ type: 9, label: 'Allow Early Start', cls: 'btn-primary' });
        }
        if (status === 2 || status === 5) {
            actions.push({ type: 3, label: 'Approve', cls: 'btn-success' });
            actions.push({ type: 4, label: 'Reject', cls: 'btn-danger' });
        }
        if (![3, 6].includes(status)) {
            actions.push({ type: 'extend', label: 'Extend', cls: 'btn-warning' });
            actions.push({ type: 6, label: 'Cancel', cls: 'btn-outline' });
        }
        actions.push({ type: 'edit', label: 'Edit', cls: 'btn-info' });
        return actions;
    };

    const allActions = getActions();
    const editAction = allActions.find(a => a.type === 'edit');
    const otherActions = allActions.filter(a => a.type !== 'edit');

    // Lead's execution log ID for history and actions
    const leadLogId = members.find(m => m.is_team_lead)?.execution_log_id || task.execution_log_id;

    return (
        <div className="task-card group-task-card">
            <div className="task-card-top">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <PriorityBadge priority={task.priority_type} />
                        <StatusBadge status={status} />
                        <span className="task-group-tag">👥 GROUP TASK</span>
                        {task.extended_date && <span className="task-extended-tag">Extended</span>}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#007bff', fontWeight: 'bold' }}>
                        {members.length} Members | Lead: {members.find(m => m.is_team_lead)?.emp_name || 'N/A'}
                    </div>
                </div>

                {/* Edit button top-right (Consistent with TaskCard) */}
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
            {task.task_description && <p className="task-card-desc">{task.task_description}</p>}

            {/* Group Members Section (Matching TaskCard bubble style) */}
            <div style={{
                marginTop: '12px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '15px'
            }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#555' }}>members:-</span>
                {members.map((member, index) => (
                    <div key={index} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        background: 'rgba(67, 97, 238, 0.05)',
                        border: '1px solid #4361ee',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#4361ee',
                        fontWeight: '500',
                        whiteSpace: 'nowrap'
                    }}>
                        {member.is_team_lead ? '⭐ ' : ''}{member.emp_name}
                    </div>
                ))}
            </div>

            <div className="task-card-meta">
                <div className="task-meta-item">
                    <MdAccessTime />
                    <span>
                        Due: {isInfinite ? 'No Deadline' : formatDate(task.effective_deadline)}
                    </span>
                </div>
            </div>

            {/* Attachments Section - Collated from all members */}
            {(() => {
                const allAttachments = [];
                members.forEach(m => {
                    if (m.attachments) {
                        m.attachments.forEach(att => {
                            if (!allAttachments.find(existing => existing.file_url === att.file_url)) {
                                allAttachments.push(att);
                            }
                        });
                    }
                });

                if (allAttachments.length === 0) return null;

                const managerFiles = allAttachments.filter(f => !f.is_employee_upload);
                const employeeFiles = allAttachments.filter(f => f.is_employee_upload);

                return (
                    <div className="task-attachments" style={{ marginTop: 10, padding: '0 4px' }}>
                        {managerFiles.length > 0 && (
                            <div style={{ marginBottom: employeeFiles.length > 0 ? 8 : 0 }}>
                                <strong style={{ fontSize: 13, display: 'block', color: '#555' }}>Attachments (Manager):</strong>
                                {managerFiles.map((file, index) => (
                                    <div key={index} style={{ marginTop: 4 }}>
                                        <a
                                            href={`${API_BASE_URL}${file.file_url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ fontSize: 13, color: '#007bff', textDecoration: 'none' }}
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
                                <strong style={{ fontSize: 13, display: 'block', color: '#555' }}>Member Uploads:</strong>
                                {employeeFiles.map((file, index) => (
                                    <div key={index} style={{ marginTop: 4 }}>
                                        <a
                                            href={`${API_BASE_URL}${file.file_url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ fontSize: 13, color: '#28a745', textDecoration: 'none' }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            📎 {file.file_name} <small style={{ color: '#888' }}>({file.uploaded_by})</small>
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })()}

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

                    {/* Always visible History button (Consistent with TaskCard) */}
                    <button
                        className="btn btn-sm btn-outline"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/task/${leadLogId}`);
                        }}
                    >
                        <MdHistory /> History
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupTaskCard;
