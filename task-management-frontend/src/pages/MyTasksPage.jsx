import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { toast } from 'react-toastify';
import TaskCard from '../components/tasks/TaskCard';
import TaskFilters from '../components/tasks/TaskFilters';
import ActionModal from '../components/common/ActionModal';

const MyTasksPage = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({});
    const [actionModal, setActionModal] = useState(null);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, val]) => {
                if (val !== '' && val !== undefined && val !== null) {
                    params.append(key, val);
                }
            });
            const response = await api.get(`/tasks/my-tasks/?${params.toString()}`);
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
        const titles = {
            1: 'Start Task', 2: 'Submit Task', 5: 'Resubmit Task',
        };
        setActionModal({
            task,
            actionType,
            title: titles[actionType] || 'Confirm Action',
        });
    };

    const submitAction = async ({ remarks }) => {
        try {
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
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1>My Tasks</h1>
            </div>

            <TaskFilters filters={filters} setFilters={setFilters} showDateFilter={true} />

            {loading ? (
                <div className="loading-container"><div className="spinner" /></div>
            ) : tasks.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <p>No tasks found</p>
                </div>
            ) : (
                tasks.map((task) => (
                    <TaskCard
                        key={task.execution_log_id}
                        task={task}
                        viewType="SELF"
                        onAction={handleAction}
                    />
                ))
            )}

            {actionModal && (
                <ActionModal
                    title={actionModal.title}
                    onSubmit={submitAction}
                    onClose={() => setActionModal(null)}
                />
            )}
        </div>
    );
};

export default MyTasksPage;