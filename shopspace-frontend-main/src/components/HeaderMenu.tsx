import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * The hamburger button + floating dropdown nav (Chats/Saved/Transactions/
 * Profile/Admin/Sell/Log out). Shared by every page header (both the
 * market-header on MarketHome and the ss-page-header used everywhere else)
 * so the same menu is reachable from anywhere in the app.
 *
 * Renders as a fragment — the toggle button, backdrop, and dropdown panel
 * are positioned absolutely relative to whichever header wraps this
 * component, so that header must have `position: relative`.
 */
const HeaderMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Let keyboard users dismiss the open menu with Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        className="market-menu-toggle"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        )}
      </button>

      {open && <div className="market-menu-backdrop" onClick={close}></div>}

      <div className={`market-header-actions ${open ? 'open' : ''}`}>
        <span className="market-user">Hi, {user?.full_name?.split(' ')[0]}</span>
        <Link to="/chats" className="market-btn-ghost" onClick={close}>Chats</Link>
        <Link to="/market/saved" className="market-btn-ghost" onClick={close}>Saved</Link>
        <Link to="/transactions" className="market-btn-ghost" onClick={close}>Transactions</Link>
        <Link to="/profile" className="market-btn-ghost" onClick={close}>Profile</Link>
        {user?.role === 'admin' && (
          <Link to="/admin" className="market-btn-ghost" onClick={close}>Admin</Link>
        )}
        <Link to="/market/new" className="market-btn-primary" onClick={close}>+ Sell an item</Link>
        <button className="market-btn-ghost" onClick={() => { close(); logout(); }}>Log out</button>
      </div>
    </>
  );
};

export default HeaderMenu;