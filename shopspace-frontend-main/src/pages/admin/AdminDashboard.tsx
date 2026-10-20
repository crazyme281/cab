import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import HeaderMenu from '../../components/HeaderMenu';
import UsersTab from './tabs/UsersTab';
import ListingsTab from './tabs/ListingsTab';
import CategoriesTab from './tabs/CategoriesTab';
import ReportsTab from './tabs/ReportsTab';
import ReviewsTab from './tabs/ReviewsTab';
import AnnouncementsTab from './tabs/AnnouncementsTab';
import CampusTab from './tabs/CampusTab';
import AuditLogTab from './tabs/AuditLogTab';
import AdminManagementTab from './tabs/AdminManagementTab';

interface DashboardData {
  total_students: number;
  active_students: number;
  active_sellers: number;
  total_listings: number;
  pending_approvals: number;
  reported_products: number;
  reported_users: number;
  open_disputes: number;
  suspended_users: number;
  recent_users: { user_id: string; full_name: string; email: string; created_at: string }[];
  recent_products: { product_id: number; title: string; approval_status: string; created_at: string }[];
  most_viewed_products: { product_id: number; title: string; view_count: number }[];
  most_active_sellers: { user_id: string; full_name: string; listing_count: number }[];
  most_active_categories: { name: string; listing_count: number }[];
  recent_admin_actions: { log_id: number; action: string; target_type: string; target_id: string; created_at: string }[];
}

type Tab =
  | 'overview' | 'users' | 'listings' | 'categories' | 'reports'
  | 'reviews' | 'announcements' | 'campus' | 'audit' | 'admins';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'listings', label: 'Marketplace' },
  { key: 'categories', label: 'Categories' },
  { key: 'reports', label: 'Reports' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'campus', label: 'Campus' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'admins', label: 'Admin' },
];

const OverviewTab: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('admin_dashboard').single();
        if (error) setError(error.message);
        else setData(data as DashboardData);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p className="market-status">Loading dashboard...</p>;
  if (error || !data) return <p className="market-status">{error}</p>;

  const pendingCount = data.pending_approvals + data.reported_products + data.reported_users;

  return (
    <div className="admin-section">
      {pendingCount > 0 && (
        <div className="admin-pending-actions">
          <div className="admin-pending-actions-title">Needs your attention</div>
          {data.pending_approvals > 0 && <div>&bull; {data.pending_approvals} products awaiting review</div>}
          {data.reported_users > 0 && <div>&bull; {data.reported_users} reported users</div>}
          {data.reported_products > 0 && <div>&bull; {data.reported_products} reported listings</div>}
          {data.open_disputes > 0 && <div>&bull; {data.open_disputes} open reports/disputes</div>}
        </div>
      )}

      <div className="admin-stats-grid">
        <div className="admin-stat-card"><div className="admin-stat-number">{data.total_students}</div><div className="admin-stat-label">Total students</div></div>
        <div className="admin-stat-card"><div className="admin-stat-number">{data.active_students}</div><div className="admin-stat-label">Active students</div></div>
        <div className="admin-stat-card"><div className="admin-stat-number">{data.active_sellers}</div><div className="admin-stat-label">Active sellers</div></div>
        <div className="admin-stat-card"><div className="admin-stat-number">{data.total_listings}</div><div className="admin-stat-label">Total listings</div></div>
        <div className="admin-stat-card"><div className="admin-stat-number">{data.pending_approvals}</div><div className="admin-stat-label">Pending approvals</div></div>
        <div className="admin-stat-card"><div className="admin-stat-number">{data.suspended_users}</div><div className="admin-stat-label">Suspended users</div></div>
      </div>

      <div className="admin-detail-block">
        <div className="admin-detail-label">Recently registered</div>
        {data.recent_users.map((u) => (
          <div key={u.user_id} className="admin-detail-item">{u.full_name} &middot; {u.email}</div>
        ))}
      </div>

      <div className="admin-detail-block">
        <div className="admin-detail-label">Recently listed</div>
        {data.recent_products.map((p) => (
          <div key={p.product_id} className="admin-detail-item">{p.title} &middot; {p.approval_status}</div>
        ))}
      </div>

      <div className="admin-detail-block">
        <div className="admin-detail-label">Most viewed products</div>
        {data.most_viewed_products.map((p) => (
          <div key={p.product_id} className="admin-detail-item">{p.title} &middot; {p.view_count} views</div>
        ))}
      </div>

      <div className="admin-detail-block">
        <div className="admin-detail-label">Most active sellers</div>
        {data.most_active_sellers.map((s) => (
          <div key={s.user_id} className="admin-detail-item">{s.full_name} &middot; {s.listing_count} listings</div>
        ))}
      </div>

      <div className="admin-detail-block">
        <div className="admin-detail-label">Most active categories</div>
        {data.most_active_categories.map((c) => (
          <div key={c.name} className="admin-detail-item">{c.name} &middot; {c.listing_count} listings</div>
        ))}
      </div>

      <div className="admin-detail-block">
        <div className="admin-detail-label">Recent admin actions</div>
        {data.recent_admin_actions.length === 0 ? (
          <div className="admin-detail-item">No actions yet.</div>
        ) : (
          data.recent_admin_actions.map((a) => (
            <div key={a.log_id} className="admin-detail-item">
              {a.action.replace(/_/g, ' ')} &middot; {a.target_type} #{a.target_id}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="market-page-outer">
      <div className="market-page ss-wide">
        <header className="ss-page-header">
          <Link to="/market" className="ss-back-btn" aria-label="Back to market">
            <i className="ti ti-arrow-left" aria-hidden="true"></i>
          </Link>
          <h1>Admin Dashboard</h1>
          <HeaderMenu />
        </header>

        <div className="admin-page">
          <div className="admin-tabs-dropdown-wrap">
            <select
              className="admin-tabs-dropdown"
              value={tab}
              onChange={(e) => setTab(e.target.value as Tab)}
              aria-label="Admin section"
            >
              {TABS.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            <svg
              className="admin-tabs-dropdown-icon"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {tab === 'overview' && <OverviewTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'listings' && <ListingsTab />}
          {tab === 'categories' && <CategoriesTab />}
          {tab === 'reports' && <ReportsTab />}
          {tab === 'reviews' && <ReviewsTab />}
          {tab === 'announcements' && <AnnouncementsTab />}
          {tab === 'campus' && <CampusTab />}
          {tab === 'audit' && <AuditLogTab />}
          {tab === 'admins' && <AdminManagementTab />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;