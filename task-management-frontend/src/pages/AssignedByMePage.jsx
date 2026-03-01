// src/pages/AssignedByMePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { toast } from 'react-toastify';
import TaskCard from '../components/tasks/TaskCard';
import GroupTaskCard from '../components/tasks/GroupTaskCard';
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
        } else if (actionType === 'edit') {
            setActionModal({
                task,
                actionType: 'edit',
                title: 'Edit Task',
                showDate: false,
            });
        } else {
            const titles = {
                3: 'Approve Task',
                4: 'Reject Task',
                6: 'Cancel Task',
                7: 'Put On Hold',
            };
            setActionModal({
                task,
                actionType,
                title: titles[actionType] || 'Confirm Action',
            });
        }
    };

    const submitAction = async ({ remarks, extended_date, title, description, emp_list }) => {
        try {
            if (actionModal.actionType === 'edit') {
                // ✅ Validate required fields
                if (!title?.trim() || !description?.trim()) {
                    toast.error("Title and Description are required");
                    return;
                }

                // ✅ Prepare payload
                const payload = {
                    execution_log_id: actionModal.task.execution_log_id,
                    title: title.trim(),
                    description: description.trim(),
                };

                if (emp_list?.trim()) payload.emp_list = emp_list.trim();
                if (extended_date?.trim()) payload.deadline = extended_date.trim();

                // ✅ Send POST to backend
                const response = await api.post('/tasks/edit/', payload);

                if (response.data.success) {
                    toast.success('Task updated successfully!');
                    setActionModal(null);
                    fetchTasks(); // refresh list
                } else {
                    toast.error(response.data.message || "Failed to update task");
                }
                return;
            }

            // ---------------- EXTEND TASK ----------------
            if (actionModal.actionType === 'extend') {
                if (!extended_date) {
                    toast.error('Please select a date');
                    return;
                }

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
                // ---------------- OTHER ACTIONS ----------------
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
                    toast.error(response.data.message || "Action failed");
                }
            }
        } catch (error) {
            console.error(error.response?.data || error); // ✅ log exact backend error
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

            <TaskFilters filters={filters} setFilters={setFilters} showEmployeeFilter showDateFilter={true} />

            {loading ? (
                <div className="loading-container"><div className="spinner" /></div>
            ) : tasks.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📤</div>
                    <p>No assigned tasks</p>
                </div>
            ) : (
                (() => {
                    // Group tasks by group_id
                    const groups = tasks.reduce((acc, t) => {
                        const key = t.group_id || `ind_${t.execution_log_id}`;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(t);
                        return acc;
                    }, {});

                    return Object.entries(groups).map(([key, groupMembers]) => {
                        const isGroup = !key.startsWith('ind_');
                        if (isGroup) {
                            return (
                                <GroupTaskCard
                                    key={key}
                                    members={groupMembers}
                                    onAction={handleAction}
                                />
                            );
                        } else {
                            return (
                                <TaskCard
                                    key={key}
                                    task={groupMembers[0]}
                                    viewType="ASSIGNED_BY_ME"
                                    onAction={handleAction}
                                />
                            );
                        }
                    });
                })()
            )}

            {actionModal && (
                <ActionModal
                    title={actionModal.title}
                    showDate={actionModal.showDate}
                    onSubmit={submitAction}
                    onClose={() => setActionModal(null)}
                    actionModal={actionModal}
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