import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

interface Announcement {
  announcement_id: number;
  title: string;
  body: string;
  target_type: string;
  target_value: string | null;
  created_at: string;
}

const TARGET_TYPES = ['all', 'sellers', 'university', 'campus', 'user'] as const;

const AnnouncementsTab: React.FC = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<string>('all');
  const [targetValue, setTargetValue] = useState('');
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      setAnnouncements((data as Announcement[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !body.trim()) return;
    setPosting(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        title: title.trim(),
        body: body.trim(),
        target_type: targetType,
        target_value: targetType === 'all' || targetType === 'sellers' ? null : targetValue || null,
        created_by: user.user_id,
      });
      if (error) throw new Error(error.message);
      setTitle('');
      setBody('');
      setTargetValue('');
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post announcement');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this announcement?')) return;
    await supabase.from('announcements').delete().eq('announcement_id', id);
    load();
  };

  return (
    <div className="admin-section">
      <form className="create-listing-form" onSubmit={handlePost}>
        <label className="auth-label">Title</label>
        <input className="auth-input" value={title} onChange={(e) => setTitle(e.target.value)} required />

        <label className="auth-label">Message</label>
        <textarea className="auth-input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required />

        <label className="auth-label">Audience</label>
        <select className="auth-input" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
          {TARGET_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {targetType !== 'all' && targetType !== 'sellers' && (
          <input
            className="auth-input"
            placeholder={`${targetType} name or id`}
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
          />
        )}

        <button type="submit" className="auth-button" disabled={posting || !title.trim() || !body.trim()}>
          {posting ? 'Posting...' : 'Post announcement'}
        </button>
      </form>

      {loading ? (
        <p className="market-status">Loading announcements...</p>
      ) : (
        <div className="admin-list">
          {announcements.map((a) => (
            <div key={a.announcement_id} className="admin-report-row">
              <div className="admin-row-body">
                <div className="admin-row-title">{a.title}</div>
                <p className="admin-report-description">{a.body}</p>
                <div className="admin-row-meta">
                  To: {a.target_type}
                  {a.target_value ? ` (${a.target_value})` : ''} &middot; {new Date(a.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="admin-row-actions">
                <button className="admin-action-btn admin-action-danger" onClick={() => handleDelete(a.announcement_id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementsTab;