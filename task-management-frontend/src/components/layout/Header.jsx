import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { MdPerson, MdLogout } from 'react-icons/md';
import './Header.css';

const Header = () => {
    const { user, logout } = useAuth();

    return (
        <header className="header">
            <div className="header-left">
                {/* Spacer for mobile menu button */}
                <div className="header-spacer" />
            </div>
            <div className="header-right">
                <div className="header-user">
                    <MdPerson className="header-user-icon" />
                    <span className="header-user-name">
                        {user?.full_name || user?.emp_name || 'User'}
                    </span>
                    <span className="header-emp-id">
                        (ID: {user?.emp_id})
                    </span>
                </div>
                <button className="header-logout" onClick={logout} title="Logout">
                    <MdLogout />
                </button>
            </div>
        </header>
    );
};

export default Header;