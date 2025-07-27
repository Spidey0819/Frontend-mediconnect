import { useState, useEffect } from "react";
import axios from "axios";
import LogOut from "../auth/LogOut.jsx";
import PatientProfile from "./PatientProfile.jsx";
import { useNavigate } from "react-router-dom";
import { useMessages } from "../../hooks/useMessages";
import { messageService } from "../../services/messageService";
import { Modal, Button } from "react-bootstrap";
import VideoConsultationModal from "../../components/VideoConsultationModal";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

import "./Dashboard.css";

const PatientDashboard = () => {
    const [activeTab, setActiveTab] = useState("overview");
    const [patientName, setPatientName] = useState("Patient");
    const [patientProfile, setPatientProfile] = useState(null);
    const [availableDoctor, setAvailableDoctors] = useState([]);

    // Real appointments state
    const [appointments, setAppointments] = useState([]);
    const [appointmentsLoading, setAppointmentsLoading] = useState(true);

    const [availabilitySlots, setAvailabilitySlots] = useState([]);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [availabilityDoctorId, setAvailabilityDoctorId] = useState(null);

    const navigate = useNavigate();
    const {
        conversations,
        activeConversation,
        messages,
        loading,
        error,
        sendMessage,
        uploadImage,
        selectConversation,
        getUnreadCount,
        clearError,
    } = useMessages();
    const [newMessage, setNewMessage] = useState("");
    const [selectedImage, setSelectedImage] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [specialtyFilter, setSpecialtyFilter] = useState("All");
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState(null);

    // Video consultation state
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [selectedAppointmentForVideo, setSelectedAppointmentForVideo] =
        useState(null);

    const handleShowProfile = (doctor) => {
        console.log("Selected doctor:", doctor);
        setSelectedDoctor(doctor);
        setShowProfileModal(true);
    };

    const handleCloseProfile = () => {
        setShowProfileModal(false);
        setSelectedDoctor(null);
    };

    const calendarEvents = availabilitySlots.map((slot) => ({
        title: "Available",
        start: new Date(slot.startTime),
        end: new Date(slot.endTime),
        allDay: false,
    }));

    const handleEventClick = ({ event }) => {
        const start = event.start.toISOString();
        const end = event.end.toISOString();

        // Find the doctor info to pass along
        const selectedDoctor = availableDoctor.find(doc => doc._id === availabilityDoctorId);

        navigate(
            `/book-appointment/${availabilityDoctorId}?start=${start}&end=${end}`,
            {
                state: {
                    doctorName: selectedDoctor?.name || 'Doctor',
                    doctorInfo: selectedDoctor
                }
            }
        );
    };

    const fetchDoctorAvailability = async (doctorUserId) => {
        setAvailabilityLoading(true);
        setAvailabilityDoctorId(doctorUserId);
        setActiveTab("availability");
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(
                `https://backend-mediconnect.onrender.com/api/doctors/${doctorUserId}/availability`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setAvailabilitySlots(res.data);
        } catch (err) {
            console.error("Failed to load availability:", err);
            setAvailabilitySlots([]);
        } finally {
            setAvailabilityLoading(false);
        }
    };

    const renderDoctorAvailability = () => (
        <div className="row g-3 g-md-4">
            <div className="col-12">
                <button
                    className="btn btn-outline-secondary mb-3"
                    onClick={() => setActiveTab("available")}
                >
                    ← Back to Doctor List
                </button>
                <h4>Available Slots</h4>
                {availabilityLoading ? (
                    <p className="text-muted">Loading slots...</p>
                ) : availabilitySlots.length === 0 ? (
                    <p className="text-muted">No available slots</p>
                ) : (
                    <div style={{
                        width: "95%",
                        backgroundColor: "#ffffff",
                        borderRadius: "16px",
                        boxShadow: "inset 0 4px 10px rgba(0,0,0,0.1)",
                        padding: "10px",
                        margin: "0 auto"
                    }}>
                        <FullCalendar
                            plugins={[timeGridPlugin, interactionPlugin]}
                            initialView="timeGridWeek"
                            headerToolbar={{
                                left: "prev,next today",
                                center: "title",
                                right: "timeGridDay,timeGridWeek",
                            }}
                            events={calendarEvents}
                            eventClick={handleEventClick}
                            height="550px"
                            timeZone="UTC"
                            slotLabelInterval="00:30:00"
                            slotDuration="00:30:00"
                            slotMinTime="08:00:00"
                            slotMaxTime="22:00:00"
                            allDaySlot={false}
                        />
                    </div>
                )}
            </div>
        </div>
    );

    // Fetch real appointments from API
    const fetchAppointments = async () => {
        try {
            setAppointmentsLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get('https://backend-mediconnect.onrender.com/api/patient/appointments', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAppointments(response.data.appointments || []);
        } catch (error) {
            console.error('Error fetching appointments:', error);
            setAppointments([]);
        } finally {
            setAppointmentsLoading(false);
        }
    };

    // Get upcoming appointments (today and future)
    const getUpcomingAppointments = () => {
        const today = new Date().toISOString().split('T')[0];
        return appointments.filter(apt => apt.date >= today).slice(0, 5);
    };

    // Get today's appointments
    const getTodayAppointments = () => {
        const today = new Date().toISOString().split('T')[0];
        return appointments.filter(apt => apt.date === today);
    };

    // Video consultation handlers
    const handleStartVideoConsultation = (appointment) => {
        setSelectedAppointmentForVideo({
            id: appointment._id,
            patient_name: appointment.patientName,
            doctor_name: appointment.doctorName,
            date: appointment.date,
            time: appointment.time,
            type: 'Video Consultation'
        });
        setShowVideoModal(true);
    };

    const handleCloseVideoModal = () => {
        setShowVideoModal(false);
        setSelectedAppointmentForVideo(null);
    };

    useEffect(() => {
        // Get patient's name from localStorage
        const name = localStorage.getItem("name");
        if (name) {
            setPatientName(name);
        }

        // Fetch patient profile, doctors, and appointments
        fetchPatientProfile();
        fetchAvailableDoctors();
        fetchAppointments();
    }, []);

    const fetchPatientProfile = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(
                "https://backend-mediconnect.onrender.com/api/patient/profile",
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setPatientProfile(response.data);
        } catch (error) {
            console.error("Error fetching patient profile:", error);
        }
    };

    const fetchAvailableDoctors = () => {
        axios
            .get("https://backend-mediconnect.onrender.com/api/doctors", {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            })
            .then((res) => setAvailableDoctors(res.data))
            .catch((err) => {
                console.error("Failed to fetch doctors:", err);
            });
    };

    const filteredDoctors = availableDoctor.filter((doctor) => {
        const specialization = (doctor.specialization || "").toLowerCase();
        const filter = specialtyFilter.toLowerCase();
        const matchesSpecialty = filter === "all" || specialization === filter;
        return matchesSpecialty;
    });

    const noDoctorsInSpecialization =
        specialtyFilter &&
        specialtyFilter.toLowerCase() !== "all" &&
        availableDoctor.filter(
            (doc) =>
                (doc.specialization || "").toLowerCase() ===
                specialtyFilter.toLowerCase()
        ).length === 0;

    // Dynamic patient data
    const patientData = {
        name: patientName,
        email:
            patientProfile?.email || localStorage.getItem("email") || "Not specified",
        phone: patientProfile?.contactNumber || "Not specified",
        dateOfBirth: patientProfile?.dateOfBirth || "Not specified",
        bloodType: patientProfile?.bloodGroup || "Not specified",
        emergencyContact: patientProfile?.emergencyContact || "Not specified",
    };

    const upcomingAppointments = getUpcomingAppointments();
    const todayAppointments = getTodayAppointments();

    // Handle image selection
    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log(
                "Selected image:",
                file.name,
                "Type:",
                file.type,
                "Size:",
                file.size
            );

            // Check image type
            const allowedTypes = [
                "image/png",
                "image/jpeg",
                "image/jpg",
                "image/gif",
            ];
            if (!allowedTypes.includes(file.type)) {
                alert(
                    `File type "${file.type}" not allowed. Only images (PNG, JPG, GIF) are allowed`
                );
                return;
            }

            // Check file size (16MB max)
            if (file.size > 16 * 1024 * 1024) {
                alert("Image size must be less than 16MB");
                return;
            }

            console.log("Image validation passed, setting selected image");
            setSelectedImage(file);
        }
    };

    // Handle message sending
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if ((!newMessage.trim() && !selectedImage) || !activeConversation) return;

        setUploading(true);
        try {
            let imageAttachment = null;

            // Upload image first if selected
            if (selectedImage) {
                console.log("Uploading image:", selectedImage.name, selectedImage.type);
                const uploadResult = await uploadImage(selectedImage);
                console.log("Upload result:", uploadResult);
                if (uploadResult) {
                    imageAttachment = uploadResult;
                }
            }

            const success = await sendMessage(
                activeConversation.conversation_id,
                newMessage,
                activeConversation.other_user_email,
                imageAttachment
            );

            if (success) {
                setNewMessage("");
                setSelectedImage(null);
                // Reset file input
                const imageInput = document.getElementById("image-input");
                if (imageInput) imageInput.value = "";
            }
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setUploading(false);
        }
    };

    const renderOverview = () => (
        <div className="row g-3 g-md-4">
            {/* Quick Stats */}
            <div className="col-12">
                <div className="row g-3">
                    <div className="col-6 col-lg-3">
                        <div
                            className="card stat-card text-white h-100"
                            style={{
                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                border: "none",
                                borderRadius: "15px",
                                boxShadow: "0 8px 25px rgba(102, 126, 234, 0.3)",
                                transform: "translateY(0)",
                                transition: "all 0.3s ease",
                            }}
                        >
                            <div className="card-body text-center p-3">
                                <div
                                    className="mb-3"
                                    style={{
                                        background: "rgba(255,255,255,0.2)",
                                        borderRadius: "50%",
                                        width: "60px",
                                        height: "60px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        margin: "0 auto",
                                    }}
                                >
                                    <i
                                        className="fas fa-calendar-check"
                                        style={{ fontSize: "1.5rem" }}
                                    ></i>
                                </div>
                                <h3 className="mb-1 fw-bold">{upcomingAppointments.length}</h3>
                                <p className="mb-0 small opacity-75">Upcoming Appointments</p>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-lg-3">
                        <div
                            className="card stat-card text-white h-100"
                            style={{
                                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                                border: "none",
                                borderRadius: "15px",
                                boxShadow: "0 8px 25px rgba(79, 172, 254, 0.3)",
                                transform: "translateY(0)",
                                transition: "all 0.3s ease",
                            }}
                        >
                            <div className="card-body text-center p-3">
                                <div
                                    className="mb-3"
                                    style={{
                                        background: "rgba(255,255,255,0.2)",
                                        borderRadius: "50%",
                                        width: "60px",
                                        height: "60px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        margin: "0 auto",
                                    }}
                                >
                                    <i
                                        className="fas fa-comments"
                                        style={{ fontSize: "1.5rem" }}
                                    ></i>
                                </div>
                                <h3 className="mb-1 fw-bold">{getUnreadCount()}</h3>
                                <p className="mb-0 small opacity-75">New Messages</p>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-lg-3">
                        <div
                            className="card stat-card text-white h-100"
                            style={{
                                background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                                border: "none",
                                borderRadius: "15px",
                                boxShadow: "0 8px 25px rgba(250, 112, 154, 0.3)",
                                transform: "translateY(0)",
                                transition: "all 0.3s ease",
                            }}
                        >
                            <div className="card-body text-center p-3">
                                <div
                                    className="mb-3"
                                    style={{
                                        background: "rgba(255,255,255,0.2)",
                                        borderRadius: "50%",
                                        width: "60px",
                                        height: "60px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        margin: "0 auto",
                                    }}
                                >
                                    <i
                                        className="fas fa-history"
                                        style={{ fontSize: "1.5rem" }}
                                    ></i>
                                </div>
                                <h3 className="mb-1 fw-bold">{appointments.filter(apt => apt.status === 'completed').length}</h3>
                                <p className="mb-0 small opacity-75">Past Consultations</p>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-lg-3">
                        <div
                            className="card stat-card text-white h-100"
                            style={{
                                background: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
                                border: "none",
                                borderRadius: "15px",
                                boxShadow: "0 8px 25px rgba(17, 153, 142, 0.3)",
                                transform: "translateY(0)",
                                transition: "all 0.3s ease",
                            }}
                        >
                            <div className="card-body text-center p-3">
                                <div
                                    className="mb-3"
                                    style={{
                                        background: "rgba(255,255,255,0.2)",
                                        borderRadius: "50%",
                                        width: "60px",
                                        height: "60px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        margin: "0 auto",
                                    }}
                                >
                                    <i
                                        className="fas fa-video"
                                        style={{ fontSize: "1.5rem" }}
                                    ></i>
                                </div>
                                <h3 className="mb-1 fw-bold">{todayAppointments.length}</h3>
                                <p className="mb-0 small opacity-75">Today's Appointments</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upcoming Appointments and Recent Messages */}
            <div className="col-12 col-xl-8">
                <div
                    className="card h-100"
                    style={{
                        border: "none",
                        borderRadius: "20px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                        background: "white",
                    }}
                >
                    <div
                        className="card-header d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2"
                        style={{
                            background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
                            borderRadius: "20px 20px 0 0",
                            border: "none",
                            padding: "1.5rem",
                        }}
                    >
                        <h5 className="mb-0 fw-bold text-dark">Upcoming Appointments</h5>
                        <button
                            className="btn text-white fw-semibold"
                            onClick={() => setActiveTab("available")}
                            style={{
                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                border: "none",
                                borderRadius: "12px",
                                padding: "8px 16px",
                            }}
                        >
                            <i className="fas fa-plus me-1"></i>Book New
                        </button>
                    </div>
                    <div className="card-body p-4">
                        {appointmentsLoading ? (
                            <div className="text-center py-4">
                                <div className="spinner-border text-primary" role="status"></div>
                                <p className="text-muted mt-2">Loading appointments...</p>
                            </div>
                        ) : upcomingAppointments.length === 0 ? (
                            <div className="text-center py-4">
                                <i className="fas fa-calendar-plus fa-3x text-muted mb-3"></i>
                                <p className="text-muted">No upcoming appointments</p>
                                <button className="btn btn-primary" onClick={() => setActiveTab("available")}>
                                    <i className="fas fa-plus me-2"></i>Book Your First Appointment
                                </button>
                            </div>
                        ) : (
                            <div className="row g-3">
                                {upcomingAppointments.map((appointment) => (
                                    <div key={appointment._id} className="col-12">
                                        <div
                                            className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center appointment-card p-3 border rounded gap-3"
                                            style={{
                                                borderRadius: "15px",
                                                border: "1px solid #e9ecef",
                                                background: "#fafbfc",
                                                transition: "all 0.3s ease",
                                            }}
                                        >
                                            <div className="d-flex align-items-center justify-content-center" style={{
                                                width: '60px',
                                                height: '60px',
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                borderRadius: '50%',
                                                color: 'white'
                                            }}>
                                                <i className="fas fa-user-md"></i>
                                            </div>
                                            <div className="flex-grow-1">
                                                <h6 className="mb-1 fw-bold">{appointment.doctorName}</h6>
                                                <p className="mb-1 text-muted small">
                                                    Video Consultation
                                                </p>
                                                <small className="text-muted">
                                                    <i className="fas fa-calendar me-1 text-primary"></i>
                                                    {appointment.date} at {appointment.time}
                                                </small>
                                            </div>
                                            <div className="d-flex flex-column align-items-center gap-2">
                        <span
                            className={`badge px-3 py-1 text-white`}
                            style={{
                                background:
                                    appointment.status === "confirmed"
                                        ? "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
                                        : appointment.status === "in-progress"
                                            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                            : "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                                borderRadius: "20px",
                            }}
                        >
                          {appointment.status}
                        </span>
                                                <div className="d-flex gap-1">
                                                    {(appointment.status === 'confirmed' || appointment.status === 'in-progress') && (
                                                        <button
                                                            className="btn btn-sm"
                                                            onClick={() => handleStartVideoConsultation(appointment)}
                                                            style={{
                                                                background:
                                                                    "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
                                                                border: "none",
                                                                borderRadius: "8px",
                                                                color: "white",
                                                                padding: "6px 12px",
                                                            }}
                                                            title="Join video consultation"
                                                        >
                                                            <i className="fas fa-video"></i>
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-outline-secondary btn-sm"
                                                        style={{
                                                            borderRadius: "8px",
                                                            padding: "6px 12px",
                                                        }}
                                                    >
                                                        <i className="fas fa-message"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="col-12 col-xl-4">
                <div
                    className="card h-100"
                    style={{
                        border: "none",
                        borderRadius: "20px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                        background: "white",
                    }}
                >
                    <div
                        className="card-header"
                        style={{
                            background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
                            borderRadius: "20px 20px 0 0",
                            border: "none",
                            padding: "1.5rem 1.5rem 1rem",
                        }}
                    >
                        <h5 className="mb-0 fw-bold text-dark">Recent Messages</h5>
                    </div>
                    <div className="card-body p-3">
                        {loading ? (
                            <div className="text-center py-3">
                                <div
                                    className="spinner-border spinner-border-sm text-primary"
                                    role="status"
                                ></div>
                                <p className="small text-muted mt-2">Loading messages...</p>
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="text-center py-3">
                                <p className="text-muted">No conversations yet</p>
                            </div>
                        ) : (
                            conversations.slice(0, 3).map((conversation) => (
                                <div
                                    key={conversation.id}
                                    className={`d-flex align-items-start message-item p-3 rounded mb-2`}
                                    style={{
                                        background:
                                            conversation.unread_count > 0
                                                ? "linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)"
                                                : "transparent",
                                        borderRadius: "12px",
                                        border:
                                            conversation.unread_count > 0
                                                ? "1px solid rgba(102, 126, 234, 0.1)"
                                                : "1px solid transparent",
                                        cursor: "pointer",
                                    }}
                                    onClick={() => {
                                        selectConversation(conversation);
                                        setActiveTab("messages");
                                    }}
                                >
                                    <div
                                        className="rounded-circle me-3 flex-shrink-0 d-flex align-items-center justify-content-center"
                                        style={{
                                            width: "40px",
                                            height: "40px",
                                            background:
                                                "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                            color: "white",
                                        }}
                                    >
                                        <i className="fas fa-user-md"></i>
                                    </div>
                                    <div
                                        className="flex-grow-1 min-w-0"
                                        style={{ width: "0", overflow: "hidden" }}
                                    >
                                        <h6 className="mb-1 fs-6 fw-semibold">
                                            {conversation.other_user_name}
                                        </h6>
                                        <p
                                            className="mb-1 small text-muted"
                                            style={{
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                width: "100%",
                                            }}
                                        >
                                            {conversation.last_message || "Start a conversation"}
                                        </p>
                                        <small className="text-muted">
                                            {messageService.formatTime(
                                                conversation.last_message_time
                                            )}
                                        </small>
                                    </div>
                                    {conversation.unread_count > 0 && (
                                        <span
                                            className="flex-shrink-0"
                                            style={{
                                                background:
                                                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                                width: "8px",
                                                height: "8px",
                                                borderRadius: "50%",
                                            }}
                                        ></span>
                                    )}
                                </div>
                            ))
                        )}
                        <button
                            className="btn btn-sm w-100 mt-3 fw-semibold"
                            onClick={() => setActiveTab("messages")}
                            style={{
                                background:
                                    "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
                                border: "1px solid rgba(102, 126, 234, 0.3)",
                                borderRadius: "10px",
                                color: "#667eea",
                            }}
                        >
                            View All Messages
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // Keep other render functions the same but update renderAvailableDoctors slightly
    const renderAvailableDoctors = () => (
        <div className="row g-3 g-md-4">
            <div className="col-12">
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 mb-4">
                    <h4 className="mb-0">Available Doctors</h4>
                    <div className="d-flex gap-2">
                        <select
                            className="form-select"
                            value={specialtyFilter}
                            onChange={(e) => setSpecialtyFilter(e.target.value)}
                            style={{ borderRadius: "10px", maxWidth: "150px" }}
                        >
                            <option value="all">All Specialties</option>
                            <option>Cardiology</option>
                            <option>Dermatology</option>
                            <option>Neurology</option>
                            <option>Orthopedics</option>
                            <option>Pediatrics</option>
                            <option>Psychiatry</option>
                            <option>General Medicine</option>
                            <option>Gynecology</option>
                            <option>Ophthalmology</option>
                            <option>ENT</option>
                        </select>
                    </div>
                </div>
            </div>

            {filteredDoctors.length > 0 ? (
                filteredDoctors.map((doctor) => (
                    <div key={doctor.userId} className="col-12 col-lg-6">
                        <div
                            className="card h-100"
                            style={{
                                border: "none",
                                borderRadius: "20px",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                                background: "white",
                                transition: "all 0.3s ease",
                            }}
                        >
                            <div className="card-body p-4">
                                <div className="d-flex align-items-start gap-3">
                                    <img
                                        src={doctor.profilePhoto || "/default-avatar.png"}
                                        alt={doctor.name}
                                        className="rounded-circle"
                                        style={{
                                            width: "80px",
                                            height: "80px",
                                            objectFit: "cover",
                                            boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                                        }}
                                    />
                                    <div className="flex-grow-1">
                                        <h5 className="mb-1 fw-bold">{doctor.name}</h5>
                                        <p className="text-muted mb-2">{doctor.specialization}</p>

                                        {doctor.rating ? (
                                            <div className="d-flex align-items-center mb-2">
                        <span className="text-warning me-1">
                          {"★".repeat(Math.floor(doctor.rating))}
                        </span>
                                                <span className="small text-muted">
                          {doctor.rating} • {doctor.experience}
                        </span>
                                            </div>
                                        ) : (
                                            <p className="small text-muted mb-2">
                                                {doctor.experience} years experience
                                            </p>
                                        )}

                                        <div className="d-flex gap-2">
                                            <button
                                                className="btn btn-outline-success btn-sm"
                                                onClick={() => fetchDoctorAvailability(doctor._id)}
                                            >
                                                <i className="fas fa-clock me-1"></i> View Availability
                                            </button>

                                            <button
                                                className="btn btn-outline-secondary btn-sm"
                                                style={{ borderRadius: "8px", padding: "8px 16px" }}
                                                onClick={() => handleShowProfile(doctor)}
                                            >
                                                <i className="fas fa-user me-1"></i> View Profile
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))
            ) : noDoctorsInSpecialization ? (
                <p className="text-center mt-4">
                    No doctors found with this specialization.
                </p>
            ) : (
                <p className="text-center mt-4">No matching doctors found.</p>
            )}
        </div>
    );

    // Keep your existing renderMessages and renderProfile functions...
    // (They can remain the same as they're already working properly)

    const renderMessages = () => (
        <div className="row g-3 g-md-4">
            <div className="col-12">
                <h4>Messages</h4>
                {error && (
                    <div
                        className="alert alert-danger alert-dismissible fade show"
                        role="alert"
                    >
                        {error}
                        <button
                            type="button"
                            className="btn-close"
                            onClick={() => clearError()}
                        ></button>
                    </div>
                )}
            </div>

            <div className="col-12 col-lg-4">
                <div
                    className="card h-100"
                    style={{
                        border: "none",
                        borderRadius: "20px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                    }}
                >
                    <div
                        className="card-header"
                        style={{
                            background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
                            borderRadius: "20px 20px 0 0",
                            border: "none",
                            padding: "1.5rem",
                        }}
                    >
                        <h5 className="mb-0 fw-bold text-dark">Conversations</h5>
                    </div>
                    <div className="card-body p-0">
                        {loading ? (
                            <div className="text-center py-4">
                                <div className="spinner-border" role="status"></div>
                                <p className="text-muted mt-2">Loading conversations...</p>
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="text-center py-4">
                                <i className="fas fa-comments fa-3x text-muted mb-3"></i>
                                <p className="text-muted">No conversations yet</p>
                                <small className="text-muted">
                                    Messages with doctors will appear here
                                </small>
                            </div>
                        ) : (
                            conversations.map((conversation) => (
                                <div
                                    key={conversation.id}
                                    className={`d-flex align-items-center p-3 border-bottom ${
                                        activeConversation?.id === conversation.id
                                            ? "bg-primary-subtle"
                                            : ""
                                    }`}
                                    style={{
                                        cursor: "pointer",
                                        background:
                                            conversation.unread_count > 0 &&
                                            activeConversation?.id !== conversation.id
                                                ? "linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)"
                                                : undefined,
                                    }}
                                    onClick={() => selectConversation(conversation)}
                                >
                                    <div
                                        className="rounded-circle me-3 flex-shrink-0 d-flex align-items-center justify-content-center"
                                        style={{
                                            width: "50px",
                                            height: "50px",
                                            background:
                                                "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                            color: "white",
                                        }}
                                    >
                                        <i className="fas fa-user-md"></i>
                                    </div>
                                    <div
                                        className="flex-grow-1 min-w-0"
                                        style={{ width: "0", overflow: "hidden" }}
                                    >
                                        <h6 className="mb-1 fw-semibold">
                                            {conversation.other_user_name}
                                        </h6>
                                        <p
                                            className="mb-0 small text-muted"
                                            style={{
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                width: "100%",
                                            }}
                                        >
                                            {conversation.last_message || "Start a conversation"}
                                        </p>
                                        <small className="text-muted">
                                            {messageService.formatTime(
                                                conversation.last_message_time
                                            )}
                                        </small>
                                    </div>
                                    {conversation.unread_count > 0 && (
                                        <span className="badge bg-primary rounded-pill">
                      {conversation.unread_count}
                    </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="col-12 col-lg-8">
                <div
                    className="card h-100"
                    style={{
                        border: "none",
                        borderRadius: "20px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                    }}
                >
                    {activeConversation ? (
                        <>
                            <div
                                className="card-header d-flex align-items-center"
                                style={{
                                    background:
                                        "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
                                    borderRadius: "20px 20px 0 0",
                                    border: "none",
                                    padding: "1.5rem",
                                }}
                            >
                                <div
                                    className="rounded-circle me-3 flex-shrink-0 d-flex align-items-center justify-content-center"
                                    style={{
                                        width: "40px",
                                        height: "40px",
                                        background:
                                            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                        color: "white",
                                    }}
                                >
                                    <i className="fas fa-user-md"></i>
                                </div>
                                <div>
                                    <h6 className="mb-0 fw-bold text-dark">
                                        {activeConversation.other_user_name}
                                    </h6>
                                    <small className="text-success">
                                        {activeConversation.other_user_role}
                                    </small>
                                </div>
                            </div>
                            <div
                                className="card-body"
                                style={{ height: "400px", overflowY: "auto" }}
                            >
                                {loading ? (
                                    <div className="text-center py-4">
                                        <div className="spinner-border" role="status"></div>
                                        <p className="text-muted mt-2">Loading messages...</p>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center py-4">
                                        <i className="fas fa-comment fa-3x text-muted mb-3"></i>
                                        <p className="text-muted">No messages yet</p>
                                        <small className="text-muted">
                                            Start the conversation by sending a message
                                        </small>
                                    </div>
                                ) : (
                                    messages.map((message) => {
                                        const isCurrentUser =
                                            message.sender_email ===
                                            localStorage.getItem("userEmail") ||
                                            message.sender_role === "patient";
                                        return (
                                            <div
                                                key={message.id}
                                                className={`d-flex mb-3 ${
                                                    isCurrentUser ? "justify-content-end" : ""
                                                }`}
                                            >
                                                {!isCurrentUser && (
                                                    <div
                                                        className="rounded-circle me-2 flex-shrink-0 d-flex align-items-center justify-content-center"
                                                        style={{
                                                            width: "30px",
                                                            height: "30px",
                                                            background:
                                                                "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                                            color: "white",
                                                            fontSize: "0.8rem",
                                                        }}
                                                    >
                                                        <i className="fas fa-user-md"></i>
                                                    </div>
                                                )}
                                                <div
                                                    className={`p-2 rounded ${
                                                        isCurrentUser ? "text-white" : "bg-light"
                                                    }`}
                                                    style={{
                                                        background: isCurrentUser
                                                            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                                            : undefined,
                                                        maxWidth: "70%",
                                                    }}
                                                >
                                                    {/* Text message */}
                                                    {message.message && (
                                                        <p className="mb-1 small">
                                                            {typeof message.message === "string"
                                                                ? message.message
                                                                : "[Invalid Message]"}
                                                        </p>
                                                    )}

                                                    {/* Image attachment */}
                                                    {message.image_attachment && (
                                                        <div className="mb-1">
                                                            <img
                                                                src={`http://localhost:5000/api/files/${message.image_attachment.file_id}`}
                                                                alt={message.image_attachment.original_name}
                                                                style={{
                                                                    maxWidth: "200px",
                                                                    maxHeight: "200px",
                                                                    borderRadius: "8px",
                                                                    cursor: "pointer",
                                                                }}
                                                                onClick={() =>
                                                                    window.open(
                                                                        `http://localhost:5000/api/files/${message.image_attachment.file_id}`,
                                                                        "_blank"
                                                                    )
                                                                }
                                                            />
                                                            <br />
                                                            <small
                                                                className={
                                                                    isCurrentUser ? "text-white-50" : "text-muted"
                                                                }
                                                            >
                                                                {message.image_attachment.original_name}
                                                            </small>
                                                        </div>
                                                    )}

                                                    <small
                                                        className={
                                                            isCurrentUser ? "text-white-50" : "text-muted"
                                                        }
                                                    >
                                                        {messageService.formatMessageTime(
                                                            message.timestamp
                                                        )}
                                                    </small>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div
                                className="card-footer"
                                style={{ background: "white", borderRadius: "0 0 20px 20px" }}
                            >
                                <form onSubmit={handleSendMessage}>
                                    {selectedImage && (
                                        <div className="mb-2 p-2 bg-light rounded">
                                            <small className="text-muted">
                                                🖼️ {selectedImage.name} (
                                                {(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-link text-danger p-0 ms-2"
                                                    onClick={() => {
                                                        setSelectedImage(null);
                                                        document.getElementById("image-input").value = "";
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            </small>
                                        </div>
                                    )}
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Type your message..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            style={{ borderRadius: "10px 0 0 0" }}
                                        />
                                        <input
                                            type="file"
                                            id="image-input"
                                            accept=".png,.jpg,.jpeg,.gif"
                                            onChange={handleImageSelect}
                                            style={{ display: "none" }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={() =>
                                                document.getElementById("image-input").click()
                                            }
                                            title="Attach image"
                                            style={{ borderRadius: "0" }}
                                        >
                                            🖼️
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn text-white"
                                            disabled={
                                                (!newMessage.trim() && !selectedImage) ||
                                                loading ||
                                                uploading
                                            }
                                            style={{
                                                background:
                                                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                                border: "none",
                                                borderRadius: "0 10px 10px 0",
                                            }}
                                        >
                                            {uploading ? (
                                                <span
                                                    className="spinner-border spinner-border-sm"
                                                    role="status"
                                                ></span>
                                            ) : (
                                                <i className="fas fa-paper-plane"></i>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div
                            className="card-body d-flex align-items-center justify-content-center"
                            style={{ height: "500px" }}
                        >
                            <div className="text-center">
                                <i className="fas fa-comments fa-4x text-muted mb-3"></i>
                                <h5 className="text-muted">Select a conversation</h5>
                                <p className="text-muted">
                                    Choose a conversation from the left to start messaging
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderProfile = () => (
        <div className="row g-3 g-md-4">
            <div className="col-12">
                <div className="d-flex justify-content-between align-items-center">
                    <h4>My Profile</h4>
                </div>
            </div>
            <div className="col-12">
                <PatientProfile />
            </div>
        </div>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case "available":
                return renderAvailableDoctors();
            case "availability":
                return renderDoctorAvailability();
            case "overview":
                return renderOverview();
            case "messages":
                return renderMessages();
            case "profile":
                return renderProfile();
            default:
                return renderOverview();
        }
    };

    return (
        <div
            className="min-vh-100"
            style={{
                background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                minHeight: "100vh",
            }}
        >
            {/* Dashboard Header */}
            <header
                className="sticky-top"
                style={{
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                }}
            >
                <div className="container-fluid px-3 px-md-4">
                    <div className="row align-items-center py-4">
                        <div className="col-12 col-lg-8 mb-3 mb-lg-0">
                            <div className="d-flex align-items-center">
                                <div className="me-3">
                                    <div
                                        className="bg-white rounded-circle p-2"
                                        style={{ width: "50px", height: "50px" }}
                                    >
                                        {patientProfile?.profilePhoto ? (
                                            <img
                                                alt="Profile"
                                                className="rounded-circle"
                                                src={`http://localhost:5000/api/files/${patientProfile.profilePhoto}`}
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    objectFit: "cover",
                                                }}
                                            />
                                        ) : (
                                            <i
                                                className="fas fa-user text-primary"
                                                style={{ fontSize: "1.5rem" }}
                                            ></i>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h1 className="h3 mb-1 fw-bold text-white">
                                        Welcome back, {patientData.name}!
                                    </h1>
                                    <p className="text-white-50 mb-0 small">
                                        Manage your healthcare appointments and records
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-lg-4">
                            <div className="d-flex flex-column flex-sm-row gap-2 justify-content-lg-end">
                                <button
                                    className="btn text-white flex-fill flex-sm-grow-0"
                                    onClick={() => setActiveTab("available")}
                                    style={{
                                        background: "rgba(255,255,255,0.2)",
                                        border: "1px solid rgba(255,255,255,0.3)",
                                        backdropFilter: "blur(10px)",
                                        borderRadius: "10px",
                                    }}
                                >
                                    <i className="fas fa-plus me-2"></i>
                                    <span className="d-none d-sm-inline">Book </span>Appointment
                                </button>
                                <button
                                    className="btn text-white flex-fill flex-sm-grow-0"
                                    onClick={() => {
                                        // Find next upcoming appointment
                                        const nextAppointment = upcomingAppointments.find(apt =>
                                            apt.status === 'confirmed' || apt.status === 'in-progress'
                                        );
                                        if (nextAppointment) {
                                            handleStartVideoConsultation(nextAppointment);
                                        } else {
                                            alert("No upcoming appointments to join");
                                        }
                                    }}
                                    style={{
                                        background: "rgba(255,255,255,0.15)",
                                        border: "1px solid rgba(255,255,255,0.3)",
                                        backdropFilter: "blur(10px)",
                                        borderRadius: "10px",
                                    }}
                                >
                                    <i className="fas fa-video me-2"></i>
                                    <span className="d-none d-sm-inline">Join </span>Call
                                </button>
                                <LogOut />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Dashboard Navigation */}
            <nav
                className="bg-white"
                style={{
                    borderBottom: "1px solid #e9ecef",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                }}
            >
                <div className="container-fluid px-3 px-md-4">
                    <div
                        className="nav nav-pills d-flex overflow-auto py-3"
                        style={{ minHeight: "4rem" }}
                    >
                        {[
                            {
                                id: "overview",
                                icon: "fa-tachometer-alt",
                                label: "Overview",
                                color: "#f093fb",
                            },
                            {
                                id: "available",
                                icon: "fa-user-md",
                                label: "Available Doctors",
                                color: "#667eea",
                            },
                            {
                                id: "messages",
                                icon: "fa-comments",
                                label: "Messages",
                                badge: getUnreadCount(),
                                color: "#fa709a",
                            },
                            {
                                id: "profile",
                                icon: "fa-user",
                                label: "Profile",
                                color: "#a8edea",
                            },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                className={`nav-link d-flex align-items-center text-nowrap me-3 position-relative ${
                                    activeTab === tab.id ? "" : "text-muted"
                                }`}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    background:
                                        activeTab === tab.id
                                            ? `linear-gradient(135deg, ${tab.color}, ${tab.color}dd)`
                                            : "transparent",
                                    color: activeTab === tab.id ? "white" : "#6c757d",
                                    border: "none",
                                    borderRadius: "12px",
                                    padding: "12px 20px",
                                    fontWeight: activeTab === tab.id ? "600" : "500",
                                    transition: "all 0.3s ease",
                                    transform: activeTab === tab.id ? "translateY(-2px)" : "none",
                                    boxShadow:
                                        activeTab === tab.id
                                            ? "0 4px 15px rgba(0,0,0,0.2)"
                                            : "none",
                                }}
                                onMouseEnter={(e) => {
                                    if (activeTab !== tab.id) {
                                        e.target.style.background = `linear-gradient(135deg, ${tab.color}20, ${tab.color}10)`;
                                        e.target.style.transform = "translateY(-1px)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (activeTab !== tab.id) {
                                        e.target.style.background = "transparent";
                                        e.target.style.transform = "none";
                                    }
                                }}
                            >
                                <i
                                    className={`fas ${tab.icon} me-2`}
                                    style={{ fontSize: "1.1rem" }}
                                ></i>
                                <span className="d-none d-md-inline">{tab.label}</span>
                                <span className="d-md-none">{tab.label.split(" ")[0]}</span>
                                {tab.badge && tab.badge > 0 ? (
                                    <span
                                        className="position-absolute badge rounded-pill text-white"
                                        style={{
                                            background: "linear-gradient(135deg, #ff6b6b, #ee5a52)",
                                            fontSize: "0.75rem",
                                            padding: "4px 8px",
                                            top: "4px",
                                            right: "4px",
                                            minWidth: "18px",
                                            height: "18px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontWeight: "bold",
                                            border: "2px solid white",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                                            zIndex: 10,
                                        }}
                                    >
                    {tab.badge}
                  </span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="container-fluid px-3 px-md-4 py-4">
                {renderTabContent()}
            </main>

            {/* Doctor Profile Modal */}
            {selectedDoctor && (
                <Modal show={showProfileModal} onHide={handleCloseProfile} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>Dr. {selectedDoctor.name}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <p>
                            <strong>Specialization:</strong> {selectedDoctor.specialization}
                        </p>
                        <p>
                            <strong>Email:</strong> {selectedDoctor.email || "N/A"}
                        </p>
                        <p>
                            <strong>Experience:</strong> {selectedDoctor.experience || "N/A"}{" "}
                            years
                        </p>
                        <p>
                            <strong>Qualification:</strong>{" "}
                            {selectedDoctor.qualification || "N/A"}
                        </p>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseProfile}>
                            Close
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}

            {/* Video Consultation Modal */}
            {showVideoModal && (
                <VideoConsultationModal
                    isOpen={showVideoModal}
                    onClose={handleCloseVideoModal}
                    appointmentId={selectedAppointmentForVideo?.id}
                    appointmentData={selectedAppointmentForVideo}
                />
            )}
        </div>
    );
};

export default PatientDashboard;