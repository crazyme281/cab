import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface University {
  university_id: number;
  name: string;
}

interface PickupLocation {
  pickup_location_id: number;
  name: string;
  campus_id: number;
}

interface Campus {
  campus_id: number;
  name: string;
  university_id: number;
}

const CampusTab: React.FC = () => {
  const [universities, setUniversities] = useState<University[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const [newUniversity, setNewUniversity] = useState('');
  const [newCampusName, setNewCampusName] = useState('');
  const [newCampusUniversity, setNewCampusUniversity] = useState('');
  const [newPickupName, setNewPickupName] = useState('');
  const [newPickupCampus, setNewPickupCampus] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      supabase.from('universities').select('*').order('name'),
      supabase.from('campuses').select('*').order('name'),
      supabase.from('pickup_locations').select('*').order('name'),
    ]).then(([u, c, p]) => {
      setUniversities((u.data as University[]) || []);
      setCampuses((c.data as Campus[]) || []);
      setPickupLocations((p.data as PickupLocation[]) || []);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const addUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniversity.trim()) return;
    const { error } = await supabase.from('universities').insert({ name: newUniversity.trim() });
    if (error) return alert(error.message);
    setNewUniversity('');
    load();
  };

  const addCampus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampusName.trim() || !newCampusUniversity) return;
    const { error } = await supabase
      .from('campuses')
      .insert({ name: newCampusName.trim(), university_id: Number(newCampusUniversity) });
    if (error) return alert(error.message);
    setNewCampusName('');
    load();
  };

  const addPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPickupName.trim() || !newPickupCampus) return;
    const { error } = await supabase
      .from('pickup_locations')
      .insert({ name: newPickupName.trim(), campus_id: Number(newPickupCampus) });
    if (error) return alert(error.message);
    setNewPickupName('');
    load();
  };

  const deleteRow = async (table: string, idField: string, id: number) => {
    if (!confirm('Delete this?')) return;
    const { error } = await supabase.from(table).delete().eq(idField, id);
    if (error) return alert(error.message);
    load();
  };

  if (loading) return <p className="market-status">Loading campus data...</p>;

  return (
    <div className="admin-section">
      <div className="admin-detail-block">
        <div className="admin-detail-label">Universities</div>
        {universities.map((u) => (
          <div key={u.university_id} className="admin-category-row">
            <span className="admin-row-title">{u.name}</span>
            <button className="admin-action-btn admin-action-danger" onClick={() => deleteRow('universities', 'university_id', u.university_id)}>
              Delete
            </button>
          </div>
        ))}
        <form className="admin-inline-form" onSubmit={addUniversity}>
          <input className="auth-input" placeholder="University name" value={newUniversity} onChange={(e) => setNewUniversity(e.target.value)} />
          <button type="submit" className="market-btn-primary">Add</button>
        </form>
      </div>

      <div className="admin-detail-block">
        <div className="admin-detail-label">Campuses</div>
        {campuses.map((c) => (
          <div key={c.campus_id} className="admin-category-row">
            <span className="admin-row-title">
              {c.name} <span className="admin-row-meta">({universities.find((u) => u.university_id === c.university_id)?.name})</span>
            </span>
            <button className="admin-action-btn admin-action-danger" onClick={() => deleteRow('campuses', 'campus_id', c.campus_id)}>
              Delete
            </button>
          </div>
        ))}
        <form className="admin-inline-form" onSubmit={addCampus}>
          <select className="auth-input" value={newCampusUniversity} onChange={(e) => setNewCampusUniversity(e.target.value)}>
            <option value="">Select university</option>
            {universities.map((u) => (
              <option key={u.university_id} value={u.university_id}>{u.name}</option>
            ))}
          </select>
          <input className="auth-input" placeholder="Campus name" value={newCampusName} onChange={(e) => setNewCampusName(e.target.value)} />
          <button type="submit" className="market-btn-primary">Add</button>
        </form>
      </div>

      <div className="admin-detail-block">
        <div className="admin-detail-label">Pickup locations</div>
        {pickupLocations.map((p) => (
          <div key={p.pickup_location_id} className="admin-category-row">
            <span className="admin-row-title">
              {p.name} <span className="admin-row-meta">({campuses.find((c) => c.campus_id === p.campus_id)?.name})</span>
            </span>
            <button className="admin-action-btn admin-action-danger" onClick={() => deleteRow('pickup_locations', 'pickup_location_id', p.pickup_location_id)}>
              Delete
            </button>
          </div>
        ))}
        <form className="admin-inline-form" onSubmit={addPickup}>
          <select className="auth-input" value={newPickupCampus} onChange={(e) => setNewPickupCampus(e.target.value)}>
            <option value="">Select campus</option>
            {campuses.map((c) => (
              <option key={c.campus_id} value={c.campus_id}>{c.name}</option>
            ))}
          </select>
          <input className="auth-input" placeholder="Pickup location name" value={newPickupName} onChange={(e) => setNewPickupName(e.target.value)} />
          <button type="submit" className="market-btn-primary">Add</button>
        </form>
      </div>

      <p className="admin-hint">
        Faculties and departments have database tables ready but no dedicated screen yet — ask if you want that added.
      </p>
    </div>
  );
};

export default CampusTab;
