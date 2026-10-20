import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface AdminProduct {
  product_id: number;
  title: string;
  price: string;
  status: string;
  approval_status: 'pending' | 'approved' | 'rejected' | 'hidden' | 'removed';
  rejection_reason: string | null;
  featured: boolean;
  view_count: number;
  image_url: string | null;
  category_name: string;
  seller_name: string;
  seller_email: string;
  created_at: string;
}

const formatMoney = (price: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(price)
  );

const APPROVAL_FILTERS = ['pending', 'approved', 'rejected', 'hidden', 'removed'] as const;

const ListingsTab: React.FC = () => {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [search, setSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_search_products', {
        search: search || null,
        approval_filter: approvalFilter || null,
      });
      if (error) {
        setLoadError(error.message);
      } else {
        setLoadError(null);
        setProducts((data as AdminProduct[]) || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [approvalFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const runAction = async (id: number, action: () => Promise<{ error: any }>) => {
    setBusyId(id);
    try {
      const { error } = await action();
      if (error) throw new Error(error.message);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const approve = (id: number) =>
    runAction(id, async () => supabase.rpc('admin_set_product_approval', { p_product_id: id, p_approval_status: 'approved' }));

  const hide = (id: number) =>
    runAction(id, async () => supabase.rpc('admin_set_product_approval', { p_product_id: id, p_approval_status: 'hidden' }));

  const restore = (id: number) =>
    runAction(id, async () => supabase.rpc('admin_set_product_approval', { p_product_id: id, p_approval_status: 'approved' }));

  const remove = (id: number) => {
    if (!confirm('Remove this listing? The seller will see it was removed.')) return;
    const reason = prompt('Reason for removal (shown to seller):') || '';
    runAction(id, async () => supabase.rpc('admin_set_product_approval', { p_product_id: id, p_approval_status: 'removed', p_reason: reason }));
  };

  const openReject = (id: number) => {
    setRejectingId(id);
    setRejectReason('');
  };

  const submitReject = async () => {
    if (rejectingId === null || !rejectReason.trim()) return;
    await runAction(rejectingId, async () =>
      supabase.rpc('admin_set_product_approval', {
        p_product_id: rejectingId,
        p_approval_status: 'rejected',
        p_reason: rejectReason.trim(),
      })
    );
    setRejectingId(null);
  };

  const toggleFeatured = (id: number, featured: boolean) =>
    runAction(id, async () => supabase.rpc('admin_set_product_featured', { p_product_id: id, p_featured: !featured }));

  // Search is applied server-side by load()
  const filtered = products;

  if (loading && products.length === 0) return <p className="market-status">Loading listings...</p>;

  return (
    <div className="admin-section">
      <form className="admin-search-bar" onSubmit={handleSearchSubmit}>
        <i className="ti ti-search" aria-hidden="true"></i>
        <input
          className="admin-search-input"
          placeholder="Search by title or seller name, press Enter"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>

      <div className="admin-filter-row">
        <button
          className={`admin-tab admin-tab-small ${approvalFilter === '' ? 'admin-tab-active' : ''}`}
          onClick={() => setApprovalFilter('')}
        >
          All
        </button>
        {APPROVAL_FILTERS.map((f) => (
          <button
            key={f}
            className={`admin-tab admin-tab-small ${approvalFilter === f ? 'admin-tab-active' : ''}`}
            onClick={() => setApprovalFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loadError && <p className="auth-error" role="alert">{loadError}</p>}
      {filtered.length === 0 ? (
        <p className="market-status">No listings found.</p>
      ) : (
        <div className="admin-list">
          {filtered.map((p) => (
            <div key={p.product_id} className="admin-product-row-wrap">
              <div className="admin-product-row">
                <div className="admin-product-image">
                  {p.image_url ? <img src={p.image_url} alt={p.title} /> : <i className="ti ti-photo" aria-hidden="true"></i>}
                </div>
                <div className="admin-row-body">
                  <div className="admin-row-title">
                    {p.title} {p.featured && <span className="admin-featured-tag">Featured</span>}
                  </div>
                  <div className="admin-row-meta">
                    by {p.seller_name} &middot; {formatMoney(p.price)} &middot; {p.view_count} views
                  </div>
                  <span className={`admin-status-badge admin-status-${p.approval_status}`}>{p.approval_status}</span>
                  {p.approval_status === 'rejected' && p.rejection_reason && (
                    <div className="admin-rejection-reason">Reason: {p.rejection_reason}</div>
                  )}
                </div>
              </div>

              <div className="admin-row-actions admin-row-actions-wrap">
                {p.approval_status === 'pending' && (
                  <>
                    <button className="admin-action-btn admin-action-positive" disabled={busyId === p.product_id} onClick={() => approve(p.product_id)}>
                      Approve
                    </button>
                    <button className="admin-action-btn admin-action-danger" disabled={busyId === p.product_id} onClick={() => openReject(p.product_id)}>
                      Reject
                    </button>
                  </>
                )}
                {p.approval_status === 'approved' && (
                  <button className="admin-action-btn" disabled={busyId === p.product_id} onClick={() => hide(p.product_id)}>
                    Hide
                  </button>
                )}
                {(p.approval_status === 'hidden' || p.approval_status === 'rejected') && (
                  <button className="admin-action-btn admin-action-positive" disabled={busyId === p.product_id} onClick={() => restore(p.product_id)}>
                    Restore
                  </button>
                )}
                {p.approval_status !== 'removed' && (
                  <button className="admin-action-btn admin-action-danger" disabled={busyId === p.product_id} onClick={() => remove(p.product_id)}>
                    Remove
                  </button>
                )}
                <button className="admin-action-btn" disabled={busyId === p.product_id} onClick={() => toggleFeatured(p.product_id, p.featured)}>
                  {p.featured ? 'Unfeature' : 'Feature'}
                </button>
              </div>

              {rejectingId === p.product_id && (
                <div className="admin-inline-form">
                  <input
                    className="auth-input"
                    placeholder="Reason for rejection (shown to seller)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    autoFocus
                  />
                  <button className="market-btn-primary" disabled={!rejectReason.trim()} onClick={submitReject}>
                    Confirm reject
                  </button>
                  <button className="market-btn-ghost" onClick={() => setRejectingId(null)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ListingsTab;