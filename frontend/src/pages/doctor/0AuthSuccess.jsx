import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const OAuthSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const token = queryParams.get("token");
    const doctorId = queryParams.get("doctorId");

    if (token && doctorId) {
      localStorage.setItem("token", token);
      localStorage.setItem("doctorId", doctorId);
      const decoded = jwtDecode(token);
      localStorage.setItem("role", decoded.role);

      // Sync busy slots now
      fetch(`https://backend-mediconnect.onrender.com/google/sync-busy`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(res => res.json())
        .then(() => {
          navigate(`/doctor/dashboard`);
        })
        .catch(() => {
          alert("Failed to sync busy slots from Google Calendar");
          navigate(`/doctor/dashboard`);
        });
    } else {
      alert("Something went wrong. Token missing.");
      navigate("/login");
    }
  }, [location, navigate]);

  return <div>Connecting your Google Calendar... Please wait.</div>;
};

export default OAuthSuccess;