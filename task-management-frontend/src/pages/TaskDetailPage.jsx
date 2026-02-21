// src/pages/TaskDetailPage.jsx
// CHANGES:
//   1. Removed unused StatusBadge import
//   2. Wrapped fetchHistory in useCallback

import React, { useState, useEffect, useCallback } from 'react';  // ← add useCallback
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-toastify';
// ← REMOVED: import StatusBadge from '../components/common/StatusBadge';
import { formatDateTime } from '../utils/formatters';
import { STATUS_MAP } from '../utils/constants';
import { MdArrowBack, MdCircle } from 'react-icons/md';

const TaskDetailPage = () => {
    const { executionLogId } = useParams();
    const navigate = useNavigate();

    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // ← wrap with useCallback
    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get(
                `/tasks/history/${executionLogId}/`
            );
            if (response.data.success) {
                setHistory(response.data.data || []);
            }
        } catch (error) {
            toast.error('Failed to load history');
        }
        setLoading(false);
    }, [executionLogId]);  // ← executionLogId is real dependency

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);  // ← now correct

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <button className="btn btn-outline" onClick={() => navigate(-1)}>
                    <MdArrowBack /> Back
                </button>
                <h1>Task History</h1>
            </div>

            <div className="card">
                {history.length === 0 ? (
                    <div className="empty-state">
                        <p>No history found</p>
                    </div>
                ) : (
                    <div style={{ position: 'relative', paddingLeft: 24 }}>
                        {/* Vertical timeline line */}
                        <div style={{
                            position: 'absolute',
                            left: 7, top: 8, bottom: 8,
                            width: 2,
                            background: '#e8ecf1',
                        }} />

                        {history.map((item, idx) => {
                            const statusInfo =
                                STATUS_MAP[item.action_type] || { color: '#999' };
                            return (
                                <div
                                    key={idx}
                                    style={{
                                        position: 'relative',
                                        paddingBottom: 24,
                                        paddingLeft: 20,
                                    }}
                                >
                                    {/* Timeline dot */}
                                    <MdCircle style={{
                                        position: 'absolute',
                                        left: -5, top: 4,
                                        fontSize: 16,
                                        color: statusInfo.color,
                                    }} />

                                    <div>
                                        {/* Action badge + actor */}
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 8,
                                            alignItems: 'center',
                                            marginBottom: 4,
                                        }}>
                                            <span
                                                className="badge"
                                                style={{
                                                    color: statusInfo.color,
                                                    background:
                                                        statusInfo.bg || '#f5f5f5',
                                                }}
                                            >
                                                {item.action_name}
                                            </span>
                                            <span style={{
                                                fontSize: 13, color: '#666',
                                            }}>
                                                by{' '}
                                                <strong>
                                                    {item.action_by_name}
                                                </strong>
                                            </span>
                                        </div>

                                        {/* Timestamp */}
                                        <p style={{
                                            fontSize: 12, color: '#999',
                                            marginBottom: 4,
                                        }}>
                                            {formatDateTime(item.action_at)}
                                        </p>

                                        {/* Remarks */}
                                        {item.remarks && (
                                            <p style={{
                                                fontSize: 13, color: '#555',
                                                background: '#f8f9fc',
                                                padding: '8px 12px',
                                                borderRadius: 8,
                                                borderLeft:
                                                    `3px solid ${statusInfo.color}`,
                                            }}>
                                                "{item.remarks}"
                                            </p>
                                        )}

                                        {/* Extended date */}
                                        {item.extended_date && (
                                            <p style={{
                                                fontSize: 12,
                                                color: '#FF9800',
                                                marginTop: 4,
                                            }}>
                                                📅 Extended to:{' '}
                                                {formatDateTime(item.extended_date)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskDetailPage;