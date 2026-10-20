import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { categoryIcon } from '../../lib/categoryIcon';
import cabLogo from '../../assets/cab-logo.png';
import HeaderMenu from '../../components/HeaderMenu';

interface Product {
  product_id: number;
  title: string;
  price: string;
  image_url: string | null;
  category_name: string;
  condition: string;
}

interface Category {
  category_id: number;
  name: string;
}

interface Announcement {
  announcement_id: number;
  title: string;
  body: string;
}

const DISMISSED_KEY = 'cab_dismissed_announcement';

const formatMoney = (price: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(price)
  );

const readDismissed = (): number | null => {
  try {
    const v = localStorage.getItem(DISMISSED_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};

const MarketHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.user_id;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  // Wait for a pause in typing before hitting the database
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Disabled categories (admin switched them off) shouldn't be browsable
  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then(({ data }) => setCategories((data as Category[]) || []));
  }, []);

  // Latest admin announcement addressed to everyone
  useEffect(() => {
    supabase
      .from('announcements')
      .select('announcement_id, title, body')
      .eq('target_type', 'all')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const latest = ((data as Announcement[]) || [])[0];
        if (latest && latest.announcement_id !== readDismissed()) setAnnouncement(latest);
      });
  }, []);

  const dismissAnnouncement = () => {
    if (announcement) {
      try {
        localStorage.setItem(DISMISSED_KEY, String(announcement.announcement_id));
      } catch {
        /* storage unavailable — it will simply reappear next visit */
      }
    }
    setAnnouncement(null);
  };

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('favorites')
      .select('product_id')
      .eq('user_id', userId)
      .then(({ data }) => {
        setSavedIds(new Set(((data as { product_id: number }[]) || []).map((f) => f.product_id)));
      });
  }, [userId]);

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 3500);
  };

  const toggleSave = async (e: React.MouseEvent, productId: number) => {
    e.stopPropagation();
    if (!userId || savingId === productId) return;
    setSavingId(productId);
    const alreadySaved = savedIds.has(productId);
    try {
      if (alreadySaved) {
        const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('product_id', productId);
        if (error) throw new Error(error.message);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      } else {
        const { error } = await supabase.from('favorites').insert({ user_id: userId, product_id: productId });
        if (error) throw new Error(error.message);
        setSavedIds((prev) => new Set(prev).add(productId));
      }
    } catch {
      showNotice('Could not update your saved items. Please try again.');
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    // `cancelled` stops a slow, older search from overwriting a newer one
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    // Sellers can always read their own listings (pending/rejected too), so the
    // public feed must ask for approved ones explicitly. Featured items first.
    let query = supabase
      .from('products')
      .select('product_id, title, price, image_url, condition, category:categories(name)')
      .eq('status', 'available')
      .eq('approval_status', 'approved')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (debouncedSearch) {
      // Characters that have meaning inside a PostgREST `or(...)` filter would
      // break the query (or let a search term change it), so strip them.
      const term = debouncedSearch.replace(/[%,()*\\]/g, ' ').trim();
      if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }
    if (categoryId) query = query.eq('category_id', categoryId);

    query.then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setLoadError('Could not load listings. Check your connection and try again.');
        setProducts([]);
      } else {
        const rows = ((data as any[]) || []).map((p) => ({
          ...p,
          category_name: p.category?.name || '',
        }));
        setProducts(rows);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, categoryId]);

  const handleCategoryIconClick = (id: string) => {
    // Clicking the already-selected category clears the filter (acts as a toggle)
    setCategoryId((current) => (current === id ? '' : id));
  };

  return (
    <div className="market-page-outer">
      <div className="market-page">
        <header className="market-header">
          <div className="market-header-top">
            <h1 className="market-header-brand">
              <img src={cabLogo} alt="Cab" className="brand-logo" />
            </h1>
            <HeaderMenu />
          </div>

          <div className="market-hero">
            <h2>{user?.full_name ? `Hi ${user.full_name.split(' ')[0]}, what are you looking for?` : 'What are you looking for?'}</h2>
            <div className="market-search-bar">
              <i className="ti ti-search market-search-icon" aria-hidden="true"></i>
              <input
                type="search"
                placeholder="Search for textbooks, electronics..."
                aria-label="Search listings"
                className="market-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </header>

        {announcement && (
          <div className="market-announcement" role="status">
            <div className="market-announcement-text">
              <strong>{announcement.title}</strong>
              <span>{announcement.body}</span>
            </div>
            <button
              type="button"
              className="market-announcement-close"
              aria-label="Dismiss announcement"
              onClick={dismissAnnouncement}
            >
              <i className="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>
        )}

        <div className="market-category-row">
          <button
            className={`market-category-icon ${categoryId === '' ? 'active' : ''}`}
            onClick={() => setCategoryId('')}
          >
            <span className="market-category-icon-circle">
              <i className="ti ti-apps" aria-hidden="true"></i>
            </span>
            <span className="market-category-icon-label">All</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.category_id}
              className={`market-category-icon ${categoryId === String(c.category_id) ? 'active' : ''}`}
              onClick={() => handleCategoryIconClick(String(c.category_id))}
            >
              <span className="market-category-icon-circle">
                <i className={`ti ${categoryIcon(c.name)}`} aria-hidden="true"></i>
              </span>
              <span className="market-category-icon-label">{c.name}</span>
            </button>
          ))}
        </div>

        <div className="market-filters">
          <select
            className="market-category-select"
            aria-label="Filter by category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>{c.name}</option>
            ))}
          </select>
        </div>

        {notice && <p className="auth-error market-notice" role="alert">{notice}</p>}

        {loading ? (
          <p className="market-status">Loading listings...</p>
        ) : loadError ? (
          <p className="market-status">{loadError}</p>
        ) : products.length === 0 ? (
          <p className="market-status">No products found. Try a different search.</p>
        ) : (
          <>
          <div className="market-section-head">
            <h2>{debouncedSearch ? `Results for \u201c${debouncedSearch}\u201d` : 'Latest listings'}</h2>
            <span>{products.length} {products.length === 1 ? 'item' : 'items'}</span>
          </div>
          <div className="market-grid">
            {products.map((p) => (
              <div
                key={p.product_id}
                className="market-card"
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/market/product/${p.product_id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/market/product/${p.product_id}`);
                }}
              >
                <div className="market-card-image">
                  <span className="market-card-tag">{p.category_name}</span>
                  <button
                    type="button"
                    className={`market-card-save-btn ${savedIds.has(p.product_id) ? 'saved' : ''}`}
                    aria-label={savedIds.has(p.product_id) ? 'Remove from saved' : 'Save item'}
                    onClick={(e) => toggleSave(e, p.product_id)}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <i className={`ti ${savedIds.has(p.product_id) ? 'ti-heart-filled' : 'ti-heart'}`} aria-hidden="true"></i>
                  </button>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} loading="lazy" />
                  ) : (
                    <div className="market-card-placeholder">
                      <i className={`ti ${categoryIcon(p.category_name)}`} aria-hidden="true"></i>
                    </div>
                  )}
                </div>
                <div className="market-card-body">
                  <div className="market-card-title">{p.title}</div>
                  <div className="market-card-price">{formatMoney(p.price)}</div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MarketHome;
