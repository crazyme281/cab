import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import StarRating from '../../components/StarRating';
import HeaderMenu from '../../components/HeaderMenu';

interface Review {
  review_id: number;
  reviewer_id: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

const Profile: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [matricNumber, setMatricNumber] = useState(user?.matric_number || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const userId = user?.user_id;

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      try {
        const { data } = await supabase
          .from('reviews')
          .select('review_id, reviewer_id, rating, comment, created_at, reviewer:users!reviews_reviewer_id_fkey(full_name)')
          .eq('reviewee_id', userId)
          .order('created_at', { ascending: false });
        const rows = ((data as any[]) || []).map((r) => ({
          ...r,
          reviewer_name: r.reviewer?.full_name || '',
        }));
        setReviews(rows);
        setReviewCount(rows.length);
        setAverageRating(
          rows.length > 0
            ? Math.round((rows.reduce((sum, r) => sum + r.rating, 0) / rows.length) * 10) / 10
            : null
        );
      } finally {
        setLoadingReviews(false);
      }
    };
    load();
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setBusy(true);
    try {
      await updateProfile({
        full_name: fullName,
        phone_number: phoneNumber,
        matric_number: matricNumber,
      });
      setSuccess(true);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="market-page-outer">
      <div className="market-page ss-narrow">
        <header className="ss-page-header">
          <Link to="/market" className="ss-back-btn" aria-label="Back to market">
            <i className="ti ti-arrow-left" aria-hidden="true"></i>
          </Link>
          <h1>Profile</h1>
          <HeaderMenu />
        </header>

        <div className="profile-page">
          <div className="profile-card">
            <div className="profile-avatar-large">
              {user.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <h1 className="profile-name">{user.full_name}</h1>
            <p className="profile-email">{user.email}</p>

            {!editing ? (
              <>
                <div className="profile-field-row">
                  <span className="profile-field-label">Phone</span>
                  <span className="profile-field-value">{user.phone_number || '\u2014'}</span>
                </div>
                <div className="profile-field-row">
                  <span className="profile-field-label">Matric number</span>
                  <span className="profile-field-value">{user.matric_number || '\u2014'}</span>
                </div>

                {success && <p className="profile-success">Profile updated.</p>}

                <button
                  className="auth-button"
                  onClick={() => {
                    // Start from the saved values, not whatever was typed before cancelling
                    setFullName(user.full_name || '');
                    setPhoneNumber(user.phone_number || '');
                    setMatricNumber(user.matric_number || '');
                    setError(null);
                    setSuccess(false);
                    setEditing(true);
                  }}
                >
                  Edit profile
                </button>
                <Link to="/market/mine" className="market-btn-ghost profile-secondary-btn">
                  <i className="ti ti-list-details" aria-hidden="true" style={{ marginRight: 6 }}></i>
                  My listings
                </Link>
                <button className="market-btn-ghost profile-secondary-btn" onClick={logout}>
                  <i className="ti ti-logout" aria-hidden="true" style={{ marginRight: 6 }}></i>
                  Log out
                </button>
              </>
            ) : (
              <form onSubmit={handleSave} className="profile-edit-form">
                <label className="auth-label" htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  className="auth-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />

                <label className="auth-label" htmlFor="phoneNumber">Phone number</label>
                <input
                  id="phoneNumber"
                  className="auth-input"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />

                <label className="auth-label" htmlFor="matricNumber">Matric number</label>
                <input
                  id="matricNumber"
                  className="auth-input"
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value)}
                />

                {error && <p className="auth-error" role="alert">{error}</p>}

                <button type="submit" className="auth-button" disabled={busy || !fullName.trim()}>
                  {busy ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="market-btn-ghost profile-secondary-btn"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </form>
            )}
          </div>

          <div className="profile-reviews-card">
            <h2 className="profile-reviews-title">Reviews</h2>
            {loadingReviews ? (
              <p className="market-status">Loading...</p>
            ) : reviewCount === 0 ? (
              <p className="market-status">No reviews yet.</p>
            ) : (
              <>
                <div className="profile-reviews-summary">
                  <span className="profile-reviews-average">{averageRating}</span>
                  <StarRating value={averageRating || 0} size={16} />
                  <span className="profile-reviews-count">
                    ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
                  </span>
                </div>
                <div className="profile-reviews-list">
                  {reviews.map((r) => (
                    <div key={r.review_id} className="profile-review-item">
                      <div className="profile-review-header">
                        <strong>{r.reviewer_name}</strong>
                        <StarRating value={r.rating} size={13} />
                      </div>
                      {r.comment && <p className="profile-review-comment">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;