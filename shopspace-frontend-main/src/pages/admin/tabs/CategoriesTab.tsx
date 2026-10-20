import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface Category {
  category_id: number;
  name: string;
  parent_category_id: number | null;
  is_active: boolean;
}

const CategoriesTab: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('parent_category_id', { ascending: true, nullsFirst: true })
        .order('name', { ascending: true });
      setCategories((data as Category[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const topLevel = categories.filter((c) => !c.parent_category_id);
  const childrenOf = (id: number) => categories.filter((c) => c.parent_category_id === id);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const { error } = await supabase.from('categories').insert({
      name: newName.trim(),
      parent_category_id: newParentId ? Number(newParentId) : null,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setNewName('');
    setNewParentId('');
    load();
  };

  const handleToggleActive = async (c: Category) => {
    setBusyId(c.category_id);
    try {
      await supabase.from('categories').update({ is_active: !c.is_active }).eq('category_id', c.category_id);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const startRename = (c: Category) => {
    setRenamingId(c.category_id);
    setRenameValue(c.name);
  };

  const submitRename = async (id: number) => {
    if (!renameValue.trim()) return;
    setBusyId(id);
    try {
      const { error } = await supabase.from('categories').update({ name: renameValue.trim() }).eq('category_id', id);
      if (error) throw new Error(error.message);
      setRenamingId(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to rename');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (c: Category) => {
    if (!confirm(`Delete "${c.name}"? Products in this category are NOT deleted, but will need reassigning.`)) return;
    setBusyId(c.category_id);
    try {
      const { error } = await supabase.from('categories').delete().eq('category_id', c.category_id);
      if (error) throw new Error(error.message);
      load();
    } catch (err) {
      alert(
        err instanceof Error
          ? `${err.message} — reassign or remove its products/subcategories first.`
          : 'Failed to delete'
      );
    } finally {
      setBusyId(null);
    }
  };

  const renderRow = (c: Category, indent: boolean) => (
    <div key={c.category_id} className={`admin-category-row ${indent ? 'admin-category-row-child' : ''}`}>
      {renamingId === c.category_id ? (
        <input
          className="auth-input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          autoFocus
        />
      ) : (
        <span className="admin-row-title">{c.name}</span>
      )}
      <span className={`admin-status-badge admin-status-${c.is_active ? 'active' : 'suspended'}`}>
        {c.is_active ? 'Active' : 'Disabled'}
      </span>
      <div className="admin-row-actions">
        {renamingId === c.category_id ? (
          <>
            <button className="admin-action-btn admin-action-positive" disabled={busyId === c.category_id} onClick={() => submitRename(c.category_id)}>
              Save
            </button>
            <button className="admin-action-btn" onClick={() => setRenamingId(null)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="admin-action-btn" onClick={() => startRename(c)}>Rename</button>
            <button className="admin-action-btn" disabled={busyId === c.category_id} onClick={() => handleToggleActive(c)}>
              {c.is_active ? 'Disable' : 'Enable'}
            </button>
            <button className="admin-action-btn admin-action-danger" disabled={busyId === c.category_id} onClick={() => handleDelete(c)}>
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (loading) return <p className="market-status">Loading categories...</p>;

  return (
    <div className="admin-section">
      <form className="admin-inline-form" onSubmit={handleCreate}>
        <input
          className="auth-input"
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <select className="auth-input" value={newParentId} onChange={(e) => setNewParentId(e.target.value)}>
          <option value="">Top-level category</option>
          {topLevel.map((c) => (
            <option key={c.category_id} value={c.category_id}>
              Subcategory of {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="market-btn-primary" disabled={!newName.trim()}>
          Add
        </button>
      </form>

      <div className="admin-list">
        {topLevel.map((c) => (
          <div key={c.category_id}>
            {renderRow(c, false)}
            {childrenOf(c.category_id).map((child) => renderRow(child, true))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoriesTab;