import React from 'react';
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../utils/constants';
import { MdSearch, MdFilterList } from 'react-icons/md';

const TaskFilters = ({ filters, setFilters, showEmployeeFilter = false }) => {
    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="filters-bar">
            <MdFilterList style={{ fontSize: 20, color: '#999' }} />

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

            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <input
                    type="checkbox"
                    checked={filters.overdue_only === '1'}
                    onChange={(e) => updateFilter('overdue_only', e.target.checked ? '1' : '')}
                />
                Overdue
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <input
                    type="checkbox"
                    checked={filters.extended_only === '1'}
                    onChange={(e) => updateFilter('extended_only', e.target.checked ? '1' : '')}
                />
                Extended
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 150 }}>
                <MdSearch style={{ color: '#999' }} />
                <input
                    type="text"
                    className="filter-input"
                    placeholder="Search tasks..."
                    value={filters.search || ''}
                    onChange={(e) => updateFilter('search', e.target.value)}
                />
            </div>
        </div>
    );
};

export default TaskFilters;