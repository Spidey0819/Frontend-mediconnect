// src/config/api.js
const config = {
    production: {
        apiUrl: process.env.REACT_APP_API_URL || 'https://backend-mediconnect.onrender.com',
        peerjsHost: process.env.REACT_APP_PEERJS_HOST || 'peerjs-zwgq.onrender.com',
        peerjsPort: process.env.REACT_APP_PEERJS_PORT || 443, // Use 443 for HTTPS
        peerjsSecure: true, // Enable secure connection for production
        peerjsPath: '/peerjs'
    }
};

const environment = process.env.REACT_APP_ENVIRONMENT || 'production';
const currentConfig = config[environment];

// Helper function to get the correct PeerJS configuration
export const getPeerJSConfig = () => {
    const isSecure = currentConfig.peerjsSecure || window.location.protocol === 'https:';

    return {
        host: currentConfig.peerjsHost,
        port: isSecure ? (currentConfig.peerjsPort === 9000 ? 443 : currentConfig.peerjsPort) : currentConfig.peerjsPort,
        path: currentConfig.peerjsPath,
        secure: isSecure,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        }
    };
};

export default currentConfig;

// Export individual values for convenience
export const { apiUrl } = currentConfig;