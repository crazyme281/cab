import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface Report {
  report_id: number;
  category: string;
  description: string;
  evidence_url: string | null;
  status: 'new' | 'under_review' | 'resolved' | 'dismissed';
  decision: string | null;
  resolution_notes: string | null;
  created_at: string;
  reporter_id: string;
  reporter_name: string;
  reported_user_id: string | null;
  reported_user_name: string | null;
  reported_product_id: number | null;
  reported_product_title: string | null;
  reported_review_id: number | null;
  reported_review_comment: string | null;
}

const STATUS_FILTERS = ['new', 'under_review', 'resolved', 'dismissed'] as const;

const ReportsTab: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_list_reports', { status_filter: statusFilter || null });
      if (error) {
        setLoadError(error.message);
      } else {
        setLoadError(null);
        setReports((data as Report[]) || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const target = (r: Report) => {
    if (r.reported_product_title) return `Product: ${r.reported_product_title}`;
    if (r.reported_user_name) return `User: ${r.reported_user_name}`;
    if (r.reported_review_comment) return `Review: "${r.reported_review_comment.slice(0, 60)}"`;
    return 'Unknown target';
  };

  const resolve = async (id: number, status: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase.rpc('admin_resolve_report', {
        p_report_id: id,
        p_status: status,
        p_resolution_notes: notesDraft[id] || null,
      });
      if (error) throw new Error(error.message);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update report');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="market-status">Loading reports...</p>;

  return (
    <div className="admin-section">
      <div className="admin-filter-row">
        <button className={`admin-tab admin-tab-small ${statusFilter === '' ? 'admin-tab-active' : ''}`} onClick={() => setStatusFilter('')}>
          All
        </button>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={`admin-tab admin-tab-small ${statusFilter === s ? 'admin-tab-active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loadError && <p className="auth-error" role="alert">{loadError}</p>}
      {reports.length === 0 ? (
        <p className="market-status">No reports found.</p>
      ) : (
        <div className="admin-list">
          {reports.map((r) => (
            <div key={r.report_id} className="admin-report-row">
              <div className="admin-row-body">
                <div className="admin-row-title">{target(r)}</div>
                <div className="admin-row-meta">
                  {r.category.replace('_', ' ')} &middot; reported by {r.reporter_name} &middot;{' '}
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
                <p className="admin-report-description">{r.description}</p>
                {r.evidence_url && (
                  <a href={r.evidence_url} target="_blank" rel="noreferrer" className="admin-evidence-link">
                    View evidence
                  </a>
                )}
                <span className={`admin-status-badge admin-status-report-${r.status}`}>{r.status.replace('_', ' ')}</span>
                {r.resolution_notes && <div className="admin-rejection-reason">Notes: {r.resolution_notes}</div>}
              </div>

              {(r.status === 'new' || r.status === 'under_review') && (
                <div className="admin-inline-form admin-inline-form-column">
                  <input
                    className="auth-input"
                    placeholder="Resolution notes (optional)"
                    value={notesDraft[r.report_id] || ''}
                    onChange={(e) => setNotesDraft((prev) => ({ ...prev, [r.report_id]: e.target.value }))}
                  />
                  <div className="admin-row-actions">
                    {r.status === 'new' && (
                      <button className="admin-action-btn" disabled={busyId === r.report_id} onClick={() => resolve(r.report_id, 'under_review')}>
                        Start review
                      </button>
                    )}
                    <button className="admin-action-btn admin-action-positive" disabled={busyId === r.report_id} onClick={() => resolve(r.report_id, 'resolved')}>
                      Resolve
                    </button>
                    <button className="admin-action-btn admin-action-danger" disabled={busyId === r.report_id} onClick={() => resolve(r.report_id, 'dismissed')}>
                      Dismiss
                    </button>
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

export default ReportsTab;