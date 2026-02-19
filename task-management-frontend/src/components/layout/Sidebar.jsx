import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
    MdDashboard, MdAssignment, MdSend, MdAdd, MdWarning,
    MdMenu, MdClose 
} from 'react-icons/md';
import './Sidebar.css';

const Sidebar = () => {
    const [mobileOpen, setMobileOpen] = useState(false);

    const navItems = [
        { path: '/', icon: <MdDashboard />, label: 'Dashboard' },
        { path: '/my-tasks', icon: <MdAssignment />, label: 'My Tasks' },
        { path: '/assigned-by-me', icon: <MdSend />, label: 'Assigned By Me' },
        { path: '/create-task', icon: <MdAdd />, label: 'Create Task' },
        { path: '/affected-tasks', icon: <MdWarning />, label: 'Holiday Alerts' },
    ];

    return (
        <>
            {/* Mobile hamburger button */}
            <button 
                className="sidebar-toggle"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? <MdClose /> : <MdMenu />}
            </button>

            {/* Overlay for mobile */}
            {mobileOpen && (
                <div 
                    className="sidebar-overlay"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
                <div className="sidebar-header">
                    <h2>📋 Task Manager</h2>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                            onClick={() => setMobileOpen(false)}
                        >
                            <span className="sidebar-icon">{item.icon}</span>
                            <span className="sidebar-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>
        </>
    );
};

export default Sidebar;