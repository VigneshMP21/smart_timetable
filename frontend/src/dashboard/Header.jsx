/**
 * Header - Site-wide white bar (64px) for the dashboard shell.
 *
 * Matches the main Navbar design after login: BrandLogo + ProfileMenu,
 * plus the dashboard-specific sidebar toggle and current page title.
 *
 * Props:
 *   pageTitle {string} - Current route title shown in the center.
 *
 * Logic:
 *   The hamburger button drives the sidebar via useSidebar: it toggles the
 *   desktop/tablet collapse or opens/closes the mobile drawer.
 */
import { motion } from 'framer-motion';
import { LuMenu } from 'react-icons/lu';
import BrandLogo from '../components/BrandLogo/BrandLogo';
import ProfileMenu from '../components/Auth/ProfileMenu';
import { useSidebar } from './SidebarContext';

export default function Header({ pageTitle }) {
  const { toggle } = useSidebar();

  return (
    <header className="dash-header">
      {/* LEFT: toggle + brand */}
      <div className="dash-header-left">
        <button
          type="button"
          className="dash-hamburger"
          onClick={toggle}
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
        >
          <LuMenu aria-hidden="true" />
        </button>

        <BrandLogo size="md" />
      </div>

      {/* CENTER: current page title */}
      <div className="dash-header-center">
        <motion.span
          key={pageTitle}
          className="dash-page-title"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <span className="dash-page-title-dot" aria-hidden="true" />
          {pageTitle}
        </motion.span>
      </div>

      {/* RIGHT: profile menu (site-wide) */}
      <div className="dash-header-right">
        <ProfileMenu />
      </div>
    </header>
  );
}
