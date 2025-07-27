const config = {
    development: {
        apiUrl: 'https://backend-mediconnect.onrender.com',
        peerjsHost: 'localhost',
        peerjsPort: 9000
    },
    production: {
        apiUrl: process.env.REACT_APP_API_URL || 'https://backend-mediconnect.onrender.com',
        peerjsHost: process.env.REACT_APP_PEERJS_HOST || 'https://peerjs-zwgq.onrender.com',
        peerjsPort: process.env.REACT_APP_PEERJS_PORT || 9000
    }
};

const environment = process.env.REACT_APP_ENVIRONMENT || 'production';
export default config[environment];