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

// Enhanced environment detection
const getEnvironment = () => {
    // Check environment variable first
    if (process.env.NODE_ENV === 'production') {
        return 'production';
    }

    // Check if we're on a production domain
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;

        // Force production for HTTPS or known deployment platforms
        if (protocol === 'https:' ||
            hostname.includes('onrender.com') ||
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

console.log(`[API Config] Environment: ${environment}`, {
    apiUrl: currentConfig.apiUrl,
    peerjsHost: currentConfig.peerjsHost,
    peerjsPort: currentConfig.peerjsPort,
    peerjsSecure: currentConfig.peerjsSecure
});

// Enhanced PeerJS configuration with multiple fallback options
export const getPeerJSConfig = () => {
    const isSecure = currentConfig.peerjsSecure || (typeof window !== 'undefined' && window.location.protocol === 'https:');

    // Use port 443 for secure connections, original port for insecure
    const port = isSecure ? 443 : currentConfig.peerjsPort;

    const baseConfig = {
        host: currentConfig.peerjsHost,
        port: parseInt(port),
        path: currentConfig.peerjsPath,
        secure: isSecure,
        debug: environment === 'development' ? 3 : 1,
        config: {
            iceServers: getICEServers(),
            iceTransportPolicy: 'all', // Use both STUN and TURN
            iceCandidatePoolSize: 10,
            rtcpMuxPolicy: 'require',
            bundlePolicy: 'max-bundle'
        }
    };

    console.log(`[PeerJS Config] Generated:`, {
        host: baseConfig.host,
        port: baseConfig.port,
        secure: baseConfig.secure,
        iceServers: baseConfig.config.iceServers.length + ' servers'
    });

    return baseConfig;
};

// Comprehensive ICE servers configuration
export const getICEServers = () => {
    const iceServers = [
        // Google STUN servers (free and reliable)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },

        // Additional public STUN servers
        { urls: 'stun:stun.services.mozilla.com' },
        { urls: 'stun:stun.stunprotocol.org:3478' },

        // Free TURN servers (limited but helpful for testing)
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },

        // Backup TURN servers
        {
            urls: 'turn:relay1.expressturn.com:3478',
            username: 'ef3K7WY6YSZP9UTQFA',
            credential: 'lYQQMnZnmtIhURGD'
        }
    ];

    return iceServers;
};

// Test PeerJS connectivity
export const testPeerJSConnection = async () => {
    return new Promise((resolve, reject) => {
        const testPeer = new (window.Peer || require('peerjs'))('test-' + Date.now(), getPeerJSConfig());

        const timeout = setTimeout(() => {
            testPeer.destroy();
            reject(new Error('Connection timeout'));
        }, 10000);

        testPeer.on('open', (id) => {
            clearTimeout(timeout);
            testPeer.destroy();
            resolve({ success: true, peerId: id });
        });

        testPeer.on('error', (error) => {
            clearTimeout(timeout);
            testPeer.destroy();
            reject(error);
        });
    });
};

// Check if we should use secure protocols
export const isSecureEnvironment = () => {
    if (typeof window !== 'undefined') {
        return window.location.protocol === 'https:';
    }
    return currentConfig.peerjsSecure;
};

// Get WebSocket URL for debugging
export const getWebSocketUrl = () => {
    const config = getPeerJSConfig();
    const protocol = config.secure ? 'wss' : 'ws';
    return `${protocol}://${config.host}:${config.port}${config.path}`;
};

// Network quality detection
export const detectNetworkQuality = async () => {
    try {
        const startTime = Date.now();
        const response = await fetch(currentConfig.apiUrl + '/health', {
            method: 'GET',
            cache: 'no-cache'
        });
        const endTime = Date.now();
        const latency = endTime - startTime;

        if (response.ok) {
            return {
                latency,
                quality: latency < 100 ? 'excellent' :
                    latency < 300 ? 'good' :
                        latency < 500 ? 'fair' : 'poor'
            };
        }
        throw new Error('Health check failed');
    } catch (error) {
        return { error: error.message, quality: 'unknown' };
    }
};

// Enhanced error handling for API calls
export const apiCall = async (url, options = {}) => {
    const fullUrl = url.startsWith('http') ? url : `${currentConfig.apiUrl}${url}`;

    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    };

    try {
        const response = await fetch(fullUrl, defaultOptions);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API call failed for ${fullUrl}:`, error);
        throw error;
    }
};

export default currentConfig;

// Export individual values for convenience
export const { apiUrl } = currentConfig;