// src/config/api.js
const config = {
    production: {
        apiUrl: process.env.REACT_APP_API_URL || 'https://backend-mediconnect.onrender.com',
        peerjsHost: process.env.REACT_APP_PEERJS_HOST || 'peerjs-zwgq.onrender.com',
        peerjsPort: process.env.REACT_APP_PEERJS_PORT || 443,
        peerjsSecure: true,
        peerjsPath: '/peerjs'
    },
    development: {
        apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:5000',
        peerjsHost: process.env.REACT_APP_PEERJS_HOST || 'localhost',
        peerjsPort: process.env.REACT_APP_PEERJS_PORT || 9000,
        peerjsSecure: false,
        peerjsPath: '/peerjs'
    }
};

// Determine environment based on current URL or environment variable
const getEnvironment = () => {
    // Check if we're in a production environment
    if (process.env.NODE_ENV === 'production') {
        return 'production';
    }

    // Check if the current page is served over HTTPS
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
        return 'production';
    }

    // Check for common production hostnames
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname.includes('onrender.com') ||
            hostname.includes('vercel.app') ||
            hostname.includes('netlify.app') ||
            hostname.includes('herokuapp.com')) {
            return 'production';
        }
    }

    return 'development';
};

const environment = process.env.REACT_APP_ENVIRONMENT || getEnvironment();
const currentConfig = config[environment];

console.log(`[API Config] Using ${environment} configuration:`, {
    apiUrl: currentConfig.apiUrl,
    peerjsHost: currentConfig.peerjsHost,
    peerjsPort: currentConfig.peerjsPort,
    peerjsSecure: currentConfig.peerjsSecure
});

// Helper function to get the correct PeerJS configuration
export const getPeerJSConfig = () => {
    // Force secure connection if the page is served over HTTPS
    const forceSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const shouldUseSecure = forceSecure || currentConfig.peerjsSecure;

    // Adjust port for secure connections
    const port = shouldUseSecure ?
        (currentConfig.peerjsPort === 9000 ? 443 : currentConfig.peerjsPort) :
        currentConfig.peerjsPort;

    const peerConfig = {
        host: currentConfig.peerjsHost,
        port: parseInt(port),
        path: currentConfig.peerjsPath,
        secure: shouldUseSecure,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        },
        debug: process.env.NODE_ENV === 'development' ? 2 : 0
    };

    console.log(`[PeerJS Config] Generated configuration:`, {
        ...peerConfig,
        config: { iceServers: peerConfig.config.iceServers.length + ' STUN servers' }
    });

    return peerConfig;
};

// Helper function to check if we should use secure protocols
export const isSecureEnvironment = () => {
    if (typeof window !== 'undefined') {
        return window.location.protocol === 'https:';
    }
    return currentConfig.peerjsSecure;
};

// Helper function to get WebSocket URL for debugging
export const getWebSocketUrl = () => {
    const config = getPeerJSConfig();
    const protocol = config.secure ? 'wss' : 'ws';
    return `${protocol}://${config.host}:${config.port}${config.path}`;
};

export default currentConfig;

// Export individual values for convenience
export const { apiUrl } = currentConfig;