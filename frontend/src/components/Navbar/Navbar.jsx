/**
 * Navbar - Minimal top bar for public (non-dashboard) pages.
 *
 * No nav links; just the brand logo and auth-aware actions
 * (ProfileMenu when signed in, Sign In link otherwise).
 */
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProfileMenu from '../Auth/ProfileMenu';
import BrandLogo from '../BrandLogo/BrandLogo';
import './Navbar.css';

export default function Navbar() {
  const { isAuthenticated } = useAuth();

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-container">
        <div className="navbar-left">
          <BrandLogo className="navbar-logo" size="md" />
        </div>

        <div className="navbar-right">
          {isAuthenticated ? (
            <ProfileMenu />
          ) : (
            <Link to="/login" className="navbar-login-link">Sign In</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
