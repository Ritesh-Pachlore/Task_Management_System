import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // On app load, check if we have a token
    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser && token) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, [token]);

    // Get dev token for an employee
    const getDevToken = async (empId) => {
        try {
            const response = await api.get(`/auth/dev-token/?emp_id=${empId}`);
            if (response.data.success) {
                const { token: newToken, user: userData } = response.data.data;
                localStorage.setItem('token', newToken);
                localStorage.setItem('user', JSON.stringify(userData));
                setToken(newToken);
                setUser(userData);
                return { success: true };
            }
            return { success: false, message: response.data.message };
        } catch (error) {
            return { 
                success: false, 
                message: error.response?.data?.message || 'Failed to get token' 
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    };

    if (loading) {
        return <div style={{ 
            display: 'flex', justifyContent: 'center', 
            alignItems: 'center', height: '100vh' 
        }}>Loading...</div>;
    }

    return (
        <AuthContext.Provider value={{ user, token, getDevToken, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);