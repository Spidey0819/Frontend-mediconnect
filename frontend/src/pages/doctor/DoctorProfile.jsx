import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const DoctorProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [userInfo, setUserInfo] = useState({ firstName: '', lastName: '', email: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    clinicName: '',
    specialization: '',
    experience: '',
    qualification: '',
    consultationFee: '',
    contactNumber: '',
    address: '',
    medicalLicense: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchUserInfo();
  }, []);

  const fetchUserInfo = () => {
    const token = localStorage.getItem('token');
    const name = localStorage.getItem('name');
    const email = localStorage.getItem('email');
    
    if (token && name && email) {
      const nameParts = name.split(' ');
      setUserInfo({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: email
      });
    } else if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserInfo({ firstName: '', lastName: '', email: payload.email || '' });
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    }
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('https://backend-mediconnect.onrender.com/api/doctor/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
      setFormData({
        clinicName: response.data.clinicName || '',
        specialization: response.data.specialization || '',
        experience: response.data.experience || '',
        qualification: response.data.qualification || '',
        consultationFee: response.data.consultationFee || '',
        contactNumber: response.data.contactNumber || '',
        address: response.data.address || '',
        medicalLicense: response.data.medicalLicense || ''
      });
      if (response.data.profilePhoto) {
        setPhotoPreview(`https://backend-mediconnect.onrender.com/api/files/${response.data.profilePhoto}`);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setIsEditing(true);
      } else {
        console.error('Error fetching profile:', error);
      }
    }
  };

  const formatPhoneNumber = (value) => {
    // Remove all non-numeric characters
    const cleaned = value.replace(/\D/g, '');
    
    // Limit to 10 digits
    const limited = cleaned.slice(0, 10);
    
    // Format as xxx-xxx-xxxx
    if (limited.length >= 6) {
      return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
    } else if (limited.length >= 3) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    }
    return limited;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'contactNumber') {
      const formattedValue = formatPhoneNumber(value);
      setFormData({ ...formData, [name]: formattedValue });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    
    setMessage({ type: '', text: '' });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setMessage({ type: 'error', text: 'Image size must be less than 5MB' });
        return;
      }
      
      setSelectedPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async () => {
    if (!selectedPhoto) return null;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedPhoto);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('https://backend-mediconnect.onrender.com/api/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data.file_id;
    } catch (error) {
      console.error('Error uploading photo:', error);
      setMessage({ type: 'error', text: 'Failed to upload photo' });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate phone number
    const phoneDigits = formData.contactNumber.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setMessage({
        type: 'error',
        text: 'Phone number must be exactly 10 digits'
      });
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const method = profile ? 'put' : 'post';
      const message = profile ? 'Profile updated successfully!' : 'Profile created successfully!';
      
      // Upload photo if selected
      let photoId = null;
      if (selectedPhoto) {
        photoId = await uploadPhoto();
        if (!photoId) return; // Stop if photo upload failed
      }
      
      const submitData = { ...formData };
      if (photoId) {
        submitData.profilePhoto = photoId;
      }
      
      await axios[method]('https://backend-mediconnect.onrender.com/api/doctor/profile', submitData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage({ type: 'success', text: message });
      setIsEditing(false);
      setSelectedPhoto(null);
      fetchProfile();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to save profile'
      });
    }
  };

  if (!profile && !isEditing && !userInfo.email) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h3>Doctor Profile</h3>
            </div>
            <div className="card-body">
              {message.text && (
                <div className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'}`}>
                  {message.text}
                </div>
              )}

              {isEditing ? (
                <form onSubmit={handleSubmit}>
                  <div className="form-group mb-4">
                    <label className="form-label">Profile Photo</label>
                    <div className="d-flex align-items-center gap-3">
                      <div className="me-3">
                        <div className="bg-white rounded-circle p-2" style={{width: '50px', height: '50px'}}>
                          {photoPreview ? (
                            <img 
                              src={photoPreview} 
                              alt="Profile" 
                              className="rounded-circle"
                              style={{width: '100%', height: '100%', objectFit: 'cover'}}
                            />
                          ) : (
                            <i className="fas fa-user-md text-primary" style={{fontSize: '1.5rem'}}></i>
                          )}
                        </div>
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="form-control"
                          style={{width: '300px'}}
                        />
                        <small className="form-text text-muted">Upload a profile photo (Max 5MB)</small>
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="form-group mb-3">
                        <label className="form-label">Clinic Name *</label>
                        <input
                          type="text"
                          name="clinicName"
                          className="form-control"
                          value={formData.clinicName}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-group mb-3">
                        <label className="form-label">Specialization *</label>
                        <select
                          name="specialization"
                          className="form-control"
                          value={formData.specialization}
                          onChange={handleInputChange}
                          required
                        >
                          <option value="">Select Specialization</option>
                          <option value="Cardiology">Cardiology</option>
                          <option value="Dermatology">Dermatology</option>
                          <option value="Neurology">Neurology</option>
                          <option value="Orthopedics">Orthopedics</option>
                          <option value="Pediatrics">Pediatrics</option>
                          <option value="Psychiatry">Psychiatry</option>
                          <option value="General Medicine">General Medicine</option>
                          <option value="Gynecology">Gynecology</option>
                          <option value="Ophthalmology">Ophthalmology</option>
                          <option value="ENT">ENT</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6">
                      <div className="form-group mb-3">
                        <label className="form-label">Experience (Years) *</label>
                        <input
                          type="number"
                          name="experience"
                          className="form-control"
                          value={formData.experience}
                          onChange={handleInputChange}
                          min="0"
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-group mb-3">
                        <label className="form-label">Consultation Fee *</label>
                        <input
                          type="number"
                          name="consultationFee"
                          className="form-control"
                          value={formData.consultationFee}
                          onChange={handleInputChange}
                          min="0"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group mb-3">
                    <label className="form-label">Qualification *</label>
                    <input
                      type="text"
                      name="qualification"
                      className="form-control"
                      value={formData.qualification}
                      onChange={handleInputChange}
                      placeholder="e.g., MBBS, MD"
                      required
                    />
                  </div>

                  <div className="form-group mb-3">
                    <label className="form-label">Medical License Number *</label>
                    <input
                      type="text"
                      name="medicalLicense"
                      className="form-control"
                      value={formData.medicalLicense}
                      onChange={handleInputChange}
                      placeholder="e.g., ML123456789"
                      required
                    />
                  </div>

                  <div className="form-group mb-3">
                    <label className="form-label">Contact Number *</label>
                    <input
                      type="tel"
                      name="contactNumber"
                      className="form-control"
                      value={formData.contactNumber}
                      onChange={handleInputChange}
                      placeholder="123-456-7890"
                      maxLength="12"
                      required
                    />
                    <small className="form-text text-muted">Enter 10-digit phone number</small>
                  </div>

                  <div className="form-group mb-3">
                    <label className="form-label">Address *</label>
                    <textarea
                      name="address"
                      className="form-control"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows="3"
                      required
                    />
                  </div>

                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-primary">
                      Save Profile
                    </button>
                    {profile && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div>
                  <div className="d-flex align-items-center mb-4">
                    <div className="me-3">
                      <div className="bg-white rounded-circle p-2" style={{width: '50px', height: '50px'}}>
                        {photoPreview ? (
                          <img 
                            src={photoPreview} 
                            alt="Profile" 
                            className="rounded-circle"
                            style={{width: '100%', height: '100%', objectFit: 'cover'}}
                          />
                        ) : (
                          <i className="fas fa-user-md text-primary" style={{fontSize: '1.5rem'}}></i>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4>{profile?.firstName || userInfo.firstName} {profile?.lastName || userInfo.lastName}</h4>
                      <p className="text-muted mb-0">{profile?.email || userInfo.email}</p>
                      <p className="text-muted mb-0">{profile?.specialization || 'Specialization not specified'}</p>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <h5>Personal Information</h5>
                      <p><strong>Name:</strong> {profile?.firstName || userInfo.firstName} {profile?.lastName || userInfo.lastName}</p>
                      <p><strong>Email:</strong> {profile?.email || userInfo.email}</p>
                      <p><strong>Contact:</strong> {profile?.contactNumber || 'Not provided'}</p>
                    </div>
                    <div className="col-md-6">
                      <h5>Professional Information</h5>
                      <p><strong>Clinic:</strong> {profile?.clinicName || 'Not provided'}</p>
                      <p><strong>Specialization:</strong> {profile?.specialization || 'Not provided'}</p>
                      <p><strong>Experience:</strong> {profile?.experience ? `${profile.experience} years` : 'Not provided'}</p>
                      <p><strong>Qualification:</strong> {profile?.qualification || 'Not provided'}</p>
                      <p><strong>Medical License:</strong> {profile?.medicalLicense || 'Not provided'}</p>
                      <p><strong>Consultation Fee:</strong> {profile?.consultationFee ? `CAD $${profile.consultationFee}` : 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <h5>Address</h5>
                    <p>{profile?.address || 'Not provided'}</p>
                  </div>
                  <button
                    className="btn btn-primary mt-3"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Profile
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorProfile;