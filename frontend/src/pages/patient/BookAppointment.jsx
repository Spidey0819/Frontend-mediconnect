import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import axios from 'axios';
import LogOut from '../auth/LogOut';

export default function BookAppointment() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = location || {};

  // Get doctor name from state or localStorage
  const doctorName = state?.doctorName || "Doctor";

  // State management
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [doctorInfo, setDoctorInfo] = useState(null);

  // Get URL parameters for pre-selected time
  const urlParams = new URLSearchParams(location.search);
  const preSelectedStart = urlParams.get('start');
  const preSelectedEnd = urlParams.get('end');

  // Fetch patient data from localStorage
  const patientData = {
    name: localStorage.getItem("name") || "Patient",
    email: localStorage.getItem("email") || ""
  };

  // Fetch doctor info and availability
  useEffect(() => {
    const fetchDoctorData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        // Fetch doctor info
        const doctorsResponse = await axios.get('https://backend-mediconnect.onrender.com/api/doctors', {
          headers: { Authorization: `Bearer ${token}` }
        });

        const doctor = doctorsResponse.data.find(doc => doc._id === doctorId);
        if (doctor) {
          setDoctorInfo(doctor);
        }

        // Fetch availability
        const availabilityResponse = await axios.get(
            `https://backend-mediconnect.onrender.com/api/doctors/${doctorId}/availability`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
        );

        setAvailability(availabilityResponse.data);

        // If there's a pre-selected time, set it
        if (preSelectedStart && preSelectedEnd) {
          const startDate = new Date(preSelectedStart);
          const selectedDateStr = startDate.toISOString().split('T')[0];
          const selectedTimeStr = startDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });

          setSelectedDate(selectedDateStr);
          setSelectedSlot(selectedTimeStr);
        }

      } catch (error) {
        console.error('Error fetching doctor data:', error);
        alert('Failed to load doctor information');
      } finally {
        setLoading(false);
      }
    };

    if (doctorId) {
      fetchDoctorData();
    }
  }, [doctorId, preSelectedStart, preSelectedEnd]);

  // Process availability into date-time mapping
  const availableDates = availability.reduce((map, slot) => {
    const startDate = new Date(slot.startTime);
    const dateStr = startDate.toISOString().split('T')[0];
    const timeStr = startDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    if (!map[dateStr]) map[dateStr] = [];
    map[dateStr].push(timeStr);
    return map;
  }, {});

  // Check if a date has available slots
  const getTileDisabled = ({ date }) => {
    const formatted = date.toISOString().split('T')[0];
    return !availableDates[formatted] || availableDates[formatted].length === 0;
  };

  // Add visual indicator for available dates
  const getTileContent = ({ date, view }) => {
    const formatted = date.toISOString().split('T')[0];
    if (view === 'month' && availableDates[formatted] && availableDates[formatted].length > 0) {
      return (
          <div className="text-success mt-1 text-center" style={{ fontSize: '0.8rem' }}>
            ● ({availableDates[formatted].length})
          </div>
      );
    }
    return null;
  };

  // Fetch booked slots when date is selected
  useEffect(() => {
    const fetchBookedSlots = async () => {
      if (!selectedDate) return;

      try {
        const res = await axios.get(`https://backend-mediconnect.onrender.com/api/appointments/${doctorId}/${selectedDate}`);
        setBookedSlots(res.data.bookedSlots || []);
      } catch (err) {
        console.error("Failed to fetch booked slots", err);
        setBookedSlots([]);
      }
    };

    fetchBookedSlots();
  }, [selectedDate, doctorId]);

  // Handle appointment booking
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!patientData.name || !patientData.email) {
      alert("Missing user details. Please log in again.");
      return;
    }

    if (!selectedDate || !selectedSlot) {
      alert("Please select a date and time slot.");
      return;
    }

    try {
      const response = await axios.post(
          'https://backend-mediconnect.onrender.com/api/book',
          {
            date: selectedDate,
            time: selectedSlot,
            doctorId: doctorId,
            doctorName: doctorInfo?.name || doctorName
          },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`
            }
          }
      );

      alert('Appointment booked successfully!');
      navigate("/patient/dashboard");
    } catch (err) {
      console.error('Booking error:', err);
      const errorMessage = err.response?.data?.error || 'Booking failed. Please try again.';
      alert(errorMessage);
    }
  };

  if (loading) {
    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center">
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status"></div>
            <p>Loading doctor information...</p>
          </div>
        </div>
    );
  }

  return (
      <div className="min-vh-100" style={{
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
      }}>
        {/* Dashboard Header */}
        <header className="sticky-top" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <div className="container-fluid px-3 px-md-4">
            <div className="row align-items-center py-4">
              <div className="col-12 col-lg-8 mb-3 mb-lg-0">
                <div className="d-flex align-items-center">
                  <div>
                    <h1 className="h3 mb-1 fw-bold text-white">Welcome {patientData.name}!</h1>
                    <p className="text-white-50 mb-0 small">Book your appointment with {doctorInfo?.name || doctorName}</p>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="d-flex flex-column flex-sm-row gap-2 justify-content-lg-end">
                  <button
                      className="btn btn-outline-light"
                      onClick={() => navigate('/patient/dashboard')}
                  >
                    ← Back to Dashboard
                  </button>
                  <LogOut/>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Section */}
        <section className="py-5 bg-light">
          <div className="container">
            <div className="row mb-4">
              <div className="col-12 text-center">
                <h2 className="fw-bold mb-3">Book Appointment</h2>
                {doctorInfo && (
                    <div className="card mx-auto" style={{ maxWidth: '400px' }}>
                      <div className="card-body text-center">
                        <img
                            src={doctorInfo.profilePhoto || '/default-avatar.png'}
                            alt={doctorInfo.name}
                            className="rounded-circle mb-3"
                            style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                        />
                        <h5 className="card-title">{doctorInfo.name}</h5>
                        <p className="card-text text-muted">{doctorInfo.specialization}</p>
                        {doctorInfo.experience && (
                            <small className="text-muted">{doctorInfo.experience} years experience</small>
                        )}
                      </div>
                    </div>
                )}
              </div>
            </div>

            <div className="row justify-content-center">
              {/* Calendar Column */}
              <div className="col-md-5 mb-4 mb-md-0">
                <div className="bg-white p-4 rounded shadow-sm">
                  <h5 className="text-center mb-3">Select Date</h5>
                  <Calendar
                      onChange={(value) => {
                        const selected = value.toISOString().split('T')[0];
                        setSelectedDate(selected);
                        setSelectedSlot(null); // Reset selected slot when date changes
                      }}
                      tileDisabled={getTileDisabled}
                      tileContent={getTileContent}
                      value={selectedDate ? new Date(selectedDate) : null}
                      minDate={new Date()} // Prevent booking in the past
                  />
                  <div className="mt-3">
                    <small className="text-muted">
                      • Green dots indicate available dates<br/>
                      • Number shows available slots
                    </small>
                  </div>
                </div>
              </div>

              {/* Time Slots + Confirm Column */}
              <div className="col-md-5">
                <div className="bg-white p-4 rounded shadow-sm">
                  {selectedDate ? (
                      <>
                        <h5 className="mb-3 text-center">Available Time Slots</h5>
                        <p className="text-center text-muted mb-3">
                          {new Date(selectedDate).toLocaleDateString()}
                        </p>

                        {availableDates[selectedDate] && availableDates[selectedDate].length > 0 ? (
                            <div className="row">
                              {availableDates[selectedDate].map((time, i) => {
                                const isBooked = bookedSlots.includes(time);
                                const isSelected = selectedSlot === time;

                                return (
                                    <div key={i} className="col-6 mb-3">
                                      <button
                                          className={`btn w-100 ${
                                              isSelected ? 'btn-primary' :
                                                  isBooked ? 'btn-secondary' : 'btn-outline-primary'
                                          }`}
                                          onClick={() => setSelectedSlot(time)}
                                          disabled={isBooked}
                                          style={{ borderRadius: '20px' }}
                                      >
                                        {time} {isBooked && "(Booked)"}
                                      </button>
                                    </div>
                                );
                              })}
                            </div>
                        ) : (
                            <div className="text-center py-4">
                              <p className="text-muted">No available slots for this date</p>
                            </div>
                        )}
                      </>
                  ) : (
                      <div className="text-center py-5">
                        <i className="fas fa-calendar-alt fa-3x text-muted mb-3"></i>
                        <p className="text-muted">Please select a date from the calendar</p>
                      </div>
                  )}

                  {/* Booking Summary & Confirm Button */}
                  {selectedSlot && (
                      <div className="mt-4">
                        <div className="card bg-light">
                          <div className="card-body">
                            <h6 className="card-title">Booking Summary</h6>
                            <p className="mb-1"><strong>Doctor:</strong> {doctorInfo?.name || doctorName}</p>
                            <p className="mb-1"><strong>Date:</strong> {new Date(selectedDate).toLocaleDateString()}</p>
                            <p className="mb-1"><strong>Time:</strong> {selectedSlot}</p>
                            <p className="mb-0"><strong>Patient:</strong> {patientData.name}</p>
                          </div>
                        </div>

                        <form onSubmit={handleSubmit} className="mt-3">
                          <button
                              type="submit"
                              className="btn btn-success w-100 fw-bold"
                              style={{ borderRadius: '20px', padding: '12px' }}
                              disabled={!patientData.name || !patientData.email}
                          >
                            <i className="fas fa-check me-2"></i>
                            Confirm Appointment
                          </button>
                        </form>
                      </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
  );
}