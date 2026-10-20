import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Props {
  reportedUserId?: string;
  reportedProductId?: number;
  reportedReviewId?: number;
  onClose: () => void;
}

const CATEGORIES = [
  { value: 'fraud', label: 'Fraud / scam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'prohibited_item', label: 'Prohibited item' },
  { value: 'misleading_listing', label: 'Misleading listing' },
  { value: 'counterfeit', label: 'Counterfeit product' },
  { value: 'spam', label: 'Spam' },
  { value: 'fake_review', label: 'Fake review' },
  { value: 'other', label: 'Other' },
];

const ReportModal: React.FC<Props> = ({ reportedUserId, reportedProductId, reportedReviewId, onClose }) => {
  const { user } = useAuth();
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.user_id,
        category,
        description: description.trim(),
        reported_user_id: reportedUserId || null,
        reported_product_id: reportedProductId || null,
        reported_review_id: reportedReviewId || null,
      });
      if (error) throw new Error(error.message);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <h2>Report submitted</h2>
            <p>Thanks — an admin will review this shortly.</p>
            <button className="market-btn-primary" onClick={onClose}>Close</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2>Report</h2>
            <label className="auth-label">Reason</label>
            <select className="auth-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <label className="auth-label">Details</label>
            <textarea
              className="auth-input"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened?"
              required
            />
            {error && <p className="auth-error">{error}</p>}
            <div className="modal-actions">
              <button type="submit" className="market-btn-primary" disabled={submitting || !description.trim()}>
                {submitting ? 'Submitting...' : 'Submit report'}
              </button>
              <button type="button" className="market-btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
