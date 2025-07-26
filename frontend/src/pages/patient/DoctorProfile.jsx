import { useParams, useNavigate } from 'react-router-dom';

const dummyDoctors = {
  doc001: {
    name: 'Dr. Arjun Patel',
    specialty: 'Cardiologist',
    experience: '12 years',
    bio: 'Specialized in managing chronic conditions and providing virtual consultations.',
    email: 'arjun.patel@mediconnect.com',
    image: '/assets/doctors/arjun.jpg'
  },
  doc002: {
    name: 'Dr. Riya Sharma',
    specialty: 'Dermatologist',
    experience: '8 years',
    bio: 'Expert in skin care and remote treatment of common skin disorders.',
    email: 'riya.sharma@mediconnect.com',
    image: '/assets/doctors/riya.jpg'
  }
};

export default function DoctorProfile() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const doctor = dummyDoctors[doctorId];

  if (!doctor) return <p className="text-center mt-5">Doctor not found.</p>;

  return (
    <section className="py-5" style={{ background: 'linear-gradient(300deg, #2c5aa0, #fecfef)', color: 'white' }}>
      <div className="container">
        <div className="row align-items-center">
          <div className="col-md-4 text-center">
            <img src={doctor.image} alt={doctor.name} className="img-fluid rounded-circle mb-3 shadow" style={{ width: '200px' }} />
          </div>
          <div className="col-md-8">
            <h2 className="fw-bold">{doctor.name}</h2>
            <p className="mb-1">{doctor.specialty}</p>
            <p className="mb-1">Experience: {doctor.experience}</p>
            <p className="mb-1">Email: {doctor.email}</p>
            <p className="mb-3">{doctor.bio}</p>
            <button
              className="btn btn-light rounded-pill px-5"
              onClick={() => navigate(`/book-appointment/${doctorId}`)}
            >
              Book Appointment
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
