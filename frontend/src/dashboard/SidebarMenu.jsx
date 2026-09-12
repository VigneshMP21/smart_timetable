/**
 * SidebarMenu - Navigation config + collapsible menu list for the dashboard.
 *
 * Purpose:
 *   Centralizes all dashboard navigation in one data-driven place so future
 *   menu items can be added without touching layout code.
 *
 * Props:
 *   collapsed  {boolean} - When true the sidebar shows icons only (desktop).
 *   onExpand   {() => void} - Called when a group is clicked while collapsed,
 *                             so the layout can widen the sidebar first.
 *   onNavigate {() => void} - Called after a link click (used to close the
 *                             mobile overlay drawer).
 *
 * Logic:
 *   - `menuConfig` is the single source of truth for routes + icons + titles.
 *   - Groups auto-expand when one of their children is the active route.
 *   - Collapsed mode hides labels/chevrons and forwards clicks to `onExpand`.
 *
 * Future integration point:
 *   Add/remove entries in `menuConfig`; route links, active states and the
 *   header page title (getPageTitle) all update automatically.
 */
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LuLayoutDashboard,
  LuCalendarDays,
  LuGraduationCap,
  LuBuilding2,
  LuBookOpen,
  LuUsers,
  LuLayoutTemplate,
  LuPencilRuler,
  LuUpload,
  LuCpu,
  LuClipboardList,
  LuChartBar,
  LuSettings,
  LuChevronDown,
} from 'react-icons/lu';

/* Icon keys expected by lucide-react-icon naming: all verified present in react-icons/lu */
export const menuConfig = [
  { type: 'link', label: 'Dashboard', path: '/dashboard', icon: LuLayoutDashboard },
  {
    type: 'group',
    label: 'Generate Timetable',
    icon: LuCalendarDays,
    children: [
      { label: 'Upload Data', path: '/upload', icon: LuUpload },
      { label: 'Add Class', path: '/dashboard/add-class', icon: LuGraduationCap },
      { label: 'Add Room', path: '/dashboard/add-room', icon: LuBuilding2 },
      { label: 'Add Subjects', path: '/dashboard/add-subjects', icon: LuBookOpen },
      { label: 'Add Faculty', path: '/dashboard/add-faculty', icon: LuUsers },
      { label: 'Set Up', path: '/settings', icon: LuSettings },
      { label: 'Generate', path: '/generate', icon: LuCpu },
    ],
  },
  { type: 'link', label: 'Time Table Template', path: '/dashboard/template', icon: LuLayoutTemplate },
  { type: 'link', label: 'Manually Create Timetable', path: '/dashboard/manual', icon: LuPencilRuler },
  { type: 'link', label: 'Results', path: '/result', icon: LuClipboardList },
  { type: 'link', label: 'Statistics', path: '/statistics', icon: LuChartBar },
];

/** Extra header titles for routes without a sidebar menu item. */
const EXTRA_TITLES = {
  '/profile': 'Profile',
  '/about': 'About',
  '/result/class/': 'Class Timetable',
  '/result/faculty/': 'Faculty Timetable',
};

/** Maps a route path to the header page title. */
export function getPageTitle(pathname) {
  const flat = menuConfig.flatMap((item) =>
    item.type === 'group' ? item.children : item
  );
  const match = flat.find((item) => item.path === pathname);
  if (match) return match.label;
  if (pathname.startsWith('/result/class/')) return EXTRA_TITLES['/result/class/'];
  if (pathname.startsWith('/result/faculty/')) return EXTRA_TITLES['/result/faculty/'];
  return EXTRA_TITLES[pathname] || 'Dashboard';
}

export default function SidebarMenu({ collapsed, onExpand, onNavigate }) {
  const location = useLocation();
  const [openKeys, setOpenKeys] = useState([]);

  const isActive = (path) => location.pathname === path;

  const toggleGroup = (label) => {
    setOpenKeys((prev) =>
      prev.includes(label) ? prev.filter((k) => k !== label) : [...prev, label]
    );
  };

  const handleGroupClick = (item) => {
    if (collapsed) {
      onExpand?.();
      toggleGroup(item.label);
      return;
    }
    toggleGroup(item.label);
  };

  return (
    <nav className="dash-menu" aria-label="Dashboard navigation">
      {menuConfig.map((item) => {
        if (item.type === 'group') {
          const childActive = item.children.some((c) => isActive(c.path));
          const open = openKeys.includes(item.label) || childActive;

          return (
            <div className="dash-menu-group" key={item.label}>
              <button
                type="button"
                className={`dash-menu-link ${childActive ? 'active' : ''}`}
                onClick={() => handleGroupClick(item)}
                aria-expanded={open}
                aria-controls={`submenu-${item.label}`}
              >
                <item.icon className="dash-menu-icon" aria-hidden="true" />
                {!collapsed && <span className="dash-menu-label">{item.label}</span>}
                {!collapsed && (
                  <LuChevronDown
                    className={`dash-menu-chevron ${open ? 'open' : ''}`}
                    aria-hidden="true"
                  />
                )}
              </button>

              {!collapsed && (
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      id={`submenu-${item.label}`}
                      className="dash-submenu"
                      role="group"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    >
                      {item.children.map((child) => (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          className={({ isActive: a }) =>
                            `dash-menu-link ${a ? 'active' : ''}`
                          }
                          onClick={onNavigate}
                        >
                          <child.icon className="dash-menu-icon" aria-hidden="true" />
                          <span className="dash-menu-label">{child.label}</span>
                        </NavLink>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        }

        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive: a }) => `dash-menu-link ${a ? 'active' : ''}`}
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
          >
            <item.icon className="dash-menu-icon" aria-hidden="true" />
            {!collapsed && <span className="dash-menu-label">{item.label}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}
