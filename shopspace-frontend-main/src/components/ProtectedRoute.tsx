import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div role="status" style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
  }

  if (!user) {
    // Remember where they were headed so Login can send them back after signing in
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
