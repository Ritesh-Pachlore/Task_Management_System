// src/pages/CreateTaskPage.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-toastify';
import DateShiftModal from '../components/common/DateShiftModal';
import './CreateTaskPage.css';

// ─────────────────────────────────────────────────────────────────
//  TASK TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────

const TASK_TYPES = [
    { value: 1, label: 'Daily' },
    { value: 2, label: 'Weekly' },
    { value: 3, label: 'Monthly' },
    { value: 4, label: 'Random' },
    { value: 5, label: 'Time Bound' },
];

const PRIORITIES = [
    { value: 1, label: 'Low', color: '#4CAF50', bg: '#E8F5E9' },
    { value: 2, label: 'Medium', color: '#FF9800', bg: '#FFF3E0' },
    { value: 3, label: 'High', color: '#F44336', bg: '#FFEBEE' },
];

const DAYS_OF_WEEK = [
    { value: 'Monday', short: 'Mon', index: 1 },
    { value: 'Tuesday', short: 'Tue', index: 2 },
    { value: 'Wednesday', short: 'Wed', index: 3 },
    { value: 'Thursday', short: 'Thu', index: 4 },
    { value: 'Friday', short: 'Fri', index: 5 },
    { value: 'Saturday', short: 'Sat', index: 6 },
    { value: 'Sunday', short: 'Sun', index: 0 },
];

const todayStr = new Date().toISOString().split('T')[0];
const INFINITE_DATE = '3000-12-31';

const INITIAL_FORM = {
    task_title: '',
    task_description: '',
    task_type: 4,
    priority_type: 2,
    task_start_date: todayStr,
    task_end_date: '',
    start_time: '',
    end_time: '',
    recurrence_end_date: '',
    weekly_days: [],
    monthly_day_of_month: '',
    selectedEmployees: [],
    attachments: [],
};

// ─────────────────────────────────────────────────────────────────

