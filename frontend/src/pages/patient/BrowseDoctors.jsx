import { useNavigate } from 'react-router-dom';

const doctors = [
  {
    id: 'doc001',
    name: 'Dr. Arjun Patel',
    specialty: 'Cardiologist',
    experience: '12 years',
    image: '/assets/doctors/arjun.jpg'
  },
  {
    id: 'doc002',
    name: 'Dr. Riya Sharma',
    specialty: 'Dermatologist',
    experience: '8 years',
    image: '/assets/doctors/riya.jpg'
  }
];

export default function BrowseDoctors() {
  const navigate = useNavigate();

  return (
    <section className="pt-5" style={{ backgroundColor: '#e3f2fd', paddingBottom: '6.5rem' }}>
      <div className="container">
        <h2 className="display-5 fw-bold mb-4 text-center">Browse Available Doctors</h2>
        <div className="row g-4">
          {doctors.map(doctor => (
            <div key={doctor.id} className="col-md-6 col-lg-4">
              <div className="card h-100 text-center shadow border-0 rounded-4 p-3">
                <img src={doctor.image} alt={doctor.name} className="img-fluid rounded-circle mx-auto mb-3" style={{ width: '120px' }} />
                <h4 className="fw-bold">{doctor.name}</h4>
                <p className="text-muted">{doctor.specialty}</p>
                <p className="small">Experience: {doctor.experience}</p>
                <button
                  className="btn btn-outline-primary rounded-pill mt-auto"
                  onClick={() => navigate(`/doctor/${doctor.id}`)}
                >
                  View Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
