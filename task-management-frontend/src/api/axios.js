import axios from 'axios';

// Single source of truth — change this IP to move to a different server
export const API_BASE_URL = 'https://alcohol-physically-button-careful.trycloudflare.com'; //'http://172.16.24.225:8001';

// Points to your Django server
const api = axios.create({
    baseURL: `${API_BASE_URL}/api`,
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