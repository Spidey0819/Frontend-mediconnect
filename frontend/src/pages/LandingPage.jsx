import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import background from '../components/Images/frontpage.jpeg'


const Upperpage = () => {
  return (
    <section id="home" className="position-relative overflow-hidden">
      {/* <div className="position-absolute top-0 start-0 w-100 h-100" style={{
        backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000'><defs><pattern id='grid' width='50' height='50' patternUnits='userSpaceOnUse'><path d='M 50 0 L 0 0 0 50' fill='none' stroke='rgba(255,255,255,0.1)' stroke-width='1'/></pattern></defs><rect width='100%' height='100%' fill='url(%23grid)'/></svg>")`,
        opacity: 0.3
      }}></div> */}
      
      <div className="container position-relative">
        <div className="row align-items-center">
          <div className="col-lg-6">
            <h1 className="display-3 fw-bold mb-4 hero-title">MediConnect - that fits your lifestyle</h1>
            <p className="mb-4 hero-p">
              Connect with healthcare professionals instantly. Save time, and access quality medical care from anywhere .
            </p>
            <div className="d-flex flex-wrap gap-3">
              <button className="btn btn-outline-light btn-lg book-btn">
                Book an Appointment
              </button>
              
            </div>
          </div>
         
        </div>
      </div>
    </section>
  );
};

const Features = () => {
  const features = [
    {
      icon: 'fas fa-clock',
      title: 'Save Time',
      description: 'Eliminate travel time and waiting queues, and connect with your doctors instantly.'
    },
    {
      icon: 'fas fa-shield-alt',
      title: 'Secure & Private',
      description: 'Get the secure, and private connection, as we ensure your medical information remains confidential.'
    },
    {
      icon: 'fas fa-users',
      title: 'Easy Workflow',
      description: 'Streamlined interface designed for both doctors and patients, making virtual consultations effortless.'
    },
    {
      icon: 'fas fa-mobile-alt',
      title: 'Multi-Platform',
      description: 'Access us from any device - desktop, tablet, or smartphone.'
    },
    {
      icon: 'fas fa-calendar-check',
      title: 'Smart Scheduling',
      description: 'Intelligent appointment system that syncs with calendars and sends automated reminders.'
    },
    {
      icon: 'fas fa-chart-line',
      title: 'Analytics Dashboard',
      description: 'Comprehensive insights for healthcare providers to track patient engagement and optimize care delivery.'
    }
  ];

  return (
    <section id="features" className="py-5" style={{ backgroundColor: '#e3f2fd' }}>
      <div className="container">
        <div className="row mb-5">
          <div className="col-lg-8 mx-auto text-center">
            <h2 className="display-5 fw-bold mb-2">Why Choose Mediconnect?</h2>
          </div>
        </div>
        
        <div className="row g-4">
          {features.map((feature, index) => (
            <div key={index} className="col-lg-4 col-md-6">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 text-center">
                <div 
                  className="rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center"
                  style={{
                    width: '80px',
                    height: '80px',
                    background: '#3B82F6',
                    color: 'white'
                  }}
                >
                  <i className={`${feature.icon} fs-2`}></i>
                </div>
                <h4 className="fw-bold mb-3">{feature.title}</h4>
                <p className="text-muted">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Steps = () => {
  const steps = [
    {
      number: 1,
      title: 'Create Account',
      description: 'Sign up yourself with us, and complete your profile with necessary information.'
    },
    {
      number: 2,
      title: 'Schedule Meeting',
      description: 'Book an appointment according to your availability with our scheduling system.'
    },
    {
      number: 3,
      title: 'Join Virtual Call',
      description: 'Connect by using our secure video platform at the scheduled time from any device.'
    },
    {
      number: 4,
      title: 'Follow Up',
      description: 'Get the easy access to the consultation notes, prescriptions, and schedule follow-up appointments.'
    }
  ];

  return (
    <section id="how-it-works" className="py-5 bg-white">
      <div className="container">
        <div className="row mb-5">
          <div className="col-lg-8 mx-auto text-center">
            <h2 className="display-5 fw-bold mb-4">How MediConnect Works?</h2>
            <p className="lead">Connect with the healtcare, just in 4 steps</p>
          </div>
        </div>
        
        <div className="row g-4">
          {steps.map((step, index) => (
            <div key={index} className="col-lg-3 col-md-6">
              <div className="text-center p-3">
                <div 
                  className="rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center fw-bold fs-4"
                  style={{
                    width: '60px',
                    height: '60px',
                    background: '#3B82F6',
                    color: 'white'
                  }}
                >
                  {step.number}
                </div>
                <h5 className="fw-bold mb-3">{step.title}</h5>
                <p className="text-muted">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Bottompage = () => {
  return (
    <section id="signup" className="py-5" style={{
        background: '#3B82F6',
      
      color: 'white'
    }}>
      <div className="container">
        <div className="row">
          <div className="col-lg-8 mx-auto text-center">
            <h2 className="display-5 fw-bold mb-4">Ready to Transform Your Healthcare Experience?</h2>
            <p className="lead mb-4">Join the Mediconnect to meet, and choose over thousands of healthcare providers for the virtual care needs.</p>
            <div className="d-flex flex-wrap justify-content-center gap-3">
              <button className="btn btn-outline-light btn-lg px-5 rounded-pill fw-semibold">Start Free Trial</button>
              <button className="btn btn-outline-light btn-lg px-5 rounded-pill fw-semibold">Request Demo</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const App = () => {
  return (
    <div className="App">
      <Navbar />
      <Upperpage />
      <Features />
      <Steps />
      <Bottompage />
      <Footer />
    </div>
  );
};

export default App;