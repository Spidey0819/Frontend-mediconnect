import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

const DoctorAvailabilityPage = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `http://localhost:5000/api/doctors/${doctorId}/availability`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setAvailability(res.data);
      } catch (error) {
        console.error("Failed to fetch availability:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [doctorId]);

  // Transform slots to FullCalendar format
  const calendarEvents = availability.map((slot, idx) => ({
    id: `slot-${idx}`,
    title: "Available",
    start: new Date(slot.startTime),
    end: new Date(slot.endTime),
    allDay: false,
  }));

  const handleEventClick = ({ event }) => {
    const start = event.start.toISOString();
    const end = event.end.toISOString();
    navigate(`/book-appointment/${doctorId}?start=${start}&end=${end}`);
  };

  return (
    <div className="container py-4">
      <h2>Doctor Availability</h2>
      {loading ? (
        <p>Loading...</p>
      ) : availability.length === 0 ? (
        <p>No available slots</p>
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
  );
};

export default DoctorAvailabilityPage;
