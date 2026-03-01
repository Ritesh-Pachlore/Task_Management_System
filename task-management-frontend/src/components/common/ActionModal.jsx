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
    const [attachments, setAttachments] = useState([]);

    // ── NEW: Team Lead State ────────────────────────────────────
    const [currentTeamLeadId, setCurrentTeamLeadId] = useState(null);
    const [newTeamLeadId, setNewTeamLeadId] = useState(null);
    const [isGroupTask, setIsGroupTask] = useState(false);
    const [showTeamLeadPrompt, setShowTeamLeadPrompt] = useState(false);

    // Initialize modal data when opening
    useEffect(() => {
        if (actionModal?.actionType === 'edit' && actionModal.task) {
            const task = actionModal.task;
            setTaskTitle(task.task_title || '');
            setTaskDescription(task.task_description || '');
            setExtendedDate(task.effective_deadline || '');

            // Pre-select employees
            const assigned = task.emp_list || task.assigned_emp_list || '';
            if (assigned) {
                const arr = String(assigned).split(',').map(s => parseInt(s)).filter(Boolean);
                setSelectedEmployees(arr);
            }

            // NEW: Initialize team lead info
            const groupId = task.group_id;
            const teamLeadEmpId = task.team_lead_emp_id;
            if (groupId && teamLeadEmpId) {
                setIsGroupTask(true);
                setCurrentTeamLeadId(teamLeadEmpId);
                setNewTeamLeadId(teamLeadEmpId);
            } else {
                setIsGroupTask(false);
                setCurrentTeamLeadId(null);
                setNewTeamLeadId(null);
            }
            setShowTeamLeadPrompt(false);

            fetchEmployees('');
        }

        setAttachments([]);
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

    // ── UPDATED: toggleEmployee with team lead check ────────────
    const toggleEmployee = (id) => {
        setSelectedEmployees(prev => {
            const isRemoving = prev.includes(id);

            if (isRemoving) {
                const updated = prev.filter(empId => empId !== id);

                // If removing the current team lead, show prompt
                if (isGroupTask && id === newTeamLeadId) {
                    if (updated.length > 0) {
                        setShowTeamLeadPrompt(true);
                        setNewTeamLeadId(null); // Force them to pick a new one
                    } else {
                        setShowTeamLeadPrompt(false);
                        setNewTeamLeadId(null);
                    }
                }

                return updated;
            } else {
                return [...prev, id];
            }
        });
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = [];

        for (let file of files) {
            const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name);
            const maxSize = isImage ? 50 * 1024 : 2 * 1024 * 1024;

            if (file.size > maxSize) {
                const limitStr = isImage ? '50 KB' : '2 MB';
                toast.error(`Upload failed: "${file.name}" exceeds the maximum allowed size of ${limitStr}.`);
                continue;
            }
            validFiles.push(file);
        }

        setAttachments(prev => [...prev, ...validFiles]);
        e.target.value = null;
    };

    const removeFile = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // ── UPDATED: handleSubmit with team_lead_emp_id ─────────────
    const handleSubmit = () => {
        if (actionModal?.actionType === 'edit') {
            // Validate: if group task and team lead was removed, must pick new one
            if (isGroupTask && selectedEmployees.length > 0 && !newTeamLeadId) {
                toast.error("Please select a new Team Lead before saving.");
                return;
            }

            // Validate: new team lead must be in selected employees
            if (isGroupTask && newTeamLeadId && !selectedEmployees.includes(newTeamLeadId)) {
                toast.error("Team Lead must be one of the assigned employees.");
                return;
            }

            const payload = {
                execution_log_id: actionModal.task?.execution_log_id,
                title: taskTitle.trim(),
                description: taskDescription.trim(),
            };

            if (selectedEmployees.length > 0) {
                payload.emp_list = selectedEmployees.join(',');
            }

            if (extendedDate) {
                payload.extended_date = extendedDate;
            }

            // NEW: Include team lead if it's a group task
            if (isGroupTask && newTeamLeadId) {
                payload.team_lead_emp_id = newTeamLeadId;
            }

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
        } else {
            if (actionModal?.actionType === 2 || actionModal?.actionType === 5) {
                const formData = new FormData();
                if (remarks) formData.append('remarks', remarks);
                if (extendedDate) formData.append('extended_date', extendedDate);
                attachments.forEach(file => {
                    formData.append('attachments', file);
                });
                onSubmit(formData, true);
            } else {
                onSubmit({ remarks, extended_date: extendedDate });
            }
        }
    };

    // Helper to get employee name by ID
    const getEmpName = (id) => {
        const e = employees.find(x => x.emp_id === id);
        if (e) return e.emp_name;

        const t = actionModal?.task || {};
        const assignedIds = String(t.emp_list || t.assigned_emp_list || '').split(',').map(s => parseInt(s)).filter(Boolean);
        const assignedNames = String(t.emp_names || t.emp_name || '').split(',');
        const idx = assignedIds.indexOf(id);
        if (idx !== -1 && assignedNames[idx]) return assignedNames[idx].trim();

        return String(id);
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
                        {/* Add/Remove Employees */}
                        <div className="form-group">
                            <label>Assigned Employees</label>
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
                                            position: 'absolute', right: 8, top: '50%',
                                            transform: 'translateY(-50%)', border: 'none',
                                            background: 'transparent', cursor: 'pointer',
                                            fontSize: 16, fontWeight: 'bold', color: '#888'
                                        }}
                                    >×</button>
                                )}
                            </div>

                            {/* Selected employee chips */}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                                {selectedEmployees.map(id => {
                                    const empName = getEmpName(id);
                                    const isTeamLead = isGroupTask && id === newTeamLeadId;
                                    return (
                                        <span
                                            key={id}
                                            className="chip"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                border: isTeamLead ? '2px solid #1976d2' : undefined,
                                                background: isTeamLead ? '#e3f2fd' : undefined,
                                            }}
                                        >
                                            {isTeamLead && <span title="Team Lead">⭐</span>}
                                            {empName}
                                            <button
                                                type="button"
                                                onClick={() => toggleEmployee(id)}
                                                style={{
                                                    border: 'none', background: 'transparent',
                                                    cursor: 'pointer', padding: 0, fontSize: '14px',
                                                    lineHeight: 1, marginLeft: '4px'
                                                }}
                                                title={`Remove ${empName}`}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>

                            {/* Employee dropdown list */}
                            {showEmpList && (
                                <div ref={empListRef} style={{
                                    maxHeight: 200, overflowY: 'auto', marginTop: 8,
                                    border: '1px solid #eee', padding: 6, borderRadius: 6
                                }}>
                                    {empLoading ? (
                                        <div style={{ padding: 8 }}>Loading...</div>
                                    ) : employees.length === 0 ? (
                                        <div style={{ padding: 8, color: '#999' }}>No employees</div>
                                    ) : (
                                        employees.map(emp => {
                                            const checked = selectedEmployees.includes(emp.emp_id);
                                            return (
                                                <label key={emp.emp_id} style={{
                                                    display: 'flex', alignItems: 'center',
                                                    gap: 8, padding: '6px 4px'
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleEmployee(emp.emp_id)}
                                                    />
                                                    <span>
                                                        {emp.emp_name}
                                                        {emp.emp_department ? ` — ${emp.emp_department}` : ''}
                                                    </span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── NEW: Team Lead Reassignment UI ───────────── */}
                        {isGroupTask && (showTeamLeadPrompt || selectedEmployees.length > 0) && (
                            <div className="form-group" style={{
                                background: showTeamLeadPrompt ? '#fff3e0' : '#f5f5f5',
                                border: showTeamLeadPrompt ? '1px solid #ff9800' : '1px solid #e0e0e0',
                                borderRadius: 8, padding: 12, marginTop: 8
                            }}>
                                <label style={{
                                    fontWeight: 600,
                                    color: showTeamLeadPrompt ? '#e65100' : '#333',
                                    marginBottom: 6, display: 'block'
                                }}>
                                    {showTeamLeadPrompt
                                        ? '⚠️ Team Lead was removed. Please assign a new Team Lead:'
                                        : '👥 Team Lead'
                                    }
                                </label>
                                <select
                                    className="form-control"
                                    value={newTeamLeadId || ''}
                                    onChange={(e) => {
                                        const val = e.target.value ? parseInt(e.target.value) : null;
                                        setNewTeamLeadId(val);
                                        if (val) setShowTeamLeadPrompt(false);
                                    }}
                                    style={{
                                        border: showTeamLeadPrompt && !newTeamLeadId
                                            ? '2px solid #ff9800' : undefined
                                    }}
                                >
                                    <option value="">-- Select Team Lead --</option>
                                    {selectedEmployees.map(id => (
                                        <option key={id} value={id}>
                                            {getEmpName(id)}
                                            {id === currentTeamLeadId ? ' (Current)' : ''}
                                        </option>
                                    ))}
                                </select>
                                {showTeamLeadPrompt && !newTeamLeadId && (
                                    <small style={{ color: '#d32f2f', marginTop: 4, display: 'block' }}>
                                        A Team Lead is required for group tasks.
                                    </small>
                                )}
                            </div>
                        )}

                        {/* Title */}
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

                        {/* Description */}
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

                        {/* Deadline */}
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

                {actionModal?.actionType === 6 && (
                    <div style={{
                        color: '#d32f2f', background: '#ffebee', padding: '10px',
                        borderRadius: '6px', marginBottom: '15px', fontSize: '14px',
                        fontWeight: '500', border: '1px solid #ffcdd2'
                    }}>
                        ⚠️ This task is going to deactivate and user will no longer able to see this task on UI
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

                {(actionModal?.actionType === 2 || actionModal?.actionType === 5) && (
                    <div className="form-group">
                        <label>
                            Attach Documents{' '}
                            <small style={{ color: "#6c757d", fontWeight: "normal" }}>(Optional)</small>
                        </label>
                        <small style={{ display: 'block', color: "#6c757d", marginBottom: '6px' }}>
                            Maximum size: Images up to 50 KB. Documents up to 2 MB.
                        </small>
                        <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                            className="form-control"
                            onChange={handleFileChange}
                        />

                        {attachments.length > 0 && (
                            <div className="file-preview-list" style={{ marginTop: '10px' }}>
                                {attachments.map((file, index) => (
                                    <div key={index} className="file-preview-item" style={{
                                        display: 'inline-flex', alignItems: 'center',
                                        background: '#f8f9fa', padding: '4px 8px',
                                        borderRadius: '4px', border: '1px solid #dee2e6',
                                        marginRight: '8px', marginBottom: '8px', fontSize: '13px'
                                    }}>
                                        📄 {file.name}
                                        <button
                                            type="button"
                                            onClick={() => removeFile(index)}
                                            style={{
                                                marginLeft: '8px', border: 'none',
                                                background: 'transparent', cursor: 'pointer',
                                                color: '#ff4d4f', fontWeight: 'bold'
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

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