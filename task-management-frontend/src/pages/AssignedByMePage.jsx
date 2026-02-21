import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { toast } from 'react-toastify';
import TaskCard from '../components/tasks/TaskCard';
import TaskFilters from '../components/tasks/TaskFilters';
import ActionModal from '../components/common/ActionModal';
import DateShiftModal from '../components/common/DateShiftModal';

const AssignedByMePage = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({});
    const [actionModal, setActionModal] = useState(null);
    const [shiftInfo, setShiftInfo] = useState(null);
    const [pendingExtend, setPendingExtend] = useState(null);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, val]) => {
                if (val !== '' && val !== undefined && val !== null) {
                    params.append(key, val);
                }
            });
            const response = await api.get(`/tasks/assigned-by-me/?${params.toString()}`);
            if (response.data.success) {
                setTasks(response.data.data || []);
            }
        } catch (error) {
            toast.error('Failed to load tasks');
        }
        setLoading(false);
    }, [filters]);

    useEffect(() => {
        const timer = setTimeout(fetchTasks, 300);
        return () => clearTimeout(timer);
    }, [fetchTasks]);

    const handleAction = (task, actionType) => {
        if (actionType === 'extend') {
            setActionModal({
                task,
                actionType: 'extend',
                title: 'Extend Deadline',
                showDate: true,
            });
        } else {
            const titles = {
                3: 'Approve Task', 4: 'Reject Task', 6: 'Cancel Task', 7: 'Put On Hold',
            };
            setActionModal({
                task,
                actionType,
                title: titles[actionType] || 'Confirm Action',
            });
        }
    };

    const submitAction = async ({ remarks, extended_date }) => {
        try {
            if (actionModal.actionType === 'extend') {
                if (!extended_date) {
                    toast.error('Please select a date');
                    return;
                }

                // Check if date is holiday
                const checkResponse = await api.get(
                    `/tasks/check-date/?date=${extended_date}`
                );
                const checkData = checkResponse.data.data;

                if (checkData.needs_shift) {
                    setPendingExtend({
                        execution_log_id: actionModal.task.execution_log_id,
                        remarks,
                    });
                    setShiftInfo(checkData);
                    setActionModal(null);
                    return;
                }

                // Date is fine — extend directly
                const response = await api.post('/tasks/extend/', {
                    execution_log_id: actionModal.task.execution_log_id,
                    extended_date,
                    remarks,
                });
                if (response.data.success) {
                    toast.success('Deadline extended!');
                    setActionModal(null);
                    fetchTasks();
                }
            } else {
                const response = await api.post('/tasks/update-status/', {
                    execution_log_id: actionModal.task.execution_log_id,
                    action_type: actionModal.actionType,
                    remarks,
                });
                if (response.data.success) {
                    toast.success('Status updated!');
                    setActionModal(null);
                    fetchTasks();
                } else {
                    toast.error(response.data.message);
                }
            }
        } catch (error) {
            toast.error('Action failed');
        }
    };

    const handleShift = async (date) => {
        try {
            const response = await api.post('/tasks/extend/', {
                execution_log_id: pendingExtend.execution_log_id,
                extended_date: date,
                remarks: pendingExtend.remarks,
            });
            if (response.data.success) {
                toast.success('Deadline extended (shifted)!');
            }
        } catch (error) {
            toast.error('Failed to extend');
        }
        setShiftInfo(null);
        setPendingExtend(null);
        fetchTasks();
    };

    const handleKeep = async (date) => {
        try {
            const response = await api.post('/tasks/extend/', {
                execution_log_id: pendingExtend.execution_log_id,
                extended_date: date,
                remarks: pendingExtend.remarks,
            });
            if (response.data.success) {
                toast.success('Deadline extended (kept original)!');
            }
        } catch (error) {
            toast.error('Failed to extend');
        }
        setShiftInfo(null);
        setPendingExtend(null);
        fetchTasks();
    };

    return (
        <div>
            <div className="page-header">
                <h1>Assigned By Me</h1>
            </div>

            <TaskFilters filters={filters} setFilters={setFilters} showEmployeeFilter />

            {loading ? (
                <div className="loading-container"><div className="spinner" /></div>
            ) : tasks.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📤</div>
                    <p>No assigned tasks</p>
                </div>
            ) : (
                tasks.map((task) => (
                    <TaskCard
                        key={task.execution_log_id}
                        task={task}
                        viewType="ASSIGNED_BY_ME"
                        onAction={handleAction}
                    />
                ))
            )}

            {actionModal && (
                <ActionModal
                    title={actionModal.title}
                    showDate={actionModal.showDate}
                    onSubmit={submitAction}
                    onClose={() => setActionModal(null)}
                />
            )}

            {shiftInfo && (
                <DateShiftModal
                    shiftInfo={shiftInfo}
                    onShift={handleShift}
                    onKeep={handleKeep}
                    onClose={() => { setShiftInfo(null); setPendingExtend(null); }}
                />
            )}
        </div>
    );
};

export default AssignedByMePage;