const CreateTaskPage = () => {
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    const [form, setForm] = useState(INITIAL_FORM);
    const [employees, setEmployees] = useState([]);
    const [empSearch, setEmpSearch] = useState('');
    const [empLoading, setEmpLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showEmpList, setShowEmpList] = useState(false);
    const [selectedEmpDetails, setSelectedEmpDetails] = useState({}); // { id: { name, dept } }

    // Date shift modal state
    const [shiftInfo, setShiftInfo] = useState(null);
    const [shiftTarget, setShiftTarget] = useState('');

    useEffect(() => {
        if (!showEmpList) return;
        const timer = setTimeout(() => fetchEmployees(empSearch), 300);
        return () => clearTimeout(timer);
    }, [empSearch, showEmpList]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowEmpList(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchEmployees = async (search = '') => {
        setEmpLoading(true);
        try {
            const params = search ? `?search=${encodeURIComponent(search)}` : '';
            const res = await api.get(`/auth/employees/${params}`);
            if (res.data.success) setEmployees(res.data.data || []);
        } catch {
            toast.error('Could not load employees');
        }
        setEmpLoading(false);
    };

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const handleTaskTypeChange = (typeValue) => {
        setForm(prev => ({
            ...prev,
            task_type: typeValue,
            // Keep common fields (title, desc, priority, employees)
            // but reset/update type-specific date/time fields
            task_start_date: typeValue === 2 ? '' : (prev.task_start_date || todayStr),
            task_end_date: '',
            recurrence_end_date: '',
            start_time: '',
            end_time: '',
            weekly_days: [],
            monthly_day_of_month: '',
        }));
    };

    const toggleWeeklyDay = (dayValue) => {
        setForm(prev => ({
            ...prev,
            weekly_days: prev.weekly_days.includes(dayValue) ? [] : [dayValue],
        }));
    };

    const toggleEmployee = (empId) => {
        setForm(prev => {
            const isRemoving = prev.selectedEmployees.includes(empId);
            const newEmployees = isRemoving
                ? prev.selectedEmployees.filter(id => id !== empId)
                : [...prev.selectedEmployees, empId];

            // Re-trigger date validation if dates are already selected
            if (prev.task_start_date) handleDateCheckTrigger('task_start_date', prev.task_start_date, newEmployees);
            if (prev.task_end_date) handleDateCheckTrigger('task_end_date', prev.task_end_date, newEmployees);

            if (!isRemoving) {
                const emp = employees.find(e => e.emp_id === empId);
                if (emp) {
                    setSelectedEmpDetails(prevDetails => ({
                        ...prevDetails,
                        [empId]: { name: emp.emp_name, dept: emp.emp_department }
                    }));
                }
            }

            return {
                ...prev,
                selectedEmployees: newEmployees,
            };
        });
    };

    const handleDateCheckTrigger = async (field, dateValue, employeeList) => {
        if (!dateValue) return;
        try {
            const empListStr = employeeList.join(',');
            const res = await api.get(`/tasks/check-date/?date=${dateValue}&emp_list=${empListStr}`);
            const data = res.data?.data;
            if (data?.needs_shift) {
                setShiftTarget(field);
                setShiftInfo(data);
            }
        } catch { }
    };

    const handleDateChange = async (field, value) => {
        setField(field, value);
        if (!value) return;
        handleDateCheckTrigger(field, value, form.selectedEmployees);
    };

    const handleShiftApproved = (suggestedDate) => {
        setField(shiftTarget, suggestedDate);
        setShiftInfo(null);
        setShiftTarget('');
    };

    const handleShiftDenied = () => {
        setShiftInfo(null);
        setShiftTarget('');
    };

    // Helper: Calculate nearest start date for Weekly
    const calculateWeeklyStartDate = (selectedDays) => {
        if (!selectedDays || selectedDays.length === 0) return todayStr;
        const now = new Date();
        const todayIdx = now.getDay(); // 0-6 (Sun-Sat)

        let minDiff = 7;
        selectedDays.forEach(dayName => {
            const dayObj = DAYS_OF_WEEK.find(d => d.value === dayName);
            if (dayObj) {
                const diff = (dayObj.index - todayIdx + 7) % 7;
                if (diff < minDiff) minDiff = diff;
            }
        });

        const start = new Date(now);
        start.setDate(now.getDate() + minDiff);
        return start.toISOString().split('T')[0];
    };

    /* ───────────────── FILE HANDLER ───────────────── */

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = [];

        for (let file of files) {
            // Check if the file is an image based on its MIME type or extension
            const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name);

            // Set limits: 50 KB for images, 2 MB for other documents
            const maxSize = isImage ? 50 * 1024 : 2 * 1024 * 1024;

            if (file.size > maxSize) {
                const limitStr = isImage ? '50 KB' : '2 MB';
                toast.error(`Upload failed: "${file.name}" exceeds the maximum allowed size of ${limitStr}.`);
                continue;
            }
            validFiles.push(file);
        }

        setForm(prev => ({
            ...prev,
            attachments: [...prev.attachments, ...validFiles],
        }));

        // Clear the input so the same files can be selected again if needed
        e.target.value = null;
    };

    const removeFile = (index) => {
        const updated = [...form.attachments];
        updated.splice(index, 1);
        setForm(prev => ({ ...prev, attachments: updated }));
    };

    // ── Client-side validation ───────────────────────────────────
    const validate = () => {
        if (!form.task_title.trim()) {
            toast.error('Task title is required');
            return false;
        }

        // Daily/Weekly don't have manual start date (NOTE: Restored Daily, but let's check it for all now)
        if (form.task_type !== 2 && !form.task_start_date) {
            toast.error('Start date is required');
            return false;
        }

        if (form.selectedEmployees.length === 0) {
            toast.error('Please assign to at least one employee');
            return false;
        }

        if (form.task_type === 2 && form.weekly_days.length === 0) {
            toast.error('Please select at least one day for weekly recurrence');
            return false;
        }

        if (form.task_type === 5) { // Time Bound
            if (!form.task_end_date) { toast.error('End date required'); return false; }
            if (!form.start_time || !form.end_time) { toast.error('Times required'); return false; }
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);

        try {
            let finalStartDate = form.task_start_date;
            if (form.task_type === 1) finalStartDate = form.task_start_date || todayStr;
            if (form.task_type === 2) finalStartDate = calculateWeeklyStartDate(form.weekly_days);

            const formData = new FormData();
            formData.append('task_title', form.task_title.trim());
            formData.append('task_description', form.task_description.trim());
            formData.append('task_type', form.task_type);
            formData.append('priority_type', form.priority_type);
            formData.append('task_start_date', finalStartDate);

            // End Date Logic
            const endDate = form.task_end_date || ([1, 2, 3].includes(form.task_type) ? INFINITE_DATE : finalStartDate);
            formData.append('task_end_date', endDate);

            formData.append('emp_list', form.selectedEmployees.join(','));

            // Recurrence Details
            if ([1, 2, 3].includes(form.task_type)) {
                formData.append('recurrence_type', String(form.task_type));
                formData.append('recurrence_end_date', form.recurrence_end_date || INFINITE_DATE);

                if (form.task_type === 1) { // Daily
                    formData.append('weekly_days', '0');
                    formData.append('monthly_day_of_month', 0);
                } else if (form.task_type === 2) { // Weekly
                    formData.append('weekly_days', form.weekly_days.join(','));
                    formData.append('monthly_day_of_month', 0);
                } else if (form.task_type === 3) { // Monthly
                    formData.append('weekly_days', '0');
                    const d = new Date(finalStartDate);
                    const dom = isNaN(d.getDate()) ? parseInt(finalStartDate.split('-')[2] || 0) : d.getDate();
                    formData.append('monthly_day_of_month', dom);
                }
            }

            // Time Bound Details
            if (form.task_type === 5) {
                formData.append('start_time', form.start_time);
                formData.append('end_time', form.end_time);
            }

            // Attachments
            if (form.attachments && form.attachments.length > 0) {
                form.attachments.forEach(file => {
                    formData.append('attachments', file);
                });
            }

            const res = await api.post('/tasks/create/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (res.data.success) {
                toast.success('Task created successfully!');
                navigate('/assigned-by-me');
            } else {
                toast.error(res.data.message || 'Failed to create task');
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Error occurred while creating task';
            toast.error(msg);
            console.error('Submission error:', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="create-task-outer">
            <div className="page-header">
                <h1>Create New Task</h1>
            </div>

            <div className="ct-card">
                <form onSubmit={handleSubmit} noValidate>
                    {/* Basic Info */}
                    <div className="form-group">
                        <label className="form-label">Task Title <span className="req">*</span></label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="What needs to be done?"
                            value={form.task_title}
                            onChange={e => setField('task_title', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            className="form-control"
                            placeholder="Details (optional)"
                            rows={2}
                            value={form.task_description}
                            onChange={e => setField('task_description', e.target.value)}
                        />
                    </div>

                    {/* Task Type */}
                    {/* Attachments */}
                    <div className="form-group">
                        <label className="form-label">
                            Attach Documents
                        </label>
                        <small style={{ color: "#6c757d" }}>

                            Maximum size: Images up to 50 KB. Documents up to 2 MB.
                        </small>

                        <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                            className="form-control"
                            onChange={handleFileChange}
                        />

                        {form.attachments?.length > 0 && (
                            <div className="file-preview-list">
                                {form.attachments.map((file, index) => (
                                    <div key={index} className="file-preview-item">
                                        📄 {file.name}
                                        <button
                                            type="button"
                                            onClick={() => removeFile(index)}
                                            style={{ marginLeft: '10px' }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>


                    {/* ══════════════════════════════════════════
                        SECTION 2: Task Type toggle buttons
                    ══════════════════════════════════════════ */}
                    <div className="form-group">
                        <label className="form-label">Task Type <span className="req">*</span></label>
                        <div className="toggle-group">
                            {TASK_TYPES.map(type => (
                                <button
                                    key={type.value}
                                    type="button"
                                    className={`toggle-btn ${form.task_type === type.value ? 'toggle-btn-active' : ''}`}
                                    onClick={() => handleTaskTypeChange(type.value)}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Priority */}
                    <div className="form-group">
                        <label className="form-label">Priority <span className="req">*</span></label>
                        <div className="toggle-group">
                            {PRIORITIES.map(p => {
                                const active = form.priority_type === p.value;
                                return (
                                    <button
                                        key={p.value}
                                        type="button"
                                        className={`toggle-btn ${active ? 'priority-btn-active' : ''}`}
                                        style={active ? { background: p.color, borderColor: p.color, color: 'white' } : { borderColor: p.color, color: p.color, background: p.bg }}
                                        onClick={() => setField('priority_type', p.value)}
                                    >
                                        {p.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Conditionals */}

                    {/* WEEKLY: Days selection comes FIRST */}
                    {form.task_type === 2 && (
                        <div className="form-group recurrence-box">
                            <label className="form-label">Select Days <span className="req">*</span></label>
                            <div className="toggle-group chips-wrap" style={{ marginTop: 8 }}>
                                {DAYS_OF_WEEK.map(day => (
                                    <button
                                        key={day.value}
                                        type="button"
                                        className={`toggle-btn ${form.weekly_days.includes(day.value) ? 'toggle-btn-active' : ''}`}
                                        style={{ padding: '6px 12px', minWidth: 'auto' }}
                                        onClick={() => toggleWeeklyDay(day.value)}
                                    >
                                        {day.short}
                                    </button>
                                ))}
                            </div>
                            <p className="field-hint">Start date is automatically set to the nearest selected day.</p>
                        </div>
                    )}

                    {/* Dates Section */}
                    <div className="datetime-row">
                        {/* Start Date: Show for RANDOM, TIME_BOUND, MONTHLY, DAILY */}
                        {[4, 5, 3, 1].includes(form.task_type) && (
                            <div className="form-group">
                                <label className="form-label">Start Date <span className="req">*</span></label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={form.task_start_date}
                                    onChange={e => handleDateChange('task_start_date', e.target.value)}
                                />
                            </div>
                        )}

                        {/* End Date (Optional for Recurrent) */}
                        {([1, 2, 3].includes(form.task_type) || form.task_type === 5) && (
                            <div className="form-group">
                                <label className="form-label">
                                    {form.task_type === 5 ? 'End Date' : 'End Date (Optional)'}
                                    {form.task_type === 5 && <span className="req">*</span>}
                                </label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={form.task_type === 5 ? form.task_end_date : form.recurrence_end_date}
                                    min={form.task_start_date}
                                    onChange={e => handleDateChange(form.task_type === 5 ? 'task_end_date' : 'recurrence_end_date', e.target.value)}
                                />
                                {[1, 2, 3].includes(form.task_type) && <p className="field-hint">Defaults to 3000-12-31</p>}
                            </div>
                        )}
                    </div>

                    {/* Time fields for Time Bound only */}
                    {form.task_type === 5 && (
                        <div className="datetime-row" style={{ marginTop: 15 }}>
                            <div className="form-group">
                                <label className="form-label">Start Time <span className="req">*</span></label>
                                <input type="time" className="form-control" value={form.start_time} onChange={e => setField('start_time', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">End Time <span className="req">*</span></label>
                                <input type="time" className="form-control" value={form.end_time} onChange={e => setField('end_time', e.target.value)} />
                            </div>
                        </div>
                    )}

                    {/* Assign To */}
                    <div className="form-group" ref={dropdownRef} style={{ marginTop: 25 }}>
                        <label className="form-label">Assign To <span className="req">*</span></label>
                        <div className="search-wrap">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search employee..."
                                value={empSearch}
                                onFocus={() => setShowEmpList(true)}
                                onChange={e => setEmpSearch(e.target.value)}
                            />
                        </div>

                        {/* {showEmpList && (
                            <div className="emp-list-box">
                                {empLoading ? (
                                    <div className="emp-list-state">Loading...</div>
                                ) : (
                                    employees.map(emp => {
                                        const checked = form.selectedEmployees.includes(emp.emp_id);
                                        return (
                                            <label key={emp.emp_id} className={`emp-row ${checked ? 'emp-row-checked' : ''}`}>
                                                <input type="checkbox" checked={checked} onChange={() => toggleEmployee(emp.emp_id)} />
                                                <span className="emp-row-name">
                                                    {emp.emp_name}
                                                    <small style={{ marginLeft: '8px', color: '#888' }}>
                                                        ({emp.emp_department || 'N/A'})
                                                    </small>
                                                </span>
                                                <span className="emp-row-id">#{emp.emp_id}</span>
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        )} */}

                        {showEmpList && (
                            <div className="emp-list-box">
                                {empLoading ? (
                                    <div className="emp-list-state">
                                        Loading employees...
                                    </div>
                                ) : employees.length === 0 ? (
                                    <div className="emp-list-state">
                                        No employees found
                                    </div>
                                ) : (
                                    employees.map(emp => {
                                        const isChecked =
                                            form.selectedEmployees.includes(
                                                emp.emp_id
                                            );

                                        return (
                                            <label
                                                key={emp.emp_id}
                                                className={`emp-row ${isChecked
                                                    ? 'emp-row-checked'
                                                    : ''
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() =>
                                                        toggleEmployee(
                                                            emp.emp_id
                                                        )
                                                    }
                                                />
                                                <span>
                                                    {emp.emp_name}{emp.emp_department ? ` — ${emp.emp_department}` : ''}
                                                </span>
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {form.selectedEmployees.length > 0 && (
                            <div className="chips-wrap">
                                {form.selectedEmployees.map(id => {
                                    const emp = employees.find(
                                        e => e.emp_id === id
                                    );
                                    return (
                                        <span key={id} className="chip">
                                            {emp?.emp_name || id}{emp?.emp_department ? ` — ${emp.emp_department}` : ''}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleEmployee(id)
                                                }
                                            >
                                                ×
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <button type="submit" className="btn btn-primary submit-btn" disabled={submitting}>
                        {submitting ? 'Creating...' : '✓ Create Task'}
                    </button>
                </form>
            </div>

            {shiftInfo && (
                <DateShiftModal shiftInfo={shiftInfo} onShift={handleShiftApproved} onKeep={handleShiftDenied} onClose={handleShiftDenied} />
            )}
        </div>
    );
};

export default CreateTaskPage;