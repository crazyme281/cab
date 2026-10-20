import React from 'react';
import { useAuth } from '../../../context/AuthContext';

// This app enforces a single admin account at the database level (a unique
// index guarantees only one row can ever have role = 'admin'). Multi-admin
// roles/permissions are intentionally not built to avoid contradicting that.
const AdminManagementTab: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="admin-section">
      <p className="admin-hint">
        This marketplace is configured for a single administrator, enforced by a database
        constraint. There is no "create admin" flow.
      </p>
      {user && (
        <div className="admin-list">
          <div className="admin-user-row">
            <div className="admin-row-body">
              <div className="admin-row-title">{user.full_name}</div>
              <div className="admin-row-meta">{user.email}</div>
            </div>
            <span className="admin-status-badge admin-status-active">admin</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagementTab;
