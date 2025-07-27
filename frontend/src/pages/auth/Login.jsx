import React, { useState } from 'react';
import axios from "axios";
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useNavigate } from "react-router-dom";
import { jwtDecode } from 'jwt-decode';


const Login = ({ toggleForm }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage({ type: '', text: '' }); // clear message on typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post("https://backend-mediconnect.onrender.com/api/login", formData);
      const { token, role, doctorId, name, email } = res.data;
      const decoded = jwtDecode(token);

      localStorage.setItem("token", token);
      localStorage.setItem("role", role);
      localStorage.setItem("name", name);
      localStorage.setItem("email", email);

      if (role === "doctor" && doctorId) {
        localStorage.setItem("doctorId", decoded.doctorId);
      }

      setMessage({ type: 'success', text: 'Login successful! Redirecting...' });

      setTimeout(() => {
        if (role === 'doctor') {
          navigate("/doctor/dashboard");
        } else if (role === 'patient') {
          navigate("/patient/dashboard");
        } else {
          navigate("/"); // fallback
        }
      }, 2000);
    } catch (err) {
      console.error(err.response?.data || err.message);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || "Login failed. Please try again."
      });
    }
  };


  return (
    <>
    <Navbar />
    <div className="auth-container">
      <div className="floating-shapes">
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p>Sign in to your account</p>
        </div>

        <div className="auth-body">
          {/* Message box */}
          {message.text && (
            <div
              className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'}`}
              role="alert"
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="form-control form-input"
                placeholder="john@example.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="form-control form-input"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="auth-btn">Sign In</button>
          </form>

          <div className="toggle-form">
          <p>
              Forget Password? Don't worry <a href="/request-reset" onClick={toggleForm} className="toggle-link">Reset Here</a>
            </p>
            <p>
              Don’t have an account? <a href="/signup" onClick={toggleForm} className="toggle-link">Sign up here</a>
            </p>
          </div>
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
};

export default Login;