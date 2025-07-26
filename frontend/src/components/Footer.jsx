import React, { useState, useEffect } from 'react';

export default function Footer () {
  const footerLinks = {
    product: ['Features', 'Security', 'Updates'],
    company: ['About', 'Press', 'Blog'],
    resources: ['Help Center', 'Contact', 'Terms']
  };

  return (
    <footer id="footer" className="bg-dark text-light py-5">
      <div className="container">
        <div className="row g-4">
          <div className="col-lg-4">
            <h5 className="fw-bold mb-4">
              <i className="fas fa-heartbeat me-2"></i>Mediconnect
            </h5>
            <p className="mb-4">Revolutionizing healthcare through innovative virtual consultation technology. Making quality medical care accessible to everyone, everywhere.</p>
          </div>
          
          <div className="col-lg-2 col-md-6">
            <h6 className="fw-bold mb-4">Product</h6>
            <ul className="list-unstyled">
              {footerLinks.product.map((link, index) => (
                <li key={index} className="mb-2">
                  <a href="#" className="text-light text-decoration-none opacity-75">{link}</a>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="col-lg-2 col-md-6">
            <h6 className="fw-bold mb-4">Company</h6>
            <ul className="list-unstyled">
              {footerLinks.company.map((link, index) => (
                <li key={index} className="mb-2">
                  <a href="#" className="text-light text-decoration-none opacity-75">{link}</a>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="col-lg-2 col-md-6">
            <h6 className="fw-bold mb-4">Resources</h6>
            <ul className="list-unstyled">
              {footerLinks.resources.map((link, index) => (
                <li key={index} className="mb-2">
                  <a href="#" className="text-light text-decoration-none opacity-75">{link}</a>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="col-lg-2 col-md-6">
            <h6 className="fw-bold mb-4">Contact</h6>
            <ul className="list-unstyled">
              <li className="mb-2">
                <i className="fas fa-envelope me-2"></i>
                <a href="mailto:info@mediconnect.com" className="text-light text-decoration-none opacity-75">info@mediconnect.com</a>
              </li>
              <li className="mb-2">
                <i className="fas fa-phone me-2"></i>
                <a href="tel:+1234567890" className="text-light text-decoration-none opacity-75">+1 (234) 567-890</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};