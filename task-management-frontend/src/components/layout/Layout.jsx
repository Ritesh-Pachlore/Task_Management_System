import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }) => {
    return (
        <div className="app-container">
            <Sidebar />
            <div className="main-content">
                <Header />
                <div className="page-content">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Layout;