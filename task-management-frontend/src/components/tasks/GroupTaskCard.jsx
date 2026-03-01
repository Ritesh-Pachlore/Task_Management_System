// src/components/tasks/GroupTaskCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../common/StatusBadge';
import PriorityBadge from '../common/PriorityBadge';
import { STATUS_MAP, PRIORITY_MAP } from '../../utils/constants';
import { formatDate } from '../../utils/formatters';
import { MdAccessTime, MdGroups, MdHistory } from 'react-icons/md';
import './TaskCard.css';

const GroupTaskCard = ({ members, onAction }) => {
    const navigate = useNavigate();
    // Shared task details from any row (all members share task_details)
    const task = members[0];
    const status = Number(task.task_status !== undefined ? task.task_status : task.status);
    const isInfinite = task.effective_deadline && task.effective_deadline.startsWith('3000');

    // Manager actions (Cancel, Extend, Approve, Reject, Edit)
    const getActions = () => {
        const actions = [];
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

    // Lead's execution log ID for history
    const leadLogId = members.find(m => m.is_team_lead)?.execution_log_id || task.execution_log_id;

    return (
        <div className="task-card group-task-card">
            <div className="task-card-top">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <PriorityBadge priority={task.priority_type} />
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

            {/* Members Status List */}
            <div className="group-members-status-box" style={{
                margin: '15px 0',
                padding: '12px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #eef0f2'
            }}>
                <h4 style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <MdGroups /> Member Status
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {members.map(member => (
                        <div key={member.execution_log_id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.85rem',
                            padding: '4px 8px',
                            background: 'white',
                            borderRadius: '4px',
                            border: '1px solid #eee'
                        }}>
                            <span style={{ fontWeight: member.is_team_lead ? 'bold' : 'normal' }}>
                                {member.emp_name} {member.is_team_lead ? '⭐' : ''}
                            </span>
                            <StatusBadge status={member.task_status !== undefined ? member.task_status : member.status} mini />
                        </div>
                    ))}
                </div>
            </div>

            <div className="task-card-meta">
                <div className="task-meta-item">
                    <MdAccessTime />
                    <span>
                        Due: {isInfinite ? 'No Deadline' : formatDate(task.effective_deadline)}
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
