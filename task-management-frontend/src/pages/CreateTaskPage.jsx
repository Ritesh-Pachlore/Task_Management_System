// src/pages/CreateTaskPage.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-toastify';
import DateShiftModal from '../components/common/DateShiftModal';
import './CreateTaskPage.css';

// ─────────────────────────────────────────────────────────────────
//  TASK TYPE DEFINITIONS
//
//  active: true  → shown as clickable toggle button
//  active: false → shown as disabled placeholder (commented out
//                  in render, no backend impact)
//
//  task_type mapping (matches Django + DB):
//    1 = DAILY      (future)
//    2 = WEEKLY     (future)
//    3 = MONTHLY    (future)
//    4 = RANDOM     (active)
//    5 = TIME_BOUND (active)
// ─────────────────────────────────────────────────────────────────

const TASK_TYPES = [
    {
        value: 4,
        label: 'Random',
        // icon:        '🎲',
        // description: 'No fixed end date',
        active: true,
    },
    {
        value: 5,
        label: 'Time Bound',
        // icon:        '⏱️',
        // description: 'Fixed start & end with time',
        active: true,
    },
    {
        value: 1,
        label: 'Daily',
        icon: '📅',
        description: 'Repeats every day',
        active: true,
    },
    {
        value: 2,
        label: 'Weekly',
        icon: '📆',
        description: 'On a specific day each week',
        active: true,
    },
    {
        value: 3,
        label: 'Monthly',
        icon: '🗓️',
        description: 'Repeats every month',
        active: true,
    },
];

const PRIORITIES = [
    { value: 1, label: 'Low', color: '#4CAF50', bg: '#E8F5E9' },
    { value: 2, label: 'Medium', color: '#FF9800', bg: '#FFF3E0' },
    { value: 3, label: 'High', color: '#F44336', bg: '#FFEBEE' },
];

// Days for future WEEKLY type
const DAYS_OF_WEEK = [
    { value: 'Monday', short: 'Mon' },
    { value: 'Tuesday', short: 'Tue' },
    { value: 'Wednesday', short: 'Wed' },
    { value: 'Thursday', short: 'Thu' },
    { value: 'Friday', short: 'Fri' },
    { value: 'Saturday', short: 'Sat' },
    { value: 'Sunday', short: 'Sun' },
];

const today = new Date().toISOString().split('T')[0];

