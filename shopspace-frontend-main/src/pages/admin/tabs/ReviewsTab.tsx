import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface Review {
  review_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string;
  reviewee_name: string;
}

const ReviewsTab: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('reviews')
        .select(
          `review_id, rating, comment, created_at,
           reviewer:users!reviews_reviewer_id_fkey(full_name),
           reviewee:users!reviews_reviewee_id_fkey(full_name)`
        )
        .order('created_at', { ascending: false })
        .limit(200);
      const rows = ((data as any[]) || []).map((r) => ({
        ...r,
        reviewer_name: r.reviewer?.full_name || '',
        reviewee_name: r.reviewee?.full_name || '',
      }));
      setReviews(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRemove = async (id: number) => {
    const reason = prompt('Reason for removing this review (spam, abuse, fake, etc.):');
    if (reason === null) return;
    setBusyId(id);
    try {
      const { error } = await supabase.rpc('admin_delete_review', { p_review_id: id, p_reason: reason || null });
      if (error) throw new Error(error.message);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove review');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="market-status">Loading reviews...</p>;

  return (
    <div className="admin-section">
      <p className="admin-hint">Only remove reviews that violate marketplace rules — not simply because they're negative.</p>
      {reviews.length === 0 ? (
        <p className="market-status">No reviews yet.</p>
      ) : (
        <div className="admin-list">
          {reviews.map((r) => (
            <div key={r.review_id} className="admin-report-row">
              <div className="admin-row-body">
                <div className="admin-row-title">
                  {r.reviewer_name} &rarr; {r.reviewee_name} &middot; {'\u2605'.repeat(r.rating)}
                  {'\u2606'.repeat(5 - r.rating)}
                </div>
                {r.comment && <p className="admin-report-description">{r.comment}</p>}
                <div className="admin-row-meta">{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              <div className="admin-row-actions">
                <button className="admin-action-btn admin-action-danger" disabled={busyId === r.review_id} onClick={() => handleRemove(r.review_id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewsTab;