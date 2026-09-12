/**
 * LandingNavbar - Transparent/glassmorphism navbar for the home page.
 *
 * Before login: Sign In + Get Started buttons
 * After login: Profile avatar with dropdown
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiMenu, FiX } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import ProfileMenu from '../Auth/ProfileMenu';
import BrandLogo from '../BrandLogo/BrandLogo';
import './LandingNavbar.css';

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      <motion.nav
        className={`lnb ${scrolled ? 'lnb--scrolled' : ''}`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="lnb-inner">
          <BrandLogo className="lnb-logo" size="lg" />

          <div className="lnb-actions">
            {!isLoading && (
              isAuthenticated ? (
                <>
                  <Link to="/upload" className="lnb-signin">Dashboard</Link>
                  <ProfileMenu />
                </>
              ) : (
                <>
                  <Link to="/login" className="lnb-signin">Sign In</Link>
                  <Link to="/register" className="lnb-cta">
                    Get Started
                    <FiArrowRight size={15} />
                  </Link>
                </>
              )
            )}
          </div>

          <button
            className="lnb-mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="lnb-mobile-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="lnb-mobile-menu"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="lnb-mobile-header">
              <BrandLogo className="lnb-logo" size="md" onClick={() => setMobileOpen(false)} />
              <button
                className="lnb-mobile-close"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <FiX size={22} />
              </button>
            </div>
            <div className="lnb-mobile-links">
              {isAuthenticated ? (
                <>
                  <Link to="/upload" className="lnb-mobile-cta" onClick={() => setMobileOpen(false)}>
                    Dashboard <FiArrowRight size={16} />
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="lnb-mobile-link" onClick={() => setMobileOpen(false)}>
                    Sign In
                  </Link>
                  <Link to="/register" className="lnb-mobile-cta" onClick={() => setMobileOpen(false)}>
                    Get Started <FiArrowRight size={16} />
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
