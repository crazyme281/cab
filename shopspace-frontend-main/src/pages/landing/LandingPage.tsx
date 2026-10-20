import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import cabLogo from '../../assets/cab-logo.png';

const LandingPage: React.FC = () => {
  const { user, loading } = useAuth();

  // Logged-in visitors skip the pitch and go straight to the market
  if (!loading && user) {
    return <Navigate to="/market" replace />;
  }

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-logo">
          <img src={cabLogo} alt="Cab" className="brand-logo" />
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-nav-login">Log in</Link>
          <Link to="/register" className="landing-nav-signup">Sign up</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <span className="landing-eyebrow">Campus marketplace</span>
        <h1>Buy, sell and trade with students on your campus</h1>
        <p>
          Textbooks, gadgets, hostel furniture and more. Post an item in minutes,
          chat with the buyer, and meet up on campus.
        </p>
        <div className="landing-hero-actions">
          <Link to="/register" className="market-btn-primary landing-cta">Create an account</Link>
          <Link to="/login" className="landing-cta-secondary">Log in</Link>
        </div>
      </section>

      <section className="landing-features">
        <div className="landing-feature">
          <div className="landing-feature-icon">
            <i className="ti ti-tag" aria-hidden="true"></i>
          </div>
          <div className="landing-feature-title">Post in minutes</div>
          <p className="landing-feature-body">Add a photo and a price. Your listing goes live once an admin approves it.</p>
        </div>
        <div className="landing-feature">
          <div className="landing-feature-icon">
            <i className="ti ti-message-circle-2" aria-hidden="true"></i>
          </div>
          <div className="landing-feature-title">Chat directly</div>
          <p className="landing-feature-body">Message the seller, agree on a price, and arrange where to meet.</p>
        </div>
        <div className="landing-feature">
          <div className="landing-feature-icon">
            <i className="ti ti-shield-check" aria-hidden="true"></i>
          </div>
          <div className="landing-feature-title">Reviewed listings</div>
          <p className="landing-feature-body">Every listing is checked by an admin, and buyers and sellers rate each other after a sale.</p>
        </div>
      </section>

      <footer className="landing-footer">&copy; {new Date().getFullYear()} Cab</footer>
    </div>
  );
};

export default LandingPage;
