import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { categoryIcon } from '../../lib/categoryIcon';
import HeaderMenu from '../../components/HeaderMenu';

interface MyProduct {
  product_id: number;
  title: string;
  price: string;
  image_url: string | null;
  category_name: string;
  status: 'available' | 'sold' | 'removed';
  approval_status: 'pending' | 'approved' | 'rejected' | 'hidden' | 'removed';
  rejection_reason: string | null;
}

const formatMoney = (price: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(price)
  );

const MyListings: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.user_id;
  const [products, setProducts] = useState<MyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('products')
      .select('product_id, title, price, image_url, status, approval_status, rejection_reason, category:categories(name)')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      setLoadError('Could not load your listings. Check your connection and try again.');
    } else {
      setLoadError(null);
      setProducts(
        ((data as any[]) || []).map((p) => ({
          ...p,
          category_name: p.category?.name || '',
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

  // Runs one change, surfaces any database error, then refreshes the list.
  const runAction = async (id: number, action: () => PromiseLike<{ error: { message: string } | null }>, failMessage: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      const { error } = await action();
      if (error) throw new Error(error.message);
      await load();
    } catch (err) {
      setActionError(err instanceof Error && err.message ? `${failMessage} (${err.message})` : failMessage);
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkSold = (id: number) =>
    runAction(id, () => supabase.from('products').update({ status: 'sold' }).eq('product_id', id), 'Could not mark this item as sold.');

  const handleRelist = (id: number) =>
    runAction(id, () => supabase.from('products').update({ status: 'available' }).eq('product_id', id), 'Could not relist this item.');

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    setBusyId(id);
    setActionError(null);
    try {
      const { error } = await supabase.from('products').delete().eq('product_id', id);
      if (error) {
        // 23503 = foreign_key_violation: the item already has a transaction or messages attached
        const inUse = (error as { code?: string }).code === '23503';
        throw new Error(
          inUse
            ? 'This item has transactions or chats attached, so it cannot be deleted. Mark it as sold instead.'
            : error.message
        );
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete this listing.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="market-page-outer">
      <div className="market-page ss-medium">
        <header className="ss-page-header">
          <Link to="/market" className="ss-back-btn" aria-label="Back to market">
            <i className="ti ti-arrow-left" aria-hidden="true"></i>
          </Link>
          <h1>My listings</h1>
          <HeaderMenu />
        </header>

        <div className="my-listings-page">
          {actionError && <p className="auth-error" role="alert">{actionError}</p>}
          {loading ? (
            <p className="market-status">Loading your listings...</p>
          ) : loadError ? (
            <p className="market-status">{loadError}</p>
          ) : products.length === 0 ? (
            <p className="market-status">
              You haven't posted anything yet. <Link to="/market/new">Sell your first item</Link>
            </p>
          ) : (
            <div className="my-listings-list">
              {products.map((p) => (
                <div key={p.product_id} className="my-listing-row">
                  <div className="my-listing-image">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.title} />
                    ) : (
                      <i className={`ti ${categoryIcon(p.category_name)}`} aria-hidden="true"></i>
                    )}
                  </div>
                  <div className="my-listing-body">
                    <div className="my-listing-title">{p.title}</div>
                    <div className="my-listing-price">{formatMoney(p.price)}</div>
                    <span className={`my-listing-status my-listing-status-${p.status}`}>
                      {p.status === 'available' ? 'Available' : p.status === 'sold' ? 'Sold' : 'Removed'}
                    </span>
                    <span className={`admin-status-badge admin-status-${p.approval_status}`}>
                      {p.approval_status}
                    </span>
                    {p.approval_status === 'rejected' && p.rejection_reason && (
                      <div className="admin-rejection-reason">Reason: {p.rejection_reason}</div>
                    )}
                  </div>
                  <div className="my-listing-actions">
                    <Link to={`/market/edit/${p.product_id}`} className="market-btn-ghost">
                      Edit
                    </Link>
                    {p.status === 'available' && (
                      <button
                        className="market-btn-ghost"
                        disabled={busyId === p.product_id}
                        onClick={() => handleMarkSold(p.product_id)}
                      >
                        Mark sold
                      </button>
                    )}
                    {p.status === 'sold' && (
                      <button
                        className="market-btn-ghost"
                        disabled={busyId === p.product_id}
                        onClick={() => handleRelist(p.product_id)}
                      >
                        Relist
                      </button>
                    )}
                    <button
                      className="market-btn-ghost my-listing-delete"
                      disabled={busyId === p.product_id}
                      onClick={() => handleDelete(p.product_id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyListings;