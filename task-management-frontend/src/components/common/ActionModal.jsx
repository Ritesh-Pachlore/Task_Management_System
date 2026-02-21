// src/components/common/ActionModal.jsx
import React, { useState, useEffect } from 'react';

const ActionModal = ({ title, onSubmit, onClose, showDate = false, actionModal }) => {
    const [remarks, setRemarks] = useState('');
    const [extendedDate, setExtendedDate] = useState('');
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');

    useEffect(() => {
        if (actionModal?.actionType === 'edit' && actionModal.task) {
            setTaskTitle(actionModal.task.task_title || '');
            setTaskDescription(actionModal.task.task_description || '');
            setExtendedDate(actionModal.task.effective_deadline || '');
        }
    }, [actionModal]);

    const handleSubmit = () => {
        onSubmit({
            remarks,
            extended_date: extendedDate,
            title: taskTitle,
            description: taskDescription,
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                {actionModal?.actionType === 'edit' && (
                    <>
                        <div className="form-group">
                            <label>Title</label>
                            <input
                                type="text"
                                className="form-control"
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                                placeholder="Task title"
                            />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                className="form-control"
                                value={taskDescription}
                                onChange={(e) => setTaskDescription(e.target.value)}
                                placeholder="Task description"
                                rows={3}
                            />
                        </div>
                        <div className="form-group">
                            <label>Deadline</label>
                            <input
                                type="date"
                                className="form-control"
                                value={extendedDate}
                                onChange={(e) => setExtendedDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    </>
                )}

                {showDate && actionModal?.actionType !== 'edit' && (
                    <div className="form-group">
                        <label>New Deadline</label>
                        <input
                            type="date"
                            className="form-control"
                            value={extendedDate}
                            onChange={(e) => setExtendedDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                        />
                    </div>
                )}

                <div className="form-group">
                    <label>Remarks</label>
                    <textarea
                        className="form-control"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Enter remarks..."
                        rows={3}
                    />
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleSubmit}>
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActionModal;