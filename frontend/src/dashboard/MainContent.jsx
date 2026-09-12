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
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Loader from '../components/Loader/Loader';

export default function MainContent() {
  const location = useLocation();

  return (
    <main className="dash-main" id="dashboard-main">
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          className="dash-page"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        >
          <Suspense fallback={<Loader message="Loading page..." />}>
            <Outlet />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
