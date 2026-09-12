/**
 * AuthLayout - Two-column layout for auth pages.
 *
 * Left panel: immersive premium SaaS illustration (aurora, AI network,
 * floating glassmorphism cards, live dashboard mockup, marquee, parallax).
 *
 * Props:
 *   children - Right side form content
 *   title    - Left side heading
 *   subtitle - Left side description
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import CountUp from 'react-countup';
import Marquee from 'react-fast-marquee';
import {
  FiCpu, FiUploadCloud, FiUsers, FiBarChart2, FiClock, FiZap, FiCheck,
} from 'react-icons/fi';
import BrandLogo from '../BrandLogo/BrandLogo';
import './AuthLayout.css';

const FEATURES = [
  'AI-Powered Scheduling', 'Conflict-Free Timetables', 'Excel Import',
  'PDF Export', 'Faculty Allocation', 'Room Optimization',
  'Real-Time Analytics', 'Smart Constraints', 'One-Click Generate',
  'Multi-Section Support',
];

const SUBJECTS = [
  { name: 'Mathematics', time: '9:00 AM', room: 'R-102', color: '#60A5FA' },
  { name: 'Physics Lab', time: '11:00 AM', room: 'R-104', color: '#A78BFA' },
  { name: 'CS Theory', time: '2:00 PM', room: 'R-106', color: '#22D3EE' },
];

const FACULTY = [
  { initials: 'AS', name: 'Dr. A. Sharma', dept: 'Mathematics', color: '#60A5FA' },
  { initials: 'PR', name: 'Prof. P. Rao', dept: 'Physics', color: '#A78BFA' },
  { initials: 'MK', name: 'Dr. M. Kaur', dept: 'Computer Sci.', color: '#22D3EE' },
];

const NETWORK_NODES = [
  { x: 10, y: 18 }, { x: 36, y: 10 }, { x: 63, y: 22 }, { x: 88, y: 12 },
  { x: 18, y: 46 }, { x: 44, y: 40 }, { x: 70, y: 52 }, { x: 92, y: 48 },
  { x: 12, y: 78 }, { x: 40, y: 84 }, { x: 66, y: 72 }, { x: 90, y: 88 },
];

const NETWORK_LINES = [
  [0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7],
  [8, 9], [9, 10], [10, 11], [1, 5], [5, 9], [2, 6], [6, 10], [3, 7], [7, 11],
];

const CHART_BARS = [42, 68, 55, 84, 62, 92, 74];
const CHART_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ParallaxLayer({ springX, springY, depth, className, children }) {
  const x = useTransform(springX, (v) => v * depth);
  const y = useTransform(springY, (v) => v * depth);
  return (
    <motion.div className={className} style={{ x, y }}>
      {children}
    </motion.div>
  );
}

function Particles() {
  const items = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 5,
        delay: -(Math.random() * 10),
        duration: 7 + Math.random() * 9,
        opacity: 0.25 + Math.random() * 0.55,
        color: ['#60A5FA', '#A78BFA', '#22D3EE', '#FFFFFF'][i % 4],
      })),
    []
  );

  return (
    <div className="al-particles">
      {items.map((p) => (
        <motion.span
          key={p.id}
          className="al-particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--po': p.opacity,
          }}
        />
      ))}
    </div>
  );
}

function Network() {
  return (
    <svg className="al-network" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="alNetGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#A78BFA" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <g className="al-net-lines" stroke="url(#alNetGrad)">
        {NETWORK_LINES.map(([a, b], i) => {
          const p1 = NETWORK_NODES[a];
          const p2 = NETWORK_NODES[b];
          return (
            <line
              key={i}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              className="al-net-line"
              style={{ animationDelay: `${(i % 5) * 0.6}s` }}
            />
          );
        })}
      </g>
      <g>
        {NETWORK_NODES.map((n, i) => (
          <g key={i}>
            <circle
              cx={n.x}
              cy={n.y}
              r={0.9}
              fill="url(#alNetGrad)"
              className="al-net-dot"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
            <circle
              cx={n.x}
              cy={n.y}
              r={2.4}
              fill="none"
              stroke="url(#alNetGrad)"
              strokeOpacity="0.4"
              className="al-net-ring"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}

function useTicker(interval, fn) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [value, setValue] = useState(() => fn(0));
  useEffect(() => {
    const t = setInterval(() => setValue((prev) => fnRef.current(prev)), interval);
    return () => clearInterval(t);
  }, [interval]);
  return value;
}

function DashboardMockup() {
  const MAX = 30;
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    let idx = 0;
    let interval;
    let reset;
    const run = () => {
      interval = setInterval(() => {
        idx += 1;
        if (idx > MAX) {
          clearInterval(interval);
          reset = setTimeout(() => {
            idx = 0;
            setFilled(0);
            run();
          }, 1900);
          return;
        }
        setFilled(idx);
      }, 60);
    };
    run();
    return () => {
      clearInterval(interval);
      clearTimeout(reset);
    };
  }, []);

  const progress = Math.min(100, Math.round((filled / MAX) * 100));

  return (
    <div className="al-dash">
      <div className="al-dash-bar">
        <span className="al-dash-dots"><i /><i /><i /></span>
        <span className="al-dash-title">Smart Timetable AI</span>
        <span className="al-dash-live"><span className="al-live-dot" /> LIVE</span>
      </div>

      <div className="al-dash-body">
        <div className="al-dash-stats">
          <div className="al-dash-stat">
            <span className="al-dash-stat-num"><CountUp end={24} enableScrollSpy scrollSpyOnce /></span>
            <span className="al-dash-stat-label">Classes</span>
          </div>
          <div className="al-dash-stat">
            <span className="al-dash-stat-num"><CountUp end={42} enableScrollSpy scrollSpyOnce /></span>
            <span className="al-dash-stat-label">Faculty</span>
          </div>
          <div className="al-dash-stat">
            <span className="al-dash-stat-num"><CountUp end={18} enableScrollSpy scrollSpyOnce /></span>
            <span className="al-dash-stat-label">Subjects</span>
          </div>
          <div className="al-dash-stat al-dash-stat-ok">
            <span className="al-dash-stat-num">0</span>
            <span className="al-dash-stat-label">Conflicts</span>
          </div>
        </div>

        <div className="al-dash-main">
          <div className="al-dash-chart">
            <span className="al-dash-chart-title">Weekly Load</span>
            <div className="al-chart">
              {CHART_BARS.map((h, i) => (
                <div className="al-chart-col" key={i}>
                  <div
                    className="al-chart-bar"
                    style={{ height: `${h}%`, animationDelay: `${i * 0.15}s` }}
                  />
                </div>
              ))}
            </div>
            <div className="al-chart-days">
              {CHART_DAYS.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
          </div>

          <div className="al-dash-sched">
            <span className="al-dash-chart-title">Generated Grid</span>
            <div className="al-sched-grid">
              {Array.from({ length: MAX }, (_, i) => (
                <span key={i} className={`al-sched-cell ${i < filled ? 'on' : ''}`} />
              ))}
            </div>
            <div className="al-sched-legend">
              <span className="al-legend-dot" /> Filled slots
            </div>
          </div>
        </div>

        <div className="al-dash-status">
          <span className="al-dash-spinner" />
          <span className="al-dash-status-text">
            Generating Timetable
            <span className="al-status-dots"><i /><i /><i /></span>
          </span>
          <span className="al-dash-status-pct">{progress}%</span>
        </div>
      </div>
    </div>
  );
}

function TimetableCard() {
  return (
    <div className="al-card-inner al-tt">
      <div className="al-tt-head">
        <span className="al-tt-title">Today's Schedule</span>
        <span className="al-tt-day">MON</span>
      </div>
      {SUBJECTS.map((s, i) => (
        <div className="al-tt-row" key={i}>
          <span className="al-tt-dot" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
          <div className="al-tt-meta">
            <span className="al-tt-name">{s.name}</span>
            <span className="al-tt-time">{s.time}</span>
          </div>
          <span className="al-tt-room">{s.room}</span>
        </div>
      ))}
    </div>
  );
}

function FacultyCard() {
  return (
    <div className="al-card-inner al-faculty">
      <div className="al-faculty-head">
        <span className="al-faculty-title"><FiUsers /> Faculty</span>
        <span className="al-faculty-online"><i /> 42 online</span>
      </div>
      {FACULTY.map((f, i) => (
        <div className="al-faculty-row" key={i}>
          <span
            className="al-faculty-avatar"
            style={{
              background: `${f.color}22`,
              color: f.color,
              boxShadow: `0 0 10px ${f.color}44`,
            }}
          >
            {f.initials}
          </span>
          <div className="al-faculty-meta">
            <span className="al-faculty-name">{f.name}</span>
            <span className="al-faculty-dept">{f.dept}</span>
          </div>
          <span className="al-faculty-avail"><i /> Available</span>
        </div>
      ))}
    </div>
  );
}

function CalendarCard() {
  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const filled = [0, 1, 2, 6, 9, 12, 16, 20, 24, 27];
  const today = new Date().getDate();

  return (
    <div className="al-cal3d-wrap">
      <div className="al-card-inner al-cal3d">
        <div className="al-cal3d-head">
          <span>August 2026</span>
          <span className="al-cal3d-today">Today</span>
        </div>
        <div className="al-cal3d-days">
          {weekdays.map((d, i) => (
            <span key={i} className="al-cal3d-dayname">{d}</span>
          ))}
        </div>
        <div className="al-cal3d-grid">
          {Array.from({ length: 31 }, (_, i) => (
            <span
              key={i}
              className={`al-cal3d-cell ${filled.includes(i) ? 'on' : ''} ${i + 1 === today ? 'today' : ''}`}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function UploadCard() {
  const progress = useTicker(70, (p = 0) => (p >= 100 ? 0 : p + 2));

  return (
    <div className="al-card-inner al-upload">
      <div className="al-upload-head">
        <span className="al-upload-icon"><FiUploadCloud /></span>
        <div className="al-upload-meta">
          <span className="al-upload-name">timetable_data.xlsx</span>
          <span className="al-upload-size">Excel · 48.2 KB</span>
        </div>
        <span className="al-upload-pct">{progress}%</span>
      </div>
      <div className="al-upload-track">
        <span className="al-upload-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="al-upload-hint"><FiCheck /> Parsing done · <b>{Math.round((progress / 100) * 640)}</b> rows</span>
    </div>
  );
}

function ConflictCard() {
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setScanning((s) => !s), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="al-card-inner al-conflict">
      <AnimatePresence mode="wait">
        {scanning ? (
          <motion.div
            key="scan"
            className="al-conflict-row"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <span className="al-conflict-radar"><i /><i /><i /></span>
            <div className="al-conflict-txt">
              <span className="al-conflict-label">Conflict Detection</span>
              <span className="al-conflict-sub">Scanning 120 slots...</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="ok"
            className="al-conflict-row"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <span className="al-conflict-badge"><FiCheck /></span>
            <div className="al-conflict-txt">
              <span className="al-conflict-label">0 Conflicts Found</span>
              <span className="al-conflict-sub al-conflict-sub-ok">Schedule is optimized</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatsCard() {
  return (
    <div className="al-card-inner al-stats">
      <span className="al-stats-icon"><FiBarChart2 /></span>
      <div className="al-stats-meta">
        <span className="al-stats-num">
          <CountUp end={96} suffix="%" enableScrollSpy scrollSpyOnce />
        </span>
        <span className="al-stats-label">Optimization Score</span>
      </div>
    </div>
  );
}

function ClockCard() {
  const now = useTicker(1000, () => new Date());
  const time = now.toLocaleTimeString('en-US', { hour12: false });
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="al-card-inner al-clock-card">
      <span className="al-clock-icon"><FiClock /></span>
      <div className="al-clock-meta">
        <span className="al-clock-time">{time}</span>
        <span className="al-clock-date">{date}</span>
      </div>
    </div>
  );
}

export default function AuthLayout({ children, title, subtitle }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 50, damping: 18, mass: 0.6 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 18, mass: 0.6 });

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const shared = { springX, springY };

  return (
    <div className="al">
      <div className="al-left" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <div className="al-bg">
          <div className="al-aurora">
            <div className="al-aurora-blob al-aurora-1" />
            <div className="al-aurora-blob al-aurora-2" />
            <div className="al-aurora-blob al-aurora-3" />
            <div className="al-aurora-conic" />
          </div>
          <div className="al-grid" />
          <Network />
          <div className="al-rays">
            <div className="al-ray al-ray-1" />
            <div className="al-ray al-ray-2" />
            <div className="al-ray al-ray-3" />
          </div>
          <div className="al-noise" />
        </div>

        <Particles />
        <div className="al-glow al-glow-1" />
        <div className="al-glow al-glow-2" />

        <div className="al-left-content">
          <div className="al-left-head">
            <motion.div
              className="al-brand"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <BrandLogo variant="light" size="lg" link={false} />
              <span className="al-brand-live"><i /> LIVE</span>
            </motion.div>
            <motion.h1
              className="al-heading"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              {title}
            </motion.h1>
            <motion.p
              className="al-sub"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              {subtitle}
            </motion.p>
          </div>

          <div className="al-scene">
            <ParallaxLayer className="al-dash-wrap" depth={18} {...shared}>
              <div className="al-dash-center">
                <motion.div
                  className="al-float"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <DashboardMockup />
                </motion.div>
              </div>
            </ParallaxLayer>

            <ParallaxLayer className="al-fpos al-card-timetable" depth={46} {...shared}>
              <motion.div
                className="al-float"
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              >
                <TimetableCard />
              </motion.div>
            </ParallaxLayer>

            <ParallaxLayer className="al-fpos al-card-faculty" depth={30} {...shared}>
              <motion.div
                className="al-float"
                animate={{ y: [0, -9, 0] }}
                transition={{ duration: 6.8, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
              >
                <FacultyCard />
              </motion.div>
            </ParallaxLayer>

            <ParallaxLayer className="al-fpos al-card-calendar" depth={38} {...shared}>
              <motion.div
                className="al-float"
                animate={{ y: [0, -11, 0] }}
                transition={{ duration: 7.6, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}
              >
                <CalendarCard />
              </motion.div>
            </ParallaxLayer>

            <ParallaxLayer className="al-fpos al-card-upload" depth={52} {...shared}>
              <motion.div
                className="al-float"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5.4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              >
                <UploadCard />
              </motion.div>
            </ParallaxLayer>

            <ParallaxLayer className="al-fpos al-card-conflicts" depth={60} {...shared}>
              <motion.div
                className="al-float"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 6.4, repeat: Infinity, ease: 'easeInOut', delay: 1.8 }}
              >
                <ConflictCard />
              </motion.div>
            </ParallaxLayer>

            <ParallaxLayer className="al-fpos al-card-stats" depth={34} {...shared}>
              <motion.div
                className="al-float"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 7.2, repeat: Infinity, ease: 'easeInOut', delay: 2.2 }}
              >
                <StatsCard />
              </motion.div>
            </ParallaxLayer>

            <ParallaxLayer className="al-fpos al-clock-pos" depth={66} {...shared}>
              <motion.div
                className="al-float"
                animate={{ y: [0, -9, 0] }}
                transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
              >
                <ClockCard />
              </motion.div>
            </ParallaxLayer>

            <ParallaxLayer className="al-fpos al-chip-pos" depth={72} {...shared}>
              <motion.div
                className="al-float"
                animate={{ y: [0, -7, 0], rotate: [0, 3, -3, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              >
                <div className="al-chip-inner"><FiCpu /> AI Powered</div>
              </motion.div>
            </ParallaxLayer>

            <ParallaxLayer className="al-fpos al-cube-pos-1" depth={80} {...shared}>
              <motion.div
                className="al-float"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
              >
                <div className="al-cube-box" />
              </motion.div>
            </ParallaxLayer>

            <ParallaxLayer className="al-fpos al-cube-pos-2" depth={70} {...shared}>
              <motion.div
                className="al-float"
                animate={{ rotate: [0, -360] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              >
                <div className="al-cube-box al-cube-box-2" />
              </motion.div>
            </ParallaxLayer>
          </div>

          <div className="al-marquee-strip">
            <Marquee autoFill speed={40} gradient={false} pauseOnHover={false}>
              {FEATURES.map((f, i) => (
                <span className="al-marquee-item" key={i}>
                  <FiZap className="al-marquee-icon" /> {f}
                </span>
              ))}
            </Marquee>
          </div>
        </div>
      </div>

      <div className="al-right">
        <motion.div
          className="al-form-wrap"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