const INITIAL_FORM = {
    task_title: '',
    task_description: '',
    task_type: 4,          // default → Random
    priority_type: 2,          // default → Medium
    task_start_date: today,
    task_end_date: '',
    start_time: '',          // only for TIME_BOUND
    end_time: '',          // only for TIME_BOUND
    recurrence_end_date: '',
    weekly_days: [],          // for Weekly
    monthly_day_of_month: '',       // for Monthly
    selectedEmployees: [],
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

    // Date shift modal state
    const [shiftInfo, setShiftInfo] = useState(null);
    const [shiftTarget, setShiftTarget] = useState('');   // 'task_start_date' | 'task_end_date'


    // 🔥 Fetch employees ONLY when dropdown is open
    useEffect(() => {
        if (!showEmpList) return;

        const timer = setTimeout(() => {
            fetchEmployees(empSearch);
        }, 300);

        return () => clearTimeout(timer);
    }, [empSearch, showEmpList]);

    // ── Load employees — debounced on search change ──────────────
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchEmployees(empSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [empSearch]);

    // 🔥 Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setShowEmpList(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchEmployees = async (search = '') => {
        setEmpLoading(true);
        try {
            const params = search
                ? `?search=${encodeURIComponent(search)}`
                : '';
            const res = await api.get(`/auth/employees/${params}`);
            if (res.data.success) {
                setEmployees(res.data.data || []);
            }
        } catch {
            toast.error('Could not load employees');
        }
        setEmpLoading(false);
    };

    // ── Simple field setter ──────────────────────────────────────
    const setField = (key, value) =>
        setForm(prev => ({ ...prev, [key]: value }));

    // ── Task type toggle — reset time fields on change ───────────
    const handleTaskTypeChange = (typeValue) => {
        setForm(prev => ({
            ...prev,
            task_type: typeValue,
            task_end_date: '',
            start_time: '',
            end_time: '',
            recurrence_end_date: '',
            weekly_days: [],
            monthly_day_of_month: '',
        }));
    };

    // ── Toggle weekly day ───────────────────────────────────────
    const toggleWeeklyDay = (day) => {
        setForm(prev => ({
            ...prev,
            weekly_days: prev.weekly_days.includes(day)
                ? prev.weekly_days.filter(d => d !== day)
                : [...prev.weekly_days, day],
        }));
    };

    // ── Employee checkbox toggle ─────────────────────────────────
    const toggleEmployee = (empId) => {
        setForm(prev => ({
            ...prev,
            selectedEmployees: prev.selectedEmployees.includes(empId)
                ? prev.selectedEmployees.filter(id => id !== empId)
                : [...prev.selectedEmployees, empId],
        }));
    };

    // ── Date change → call check-date API → show shift modal ────
    //
    //    field = 'task_start_date' | 'task_end_date'
    //
    const handleDateChange = async (field, value) => {
        setField(field, value);
        if (!value) return;

        try {
            const res = await api.get(`/tasks/check-date/?date=${value}`);
            const data = res.data?.data;
            if (data?.needs_shift) {
                setShiftTarget(field);
                setShiftInfo(data);
            }
        } catch {
            // Ignore — check is non-critical
        }
    };

    // ── DateShiftModal callbacks ─────────────────────────────────
    const handleShiftApproved = (suggestedDate) => {
        setField(shiftTarget, suggestedDate);
        setShiftInfo(null);
        setShiftTarget('');
        toast.info(`Date shifted to ${suggestedDate}`);
    };

    const handleShiftDenied = () => {
        // Keep whatever date user already typed
        setShiftInfo(null);
        setShiftTarget('');
        toast.info('Keeping original date');
    };

    // ── Client-side validation ───────────────────────────────────
    const validate = () => {
        if (!form.task_title.trim()) {
            toast.error('Task title is required');
            return false;
        }
        if (!form.task_start_date) {
            toast.error('Start date is required');
            return false;
        }
        if (form.selectedEmployees.length === 0) {
            toast.error('Please assign to at least one employee');
            return false;
        }

        // ── TIME_BOUND specific ──────────────────────────────────
        if (form.task_type === 5) {
            if (!form.task_end_date) {
                toast.error('End date is required for Time Bound tasks');
                return false;
            }
            if (!form.start_time) {
                toast.error('Start time is required for Time Bound tasks');
                return false;
            }
            if (!form.end_time) {
                toast.error('End time is required for Time Bound tasks');
                return false;
            }
            if (
                form.task_start_date === form.task_end_date &&
                form.end_time <= form.start_time
            ) {
                toast.error('End time must be after start time on the same day');
                return false;
            }
            if (form.task_end_date < form.task_start_date) {
                toast.error('End date cannot be before start date');
                return false;
            }
        }

        // ── RECURRENCE validations ────────────────────────────────
        if ([1, 2, 3].includes(form.task_type)) {
            if (!form.recurrence_end_date) {
                toast.error('Recurrence end date is required');
                return false;
            }
            if (form.recurrence_end_date < form.task_start_date) {
                toast.error('Recurrence end date cannot be before start date');
                return false;
            }

            if (form.task_type === 2) { // WEEKLY
                if (form.weekly_days.length === 0) {
                    toast.error('Please select at least one day for weekly recurrence');
                    return false;
                }
            }

            if (form.task_type === 3) { // MONTHLY
                if (!form.monthly_day_of_month) {
                    toast.error('Please select a day of the month');
                    return false;
                }
            }
        }

        return true;
    };

    // ── Form submit ──────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        // Build payload
        // ─────────────────────────────────────────────────────────
        // Frontend sends date and time SEPARATELY.
        // SP combines them: "2025-07-15" + "09:00" → 2025-07-15 09:00:00
        // ─────────────────────────────────────────────────────────
        const payload = {
            task_title: form.task_title.trim(),
            task_description: form.task_description.trim(),
            task_type: form.task_type,
            priority_type: form.priority_type,
            task_start_date: form.task_start_date,
            task_end_date: form.task_end_date || form.task_start_date,
            emp_list: form.selectedEmployees.join(','),
        };

        // Include times only for TIME_BOUND
        if (form.task_type === 5) {
            payload.start_time = form.start_time;
            payload.end_time = form.end_time;
        }

        // Recurrence specific fields
        if ([1, 2, 3].includes(form.task_type)) {
            payload.recurrence_type = form.task_type === 1 ? 'DAILY' : form.task_type === 2 ? 'WEEKLY' : 'MONTHLY';
            payload.recurrence_end_date = form.recurrence_end_date;

            if (form.task_type === 2) {
                payload.weekly_days = form.weekly_days.join(',');
            }
            if (form.task_type === 1) {
                payload.weekly_days = 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday';
            }
            if (form.task_type === 3) {
                payload.monthly_day_of_month = form.monthly_day_of_month;
            }
        }

        setSubmitting(true);
        try {
            const res = await api.post('/tasks/create/', payload);
            if (res.data.success) {
                toast.success('Task created successfully!');
                navigate('/assigned-by-me');
            } else {
                toast.error(res.data.message || 'Failed to create task');
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to create task';
            toast.error(msg);
        }
        setSubmitting(false);
    };

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div>
            {/* Page header */}
            <div className="page-header">
                <h1>Create New Task</h1>
            </div>

            <div className="ct-card">
                <form onSubmit={handleSubmit} noValidate>

                    {/* ══════════════════════════════════════════
                        SECTION 1: Basic Info
                    ══════════════════════════════════════════ */}

                    {/* Title */}
                    <div className="form-group">
                        <label className="form-label">
                            Task Title <span className="req">*</span>
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="What needs to be done?"
                            value={form.task_title}
                            onChange={e => setField('task_title', e.target.value)}
                        />
                    </div>

                    {/* Description */}
                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            className="form-control"
                            placeholder="Add more details (optional)"
                            rows={3}
                            value={form.task_description}
                            onChange={e => setField('task_description', e.target.value)}
                        />
                    </div>

                    {/* ══════════════════════════════════════════
                        SECTION 2: Task Type toggle buttons
                    ══════════════════════════════════════════ */}
                    <div className="form-group">
                        <label className="form-label">
                            Task Type <span className="req">*</span>
                        </label>

                        <div className="toggle-group">
                            {/* Active task types */}
                            {TASK_TYPES.filter(t => t.active).map(type => (
                                <button
                                    key={type.value}
                                    type="button"
                                    className={`toggle-btn ${form.task_type === type.value
                                        ? 'toggle-btn-active'
                                        : ''
                                        }`}
                                    onClick={() => handleTaskTypeChange(type.value)}
                                    title={type.description}
                                >
                                    <span className="toggle-icon">{type.icon}</span>
                                    <span className="toggle-label">{type.label}</span>
                                    <span className="toggle-desc">{type.description}</span>
                                </button>
                            ))}



                            {/* ── FUTURE placeholder buttons ────────────────────
                                Uncomment when Daily/Weekly/Monthly are ready.
                                These are UI-only, no backend currently.

                            {TASK_TYPES.filter(t => !t.active).map(type => (
                                <button
                                    key={type.value}
                                    type="button"
                                    className="toggle-btn toggle-btn-future"
                                    disabled
                                    title="Coming soon"
                                >
                                    <span className="toggle-icon">{type.icon}</span>
                                    <span className="toggle-label">{type.label}</span>
                                    <span className="coming-soon-badge">Soon</span>
                                </button>
                            ))}
                            ──────────────────────────────────────────────── */}
                        </div>


                    </div>

                    {/* ══════════════════════════════════════════
                        SECTION 3: Priority toggle buttons
                    ══════════════════════════════════════════ */}
                    <div className="form-group">
                        <label className="form-label">
                            Priority <span className="req">*</span>
                        </label>
                        <div className="toggle-group">
                            {PRIORITIES.map(p => {
                                const isActive = form.priority_type === p.value;
                                return (
                                    <button
                                        key={p.value}
                                        type="button"
                                        className={`toggle-btn priority-btn ${isActive ? 'priority-btn-active' : ''
                                            }`}
                                        style={isActive
                                            ? {
                                                background: p.color,
                                                borderColor: p.color,
                                                color: 'white'
                                            }
                                            : {
                                                borderColor: p.color,
                                                color: p.color,
                                                background: p.bg
                                            }
                                        }
                                        onClick={() => setField('priority_type', p.value)}
                                    >
                                        {p.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════
                        SECTION 4: Conditional Date/Time Fields
                        (changes based on task_type)
                    ══════════════════════════════════════════ */}
                    {/* ── RANDOM (4): Start Date only ─────────── */}
                    {form.task_type === 4 && (
                        <div className="form-group">
                            <label className="form-label">
                                Start Date <span className="req">*</span>
                            </label>
                            <input
                                type="date"
                                className="form-control"
                                value={form.task_start_date}
                                onChange={e =>
                                    handleDateChange('task_start_date', e.target.value)
                                }
                            />
                            <p className="field-hint">
                                Random tasks have no fixed deadline
                            </p>
                        </div>
                    )}

                    {/* ── TIME BOUND (5): Date + Time both sides ─ */}
                    {form.task_type === 5 && (
                        <>
                            {/* Row 1: Start Date + Start Time */}
                            <div className="datetime-row">
                                <div className="form-group">
                                    <label className="form-label">
                                        Start Date <span className="req">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={form.task_start_date}
                                        onChange={e =>
                                            handleDateChange(
                                                'task_start_date', e.target.value)
                                        }
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Start Time <span className="req">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        className="form-control"
                                        value={form.start_time}
                                        onChange={e =>
                                            setField('start_time', e.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            {/* Divider arrow */}
                            <div className="datetime-arrow">
                                ↓ ends at
                            </div>

                            {/* Row 2: End Date + End Time */}
                            <div className="datetime-row">
                                <div className="form-group">
                                    <label className="form-label">
                                        End Date <span className="req">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={form.task_end_date}
                                        min={form.task_start_date}
                                        onChange={e =>
                                            handleDateChange(
                                                'task_end_date', e.target.value)
                                        }
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        End Time <span className="req">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        className="form-control"
                                        value={form.end_time}
                                        onChange={e =>
                                            setField('end_time', e.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            {/* Live preview of what will be stored */}
                            {form.task_start_date && form.start_time &&
                                form.task_end_date && form.end_time && (
                                    <div className="datetime-preview">
                                        <span>💾 Will save:</span>
                                        <code>
                                            {form.task_start_date} {form.start_time}:00
                                        </code>
                                        <span>→</span>
                                        <code>
                                            {form.task_end_date} {form.end_time}:00
                                        </code>
                                    </div>
                                )}
                        </>
                    )}

                    {/* ── RECURRING (1, 2, 3) ── */}
                    {[1, 2, 3].includes(form.task_type) && (
                        <div className="recurrence-box">
                            <div className="datetime-row">
                                <div className="form-group">
                                    <label className="form-label">
                                        Start Date <span className="req">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={form.task_start_date}
                                        onChange={e =>
                                            handleDateChange('task_start_date', e.target.value)
                                        }
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        Recurrence End Date <span className="req">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={form.recurrence_end_date}
                                        min={form.task_start_date}
                                        onChange={e =>
                                            setField('recurrence_end_date', e.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            {/* Weekly specific: Days checkboxes */}
                            {form.task_type === 2 && (
                                <div className="form-group">
                                    <label className="form-label">Repeat on <span className="req">*</span></label>
                                    <div className="toggle-group chips-wrap" style={{ marginTop: 8 }}>
                                        {DAYS_OF_WEEK.map(day => (
                                            <button
                                                key={day.value}
                                                type="button"
                                                className={`toggle-btn ${form.weekly_days.includes(day.value) ? 'toggle-btn-active' : ''
                                                    }`}
                                                style={{ padding: '6px 12px', minWidth: 'auto' }}
                                                onClick={() => toggleWeeklyDay(day.value)}
                                            >
                                                {day.short}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Monthly specific: Day of month dropdown */}
                            {form.task_type === 3 && (
                                <div className="form-group">
                                    <label className="form-label">Day of Month <span className="req">*</span></label>
                                    <select
                                        className="form-control"
                                        style={{ maxWidth: 120 }}
                                        value={form.monthly_day_of_month}
                                        onChange={e => setField('monthly_day_of_month', e.target.value)}
                                    >
                                        <option value="">Select Day</option>
                                        {[...Array(31)].map((_, i) => (
                                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}


                    {/* ══════════════════════════════════════════
                        SECTION 5: Employee Assignment
                        Search by ID or Name (single input)
                    ══════════════════════════════════════════ */}

                    <div className="form-group" ref={dropdownRef}>
                        <label className="form-label">
                            Assign To <span className="req">*</span>
                        </label>

                        {/* Search input */}
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

                        {/* Employee list box */}
                        {showEmpList && (
                            <div className="emp-list-box">
                                {empLoading ? (
                                    <div className="emp-list-state">
                                        <div className="spinner"
                                            style={{ width: 22, height: 22 }} />
                                        <span>Loading employees...</span>
                                    </div>
                                ) : employees.length === 0 ? (
                                    <div className="emp-list-state">
                                        {empSearch
                                            ? `No employee found matching "${empSearch}"`
                                            : 'No employees available'}
                                    </div>
                                ) : (
                                    employees.map(emp => {
                                        const isChecked =
                                            form.selectedEmployees.includes(emp.emp_id);
                                        return (
                                            <label
                                                key={emp.emp_id}
                                                className={`emp-row ${isChecked ? 'emp-row-checked' : ''
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleEmployee(emp.emp_id)}
                                                />
                                                <span className="emp-row-name">
                                                    {emp.emp_name}
                                                </span>
                                                <span className="emp-row-id">
                                                    #{emp.emp_id}
                                                </span>
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Selected employee chips */}
                        {form.selectedEmployees.length > 0 && (
                            <div className="chips-wrap">
                                {form.selectedEmployees.map(id => {
                                    const emp = employees.find(
                                        e => e.emp_id === id
                                    );
                                    return (
                                        <span key={id} className="chip">
                                            {emp?.emp_name || id}
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

                    {/* ══════════════════════════════════════════
                        SUBMIT
                    ══════════════════════════════════════════ */}
                    <button
                        type="submit"
                        className="btn btn-primary submit-btn"
                        disabled={submitting}
                    >
                        {submitting ? 'Creating...' : '✓ Create Task'}
                    </button>

                </form>
            </div>

            {/* Date shift permission modal */}
            {shiftInfo && (
                <DateShiftModal
                    shiftInfo={shiftInfo}
                    onShift={handleShiftApproved}
                    onKeep={handleShiftDenied}
                    onClose={handleShiftDenied}
                />
            )}
        </div>
    );
};

export default CreateTaskPage;