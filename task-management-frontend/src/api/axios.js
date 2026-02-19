import axios from 'axios';

// Points to your Django server
const api = axios.create({
    baseURL: 'http://127.0.0.1:8001/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Before EVERY request → add token from localStorage
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// If any response is 401 (unauthorized) → clear token
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

export default api;