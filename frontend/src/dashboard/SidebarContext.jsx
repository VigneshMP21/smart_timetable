/**
 * SidebarContext - Single source of truth for dashboard shell sidebar state.
 *
 * Purpose:
 *   Replaces the local layout state that used to live inside DashboardLayout.
 *   Any component in the dashboard (Header, Sidebar, pages) can now read and
 *   drive the sidebar via the useSidebar hook, so the shell stays stateless.
 *
 * Behaviour by device (from the responsive spec):
 *   - Desktop/Laptop (>= 1200px): sidebar expanded (280px) by default.
 *   - Tablet (768px - 1199px):    sidebar collapsed (80px) by default.
 *   - Mobile (< 768px):           off-canvas overlay drawer, closed by default.
 *
 * Exposed API:
 *   collapsed    {boolean}  - Desktop/tablet collapse flag (width 280 <-> 80).
 *   mobileOpen   {boolean}  - Mobile drawer visibility.
 *   isMobile     {boolean}  - True below the mobile breakpoint.
 *   toggle()     {() => void} - Collapse/expand on desktop, open/close drawer on mobile.
 *   expand()     {() => void} - Force-expand the desktop sidebar.
 *   openMobile() {() => void} - Open the mobile drawer.
 *   closeMobile() {() => void} - Close the mobile drawer.
 *
 * Future integration point:
 *   Swap the internal useState for redux/zustand later without touching any
 *   consumer - the hook contract stays identical.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** Viewport is mobile below this width (off-canvas drawer). */
export const MOBILE_BREAKPOINT = 768;
/** Viewport is desktop above/at this width (expanded by default). */
export const DESKTOP_BREAKPOINT = 1200;

const SidebarContext = createContext(undefined);

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Watch the breakpoints and apply each device's default state.
  useEffect(() => {
    const mobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const tablet = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${DESKTOP_BREAKPOINT - 1}px)`
    );

    const apply = () => {
      const mobileActive = mobile.matches;
      setIsMobile(mobileActive);
      setMobileOpen(false);
      if (mobileActive) {
        setCollapsed(false); // drawer is used instead
      } else if (tablet.matches) {
        setCollapsed(true); // tablet: collapsed default
      } else {
        setCollapsed(false); // desktop: expanded default
      }
    };

    apply();
    mobile.addEventListener('change', apply);
    tablet.addEventListener('change', apply);
    return () => {
      mobile.removeEventListener('change', apply);
      tablet.removeEventListener('change', apply);
    };
  }, []);

  const toggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  }, [isMobile]);

  const expand = useCallback(() => setCollapsed(false), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const value = useMemo(
    () => ({ collapsed, mobileOpen, isMobile, toggle, expand, openMobile, closeMobile }),
    [collapsed, mobileOpen, isMobile, toggle, expand, openMobile, closeMobile]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return ctx;
}
