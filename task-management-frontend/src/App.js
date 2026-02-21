import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import TokenPage from './pages/TokenPage';
import DashboardPage from './pages/DashboardPage';
import MyTasksPage from './pages/MyTasksPage';
import AssignedByMePage from './pages/AssignedByMePage';
import CreateTaskPage from './pages/CreateTaskPage';
import TaskDetailPage from './pages/TaskDetailPage';
import AffectedTasksPage from './pages/AffectedTasksPage';
import './App.css';

const ProtectedRoutes = () => {
    const { token } = useAuth();

    if (!token) {
        return <TokenPage />;
    }

    return (
        <Layout>
            <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/my-tasks" element={<MyTasksPage />} />
                <Route path="/assigned-by-me" element={<AssignedByMePage />} />
                <Route path="/create-task" element={<CreateTaskPage />} />
                <Route path="/task/:executionLogId" element={<TaskDetailPage />} />
                <Route path="/affected-tasks" element={<AffectedTasksPage />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Layout>
    );
};

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <ProtectedRoutes />
                <ToastContainer
                    position="top-right"
                    autoClose={3000}
                    hideProgressBar={false}
                    closeOnClick
                    pauseOnHover
                />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;