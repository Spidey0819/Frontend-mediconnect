const config = {
    development: {
        apiUrl: 'http://localhost:5000',
        peerjsHost: 'localhost',
        peerjsPort: 9000
    },
    production: {
        apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:5000',
        peerjsHost: process.env.REACT_APP_PEERJS_HOST || 'localhost',
        peerjsPort: process.env.REACT_APP_PEERJS_PORT || 9000
    }
};

const environment = process.env.REACT_APP_ENVIRONMENT || 'development';
export default config[environment];