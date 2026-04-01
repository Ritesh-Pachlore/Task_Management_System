import React from 'react';
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../utils/constants';
import { MdSearch, MdFilterList } from 'react-icons/md';

const TaskFilters = ({ filters, setFilters, showEmployeeFilter = false, showDateFilter = false }) => {
    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({});
    };

    return (
        <div className="filters-bar">
            <MdFilterList style={{ fontSize: 20, color: '#999', flexShrink: 0 }} />

            <select
                className="filter-select"
                value={filters.status || ''}
                onChange={(e) => updateFilter('status', e.target.value)}
            >
                {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>

            <select
                className="filter-select"
                value={filters.priority || ''}
                onChange={(e) => updateFilter('priority', e.target.value)}
            >
                {PRIORITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>

            {showDateFilter && (
                <div className="filter-date-group">
                    <div className="filter-date-field">
                        <label className="filter-date-label">Start Date</label>
                        <input
                            type="date"
                            className="filter-date-input"
                            value={filters.date_from || ''}
                            onChange={(e) => updateFilter('date_from', e.target.value)}
                        />
                    </div>
                    <div className="filter-date-field">
                        <label className="filter-date-label">End Date</label>
                        <input
                            type="date"
                            className="filter-date-input"
                            value={filters.date_to || ''}
                            onChange={(e) => updateFilter('date_to', e.target.value)}
                        />
                    </div>
                </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, whiteSpace: 'nowrap' }}>
                <input
                    type="checkbox"
                    checked={filters.overdue_only === '1'}
                    onChange={(e) => updateFilter('overdue_only', e.target.checked ? '1' : '')}
                />
                Overdue
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, whiteSpace: 'nowrap' }}>
                <input
                    type="checkbox"
                    checked={filters.extended_only === '1'}
                    onChange={(e) => updateFilter('extended_only', e.target.checked ? '1' : '')}
                />
                Extended
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 150 }}>
                <MdSearch style={{ color: '#999', flexShrink: 0 }} />
                <input
                    type="text"
                    className="filter-input"
                    placeholder={showEmployeeFilter ? 'Search by task title or employee...' : 'Search tasks...'}
                    value={filters.search || ''}
                    onChange={(e) => updateFilter('search', e.target.value)}
                />
            </div>

            {Object.values(filters).some(v => v !== '' && v !== undefined && v !== null) && (
                <button
                    onClick={clearFilters}
                    style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        borderRadius: 8,
                        border: '1px solid #ddd',
                        background: '#f8f9fc',
                        color: '#666',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                    }}
                >
                    ✕ Clear
                </button>
            )}
        </div>
    );
};

export default TaskFilters;