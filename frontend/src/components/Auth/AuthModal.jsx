/**
 * AuthModal - Beautiful popup shown when guest clicks a protected feature.
 *
 * Props: none (reads from AuthContext)
 * Features: blur background, glassmorphism, animated lock icon, ESC closes
 */
import { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLock, FiX } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import './AuthModal.css';

export default function AuthModal() {
  const { showAuthModal, authModalMessage, closeAuthModal } = useAuth();

  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') closeAuthModal();
  }, [closeAuthModal]);

  useEffect(() => {
    if (showAuthModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [showAuthModal, handleEscape]);

  return (
    <AnimatePresence>
      {showAuthModal && (
        <motion.div
          className="am-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAuthModal}
          role="dialog"
          aria-modal="true"
          aria-label="Authentication required"
        >
          <motion.div
            className="am-card"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="am-close" onClick={closeAuthModal} aria-label="Close">
              <FiX size={18} />
            </button>

            <motion.div
              className="am-icon-wrap"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
            >
              <div className="am-icon-bg" />
              <FiLock className="am-icon" size={32} />
            </motion.div>

            <h2 className="am-title">Login Required</h2>
            <p className="am-message">
              {authModalMessage || 'Please sign in to access this feature.'}
            </p>

            <div className="am-actions">
              <Link to="/login" className="am-btn-primary" onClick={closeAuthModal}>
                Sign In
              </Link>
              <Link to="/register" className="am-btn-outline" onClick={closeAuthModal}>
                Create Account
              </Link>
            </div>

            <button className="am-btn-cancel" onClick={closeAuthModal}>
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
