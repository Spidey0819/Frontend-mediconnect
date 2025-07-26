import React, { useState } from "react";
import axios from "axios";
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Nav } from "react-bootstrap";

function RequestLink() {
  const [formData, setFormData] = useState({ email: "" });
  const [message, setMessage] = useState({ text: "", type: "" });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("http://localhost:5000/api/request-reset", { email: formData.email });
      setMessage({ text: res.data.message, type: "success" });
    } catch (err) {
      setMessage({
        text: err.response?.data?.message || "Something went wrong",
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
          <h2>Forgot Password</h2>
          <p>Enter your email to receive reset link</p>
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

            <button type="submit" className="auth-btn">Submit</button>
          </form>
        </div>
      </div>
    </div>
          <Footer />
     </>
  );
}

export default RequestLink;
