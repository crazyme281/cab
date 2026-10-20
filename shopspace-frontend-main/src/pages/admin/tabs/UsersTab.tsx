import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface AdminUser {
  user_id: string;
  full_name: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended' | 'restricted' | 'deactivated';
  created_at: string;
}

interface Warning {
  warning_id: number;
  reason: string;
  created_at: string;
}

interface Note {
  note_id: number;
  note: string;
  created_at: string;
}

const STATUS_OPTIONS = ['active', 'suspended', 'restricted', 'deactivated'] as const;

const UsersTab: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [warnReason, setWarnReason] = useState('');
  const [noteText, setNoteText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('users')
        .select('user_id, full_name, email, role, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      setUsers((data as AdminUser[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadDetail = async (userId: string) => {
    const [{ data: w }, { data: n }] = await Promise.all([
      supabase.from('user_warnings').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('admin_notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);
    setWarnings((w as Warning[]) || []);
    setNotes((n as Note[]) || []);
  };

  const toggleExpand = (userId: string) => {
    if (expandedId === userId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(userId);
    setWarnReason('');
    setNoteText('');
    loadDetail(userId);
  };

  const handleSetStatus = async (userId: string, status: string) => {
    setBusyId(userId);
    try {
      const { error } = await supabase.rpc('admin_set_user_status', { p_user_id: userId, p_status: status });
      if (error) throw new Error(error.message);
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, status: status as AdminUser['status'] } : u)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const handleWarn = async (userId: string) => {
    if (!warnReason.trim()) return;
    setBusyId(userId);
    try {
      const { error } = await supabase.rpc('admin_warn_user', { p_user_id: userId, p_reason: warnReason.trim() });
      if (error) throw new Error(error.message);
      setWarnReason('');
      loadDetail(userId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to warn user');
    } finally {
      setBusyId(null);
    }
  };

  const handleAddNote = async (userId: string) => {
    if (!noteText.trim()) return;
    setBusyId(userId);
    try {
      const { error } = await supabase.rpc('admin_add_note', { p_user_id: userId, p_note: noteText.trim() });
      if (error) throw new Error(error.message);
      setNoteText('');
      loadDetail(userId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  if (loading) return <p className="market-status">Loading users...</p>;

  return (
    <div className="admin-section">
      <div className="admin-search-bar">
        <i className="ti ti-search" aria-hidden="true"></i>
        <input
          className="admin-search-input"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="market-status">No users found.</p>
      ) : (
        <div className="admin-list">
          {filtered.map((u) => (
            <div key={u.user_id} className="admin-user-row-wrap">
              <div className="admin-user-row" onClick={() => toggleExpand(u.user_id)}>
                <div className="admin-row-body">
                  <div className="admin-row-title">{u.full_name}</div>
                  <div className="admin-row-meta">{u.email}</div>
                </div>
                <span className={`admin-status-badge admin-status-${u.status}`}>{u.status}</span>
                <i className={`ti ti-chevron-${expandedId === u.user_id ? 'up' : 'down'}`} aria-hidden="true"></i>
              </div>

              {expandedId === u.user_id && (
                <div className="admin-user-detail">
                  {u.role !== 'admin' && (
                    <div className="admin-detail-block">
                      <div className="admin-detail-label">Account status</div>
                      <div className="admin-status-buttons">
                        {STATUS_OPTIONS.map((s) => (
                          <button
                            key={s}
                            className={`admin-action-btn ${s === u.status ? 'admin-action-current' : ''}`}
                            disabled={busyId === u.user_id || s === u.status}
                            onClick={() => handleSetStatus(u.user_id, s)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="admin-detail-block">
                    <div className="admin-detail-label">Warnings ({warnings.length})</div>
                    {warnings.map((w) => (
                      <div key={w.warning_id} className="admin-detail-item">
                        {w.reason} <span className="admin-detail-date">{new Date(w.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                    <div className="admin-inline-form">
                      <input
                        className="auth-input"
                        placeholder="Reason for warning"
                        value={warnReason}
                        onChange={(e) => setWarnReason(e.target.value)}
                      />
                      <button className="market-btn-ghost" disabled={busyId === u.user_id} onClick={() => handleWarn(u.user_id)}>
                        Warn
                      </button>
                    </div>
                  </div>

                  <div className="admin-detail-block">
                    <div className="admin-detail-label">Admin notes ({notes.length})</div>
                    {notes.map((n) => (
                      <div key={n.note_id} className="admin-detail-item">
                        {n.note} <span className="admin-detail-date">{new Date(n.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                    <div className="admin-inline-form">
                      <input
                        className="auth-input"
                        placeholder="Add a private note"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                      />
                      <button className="market-btn-ghost" disabled={busyId === u.user_id} onClick={() => handleAddNote(u.user_id)}>
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UsersTab;