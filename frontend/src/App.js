import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// import pages 
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import RequestLink from './pages/auth/RequestLink';
import ResetPassword from './pages/auth/ResetPassword';
import LandingPage from './pages/LandingPage';
import PatientDashboard from './pages/patient/PatientDashboard';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import ProtectedRoute from './components/routes/ProtectedRoute';
import DoctorSchedule from './pages/doctor/DoctorSchedule';

// import css 
import "./assets/css/styles.css"
import BrowseDoctors from './pages/patient/BrowseDoctors';
import DoctorProfile from './pages/patient/DoctorProfile';
import BookAppointment from './pages/patient/BookAppointment';
import OAuthSuccess from './pages/doctor/0AuthSuccess';
import DoctorAvailabilityPage from './pages/patient/DoctorAvailabilityPage';


function App() {
  return(
     <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/request-reset" element={<RequestLink />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Doctor-specific Protected Routes */}
          <Route 
            path="/doctor/dashboard" 
            element={
              <ProtectedRoute requiredRole="doctor">
                <DoctorDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Patient-specific Protected Routes */}
          <Route 
            path="/patient/dashboard" 
            element={
              <ProtectedRoute requiredRole="patient">
                <PatientDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* General Protected Routes (for both roles) */}
          <Route 
            path="/doctors" 
            element={
              <ProtectedRoute>
                <BrowseDoctors />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/doctor/:doctorId" 
            element={
              <ProtectedRoute>
                <DoctorProfile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/book-appointment/:doctorId" 
            element={
              <ProtectedRoute>
                <BookAppointment />
              </ProtectedRoute>
            } 
          />

        <Route path="/doctor/schedule/:doctorId" element={<ProtectedRoute> <DoctorSchedule /> </ProtectedRoute>} />
        <Route path="/oauth-success" element={<OAuthSuccess />} />
        <Route
          path="/doctor/:doctorId/availability"
          element={<ProtectedRoute requiredRole="patient"><DoctorAvailabilityPage /></ProtectedRoute>}
        />
        </Routes>
        {/* <Footer /> */}
      </div>
    </Router>
  )
}

export default App;