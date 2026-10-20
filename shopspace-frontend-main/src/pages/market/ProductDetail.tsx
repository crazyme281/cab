import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { categoryIcon } from '../../lib/categoryIcon';
import ReportModal from '../../components/ReportModal';
import HeaderMenu from '../../components/HeaderMenu';

interface Product {
  product_id: number;
  title: string;
  description: string | null;
  price: string;
  image_url: string | null;
  category_name: string;
  condition: string;
  status: 'available' | 'sold' | 'removed';
  approval_status: 'pending' | 'approved' | 'rejected' | 'hidden' | 'removed';
  rejection_reason: string | null;
  seller_id: string;
  seller_name: string;
}

const formatMoney = (price: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(price)
  );

const conditionLabels: Record<string, string> = {
  new: 'New',
  used_like_new: 'Used - Like New',
  used_good: 'Used - Good',
  used_fair: 'Used - Fair',
};

const ProductDetail: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingTransaction, setStartingTransaction] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const userId = user?.user_id;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Moving from one product to another reuses this component, so start clean
      setLoading(true);
      setError(null);
      setTransactionError(null);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*, category:categories(name), seller:users!products_seller_id_fkey(full_name)')
          .eq('product_id', productId)
          .single();
        if (cancelled) return;
        if (error || !data) {
          setProduct(null);
          setError(error?.message || 'Product not found');
          return;
        }
        const p: any = data;
        setProduct({
          ...p,
          category_name: p.category?.name || '',
          seller_name: p.seller?.full_name || '',
        });
        if (userId !== p.seller_id) {
          supabase.rpc('increment_product_view', { p_product_id: p.product_id }).then(() => undefined);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [productId, userId]);

  useEffect(() => {
    if (!userId || !productId) return;
    supabase
      .from('favorites')
      .select('favorite_id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle()
      .then(({ data }) => setIsSaved(!!data));
  }, [userId, productId]);

  const toggleSave = async () => {
    if (!user || !product || savingFavorite) return;
    setSavingFavorite(true);
    setSaveError(null);
    try {
      if (isSaved) {
        const { error } = await supabase.from('favorites').delete().eq('user_id', user.user_id).eq('product_id', product.product_id);
        if (error) throw new Error(error.message);
        setIsSaved(false);
      } else {
        const { error } = await supabase.from('favorites').insert({ user_id: user.user_id, product_id: product.product_id });
        if (error) throw new Error(error.message);
        setIsSaved(true);
      }
    } catch {
      setSaveError('Could not update your saved items. Please try again.');
    } finally {
      setSavingFavorite(false);
    }
  };

  const isOwnListing = user && product && user.user_id === product.seller_id;

  const handleMessageSeller = () => {
    navigate(`/chat/${product?.seller_id}?product=${product?.product_id}`);
  };

  const handleMarkPurchased = async () => {
    if (!product || !user) return;
    setTransactionError(null);
    setStartingTransaction(true);
    try {
      // Tapping twice (or coming back later) shouldn't open a second pending
      // transaction for the same item — send them to the one that exists.
      const { data: existing } = await supabase
        .from('transactions')
        .select('transaction_id')
        .eq('product_id', product.product_id)
        .eq('buyer_id', user.user_id)
        .eq('status', 'pending')
        .limit(1);
      if (existing && existing.length > 0) {
        navigate('/transactions');
        return;
      }

      const { error } = await supabase.from('transactions').insert({
        product_id: product.product_id,
        buyer_id: user.user_id,
        seller_id: product.seller_id,
        agreed_price: product.price,
        status: 'pending',
      });
      if (error) throw new Error(error.message);
      navigate('/transactions');
    } catch (err) {
      setTransactionError(err instanceof Error ? err.message : 'Failed to start transaction');
    } finally {
      setStartingTransaction(false);
    }
  };

  const header = (
    <header className="ss-page-header">
      <Link to="/market" className="ss-back-btn" aria-label="Back to market">
        <i className="ti ti-arrow-left" aria-hidden="true"></i>
      </Link>
      <h1>Item details</h1>
      <HeaderMenu />
    </header>
  );

  if (loading) {
    return (
      <div className="market-page-outer">
        <div className="market-page ss-medium">
          {header}
          <div className="product-detail-page">
            <div className="market-status">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    const missing = !error || error.toLowerCase().includes('0 rows') || error.toLowerCase().includes('not found');
    return (
      <div className="market-page-outer">
        <div className="market-page ss-medium">
          {header}
          <div className="product-detail-page">
            <div className="market-status">
              {missing ? 'Product not found.' : 'Could not load this item. Check your connection and try again.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="market-page-outer">
      <div className="market-page ss-medium">
        {header}

        <div className="product-detail-page">
          <div className="product-detail-image">
            {product.image_url ? (
              <img src={product.image_url} alt={product.title} />
            ) : (
              <div className="market-card-placeholder">
                <i className={`ti ${categoryIcon(product.category_name)}`} aria-hidden="true"></i>
              </div>
            )}
          </div>

          <div className="product-detail-body">
            <h1>{product.title}</h1>
            <div className="product-detail-price">{formatMoney(product.price)}</div>
            <div className="product-detail-meta">
              <span>{product.category_name}</span>
              <span>&middot;</span>
              <span>{conditionLabels[product.condition] || product.condition}</span>
            </div>

            <p className="product-detail-description">
              {product.description || 'No description provided.'}
            </p>

            <div className="product-detail-seller">
              Sold by <strong>{product.seller_name}</strong>
            </div>

            {!isOwnListing && product.status === 'available' && (
              <div className="product-detail-cta-group">
                <button className="market-btn-primary product-detail-cta" onClick={handleMessageSeller}>
                  Message Seller
                </button>
                <button
                  className="market-btn-ghost product-detail-cta"
                  disabled={startingTransaction}
                  onClick={handleMarkPurchased}
                >
                  {startingTransaction ? 'Starting...' : "I've bought this"}
                </button>
                <button
                  type="button"
                  className={`market-btn-ghost product-detail-cta product-detail-save-btn ${isSaved ? 'saved' : ''}`}
                  disabled={savingFavorite}
                  onClick={toggleSave}
                >
                  <i className={`ti ${isSaved ? 'ti-heart-filled' : 'ti-heart'}`} aria-hidden="true"></i>
                  {isSaved ? 'Saved' : 'Save'}
                </button>
                {saveError && <p className="auth-error" role="alert">{saveError}</p>}
                {transactionError && <p className="auth-error" role="alert">{transactionError}</p>}
                <button type="button" className="admin-report-link" onClick={() => setShowReport(true)}>
                  Report this listing
                </button>
              </div>
            )}
            {!isOwnListing && product.status === 'sold' && (
              <p className="product-detail-own-note">This item has already been sold.</p>
            )}
            {isOwnListing && (
              <div className="product-detail-cta-group">
                <Link to={`/market/edit/${product.product_id}`} className="market-btn-primary product-detail-cta">
                  Edit Listing
                </Link>
                <span className={`admin-status-badge admin-status-${product.approval_status}`}>
                  {product.approval_status}
                </span>
                {product.approval_status === 'rejected' && product.rejection_reason && (
                  <p className="admin-rejection-reason">Reason: {product.rejection_reason}</p>
                )}
                {product.approval_status === 'pending' && (
                  <p className="product-detail-own-note">
                    This listing is awaiting admin approval before it appears in the marketplace.
                  </p>
                )}
              </div>
            )}

            {showReport && (
              <ReportModal reportedProductId={product.product_id} onClose={() => setShowReport(false)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;