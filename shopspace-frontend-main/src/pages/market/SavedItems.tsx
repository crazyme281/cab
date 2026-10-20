import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { categoryIcon } from '../../lib/categoryIcon';
import HeaderMenu from '../../components/HeaderMenu';

interface SavedProduct {
  favorite_id: number;
  product_id: number;
  title: string;
  price: string;
  image_url: string | null;
  condition: string;
  status: 'available' | 'sold' | 'removed';
  category_name: string;
  seller_name: string;
}

const formatMoney = (price: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(price)
  );

const SavedItems: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.user_id;
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_favorites');
      if (error) {
        setLoadError('Could not load your saved items. Check your connection and try again.');
      } else {
        setLoadError(null);
        setItems((data as SavedProduct[]) || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleRemove = async (e: React.MouseEvent, productId: number) => {
    e.stopPropagation();
    if (!user) return;
    setRemovingId(productId);
    setRemoveError(null);
    try {
      const { error } = await supabase.from('favorites').delete().eq('user_id', user.user_id).eq('product_id', productId);
      if (error) throw new Error(error.message);
      setItems((prev) => prev.filter((i) => i.product_id !== productId));
    } catch {
      setRemoveError('Could not remove that item. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="market-page-outer">
      <div className="market-page ss-medium">
        <header className="ss-page-header">
          <Link to="/market" className="ss-back-btn" aria-label="Back to market">
            <i className="ti ti-arrow-left" aria-hidden="true"></i>
          </Link>
          <h1>Saved items</h1>
          <HeaderMenu />
        </header>

        <div className="my-listings-page">
          {removeError && <p className="auth-error" role="alert">{removeError}</p>}
          {loading ? (
            <p className="market-status">Loading your saved items...</p>
          ) : loadError ? (
            <p className="market-status">{loadError}</p>
          ) : items.length === 0 ? (
            <p className="market-status">
              Nothing saved yet. <Link to="/market">Browse the marketplace</Link>
            </p>
          ) : (
            <div className="market-grid">
              {items.map((p) => (
                <div
                  key={p.favorite_id}
                  className="market-card"
                  onClick={() => navigate(`/market/product/${p.product_id}`)}
                >
                  <div className="market-card-image">
                    <span className="market-card-tag">{p.category_name}</span>
                    <button
                      type="button"
                      className="market-card-save-btn saved"
                      aria-label="Remove from saved"
                      disabled={removingId === p.product_id}
                      onClick={(e) => handleRemove(e, p.product_id)}
                    >
                      <i className="ti ti-heart-filled" aria-hidden="true"></i>
                    </button>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.title} />
                    ) : (
                      <div className="market-card-placeholder">
                        <i className={`ti ${categoryIcon(p.category_name)}`} aria-hidden="true"></i>
                      </div>
                    )}
                    {p.status === 'sold' && <span className="my-listing-status my-listing-status-sold saved-item-sold-badge">Sold</span>}
                  </div>
                  <div className="market-card-body">
                    <div className="market-card-title">{p.title}</div>
                    <div className="market-card-price">{formatMoney(p.price)}</div>
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

export default SavedItems;