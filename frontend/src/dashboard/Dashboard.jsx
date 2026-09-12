/**
 * Dashboard - Landing page of the dashboard shell.
 *
 * Purpose:
 *   Welcomes the user and gives one-click access to the main workflows via
 *   glass quick-action cards and a live-feel stats strip.
 *
 * Props:
 *   None. Reads the authenticated user from AuthContext for the greeting.
 *
 * Logic:
 *   - Greeting adapts to the time of day.
 *   - Quick actions link to existing routes (/generate is the Phase 1 flow;
 *     the rest are Phase 2 dashboard pages).
 *   - Stats render as "—" until the data APIs are wired in.
 *
 * Future integration point:
 *   Replace the placeholder stats with real counts from the backend, and add
 *   a "recent timetables" list once generation records exist.
 */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LuCalendarDays,
  LuLayoutTemplate,
  LuPencilRuler,
  LuUsers,
  LuGraduationCap,
  LuBuilding2,
  LuBookOpen,
  LuArrowRight,
  LuSparkles,
} from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';

const QUICK_ACTIONS = [
  {
    label: 'Generate Timetable',
    desc: 'Auto-generate a conflict-free timetable in seconds.',
    to: '/generate',
    icon: LuCalendarDays,
    grad1: '#2563eb',
    grad2: '#7c3aed',
    tag: 'AI Assisted',
  },
  {
    label: 'Templates',
    desc: 'Start from Default, College or University layouts.',
    to: '/dashboard/template',
    icon: LuLayoutTemplate,
    grad1: '#7c3aed',
    grad2: '#06b6d4',
    tag: 'Layouts',
  },
  {
    label: 'Manual Timetable',
    desc: 'Design your timetable by hand on a blank canvas.',
    to: '/dashboard/manual',
    icon: LuPencilRuler,
    grad1: '#06b6d4',
    grad2: '#2563eb',
    tag: 'Canvas',
  },
  {
    label: 'Faculty',
    desc: 'Manage faculty profiles, subjects and workload.',
    to: '/dashboard/add-faculty',
    icon: LuUsers,
    grad1: '#059669',
    grad2: '#2563eb',
    tag: 'People',
  },
];

const STATS = [
  { label: 'Classes', icon: LuGraduationCap },
  { label: 'Rooms', icon: LuBuilding2 },
  { label: 'Subjects', icon: LuBookOpen },
  { label: 'Faculty', icon: LuUsers },
];

export default function Dashboard() {
  const { user } = useAuth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = user?.full_name?.split(' ')[0] || 'Admin';

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.08 * i, duration: 0.4, ease: 'easeOut' },
    }),
  };

  return (
    <div className="dash-page">
      {/* Hero */}
      <section className="dash-hero">
        <div>
          <span className="dash-hero-badge">
            <span className="dot" aria-hidden="true" />
            {today}
          </span>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            Welcome back, <span className="grad">{name}</span>
          </motion.h1>
          <p>
            Manage your timetable generation from one place. Set up your
            classes, rooms, subjects and faculty, then generate or build your
            schedule — all in a few clicks.
          </p>
          <div className="dash-hero-actions">
            <Link to="/generate" className="dash-btn dash-btn-primary">
              <LuCalendarDays aria-hidden="true" />
              Generate Timetable
            </Link>
            <Link to="/dashboard/template" className="dash-btn dash-btn-ghost">
              <LuLayoutTemplate aria-hidden="true" />
              Explore Templates
            </Link>
          </div>
        </div>

        {/* Decorative mini-timetable preview */}
        <div className="dash-hero-art" aria-hidden="true">
          <motion.div
            className="dash-hero-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <div className="dash-hero-card-label">
              <span className="dash-pulse-dot" />
              Your timetable workspace
            </div>
            <div className="dash-mini-grid">
              {Array.from({ length: 30 }).map((_, i) => (
                <span
                  key={i}
                  className={`dash-mini-cell ${i % 3 === 1 ? 'fill' : ''}`}
                />
              ))}
            </div>
            <div className="dash-hero-card-meta">
              <span>
                <strong>0</strong> conflicts · <strong>5</strong> days ·{' '}
                <strong>7</strong> periods
              </span>
              <LuSparkles style={{ color: 'var(--dash-primary)' }} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick actions */}
      <div className="dash-section-head">
        <h2 className="dash-section-title">Quick Actions</h2>
        <Link to="/generate" className="dash-section-link">
          View all workflows <LuArrowRight aria-hidden="true" />
        </Link>
      </div>

      <section className="dash-cards" aria-label="Quick actions">
        {QUICK_ACTIONS.map((action, i) => (
          <motion.div
            key={action.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <Link
              to={action.to}
              className="dash-card"
              style={{ ['--card-grad-1']: action.grad1, ['--card-grad-2']: action.grad2 }}
            >
              <span className="dash-card-icon">
                <action.icon aria-hidden="true" />
              </span>
              <h3>{action.label}</h3>
              <p>{action.desc}</p>
              <span className="dash-card-foot">
                <span className="dash-card-tag">{action.tag}</span>
                <LuArrowRight className="dash-card-arrow" aria-hidden="true" />
              </span>
            </Link>
          </motion.div>
        ))}
      </section>

      {/* Stats strip */}
      <section className="dash-stats" aria-label="Institution overview">
        {STATS.map((stat) => (
          <div className="dash-stat" key={stat.label}>
            <span className="dash-stat-icon">
              <stat.icon aria-hidden="true" />
            </span>
            <div>
              <div className="dash-stat-value">—</div>
              <div className="dash-stat-label">{stat.label}</div>
              <div className="dash-stat-note">Awaiting data</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
