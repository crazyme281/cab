import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import PhotoUploadField from '../../components/PhotoUploadField';
import { uploadProductImage } from '../../lib/uploadImage';
import HeaderMenu from '../../components/HeaderMenu';

interface Category {
  category_id: number;
  name: string;
}

interface Product {
  product_id: number;
  title: string;
  description: string | null;
  price: string;
  image_url: string | null;
  category_id: number;
  condition: string;
  seller_id: string;
}

const EditListing: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.user_id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notAllowed, setNotAllowed] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState('used_good');
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string>('approved');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active categories, plus the listing's current one even if it has since been disabled
  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => setCategories(((data as (Category & { is_active: boolean })[]) || [])));
  }, []);

  useEffect(() => {
    // Depend on the user's id, not the user object: the object is replaced on
    // every auth refresh, which used to reload the listing and wipe edits.
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('product_id', productId)
          .single();
        if (cancelled) return;
        if (error || !data) {
          setLoadError(error?.message || 'Failed to load listing');
          return;
        }
        const p = data as Product & { approval_status: string };
        if (p.seller_id !== userId) {
          setNotAllowed(true);
          return;
        }
        setApprovalStatus(p.approval_status);
        setTitle(p.title);
        setDescription(p.description || '');
        setPrice(String(p.price));
        setCategoryId(String(p.category_id));
        setCondition(p.condition);
        setExistingImageUrl(p.image_url);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [productId, userId]);

  const handlePhotoChange = (file: File | null, removedExisting: boolean) => {
    setImageFile(file);
    setImageRemoved(removedExisting);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || busy) return;
    if (!(Number(price) >= 0) || price.trim() === '') {
      setError('Enter a valid price');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // Only send image_url when the photo actually changed:
      // - a new file was picked -> upload it, send the new URL
      // - the existing photo was explicitly removed -> send null to clear it
      // - otherwise -> omit the field entirely so the current photo is kept
      const updates: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        price: Number(price),
        category_id: Number(categoryId),
        condition,
      };

      if (imageFile) {
        setUploadingImage(true);
        try {
          updates.image_url = await uploadProductImage(imageFile, user.user_id);
        } finally {
          setUploadingImage(false);
        }
      } else if (imageRemoved) {
        updates.image_url = null;
      }

      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('product_id', productId)
        .eq('seller_id', user.user_id);

      if (error) throw new Error(error.message);
      navigate(`/market/product/${productId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update listing');
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <header className="ss-page-header">
      <Link to="/market/mine" className="ss-back-btn" aria-label="Back to my listings">
        <i className="ti ti-arrow-left" aria-hidden="true"></i>
      </Link>
      <h1>Edit listing</h1>
      <HeaderMenu />
    </header>
  );

  if (loading) {
    return (
      <div className="market-page-outer">
        <div className="market-page ss-narrow">
          {header}
          <div className="create-listing-page">
            <p className="market-status">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (notAllowed || loadError) {
    return (
      <div className="market-page-outer">
        <div className="market-page ss-narrow">
          {header}
          <div className="create-listing-page">
            <p className="market-status">
              {notAllowed ? "You can only edit your own listings." : loadError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="market-page-outer">
      <div className="market-page ss-narrow">
        {header}

        <div className="create-listing-page">
          <form className="create-listing-form" onSubmit={handleSubmit}>
            <label className="auth-label" htmlFor="title">Title</label>
            <input
              id="title"
              className="auth-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <label className="auth-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              className="auth-input"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <label className="auth-label" htmlFor="price">Price (&#8358;)</label>
            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              className="auth-input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />

            <label className="auth-label" htmlFor="category">Category</label>
            <select
              id="category"
              className="auth-input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              {categories
                .filter((c) => (c as Category & { is_active?: boolean }).is_active !== false || String(c.category_id) === categoryId)
                .map((c) => (
                  <option key={c.category_id} value={c.category_id}>{c.name}</option>
                ))}
            </select>

            <label className="auth-label" htmlFor="condition">Condition</label>
            <select
              id="condition"
              className="auth-input"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              <option value="new">New</option>
              <option value="used_like_new">Used - Like New</option>
              <option value="used_good">Used - Good</option>
              <option value="used_fair">Used - Fair</option>
            </select>

            <PhotoUploadField existingImageUrl={existingImageUrl} onChange={handlePhotoChange} />

            {(approvalStatus === 'approved' || approvalStatus === 'rejected') && (
              <p className="auth-tagline">
                Significant changes may send this listing back to an admin for review.
              </p>
            )}

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button type="submit" className="auth-button" disabled={busy || !title.trim() || !price}>
              {uploadingImage ? 'Uploading photo...' : busy ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditListing;