/**
 * Sidebar - Collapsible glass sidebar for the dashboard shell.
 *
 * Purpose:
 *   Provides primary navigation. Expands to 280px on desktop, collapses to
 *   80px (icons only), and becomes an off-canvas overlay drawer on mobile.
 *
 * Props:
 *   None. All state comes from the SidebarContext (useSidebar).
 *
 * Logic:
 *   - Desktop/tablet: the sidebar is a CSS Grid column; the width transition
 *     is driven by the grid track, so the shell animates 280 <-> 80 smoothly.
 *   - Mobile: the drawer slides via framer-motion translateX and a blurred,
 *     dimmed backdrop is shown. Clicking the backdrop closes the drawer.
 *
 * Future integration point:
 *   The menu content is entirely data-driven via SidebarMenu / menuConfig.
 */
import { motion } from 'framer-motion';
import SidebarMenu from './SidebarMenu';
import { useSidebar } from './SidebarContext';

export default function Sidebar() {
  const { collapsed, mobileOpen, isMobile, expand, closeMobile } = useSidebar();
  const desktopCollapsed = collapsed && !isMobile;

  return (
    <>
      {/* Mobile backdrop (blur + dim), click anywhere closes the drawer */}
      {isMobile && mobileOpen && (
        <motion.div
          className="dash-sidebar-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      <motion.aside
        className={[
          'dash-sidebar',
          desktopCollapsed ? 'collapsed' : '',
          isMobile ? 'mobile' : '',
          isMobile && mobileOpen ? 'open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        initial={false}
        animate={isMobile ? { x: mobileOpen ? 0 : -300 } : { x: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        aria-label="Sidebar navigation"
      >
        <div className="dash-sidebar-head">
          <span className="dash-sidebar-caption">Navigation</span>
        </div>

        <div className="dash-sidebar-nav">
          <SidebarMenu
            collapsed={desktopCollapsed}
            onExpand={expand}
            onNavigate={isMobile ? closeMobile : undefined}
          />
        </div>

        <div className="dash-sidebar-foot">Smart Timetable © {new Date().getFullYear()}</div>
      </motion.aside>
    </>
  );
}
