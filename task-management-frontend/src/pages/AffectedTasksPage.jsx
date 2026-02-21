// src/pages/AffectedTasksPage.jsx
// CHANGE: Add useCallback import, wrap fetchAffected with useCallback

import React, { useState, useEffect, useCallback } from 'react';  // ← add useCallback
import api from '../api/axios';
import { toast } from 'react-toastify';
import PriorityBadge from '../components/common/PriorityBadge';
import StatusBadge from '../components/common/StatusBadge';
import { formatDate } from '../utils/formatters';
import { MdWarning } from 'react-icons/md';

const AffectedTasksPage = () => {
    const [tasks,    setTasks]    = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [viewType, setViewType] = useState('ASSIGNED_BY_ME');

    // ← wrap with useCallback so useEffect dependency is stable
    const fetchAffected = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get(
                `/tasks/affected-by-holiday/?view=${viewType}`
            );
            if (response.data.success) {
                setTasks(response.data.data || []);
            }
        } catch (error) {
            toast.error('Failed to load affected tasks');
        }
        setLoading(false);
    }, [viewType]);  // ← viewType is the real dependency

    useEffect(() => {
        fetchAffected();
    }, [fetchAffected]);  // ← now correct

    const handleShift = async (task) => {
        try {
            const response = await api.post('/tasks/extend/', {
                execution_log_id: task.execution_log_id,
                extended_date:    task.suggested_date,
                remarks: `Shifted from ${task.reason} (${formatDate(task.current_deadline)})`,
            });
            if (response.data.success) {
                toast.success(`Shifted to ${formatDate(task.suggested_date)}`);
                fetchAffected();
            }
        } catch (error) {
            toast.error('Failed to shift date');
        }
    };

    const handleDismiss = (taskId) => {
        setTasks(prev => prev.filter(t => t.execution_log_id !== taskId));
        toast.info('Kept original date');
    };

    return (
        <div>
            <div className="page-header">
                <h1>
                    <MdWarning style={{ color: '#FF9800' }} /> Holiday Alerts
                </h1>
                <select
                    className="filter-select"
                    value={viewType}
                    onChange={(e) => setViewType(e.target.value)}
                >
                    <option value="SELF">My Tasks</option>
                    <option value="ASSIGNED_BY_ME">Assigned By Me</option>
                </select>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner" />
                </div>
            ) : tasks.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">✅</div>
                    <p>No tasks on holidays. All clear!</p>
                </div>
            ) : (
                <>
                    <p style={{ color: '#666', marginBottom: 16, fontSize: 14 }}>
                        {tasks.length} task(s) have deadlines on holidays or Sundays.
                        Choose to shift or keep each one.
                    </p>

                    {tasks.map((task) => (
                        <div
                            key={task.execution_log_id}
                            className="card"
                            style={{ marginBottom: 12 }}
                        >
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 8,
                                marginBottom: 8,
                            }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <PriorityBadge priority={task.priority_type} />
                                    <StatusBadge status={task.status} />
                                </div>
                                <span style={{
                                    fontSize: 12,
                                    color: '#FF9800',
                                    background: '#FFF3E0',
                                    padding: '2px 10px',
                                    borderRadius: 10,
                                }}>
                                    {task.reason}
                                </span>
                            </div>

                            <h3 style={{
                                fontSize: 16, fontWeight: 600, marginBottom: 6,
                            }}>
                                {task.task_title}
                            </h3>

                            <div style={{
                                fontSize: 13, color: '#666', marginBottom: 12,
                            }}>
                                <p>👤 {task.emp_name}</p>
                                <p>
                                    📅 Current:{' '}
                                    <strong>
                                        {formatDate(task.current_deadline)}
                                    </strong>
                                    {' '}({task.reason})
                                </p>
                                <p>
                                    💡 Suggested:{' '}
                                    <strong>
                                        {formatDate(task.suggested_date)}
                                    </strong>
                                </p>
                                {task.days_until_deadline !== null && (
                                    <p>
                                        ⏰ {task.days_until_deadline} days until deadline
                                    </p>
                                )}
                            </div>

                            <div className="btn-group">
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleShift(task)}
                                >
                                    Shift to {formatDate(task.suggested_date)}
                                </button>
                                <button
                                    className="btn btn-sm btn-outline"
                                    onClick={() =>
                                        handleDismiss(task.execution_log_id)
                                    }
                                >
                                    Keep {formatDate(task.current_deadline)}
                                </button>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};

export default AffectedTasksPage;