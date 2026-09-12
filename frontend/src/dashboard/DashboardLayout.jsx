/**
 * DashboardLayout - The dashboard shell (header + sidebar + content + footer).
 *
 * Purpose:
 *   Renders the fixed header, the collapsible sidebar and the fluid main
 *   content via a CSS Grid body. Sidebar state no longer lives here - it
 *   comes from the global SidebarContext (wired in main.jsx).
 *
 * Props:
 *   None. It expects to be rendered inside a route using <Outlet />.
 *
 * Logic:
 *   - `.dash-body` is a CSS Grid: `280px 1fr` (expanded) <-> `80px 1fr`
 *     (collapsed), animated via a 300ms grid-template-columns transition.
 *   - Mobile renders the sidebar as an overlay drawer and the body as a
 *     single column.
 *   - The mobile drawer closes automatically on route change.
 *
 * Future integration point:
 *   Plug redux/zustand later; the shell stays stateless apart from layout.
 */
import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import Header from './Header';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import Footer from './Footer';
import { useSidebar } from './SidebarContext';
import { getPageTitle } from './SidebarMenu';
import './dashboard.css';

/** Deterministic pseudo-random particle layout for the animated background. */
function buildParticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${(i * 37) % 100}%`,
    top: `${(i * 53) % 100}%`,
    delay: `${(i * 0.7) % 9}s`,
    duration: `${7 + (i % 5)}s`,
  }));
}

/**
 * AnimatedBackground - fixed gradient, grid, blur circles and floating particles.
 * Pure decoration; sits behind everything (z-index -1).
 */
function AnimatedBackground() {
  const particles = useMemo(() => buildParticles(16), []);
  return (
    <div className="dash-bg" aria-hidden="true">
      <div className="dash-bg-grid" />
      <div className="dash-blob dash-blob-1" />
      <div className="dash-blob dash-blob-2" />
      <div className="dash-blob dash-blob-3" />
      {particles.map((p) => (
        <span
          key={p.id}
          className="dash-particle"
          style={{ left: p.left, top: p.top, animationDelay: p.delay, animationDuration: p.duration }}
        />
      ))}
    </div>
  );
}

function DashboardShell() {
  const location = useLocation();
  const { collapsed, isMobile, closeMobile } = useSidebar();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    if (isMobile) closeMobile();
  }, [location.pathname, isMobile, closeMobile]);

  const pageTitle = getPageTitle(location.pathname);

  const bodyClass = [
    'dash-body',
    !isMobile && collapsed ? 'sidebar-collapsed' : '',
    isMobile ? 'sidebar-mobile' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <MotionConfig reducedMotion="user">
      <div className="dashboard-shell">
        <AnimatedBackground />

        <Header pageTitle={pageTitle} />

        <div className={bodyClass}>
          <Sidebar />
          <MainContent />
        </div>

        <Footer />
      </div>
    </MotionConfig>
  );
}

export default function DashboardLayout() {
  return <DashboardShell />;
}
