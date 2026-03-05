
// src/pages/DashboardPage.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-toastify';
import { usePolling } from '../hooks/usePolling';
import { config } from '../config';
import {
    PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
    MdWarning, MdTrendingUp, MdAssignment,
    MdCheckCircle, MdError, MdSchedule, MdClose,
    MdArrowUpward, MdArrowDownward
} from 'react-icons/md';
import { formatDate, getDaysText } from '../utils/formatters';

const DashboardPage = () => {
    const [data, setData] = useState(null);
    const [viewType, setViewType] = useState('ASSIGNED_BY_ME');
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedEmp, setSelectedEmp] = useState('');
    const [showWarning, setShowWarning] = useState(true);
    const [selectedLabel, setSelectedLabel] = useState(null);
    const [filteredTasks, setFilteredTasks] = useState([]);
    const [filteredLoading, setFilteredLoading] = useState(false);
    const [empSearch, setEmpSearch] = useState('');
    const [showEmpDropdown, setShowEmpDropdown] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const employeeListRef = useRef([]);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    // AJAX Polling for real-time updates (every 10 seconds)
    usePolling(() => {
        fetchDashboard();
        if (selectedLabel) fetchFilteredTasks(selectedLabel);
    }, config.POLLING_INTERVAL);

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ view: viewType });
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            if (selectedEmp && viewType === 'ASSIGNED_BY_ME')
                params.set('employee_id', selectedEmp);

            const url = `/tasks/dashboard/?${params.toString()}`;
            console.log(`🔄 Fetching dashboard data from: ${url}`);

            const response = await api.get(url);

            if (response.data.success) {
                const d = response.data.data;
                console.log('✅ Dashboard data loaded successfully:', d);
                setData(d);
                // Build employee list from summary only on unfiltered first load
                if (!selectedEmp && d.employee_summary?.length) {
                    employeeListRef.current = d.employee_summary;
                }
            } else {
                console.error('❌ API returned success=false:', response.data);
                toast.error(response.data.message || 'Failed to load dashboard');
            }
        } catch (error) {
            console.error('❌ Error fetching dashboard:', {
                status: error.response?.status,
                message: error.response?.data?.message || error.message,
                details: error.response?.data,
                url: error.config?.url,
            });
            toast.error('Failed to load dashboard: ' + (error.response?.data?.message || error.message));
        }
        setLoading(false);
    }, [viewType, dateFrom, dateTo, selectedEmp]);

    const fetchFilteredTasks = useCallback(async (label) => {
        setFilteredLoading(true);
        try {
            const endpoint = viewType === 'ASSIGNED_BY_ME' ? '/tasks/assigned-by-me/' : '/tasks/my-tasks/';
            const params = new URLSearchParams();

            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);

            if (viewType === 'ASSIGNED_BY_ME' && selectedEmp) {
                params.set('employee_id', selectedEmp);
            }

            if (label === 'In Progress') params.set('status', 1);
            else if (label === 'Submitted') params.set('status', 2);
            else if (label === 'Approved') params.set('status', 3);
            else if (label === 'Pending') params.set('filter_group', 'PENDING');
            else if (label === 'Overdue') params.set('overdue_only', 1);

            const url = `${endpoint}?${params.toString()}`;
            console.log(`🔄 Fetching filtered tasks from: ${url}`, { label, viewType });

            const response = await api.get(url);
            if (response.data.success) {
                console.log(`✅ Filtered tasks loaded for "${label}":`, response.data.data);
                setFilteredTasks(response.data.data || []);
            } else {
                console.error(`❌ Failed to fetch "${label}" tasks:`, response.data);
                toast.error(response.data.message || 'Failed to load tasks');
            }
        } catch (error) {
            console.error(`❌ Error fetching "${label}" tasks:`, {
                status: error.response?.status,
                message: error.response?.data?.message || error.message,
                details: error.response?.data,
            });
            toast.error('Failed to load tasks: ' + (error.response?.data?.message || error.message));
        }
        setFilteredLoading(false);
    }, [viewType, dateFrom, dateTo, selectedEmp]);

    useEffect(() => {
        fetchDashboard();
        setSelectedLabel(null);
        setFilteredTasks([]);
    }, [fetchDashboard]);

    useEffect(() => {
        if (selectedLabel) {
            fetchFilteredTasks(selectedLabel);
        }
    }, [selectedLabel, fetchFilteredTasks]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <span style={{ opacity: 0.3 }}><MdArrowUpward style={{ fontSize: 12 }} /></span>;
        return sortConfig.direction === 'asc' ? <MdArrowUpward /> : <MdArrowDownward />;
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowEmpDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
            </div>
        );
    }

    if (!data) return null;

    const counts = data.overall_counts || {};
    const getDeptName = (item) => {
        if (!item) return '';
        const candidates = [
            item.emp_department,
            item.department,
            item.department_name,
            item.dept_name,
            item.dep_name,
            item.dept,
        ];
        const found = candidates.find(c => c && c !== 'N/A');
        return found || '';
    };

    const statsCards = [
        { label: 'Total', value: counts.total_tasks, icon: <MdAssignment />, color: '#4361ee' },
        { label: 'Pending', value: counts.pending_count, icon: <MdSchedule />, color: '#FF9800' },
        { label: 'In Progress', value: counts.in_progress_count, icon: <MdTrendingUp />, color: '#2196F3' },
        { label: 'Submitted', value: counts.submitted_count, icon: <MdSchedule />, color: '#FF9800' },
        { label: 'Approved', value: counts.approved_count, icon: <MdCheckCircle />, color: '#4CAF50' },
        { label: 'Overdue', value: counts.overdue_count, icon: <MdError />, color: '#F44336' },
    ];

    return (
        <div>
            {/* ── Header row: title + mode toggle ── */}
            <div className="page-header">
                <h1>Dashboard</h1>
                <div style={{ display: 'flex', background: '#f1f3f9', padding: 4, borderRadius: 10 }}>
                    <button
                        style={{
                            padding: '8px 20px',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: viewType === 'SELF' ? '#fff' : 'transparent',
                            color: viewType === 'SELF' ? '#4361ee' : '#666',
                            boxShadow: viewType === 'SELF' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                        }}
                        onClick={() => {
                            setViewType('SELF');
                            setDateFrom(''); setDateTo(''); setSelectedEmp('');
                            employeeListRef.current = [];
                        }}
                    >
                        My Tasks
                    </button>
                    <button
                        style={{
                            padding: '8px 20px',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: viewType === 'ASSIGNED_BY_ME' ? '#fff' : 'transparent',
                            color: viewType === 'ASSIGNED_BY_ME' ? '#4361ee' : '#666',
                            boxShadow: viewType === 'ASSIGNED_BY_ME' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                            marginLeft: 4
                        }}
                        onClick={() => {
                            setViewType('ASSIGNED_BY_ME');
                            setDateFrom(''); setDateTo(''); setSelectedEmp('');
                            employeeListRef.current = [];
                        }}
                    >
                        Assigned By Me
                    </button>
                </div>
            </div>

            {/* ── Filter bar ── */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
                background: '#f9f9fb', border: '1px solid #e8e8f0',
                borderRadius: 10, padding: '14px 18px', marginBottom: 20,
            }}>
                {/* Start Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>
                        Start Date
                    </label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        style={{
                            padding: '7px 10px', borderRadius: 6,
                            border: '1px solid #ccc', fontSize: 14,
                        }}
                    />
                </div>

                {/* End Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>
                        End Date
                    </label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        style={{
                            padding: '7px 10px', borderRadius: 6,
                            border: '1px solid #ccc', fontSize: 14,
                        }}
                    />
                </div>

                {/* Employee dropdown — Searchable */}
                {viewType === 'ASSIGNED_BY_ME' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }} ref={dropdownRef}>
                        <label style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>
                            Employee
                        </label>
                        <div
                            style={{
                                display: 'flex', alignItems: 'center', border: '1px solid #ccc',
                                borderRadius: 6, background: '#fff', padding: '2px 8px', minWidth: 200
                            }}
                            onClick={() => setShowEmpDropdown(true)}
                        >
                            <input
                                type="text"
                                placeholder="Search employee..."
                                value={empSearch}
                                onChange={(e) => {
                                    setEmpSearch(e.target.value);
                                    setShowEmpDropdown(true);
                                }}
                                style={{ border: 'none', outline: 'none', padding: '5px', flex: 1, fontSize: 14 }}
                            />
                            {selectedEmp && (
                                <MdClose
                                    style={{ cursor: 'pointer', color: '#999' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEmp('');
                                        setEmpSearch('');
                                    }}
                                />
                            )}
                        </div>
                        {showEmpDropdown && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                background: '#fff', border: '1px solid #ccc',
                                borderRadius: 6, marginTop: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                zIndex: 100, maxHeight: 250, overflowY: 'auto'
                            }}>
                                <div
                                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f0f0f0' }}
                                    onClick={() => {
                                        setSelectedEmp('');
                                        setEmpSearch('');
                                        setShowEmpDropdown(false);
                                    }}
                                >
                                    All Employees
                                </div>
                                {employeeListRef.current
                                    .filter(emp => emp.emp_name.toLowerCase().includes(empSearch.toLowerCase()))
                                    .map((emp) => (
                                        <div
                                            key={emp.emp_id}
                                            style={{
                                                padding: '8px 12px', cursor: 'pointer', fontSize: 14,
                                                background: selectedEmp === emp.emp_id ? '#f0f3ff' : 'transparent'
                                            }}
                                            onClick={() => {
                                                setSelectedEmp(emp.emp_id);
                                                setEmpSearch(emp.emp_name);
                                                setShowEmpDropdown(false);
                                            }}
                                        >
                                            {emp.emp_name}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Clear button */}
                {(dateFrom || dateTo || selectedEmp) && (
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button
                            onClick={() => {
                                setDateFrom(''); setDateTo(''); setSelectedEmp('');
                                setEmpSearch('');
                            }}
                            style={{
                                shadow: 'none', padding: '8px 18px', borderRadius: 6,
                                border: '1px solid #ccc', background: '#fff',
                                fontSize: 14, cursor: 'pointer', color: '#666',
                            }}
                        >
                            Clear Filters
                        </button>
                    </div>
                )}
            </div>

            {showWarning && counts.holiday_affected_count > 0 && (
                <div
                    style={{
                        background: '#FFF3E0',
                        border: '1px solid #FFE0B2',
                        borderRadius: 12,
                        padding: '14px 20px',
                        marginBottom: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        cursor: 'pointer',
                    }}
                >
                    <div
                        onClick={() => navigate('/affected-tasks')}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}
                    >
                        <MdWarning style={{ fontSize: 24, color: '#FF9800' }} />
                        <span style={{ fontSize: 14 }}>
                            <strong>{counts.holiday_affected_count} task(s)</strong> have deadlines on holidays/Sundays.
                            <span style={{ color: '#4361ee' }}> Click to review →</span>
                        </span>
                    </div>

                    {/* Close button */}
                    <MdClose
                        style={{ fontSize: 20, color: '#FF5722', cursor: 'pointer' }}
                        onClick={(e) => {
                            e.stopPropagation(); // prevent navigate click
                            setShowWarning(false);
                        }}
                    />
                </div>
            )}


            {/* Stats cards */}
            <div className="stats-grid">
                {statsCards.map((card, idx) => (
                    <div
                        key={idx}
                        className={`card card-clickable ${selectedLabel === card.label ? 'selected-card' : ''}`}
                        style={{ textAlign: 'center' }}
                        onClick={() => setSelectedLabel(selectedLabel === card.label ? null : card.label)}
                    >
                        <div style={{
                            fontSize: 28, color: card.color, marginBottom: 4,
                        }}>
                            {card.icon}
                        </div>
                        <div style={{
                            fontSize: 28, fontWeight: 700, color: card.color,
                        }}>
                            {card.value || 0}
                        </div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                            {card.label}
                        </div>
                    </div>
                ))}
            </div>

            {/* Filtered Task Details Section */}
            {selectedLabel && (
                <div className="card" style={{ marginBottom: 20, border: '1px solid #4361ee', padding: 0 }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px', background: '#4361ee', color: '#fff',
                        borderRadius: '10px 10px 0 0'
                    }}>
                        <h3 style={{ fontSize: 16, margin: 0 }}>
                            Tasks: {selectedLabel}
                        </h3>
                        <MdClose
                            style={{ fontSize: 22, cursor: 'pointer' }}
                            onClick={() => setSelectedLabel(null)}
                        />
                    </div>

                    <div style={{ padding: '20px' }}>
                        {filteredLoading ? (
                            <div style={{ textAlign: 'center', padding: 20 }}>
                                <div className="spinner" style={{ margin: '0 auto' }} />
                            </div>
                        ) : (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th onClick={() => handleSort('emp_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                                Employee {getSortIcon('emp_name')}
                                            </th>
                                            <th>Department</th>
                                            <th>Task Title</th>
                                            <th>Description</th>
                                            <th>Priority</th>
                                            <th onClick={() => handleSort('display_start_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                                Start Date {getSortIcon('display_start_date')}
                                            </th>
                                            <th onClick={() => handleSort('display_end_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                                End Date {getSortIcon('display_end_date')}
                                            </th>
                                            <th>Due by</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTasks.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                                                    No tasks found for this status
                                                </td>
                                            </tr>
                                        ) : (
                                            (() => {
                                                // Apply sorting if configured
                                                let sortedTasks = [...filteredTasks];
                                                if (sortConfig.key) {
                                                    sortedTasks.sort((a, b) => {
                                                        let valA = a[sortConfig.key] || '';
                                                        let valB = b[sortConfig.key] || '';

                                                        // Handle date strings
                                                        if (sortConfig.key.includes('date')) {
                                                            valA = new Date(valA);
                                                            valB = new Date(valB);
                                                        }

                                                        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                                                        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                                                        return 0;
                                                    });
                                                }

                                                // Group tasks using Map to preserve backend sort order (or new sort order)
                                                const groupsMap = new Map();
                                                sortedTasks.forEach(t => {
                                                    const key = t.group_id || `ind_${t.execution_log_id}`;
                                                    if (!groupsMap.has(key)) groupsMap.set(key, []);
                                                    groupsMap.get(key).push(t);
                                                });

                                                return Array.from(groupsMap.entries()).map(([key, groupMembers], gIdx) => {
                                                    const isGroup = typeof key === 'number';
                                                    const bgColor = isGroup ? (gIdx % 2 === 0 ? '#f0f7ff' : '#f5faff') : 'transparent';

                                                    return groupMembers.map((task, mIdx) => {
                                                        const isOverdue = task.is_overdue === 1 || task.is_overdue === true;
                                                        const isFirstInGroup = mIdx === 0;
                                                        // Use task_status (from new SP) or fallback to status
                                                        const currentStatus = task.task_status !== undefined ? task.task_status : task.status;

                                                        return (
                                                            <tr key={task.execution_log_id} style={{ background: bgColor }}>
                                                                <td
                                                                    style={{
                                                                        fontWeight: 500,
                                                                        color: viewType === 'ASSIGNED_BY_ME' ? '#4361ee' : 'inherit',
                                                                        cursor: viewType === 'ASSIGNED_BY_ME' ? 'pointer' : 'default',
                                                                        borderTop: isGroup && isFirstInGroup ? '2px solid #4361ee' : '1px solid #eee'
                                                                    }}
                                                                    onClick={() => {
                                                                        if (viewType === 'ASSIGNED_BY_ME') {
                                                                            setSelectedEmp(task.emp_id);
                                                                            setEmpSearch(task.emp_name);
                                                                            setSelectedLabel(null);
                                                                        }
                                                                    }}
                                                                >
                                                                    {task.emp_name || 'Unassigned'}
                                                                    {task.is_team_lead === 1 && <span style={{ marginLeft: 5, fontSize: 10 }}>⭐</span>}
                                                                </td>
                                                                <td style={{ borderTop: isGroup && isFirstInGroup ? '2px solid #4361ee' : '1px solid #eee' }}>
                                                                    {getDeptName(task) || 'N/A'}
                                                                </td>
                                                                <td style={{ borderTop: isGroup && isFirstInGroup ? '2px solid #4361ee' : '1px solid #eee' }}>
                                                                    {isGroup && isFirstInGroup && <span style={{ color: '#4361ee', fontWeight: 'bold', marginRight: 5 }}>[G]</span>}
                                                                    {task.task_title}
                                                                </td>
                                                                <td style={{
                                                                    maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                                    borderTop: isGroup && isFirstInGroup ? '2px solid #4361ee' : '1px solid #eee'
                                                                }}>
                                                                    {task.task_description}
                                                                </td>
                                                                <td style={{ borderTop: isGroup && isFirstInGroup ? '2px solid #4361ee' : '1px solid #eee' }}>
                                                                    <span style={{
                                                                        padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                                                        background: task.priority_type === 3 ? '#ffebee' : task.priority_type === 2 ? '#fff3e0' : '#e8f5e9',
                                                                        color: task.priority_type === 3 ? '#f44336' : task.priority_type === 2 ? '#ff9800' : '#4caf50'
                                                                    }}>
                                                                        {task.priority_type === 3 ? 'HIGH' : task.priority_type === 2 ? 'MEDIUM' : 'LOW'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ borderTop: isGroup && isFirstInGroup ? '2px solid #4361ee' : '1px solid #eee' }}>
                                                                    {formatDate(task.display_start_date) || 'N/A'}
                                                                </td>
                                                                <td style={{ borderTop: isGroup && isFirstInGroup ? '2px solid #4361ee' : '1px solid #eee' }}>
                                                                    {formatDate(task.display_end_date)}
                                                                </td>
                                                                <td style={{
                                                                    borderTop: isGroup && isFirstInGroup ? '2px solid #4361ee' : '1px solid #eee',
                                                                    color: currentStatus === 3 ? '#4CAF50' :
                                                                        (task.days_remaining === 0 ? '#FF9800' :
                                                                            (isOverdue || task.days_remaining < 0 ? '#F44336' :
                                                                                (task.days_remaining === 1 ? '#FBC02D' : '#4CAF50'))),
                                                                    fontWeight: 600
                                                                }}>
                                                                    {currentStatus === 3 ? 'Completed' : (getDaysText(task.days_remaining) || '-')}
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                });
                                            })()
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Charts */}
            <div className="charts-grid">
                {data.status_chart && data.status_chart.length > 0 && (
                    <div className="card">
                        <h3 style={{ fontSize: 16, marginBottom: 16 }}>
                            Status Distribution
                        </h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={data.status_chart.filter(e => e.status_name != null)}
                                    dataKey="value"
                                    nameKey="status_name"
                                    cx="50%" cy="50%"
                                    outerRadius={80}
                                    label={({ status_name, value }) =>
                                        `${status_name || ''}: ${value}`
                                    }
                                >
                                    {data.status_chart.map((entry, index) => (
                                        <Cell
                                            key={index}
                                            fill={entry.color}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {data.priority_chart && data.priority_chart.length > 0 && (
                    <div className="card">
                        <h3 style={{ fontSize: 16, marginBottom: 16 }}>
                            By Priority
                        </h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={data.priority_chart}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar
                                    dataKey="completed"
                                    fill="#4CAF50"
                                    name="Completed"
                                />
                                <Bar
                                    dataKey="pending"
                                    fill="#FF9800"
                                    name="Pending"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Employee summary table */}
            {viewType === 'ASSIGNED_BY_ME' &&
                data.employee_summary &&
                data.employee_summary.length > 0 && (
                    <div className="card" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: 16, marginBottom: 16 }}>
                            Employee Summary
                        </h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Department</th>
                                        <th>Total</th>
                                        <th>Completed</th>
                                        <th>Pending</th>
                                        <th>Overdue</th>
                                        <th>Rejected</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.employee_summary.map((emp, idx) => (
                                        <tr key={idx}>
                                            <td
                                                style={{
                                                    fontWeight: 500,
                                                    color: '#4361ee',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => {
                                                    setSelectedEmp(emp.emp_id);
                                                    setEmpSearch(emp.emp_name);
                                                }}
                                            >
                                                {emp.emp_name}
                                            </td>
                                            <td>{getDeptName(emp) || 'N/A'}</td>
                                            <td>{emp.total_tasks}</td>
                                            <td style={{ color: '#4CAF50' }}>
                                                {emp.completed}
                                            </td>
                                            <td style={{ color: '#FF9800' }}>
                                                {emp.pending}
                                            </td>
                                            <td className={emp.overdue > 0 ? 'text-danger' : 'text-muted'}>
                                                {emp.overdue}
                                            </td>
                                            <td>{emp.rejected}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
        </div>
    );
};

export default DashboardPage;