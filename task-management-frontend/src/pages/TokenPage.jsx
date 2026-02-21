import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const TokenPage = () => {
    const [empId, setEmpId] = useState('');
    const [loading, setLoading] = useState(false);
    const { getDevToken } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!empId.trim()) {
            toast.error('Please enter Employee ID');
            return;
        }

        setLoading(true);
        const result = await getDevToken(empId.trim());
        setLoading(false);

        if (result.success) {
            toast.success('Token generated! Loading app...');
        } else {
            toast.error(result.message);
        }
    };

    return (
        <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            minHeight: '100vh', background: '#f5f7fa', padding: 16,
        }}>
            <div style={{
                background: 'white', borderRadius: 16, padding: 32,
                width: '100%', maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}>
                <h1 style={{ fontSize: 24, marginBottom: 8, textAlign: 'center' }}>
                    📋 Task Manager
                </h1>
                <p style={{ color: '#999', textAlign: 'center', marginBottom: 24, fontSize: 14 }}>
                    Enter your Employee ID to continue
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Employee ID</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. 102201"
                            value={empId}
                            onChange={(e) => setEmpId(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '12px', fontSize: 15 }}
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : 'Continue'}
                    </button>
                </form>

                <p style={{ 
                    color: '#bbb', textAlign: 'center', 
                    marginTop: 16, fontSize: 12 
                }}>
                    Dev mode — no password required
                </p>
            </div>
        </div>
    );
};

export default TokenPage;