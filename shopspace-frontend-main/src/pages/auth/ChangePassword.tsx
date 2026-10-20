import React, { useState } from 'react';
import cabLogo from '../../assets/cab-logo.png';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const { completePasswordChange, logout } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setBusy(true);
    try {
      await completePasswordChange(newPassword);
      navigate('/market', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <div className="auth-logo"><img src={cabLogo} alt="Cab" /></div>
          <h1>Set a new password</h1>
          <p className="auth-tagline">
            This account was created with a temporary password. Choose a new one to continue.
          </p>
        </div>

        <label className="auth-label" htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          className="auth-input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={6}
          required
          autoFocus
        />

        <label className="auth-label" htmlFor="confirmPassword">Confirm new password</label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="auth-input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={6}
          required
        />

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" className="auth-button" disabled={busy || !newPassword || !confirmPassword}>
          {busy ? 'Updating...' : 'Update password & continue'}
        </button>

        <p className="auth-switch">
          <button type="button" className="market-btn-ghost" onClick={logout}>
            Log out instead
          </button>
        </p>
      </form>
    </div>
  );
};

export default ChangePassword;
