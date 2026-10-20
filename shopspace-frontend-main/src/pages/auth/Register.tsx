import React, { useState } from 'react';
import cabLogo from '../../assets/cab-logo.png';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmailSentTo, setConfirmEmailSentTo] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { needsEmailConfirmation } = await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        phone_number: phoneNumber.trim() || undefined,
        matric_number: matricNumber.trim() || undefined,
      });
      if (needsEmailConfirmation) {
        // No session yet — the person has to click the link we just emailed
        setConfirmEmailSentTo(email.trim());
        return;
      }
      navigate('/market', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  if (confirmEmailSentTo) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-logo"><img src={cabLogo} alt="Cab" /></div>
            <h1>Check your email</h1>
            <p className="auth-tagline">
              We sent a confirmation link to <strong>{confirmEmailSentTo}</strong>. Open it to
              activate your account, then log in.
            </p>
          </div>
          <Link to="/login" className="auth-button" style={{ textAlign: 'center', textDecoration: 'none' }}>
            Go to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleRegister}>
        <div className="auth-brand">
          <div className="auth-logo"><img src={cabLogo} alt="Cab" /></div>
          <h1>Create your Cab account</h1>
          <p className="auth-tagline">Free to join. Start buying and selling in minutes.</p>
        </div>

        <label className="auth-label" htmlFor="fullName">Full name</label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          className="auth-input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <label className="auth-label" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="auth-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="auth-label" htmlFor="phoneNumber">Phone number (optional)</label>
        <input
          id="phoneNumber"
          type="tel"
          autoComplete="tel"
          className="auth-input"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />

        <label className="auth-label" htmlFor="matricNumber">Matric number (optional)</label>
        <input
          id="matricNumber"
          type="text"
          className="auth-input"
          value={matricNumber}
          onChange={(e) => setMatricNumber(e.target.value)}
        />

        <label className="auth-label" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className="auth-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <p className="auth-hint">At least 6 characters.</p>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button
          type="submit"
          className="auth-button"
          disabled={busy || !email || !password || !fullName.trim()}
        >
          {busy ? 'Creating account...' : 'Create account'}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
