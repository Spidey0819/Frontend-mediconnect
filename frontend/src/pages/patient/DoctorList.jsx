// DoctorList.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

const DoctorList = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("https://backend-mediconnect.onrender.com/api/doctors") // adjust the URL if needed
      .then(res => {
        setDoctors(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching doctors:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading doctors...</div>;

  return (
    <div className="row g-4">
      <div className="col-12">
        <h4>Available Doctors</h4>
      </div>
      {doctors.map((doctor, index) => (
        <div key={index} className="col-md-4">
          <div className="card h-100 text-center">
            <div className="card-body">
              <img
                src={doctor.avatar || "https://via.placeholder.com/100"}
                alt={doctor.name}
                className="rounded-circle mb-3"
                style={{ width: '100px', height: '100px', objectFit: 'cover' }}
              />
              <h5 className="mb-1">{doctor.name}</h5>
              {doctor.specialty && <p className="text-muted mb-1">{doctor.specialty}</p>}
              {doctor.location && <p className="text-muted small">{doctor.location}</p>}
              {doctor.experience && <p className="text-muted small">Experience: {doctor.experience}</p>}
              <button className="btn btn-outline-primary btn-sm mt-2">
                <i className="fas fa-calendar-plus me-1"></i>Book Appointment
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DoctorList;
