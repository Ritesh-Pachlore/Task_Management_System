// src/components/common/ActionModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';

const ActionModal = ({ title, onSubmit, onClose, showDate = false, actionModal }) => {
    const [remarks, setRemarks] = useState('');
    const [extendedDate, setExtendedDate] = useState('');
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [employees, setEmployees] = useState([]);
    const [empSearch, setEmpSearch] = useState('');
    const [empLoading, setEmpLoading] = useState(false);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [showEmpList, setShowEmpList] = useState(false);
    const empListRef = useRef(null);
    const empInputRef = useRef(null);

    // Initialize modal data when opening
    useEffect(() => {
        if (actionModal?.actionType === 'edit' && actionModal.task) {
            setTaskTitle(actionModal.task.task_title || '');
            setTaskDescription(actionModal.task.task_description || '');
            setExtendedDate(actionModal.task.effective_deadline || '');

            // Pre-select employees
            const assigned = actionModal.task.emp_list || actionModal.task.assigned_emp_list || '';
            if (assigned) {
                const arr = String(assigned).split(',').map(s => parseInt(s)).filter(Boolean);
                setSelectedEmployees(arr);
            }

            fetchEmployees(''); // load employee names
        }
    }, [actionModal]);

    // Employee search
    useEffect(() => {
        if (actionModal?.actionType !== 'edit') return;
        const timer = setTimeout(() => fetchEmployees(empSearch), 250);
        return () => clearTimeout(timer);
    }, [empSearch, actionModal]);

    // Close employee list when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (!showEmpList) return;
            if (empListRef.current && empListRef.current.contains(e.target)) return;
            if (empInputRef.current && empInputRef.current.contains(e.target)) return;
            setShowEmpList(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showEmpList]);

    const fetchEmployees = async (search = '') => {
        setEmpLoading(true);
        try {
            const params = search ? `?search=${encodeURIComponent(search)}` : '';
            const res = await api.get(`/auth/employees/${params}`);
            if (res.data.success) setEmployees(res.data.data || []);
        } catch (e) {
            toast.error('Could not load employees');
        }
        setEmpLoading(false);
    };

    const toggleEmployee = (id) => {
        setSelectedEmployees(prev =>
            prev.includes(id)
                ? prev.filter(empId => empId !== id)
                : [...prev, id]
        );
    };

    // ✅ Fixed handleSubmit for edit action
    const handleSubmit = () => {
        const payload = {
            execution_log_id: actionModal.task?.execution_log_id, // required
            title: taskTitle.trim(),
            description: taskDescription.trim(),
        };

        if (selectedEmployees.length > 0) {
            payload.emp_list = selectedEmployees.join(',');
        }

        if (extendedDate) {
            payload.deadline = extendedDate;
        }

        // Validate required fields before sending
        if (!payload.execution_log_id) {
            toast.error("Task not found");
            return;
        }
        if (!payload.title) {
            toast.error("Title is required");
            return;
        }
        if (!payload.description) {
            toast.error("Description is required");
            return;
        }

        onSubmit(payload);
    };

    const clearSearch = () => setEmpSearch('');

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                {actionModal?.actionType === 'edit' && (
                    <>
                        {/* Previously assigned employees */}
                        <div className="form-group">
                            <label>Previously assigned to</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {(() => {
                                    const t = actionModal.task || {};
                                    if (t.emp_names) return String(t.emp_names).split(',').map((n, i) => (<span key={i} className="chip">{n.trim()}</span>));
                                    if (t.emp_name) return (<span className="chip">{t.emp_name}</span>);
                                    return selectedEmployees.map(id => {
                                        const e = employees.find(x => x.emp_id === id);
                                        return (<span key={id} className="chip">{e ? e.emp_name : id}</span>);
                                    });
                                })()}
                            </div>
                        </div>

                        {/* Add/Remove Employees */}
                        <div className="form-group">
                            <label>Add/Remove Employees</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    ref={empInputRef}
                                    type="text"
                                    className="form-control"
                                    placeholder="Search employees to add..."
                                    value={empSearch}
                                    onFocus={() => setShowEmpList(true)}
                                    onChange={(e) => { setEmpSearch(e.target.value); setShowEmpList(true); }}
                                />
                                {empSearch && (
                                    <button
                                        type="button"
                                        onClick={clearSearch}
                                        style={{
                                            position: 'absolute',
                                            right: 8,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            border: 'none',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            fontSize: 16,
                                            fontWeight: 'bold',
                                            color: '#888'
                                        }}
                                    >×</button>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                                {selectedEmployees.map(id => {
                                    const e = employees.find(x => x.emp_id === id);
                                    return (
                                        <span key={id} className="chip">{e ? e.emp_name : id}</span>
                                    );
                                })}
                            </div>

                            {showEmpList && (
                                <div ref={empListRef} style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8, border: '1px solid #eee', padding: 6, borderRadius: 6 }}>
                                    {empLoading ? (
                                        <div style={{ padding: 8 }}>Loading...</div>
                                    ) : employees.length === 0 ? (
                                        <div style={{ padding: 8, color: '#999' }}>No employees</div>
                                    ) : (
                                        employees.map(emp => {
                                            const checked = selectedEmployees.includes(emp.emp_id);
                                            return (
                                                <label key={emp.emp_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleEmployee(emp.emp_id)}
                                                    />
                                                    <span>{emp.emp_name}{emp.emp_department ? ` — ${emp.emp_department}` : ''}</span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Title & Description */}
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