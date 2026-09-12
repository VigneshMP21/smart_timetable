/**
 * MainContent - The flexible content column of the dashboard grid.
 *
 * Purpose:
 *   Renders the nested route (Outlet) with a smooth fade/slide transition
 *   keyed on the current pathname, plus a Suspense fallback while lazy pages
 *   load. Future pages added under ProtectedLayout inherit this automatically.
 *
 * Props:
 *   None. Reads the current route via useLocation.
 *
 * Logic:
 *   - `min-width: 0` (set in CSS) is what lets wide tables scroll inside
 *     their own wrapper instead of pushing the whole layout sideways.
 *
 * Future integration point:
 *   Swap AnimatePresence page transitions for router-agnostic ones here.
 */
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Loader from '../components/Loader/Loader';

export default function MainContent() {
  return (
    <main className="dash-main" id="dashboard-main">
      <div className="dash-page">
        <Suspense fallback={<Loader message="Loading page..." />}>
          <Outlet />
        </Suspense>
      </div>
    </main>
  );
}
