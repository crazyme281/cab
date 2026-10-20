import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface LogEntry {
  log_id: number;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  created_at: string;
}

const AuditLogTab: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('audit_logs')
          .select('log_id, action, target_type, target_id, reason, created_at')
          .order('created_at', { ascending: false })
          .limit(200);
        setLogs((data as LogEntry[]) || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p className="market-status">Loading audit log...</p>;

  return (
    <div className="admin-section">
      {logs.length === 0 ? (
        <p className="market-status">No administrative actions recorded yet.</p>
      ) : (
        <div className="admin-list">
          {logs.map((l) => (
            <div key={l.log_id} className="admin-audit-row">
              <div className="admin-row-title">
                {l.action.replace(/_/g, ' ')} &middot; {l.target_type} #{l.target_id}
              </div>
              {l.reason && <div className="admin-row-meta">Reason: {l.reason}</div>}
              <div className="admin-detail-date">{new Date(l.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditLogTab;