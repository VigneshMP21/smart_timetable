/**
 * LoadingScreen - Full-screen auth boot screen.
 *
 * Purpose:
 *   Shown while the app restores the stored session on startup.
 *   Prevents protected content flashing before session state is known.
 */
import BrandLogo from '../BrandLogo/BrandLogo';
import './LoadingScreen.css';

export default function LoadingScreen() {
  return (
    <div className="auth-loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="auth-loading-brand">
        <BrandLogo size="lg" link={false} />
      </div>
      <div className="auth-loading-spinner">
        <div className="auth-loading-ring" />
        <div className="auth-loading-ring auth-loading-ring--2" />
        <div className="auth-loading-ring auth-loading-ring--3" />
      </div>
      <p className="auth-loading-text">Restoring your session...</p>
    </div>
  );
}
