import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState({ text: "", type: "" });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      return setMessage({ text: "Passwords do not match", type: "error" });
    }
    

    try {
      const res = await axios.post("http://localhost:5000/api/reset-password", {
        token,
        newPassword: formData.newPassword,
      });

      setMessage({ text: res.data.message, type: "success" });

      // Optional: Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setMessage({
        text: err.response?.data?.message || "Invalid or expired link.",
        type: "error",
      });
    }
  };

  return (
    <>
        <Navbar />
    
    <div className="auth-container request-pwd">
      <div className="floating-shapes">
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <h2>Reset Your Password</h2>
          <p>Enter a new password for your account</p>
        </div>

        <div className="auth-body">
          {message.text && (
            <div
              className={`alert ${message.type === "error" ? "alert-danger" : "alert-success"}`}
              role="alert"
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="newPassword" className="form-label">New Password</label>
              <input
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                required
                className="form-control form-input"
                placeholder="Enter new password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                className="form-control form-input"
                placeholder="Confirm new password"
              />
            </div>

            <button type="submit" className="auth-btn">Reset Password</button>
          </form>
        </div>
      </div>
    </div>
          <Footer />
    </>
  );
}

export default ResetPassword;
