// src/pages/DashboardPage.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-toastify';
import {
    PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
    MdWarning, MdTrendingUp, MdAssignment,
    MdCheckCircle, MdError, MdSchedule,
} from 'react-icons/md';

const DashboardPage = () => {
    const [data, setData] = useState(null);
    const [viewType, setViewType] = useState('ASSIGNED_BY_ME');
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedEmp, setSelectedEmp] = useState('');
    // Cache employee list so dropdown doesn't empty when a filter is active
    const employeeListRef = useRef([]);

    const navigate = useNavigate();

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ view: viewType });
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            if (selectedEmp && viewType === 'ASSIGNED_BY_ME')
                params.set('employee_id', selectedEmp);

            const response = await api.get(`/tasks/dashboard/?${params.toString()}`);
            if (response.data.success) {
                const d = response.data.data;
                setData(d);
                // Build employee list from summary only on unfiltered first load
                if (!selectedEmp && d.employee_summary?.length) {
                    employeeListRef.current = d.employee_summary;
                }
            }
        } catch (error) {
            toast.error('Failed to load dashboard');
        }
        setLoading(false);
    }, [viewType, dateFrom, dateTo, selectedEmp]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
            </div>
        );
    }

    if (!data) return null;

    const counts = data.overall_counts || {};

    const statsCards = [
        { label: 'Total', value: counts.total_tasks, icon: <MdAssignment />, color: '#4361ee' },
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
                <select
                    className="filter-select"
                    value={viewType}
                    onChange={(e) => {
                        setViewType(e.target.value);
                        // Reset filters when switching mode
                        setDateFrom(''); setDateTo(''); setSelectedEmp('');
                        employeeListRef.current = [];
                    }}
                >
                    <option value="SELF">My Tasks</option>
                    <option value="ASSIGNED_BY_ME">Assigned By Me</option>
                </select>
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

                {/* Employee dropdown — only in ASSIGNED_BY_ME mode, shows only employees with assigned tasks */}
                {viewType === 'ASSIGNED_BY_ME' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>
                            Employee
                        </label>
                        <select
                            value={selectedEmp}
                            onChange={(e) => setSelectedEmp(e.target.value)}
                            style={{
                                padding: '7px 10px', borderRadius: 6,
                                border: '1px solid #ccc', fontSize: 14, minWidth: 180,
                            }}
                        >
                            <option value="">All Employees</option>
                            {employeeListRef.current.map((emp) => (
                                <option key={emp.emp_id} value={emp.emp_id}>
                                    {emp.emp_name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Clear button */}
                {(dateFrom || dateTo || selectedEmp) && (
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button
                            onClick={() => {
                                setDateFrom(''); setDateTo(''); setSelectedEmp('');
                            }}
                            style={{
                                padding: '8px 18px', borderRadius: 6,
                                border: '1px solid #ccc', background: '#fff',
                                fontSize: 14, cursor: 'pointer', color: '#666',
                            }}
                        >
                            Clear Filters
                        </button>
                    </div>
                )}
            </div>

            {counts.holiday_affected_count > 0 && (
                <div
                    onClick={() => navigate('/affected-tasks')}
                    style={{
                        background: '#FFF3E0',
                        border: '1px solid #FFE0B2',
                        borderRadius: 12,
                        padding: '14px 20px',
                        marginBottom: 20,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <MdWarning style={{ fontSize: 24, color: '#FF9800' }} />
                    <span style={{ fontSize: 14 }}>
                        <strong>
                            {counts.holiday_affected_count} task(s)
                        </strong>
                        {' '}have deadlines on holidays/Sundays.
                        <span style={{ color: '#4361ee' }}>
                            {' '}Click to review →
                        </span>
                    </span>
                </div>
            )}

            {/* Stats cards */}
            <div className="stats-grid">
                {statsCards.map((card, idx) => (
                    <div key={idx} className="card" style={{ textAlign: 'center' }}>
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
                                    data={data.status_chart}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%" cy="50%"
                                    outerRadius={80}
                                    label={({ name, value }) =>
                                        `${name}: ${value}`
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
                                            <td style={{ fontWeight: 500 }}>
                                                {emp.emp_name}
                                            </td>
                                            <td>{emp.total_tasks}</td>
                                            <td style={{ color: '#4CAF50' }}>
                                                {emp.completed}
                                            </td>
                                            <td style={{ color: '#FF9800' }}>
                                                {emp.pending}
                                            </td>
                                            <td style={{
                                                color: emp.overdue > 0
                                                    ? '#F44336' : '#999',
                                            }}>
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