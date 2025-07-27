import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import axios from "axios";
import Modal from "react-modal";
import "../../assets/css/styles.css";

const DoctorSchedule = (props) => {
  const { doctorId: propDoctorId, settings } = props;
  const params = useParams();
  const doctorId = props.doctorId || params.doctorId;
  const jwtToken = localStorage.getItem("token");
  const [events, setEvents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [slotData, setSlotData] = useState({
    startTime: "",
    endTime: "",
    type: "available",
    reason: "",
  });

  useEffect(() => {
    Modal.setAppElement("#root");
    fetchSchedule();
  }, [doctorId]);

  const fetchSchedule = async () => {
    try {
      const res = await axios.get(
        `https://backend-mediconnect.onrender.com/doctor/schedule?doctorId=${doctorId}`
      );
      const mappedEvents = res.data.map((slot) => ({
        id: slot._id,
        title:
          slot.type === "available"
            ? "Available"
            : `Busy: ${slot.reason || "Unavailable"}`,
        start: new Date(slot.startTime),
        end: new Date(slot.endTime),
        backgroundColor: slot.type === "available" ? "#38A169" : "#E53E3E",
        borderRadius: "8px",
        borderColor: "#ccc",
        textColor: "#ffffff",
      }));
      setEvents(mappedEvents);
    } catch (err) {
      console.error("Error fetching schedule", err);
    }
  };

  const resetSlotData = () => {
    setSlotData({
      startTime: "",
      endTime: "",
      type: "available",
      reason: "",
    });
  };

  const formatToLocalDateTime = (isoString) => {
    const local = new Date(isoString);
    const offset = local.getTimezoneOffset();
    local.setMinutes(local.getMinutes() - offset);
    return local.toISOString().slice(0, 16);
  };

  const handleSlotSelect = (info) => {
    const dayOfWeek = new Date(info.startStr).toLocaleDateString("en-US", {
      weekday: "long",
    });

    if (!settings.workingDays.includes(dayOfWeek)) {
      alert(`You can't add slots on ${dayOfWeek}`);
      return;
    }

    const start = formatToLocalDateTime(info.startStr);
    const end = formatToLocalDateTime(info.endStr);

    setSlotData({
      startTime: start,
      endTime: end,
      type: "available",
      reason: "",
    });

    setIsModalOpen(true);
  };

  const handleAddSlotClick = () => {
    resetSlotData();
    setIsModalOpen(true);
  };

// In DoctorSchedule.jsx, update the handleAddSlot function:

  const handleAddSlot = async () => {
    try {
      // Make sure we're using the correct doctor ID
      const currentDoctorId = localStorage.getItem("doctorId");

      console.log('🔍 Creating slot for doctorId:', currentDoctorId);
      console.log('📅 Slot data:', slotData);

      const endpoint =
          slotData.type === "available"
              ? "https://backend-mediconnect.onrender.com/doctor/availability"
              : "https://backend-mediconnect.onrender.com/doctor/busy";

      const payload = {
        doctorId: currentDoctorId, // Use the stored doctor ID
        startTime: slotData.startTime,
        endTime: slotData.endTime,
        reason: slotData.reason, // for busy, optional for available
      };

      console.log('📤 Sending payload:', payload);

      const response = await axios.post(endpoint, payload);

      console.log('✅ Slot created successfully:', response.data);

      setIsModalOpen(false);
      resetSlotData();
      fetchSchedule(); // reload calendar slots without full reload
    } catch (err) {
      console.error("❌ Failed to add slot", err);
      console.error("Error details:", err.response?.data);
      alert(`Failed to add slot: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleEventClick = async (info) => {
    const { id, extendedProps, title } = info.event;
    const isBusy = title.toLowerCase().includes("busy");

    if (
      window.confirm(
        `Do you want to delete this ${isBusy ? "busy" : "available"} slot?`
      )
    ) {
      try {
        const endpoint = isBusy
          ? `https://backend-mediconnect.onrender.com/doctor/busy/${id}`
          : `https://backend-mediconnect.onrender.com/doctor/availability/${id}`;

        await axios.delete(endpoint);
        fetchSchedule(); // re-fetch the schedule without reloading the page
      } catch (err) {
        console.error("Failed to delete slot", err);
      }
    }
  };

  return (
    <div className="p-4">
      <div
        style={{
          height: "500px",
          overflowY: "hidden",
          display: "flex",
          justifyContent: "center",
          paddingBottom: "30px"
        }}
      >
        <div
          style={{
            width: "100%",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow: "inset 0 4px 10px rgba(0,0,0,0.1)",
            padding: "20px",
          }}
        >
          <FullCalendar
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            events={events}
            height="100%"
            slotMinTime={settings?.workingHours?.start || "07:00:00"}
            slotMaxTime={settings?.workingHours?.end || "21:00:00"}
            allDaySlot={false}
            selectable={true}
            eventOverlap={false}
            timeZone="local"
            select={handleSlotSelect}
            eventClick={handleEventClick}
            dayCellDidMount={(arg) => {
            const weekday = new Date(arg.date).toLocaleDateString("en-US", {
              weekday: "long",
            });
              if (!settings.workingDays.includes(weekday)) {
                arg.el.style.backgroundColor = "#dededeff"; // light gray
                arg.el.style.opacity = "0.6"; // optional dim effect
              }
            }}
            slotDuration={`00:${settings.consultationDuration}:00`}
            slotLabelInterval={`00:${settings.consultationDuration}:00`} 
          />
        </div>
      </div>

      <div>
        <button className="add-slot-btn" onClick={handleAddSlotClick}>
          + Add Slot
        </button>

        <button
          className="google-sync-btn"
          onClick={() => {
            const token = localStorage.getItem("token");
            const doctorId = localStorage.getItem("doctorId");

            if (!token || !doctorId) {
              alert("Please login again — token or doctorId missing.");
              return;
            }

            // Decode token to verify doctor ID
            try {
              const decoded = JSON.parse(atob(token.split(".")[1]));
              if (decoded.doctorId !== doctorId) {
                alert("Doctor ID mismatch in token! Please logout and login again.");
                return;
              }
            } catch (err) {
              alert("Invalid token. Please login again.");
              return;
            }

            // Check if already connected to Google
            try {
              const doctor = JSON.parse(localStorage.getItem("doctor"));
              if (doctor?.googleToken?.token) {
                alert("Already connected to Google Calendar.");
                return;
              }
            } catch (err) {
              // no-op — proceed to login
            }

            // Redirect to Google login
            window.location.href = `http://localhost:5000/google/login?token=${token}`;
          }}
        >
          Connect Google Calendar
        </button>

        <button
          className="google-sync-btn"
          onClick={async () => {
            try {
              const res = await fetch(
                "http://localhost:5000/google/sync-busy",
                {
                  headers: {
                    Authorization: `Bearer ${jwtToken}`, // Make sure it's fresh
                  },
                }
              );
              const data = await res.json();
              alert(data.message || "Sync complete");
              fetchSchedule(); // reload calendar
            } catch (err) {
              console.error("Google sync failed", err);
              alert("Google Calendar sync failed.");
            }
          }}
        >
          Sync Busy Slots
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => {
          resetSlotData();
          setIsModalOpen(false);
        }}
        overlayClassName="modal-overlay"
        className="modal-content"
      >
        <h3>Add Availability Slot</h3>
        <form>
          <label>Start Time:</label>
          <input
            type="datetime-local"
            name="startTime"
            value={slotData.startTime}
            onChange={(e) =>
              setSlotData({ ...slotData, startTime: e.target.value })
            }
          />

          <label>End Time:</label>
          <input
            type="datetime-local"
            name="endTime"
            value={slotData.endTime}
            onChange={(e) =>
              setSlotData({ ...slotData, endTime: e.target.value })
            }
          />

          <label>Type:</label>
          <select
            name="type"
            value={slotData.type}
            onChange={(e) => setSlotData({ ...slotData, type: e.target.value })}
          >
            <option value="available">Available</option>
            <option value="busy">Busy</option>
          </select>

          {slotData.type === "busy" && (
            <>
              <label>Reason:</label>
              <input
                type="text"
                name="reason"
                value={slotData.reason}
                onChange={(e) =>
                  setSlotData({ ...slotData, reason: e.target.value })
                }
              />
            </>
          )}

          <div className="modal-buttons">
            <button
              type="button"
              onClick={() => {
                resetSlotData();
                setIsModalOpen(false);
              }}
              className="modal-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddSlot}
              className="modal-save"
            >
              Save Slot
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DoctorSchedule;
