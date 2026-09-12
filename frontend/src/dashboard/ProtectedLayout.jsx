/**
 * ProtectedLayout - Auth guard for the dashboard routes.
 *
 * Purpose:
 *   Wraps the DashboardLayout with the existing ProtectedRoute so every
 *   /dashboard route requires an authenticated user before rendering the
 *   shell. Guests trigger the "login required" modal via ProtectedRoute.
 *
 * Props:
 *   None. Renders <DashboardLayout /> which itself renders <Outlet />.
 *
 * Logic:
 *   - Delegates all auth handling to the existing ProtectedRoute component,
 *     so auth behaviour stays consistent with the rest of the app.
 *
 * Future integration point:
 *   Add role/permission checks here (e.g. admin-only) without touching the
 *   pages or the layout shell.
 */
import ProtectedRoute from '../components/Auth/ProtectedRoute';
import DashboardLayout from './DashboardLayout';

export default function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <DashboardLayout />
    </ProtectedRoute>
  );
}
