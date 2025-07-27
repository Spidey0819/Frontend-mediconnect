// src/services/api.js
import axios from 'axios';

// Determine the base URL based on environment
const getBaseURL = () => {
    if (process.env.NODE_ENV === 'production') {
        // Replace with your actual deployed backend URL
        return process.env.REACT_APP_API_BASE_URL || 'https://backend-mediconnect.onrender.com';
    }
    return 'http://localhost:5000';
};

// Create axios instance with base configuration
const api = axios.create({
    baseURL: getBaseURL(),
    timeout: 30000, // 30 seconds timeout
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            localStorage.removeItem('name');
            localStorage.removeItem('email');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// API methods
export const apiService = {
    // Auth endpoints
    login: (credentials) => api.post('/api/login', credentials),
    signup: (userData) => api.post('/api/signup', userData),
    requestPasswordReset: (email) => api.post('/api/request-reset', { email }),
    resetPassword: (data) => api.post('/api/reset-password', data),

    // Doctor endpoints
    getDoctors: () => api.get('/api/doctors'),
    getDoctorProfile: () => api.get('/api/doctor/profile'),
    createDoctorProfile: (data) => api.post('/api/doctor/profile', data),
    updateDoctorProfile: (data) => api.put('/api/doctor/profile', data),
    getDoctorAppointments: () => api.get('/api/doctor/appointments'),

    // Patient endpoints
    getPatientProfile: () => api.get('/api/patient/profile'),
    createPatientProfile: (data) => api.post('/api/patient/profile', data),
    updatePatientProfile: (data) => api.put('/api/patient/profile', data),
    getPatientAppointments: () => api.get('/api/patient/appointments'),

    // Appointment endpoints
    bookAppointment: (data) => api.post('/api/book', data),
    getBookedSlots: (doctorId, date) => api.get(`/api/appointments/${doctorId}/${date}`),
    updateAppointmentStatus: (appointmentId, status) =>
        api.put(`/api/appointments/${appointmentId}/status`, { status }),

    // Messaging endpoints
    getConversations: () => api.get('/api/conversations'),
    getMessages: (conversationId) => api.get(`/api/conversations/${conversationId}/messages`),
    sendMessage: (conversationId, data) => api.post(`/api/conversations/${conversationId}/send`, data),
    startConversation: (otherUserEmail) => api.post('/api/conversations/start', { other_user_email: otherUserEmail }),

    // File upload
    uploadFile: (formData) => api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),

    // Video session endpoints
    createVideoSession: (appointmentId) => api.post('/api/video/session/create', { appointment_id: appointmentId }),
    joinVideoSession: (sessionId) => api.post(`/api/video/session/${sessionId}/join`),
    endVideoSession: (sessionId) => api.post(`/api/video/session/${sessionId}/end`),
    getSessionStatus: (sessionId) => api.get(`/api/video/session/${sessionId}/status`),
};

export default api;