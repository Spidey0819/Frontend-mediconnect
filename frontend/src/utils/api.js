import apiConfig from '../config/api';

export const apiUrl = apiConfig.apiUrl;

export const apiCall = async (endpoint, options = {}) => {
    const url = `${apiConfig.apiUrl}${endpoint}`;
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') && {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        })
    };

    const response = await fetch(url, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });

    return response;
};