import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import PhotoUploadField from '../../components/PhotoUploadField';
import { uploadProductImage } from '../../lib/uploadImage';
import HeaderMenu from '../../components/HeaderMenu';

interface Category {
  category_id: number;
  name: string;
}

const CreateListing: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState('used_good');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then(({ data }) => {
        const cats = (data as Category[]) || [];
        setCategories(cats);
        if (cats.length > 0) setCategoryId(String(cats[0].category_id));
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || busy) return;
    if (!categoryId) {
      setError('Please choose a category');
      return;
    }
    if (!(Number(price) >= 0) || price.trim() === '') {
      setError('Enter a valid price');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let imageUrl: string | undefined;

      if (imageFile) {
        setUploadingImage(true);
        try {
          imageUrl = await uploadProductImage(imageFile, user.user_id);
        } finally {
          setUploadingImage(false);
        }
      }

      const { data, error } = await supabase
        .from('products')
        .insert({
          seller_id: user.user_id,
          title: title.trim(),
          description: description.trim() || null,
          price: Number(price),
          category_id: Number(categoryId),
          condition,
          image_url: imageUrl || null,
        })
        .select('product_id')
        .single();

      if (error) throw new Error(error.message);
      // New listings wait for admin approval; the detail page explains that
      navigate(`/market/product/${data.product_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create listing');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="market-page-outer">
      <div className="market-page ss-narrow">
        <header className="ss-page-header">
          <Link to="/market" className="ss-back-btn" aria-label="Back to market">
            <i className="ti ti-arrow-left" aria-hidden="true"></i>
          </Link>
          <h1>Sell an item</h1>
          <HeaderMenu />
        </header>

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
              {categories.map((c) => (
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

            <PhotoUploadField onChange={(file) => setImageFile(file)} />

            <p className="auth-tagline">New listings are reviewed by an admin before they appear in the marketplace.</p>

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button type="submit" className="auth-button" disabled={busy || !title.trim() || !price || !categoryId}>
              {uploadingImage ? 'Uploading photo...' : busy ? 'Posting...' : 'Post Listing'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateListing;