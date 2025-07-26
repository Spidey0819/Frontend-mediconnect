import React from 'react';

const LogOut = ({ buttonText = "Logout", buttonStyle = "", showIcon = true }) => {
    const handleLogout = () => {

        localStorage.removeItem('token');
        localStorage.removeItem('role');
        
        window.location.href = '/login';
    };

    return (
        <button 
            className={`btn ${buttonStyle}`}
            onClick={handleLogout}
            style={{
                borderRadius: '12px',
                padding: '8px 16px',
                backgroundColor: "#b3a9caff",
            }}
        >
            {showIcon && <i className="fas fa-sign-out-alt me-2"></i>}
            {buttonText}
        </button>
    );
};

export default LogOut;