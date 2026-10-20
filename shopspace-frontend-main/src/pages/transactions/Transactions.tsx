import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import StarRating from '../../components/StarRating';
import HeaderMenu from '../../components/HeaderMenu';

interface Transaction {
  transaction_id: number;
  product_id: number;
  product_title: string;
  product_image_url: string | null;
  buyer_id: string;
  seller_id: string;
  buyer_name: string;
  seller_name: string;
  agreed_price: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  reviewed_by_me: boolean;
}

const formatMoney = (price: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(price)
  );

const Transactions: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.user_id;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Review form state, keyed to whichever transaction row currently has the
  // form open (only one at a time).
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('transactions')
      .select(
        `*,
         product:products(title, image_url),
         buyer:users!transactions_buyer_id_fkey(full_name),
         seller:users!transactions_seller_id_fkey(full_name),
         reviews(reviewer_id)`
      )
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) {
      setLoadError('Could not load your transactions. Check your connection and try again.');
    } else {
      setLoadError(null);
      setTransactions(
        ((data as any[]) || []).map((t) => ({
          ...t,
          product_title: t.product?.title || '',
          product_image_url: t.product?.image_url || null,
          buyer_name: t.buyer?.full_name || '',
          seller_name: t.seller?.full_name || '',
          reviewed_by_me: (t.reviews || []).some((r: any) => r.reviewer_id === userId),
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Only the seller can confirm a sale. Previously the buyer saw this button
  // too, but marking the item as sold is something only the seller is allowed
  // to do — so a buyer's "confirm" completed the transaction while the item
  // stayed listed as available.
  const handleComplete = async (id: number) => {
    const tx = transactions.find((t) => t.transaction_id === id);
    if (!tx || tx.seller_id !== userId) return;
    setBusyId(id);
    setActionError(null);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('transaction_id', id)
        .eq('status', 'pending')
        .select('transaction_id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('This transaction is no longer pending.');

      const { error: productError } = await supabase
        .from('products')
        .update({ status: 'sold' })
        .eq('product_id', tx.product_id);
      if (productError) throw new Error(`Sale confirmed, but the item could not be marked as sold: ${productError.message}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not confirm this sale.');
    } finally {
      await load();
      setBusyId(null);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Cancel this transaction?')) return;
    setBusyId(id);
    setActionError(null);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('transaction_id', id)
        .eq('status', 'pending')
        .select('transaction_id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('This transaction is no longer pending.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not cancel this transaction.');
    } finally {
      await load();
      setBusyId(null);
    }
  };

  const openReviewForm = (id: number) => {
    setReviewingId(id);
    setReviewRating(0);
    setReviewComment('');
    setReviewError(null);
  };

  const closeReviewForm = () => {
    setReviewingId(null);
  };

  const submitReview = async (transactionId: number) => {
    if (!user) return;
    if (reviewRating === 0) {
      setReviewError('Please choose a star rating');
      return;
    }
    setReviewError(null);
    setSubmittingReview(true);
    try {
      const tx = transactions.find((t) => t.transaction_id === transactionId);
      if (!tx) throw new Error('Transaction not found');
      const revieweeId = tx.buyer_id === user.user_id ? tx.seller_id : tx.buyer_id;

      if (tx.status !== 'completed') throw new Error('You can only review a completed transaction.');

      const { error } = await supabase.from('reviews').insert({
        transaction_id: transactionId,
        reviewer_id: user.user_id,
        reviewee_id: revieweeId,
        rating: reviewRating,
        comment: reviewComment || null,
      });
      if (error) throw new Error(error.message);
      setReviewingId(null);
      load();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="market-page-outer">
      <div className="market-page ss-medium">
        <header className="ss-page-header">
          <Link to="/market" className="ss-back-btn" aria-label="Back to market">
            <i className="ti ti-arrow-left" aria-hidden="true"></i>
          </Link>
          <h1>Transactions</h1>
          <HeaderMenu />
        </header>

        <div className="transactions-page">
          {actionError && <p className="auth-error" role="alert">{actionError}</p>}
          {loading ? (
            <p className="market-status">Loading...</p>
          ) : loadError ? (
            <p className="market-status">{loadError}</p>
          ) : transactions.length === 0 ? (
            <p className="market-status">No transactions yet.</p>
          ) : (
            <div className="transactions-list">
              {transactions.map((t) => {
                const isBuyer = user?.user_id === t.buyer_id;
                const otherPartyName = isBuyer ? t.seller_name : t.buyer_name;
                const isReviewing = reviewingId === t.transaction_id;
                return (
                  <div key={t.transaction_id} className="transaction-row">
                    <div className="transaction-image">
                      {t.product_image_url ? (
                        <img src={t.product_image_url} alt={t.product_title} />
                      ) : (
                        <i className="ti ti-photo" aria-hidden="true"></i>
                      )}
                    </div>
                    <div className="transaction-body">
                      <div className="transaction-title">{t.product_title}</div>
                      <div className="transaction-meta">
                        {isBuyer ? 'Buying from' : 'Selling to'} <strong>{otherPartyName}</strong>
                      </div>
                      <div className="transaction-price">{formatMoney(t.agreed_price)}</div>
                      <span className={`transaction-status transaction-status-${t.status}`}>
                        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </span>

                      {t.status === 'completed' && (
                        <>
                          {isReviewing ? (
                            <div className="review-form">
                              <div className="review-form-label">Rate {otherPartyName}</div>
                              <StarRating value={reviewRating} onChange={setReviewRating} size={22} />
                              <textarea
                                className="auth-input review-form-comment"
                                placeholder="How did it go? (optional)"
                                rows={2}
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                              />
                              {reviewError && <p className="auth-error">{reviewError}</p>}
                              <div className="review-form-actions">
                                <button
                                  type="button"
                                  className="market-btn-primary"
                                  disabled={submittingReview}
                                  onClick={() => submitReview(t.transaction_id)}
                                >
                                  {submittingReview ? 'Submitting...' : 'Submit review'}
                                </button>
                                <button
                                  type="button"
                                  className="market-btn-ghost"
                                  disabled={submittingReview}
                                  onClick={closeReviewForm}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : t.reviewed_by_me ? (
                            <div className="review-reviewed-tag">
                              <i className="ti ti-check" aria-hidden="true"></i> You reviewed this
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="market-btn-primary review-leave-btn"
                              onClick={() => openReviewForm(t.transaction_id)}
                            >
                              Leave a review
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {t.status === 'pending' && (
                      <div className="transaction-actions">
                        {isBuyer ? (
                          <p className="transaction-meta">Waiting for {t.seller_name} to confirm</p>
                        ) : (
                          <button
                            className="market-btn-primary"
                            disabled={busyId === t.transaction_id}
                            onClick={() => handleComplete(t.transaction_id)}
                          >
                            Confirm sale
                          </button>
                        )}
                        <button
                          className="market-btn-ghost transaction-cancel"
                          disabled={busyId === t.transaction_id}
                          onClick={() => handleCancel(t.transaction_id)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Transactions;