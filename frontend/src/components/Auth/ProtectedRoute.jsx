/**
 * ProtectedRoute - Route guard for authenticated pages.
 *
 * Purpose:
 *   - While auth state is loading, renders nothing (global loading screen covers it).
 *   - If the user is not authenticated, opens the Login Required modal so
 *     guests get a clear call-to-action instead of a silent redirect.
 *   - Otherwise renders the protected page.
 *
 * @param {ReactNode} children The protected page content.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, openAuthModal, closeAuthModal } = useAuth();
  const prompted = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      prompted.current = false;
      closeAuthModal();
      return;
    }
    if (!prompted.current) {
      prompted.current = true;
      openAuthModal('Please sign in to access this feature.');
    }
  }, [isLoading, isAuthenticated, openAuthModal, closeAuthModal]);

  if (isLoading) return null;
  if (!isAuthenticated) return null;

  return children;
}
