/**
 * ProfileMenu - Avatar dropdown with profile actions.
 *
 * Props: none (reads from AuthContext)
 * Shows: avatar, name, dropdown with Profile, Settings, Logout, Delete Account
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiSettings, FiLogOut, FiTrash2, FiChevronDown, FiInfo } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import './ProfileMenu.css';

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="pm" ref={ref}>
      <button className="pm-trigger" onClick={() => setOpen(!open)} aria-label="Profile menu" aria-expanded={open}>
        <div className="pm-avatar">{initials}</div>
        <span className="pm-name">{user?.full_name || 'User'}</span>
        <FiChevronDown size={14} className={`pm-chevron ${open ? 'pm-chevron-open' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="pm-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="pm-header">
              <div className="pm-avatar-lg">{initials}</div>
              <div>
                <div className="pm-user-name">{user?.full_name || 'User'}</div>
                <div className="pm-user-email">{user?.email || ''}</div>
              </div>
            </div>
            <div className="pm-divider" />
            <Link to="/profile" className="pm-item" onClick={() => setOpen(false)}>
              <FiUser size={16} /> My Profile
            </Link>
            <Link to="/settings" className="pm-item" onClick={() => setOpen(false)}>
              <FiSettings size={16} /> Settings
            </Link>
            <Link to="/about" className="pm-item" onClick={() => setOpen(false)}>
              <FiInfo size={16} /> About
            </Link>
            <div className="pm-divider" />
            <button className="pm-item pm-logout" onClick={() => { setOpen(false); logout(); }}>
              <FiLogOut size={16} /> Logout
            </button>
            <div className="pm-divider" />
            <Link to="/delete-account" className="pm-item pm-danger" onClick={() => setOpen(false)}>
              <FiTrash2 size={16} /> Delete Account
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
