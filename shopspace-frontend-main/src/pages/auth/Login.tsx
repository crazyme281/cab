import React, { useState } from 'react';
import cabLogo from '../../assets/cab-logo.png';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  // ProtectedRoute passes along the page the person originally asked for
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate(from && from.startsWith('/') ? from : '/market', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleLogin}>
        <div className="auth-brand">
          <div className="auth-logo"><img src={cabLogo} alt="Cab" /></div>
          <h1>Welcome back</h1>
          <p className="auth-tagline">Log in to buy, sell and chat on Cab.</p>
        </div>

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

        <label className="auth-label" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="auth-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" className="auth-button" disabled={busy || !email || !password}>
          {busy ? 'Logging in...' : 'Log in'}
        </button>

        <p className="auth-switch">
          New to Cab? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
