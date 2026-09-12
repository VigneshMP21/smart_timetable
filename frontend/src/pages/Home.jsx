import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation';
import CountUp from 'react-countup';
import { useInView } from 'react-intersection-observer';
import Marquee from 'react-fast-marquee';
import {
  FiArrowRight, FiUploadCloud, FiCpu, FiUsers, FiLayers, FiFileText,
  FiDownload, FiBarChart2, FiAlertTriangle, FiCheck, FiX,
  FiCalendar, FiBook, FiClock, FiChevronDown, FiPlay, FiZap,
  FiShield, FiSettings, FiGlobe, FiMousePointer, FiCheckCircle,
  FiDatabase, FiTrendingUp, FiStar, FiMessageSquare,
} from 'react-icons/fi';
import LandingFooter from '../components/LandingFooter/LandingFooter';
import './Home.css';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] } }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i = 0) => ({ opacity: 1, scale: 1, transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] } }),
};

const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

const features = [
  { icon: FiUploadCloud, title: 'Excel Upload', desc: 'Upload class, faculty, and subject data via intuitive Excel templates.', color: '#2563EB' },
  { icon: FiAlertTriangle, title: 'Conflict Detection', desc: 'Automatically detects and resolves scheduling conflicts in real-time.', color: '#EF4444' },
  { icon: FiCpu, title: 'Smart Scheduling', desc: 'AI-powered scheduling with greedy algorithms and backtracking optimization.', color: '#7C3AED' },
  { icon: FiUsers, title: 'Faculty Allocation', desc: 'Intelligent workload distribution and availability handling for all faculty.', color: '#06B6D4' },
  { icon: FiLayers, title: 'Lab Allocation', desc: 'Consecutive period allocation for lab sessions and practical classes.', color: '#F59E0B' },
  { icon: FiFileText, title: 'PDF Export', desc: 'Download professionally formatted PDF timetables for each class and faculty.', color: '#22C55E' },
  { icon: FiDownload, title: 'Excel Export', desc: 'Multi-sheet Excel export with styling, color-coding, and statistics.', color: '#EC4899' },
  { icon: FiBarChart2, title: 'Analytics', desc: 'Visualize faculty workload, subject distribution, and utilization metrics.', color: '#8B5CF6' },
];

const steps = [
  { num: '01', icon: FiUploadCloud, title: 'Upload Excel', desc: 'Upload your department data including subjects, faculty, rooms, and constraints.' },
  { num: '02', icon: FiCheckCircle, title: 'Validation', desc: 'System validates data integrity, checks for missing fields and inconsistencies.' },
  { num: '03', icon: FiCpu, title: 'Scheduling Engine', desc: 'AI engine processes constraints and generates optimal timetable permutations.' },
  { num: '04', icon: FiShield, title: 'Conflict Resolution', desc: 'Automatic detection and resolution of faculty, room, and time slot conflicts.' },
  { num: '05', icon: FiCalendar, title: 'Timetable Ready', desc: 'Download your conflict-free, optimized timetables in PDF or Excel format.' },
];

const stats = [
  { value: 10, suffix: '+', label: 'Departments', icon: FiGlobe },
  { value: 200, suffix: '+', label: 'Faculty', icon: FiUsers },
  { value: 500, suffix: '+', label: 'Subjects', icon: FiBook },
  { value: 5000, suffix: '+', label: 'Timetables Generated', icon: FiCalendar },
];

const comparisonRows = [
  { feature: 'Time to Generate', manual: '2-3 Days', auto: '30 Seconds', icon: FiClock },
  { feature: 'Conflict Detection', manual: 'Manual Review', auto: 'Instant AI', icon: FiAlertTriangle },
  { feature: 'Revisions Needed', manual: 'Multiple Rounds', auto: 'One Click', icon: FiSettings },
  { feature: 'Accuracy', manual: 'Prone to Errors', auto: '100% Accurate', icon: FiShield },
  { feature: 'Faculty Workload', manual: 'Hard to Balance', auto: 'Auto Optimized', icon: FiTrendingUp },
  { feature: 'Export Options', manual: 'Print & Share', auto: 'PDF + Excel', icon: FiDownload },
];

const testimonials = [
  { name: 'Dr. Priya Sharma', role: 'HOD, Computer Science', college: 'SRM Institute of Technology', quote: 'Reduced our timetable generation time from 3 days to under a minute. The conflict resolution is phenomenal.', rating: 5 },
  { name: 'Prof. Rajesh Kumar', role: 'Dean, Academics', college: 'VIT University', quote: 'Our faculty workload is now perfectly balanced. The analytics dashboard gives us insights we never had before.', rating: 5 },
  { name: 'Ms. Anita Reddy', role: 'Academic Coordinator', college: 'BITS Pilani', quote: 'The Excel upload and PDF export features make it incredibly easy for non-technical staff to use.', rating: 5 },
  { name: 'Dr. Suresh Menon', role: 'Principal', college: 'NIT Trichy', quote: 'A game-changer for our institution. We recommend it to every college in our consortium.', rating: 5 },
  { name: 'Prof. Kavitha Nair', role: ' timetabling Officer', college: 'Amrita University', quote: 'The smart scheduling algorithm handles our complex 8-department overlap perfectly every time.', rating: 5 },
];

const faqData = [
  { q: 'How does the automatic scheduling work?', a: 'Our AI engine uses a combination of greedy algorithms and constraint-based backtracking to generate optimal timetables. It considers faculty availability, room capacity, subject prerequisites, and institutional constraints to produce conflict-free schedules.' },
  { q: 'What file format do I need to upload?', a: 'We support Excel (.xlsx) files with a predefined template. The template includes sheets for subjects, faculty, rooms, and scheduling constraints. You can download the template directly from the upload page.' },
  { q: 'Can I manually override the generated timetable?', a: 'Yes! After generation, you can swap time slots, reassign rooms, or lock specific cells. The system will automatically adjust the rest of the timetable to maintain conflict-free scheduling.' },
  { q: 'How many departments can it handle simultaneously?', a: 'There is no hard limit. The system has been tested with institutions running 15+ departments simultaneously with over 500 faculty members and 2000+ weekly class sessions.' },
  { q: 'Is my data secure?', a: 'All data is processed locally on your server. We do not send any institutional data to external servers. The application can be deployed entirely on-premise for maximum security.' },
  { q: 'Can I export timetables for individual faculty?', a: 'Yes, the system generates personalized timetables for each faculty member, each class, and each room. All exports are available in both PDF and Excel formats with professional styling.' },
];

const timetableData = [
  ['Mathematics', 'Physics', 'Chemistry', 'English', 'CS Lab', 'Break', 'Mathematics'],
  ['Physics', 'CS Theory', 'Mathematics', 'Physics Lab', 'Chemistry', 'Lunch', 'English'],
  ['Chemistry', 'Mathematics', 'English', 'CS Theory', 'Physics', 'Break', 'CS Lab'],
  ['CS Theory', 'English', 'Physics Lab', 'Chemistry', 'Mathematics', 'Lunch', 'Physics'],
  ['English', 'Chemistry', 'CS Lab', 'Mathematics', 'Physics', 'Break', 'CS Theory'],
];

const timeSlots = ['9:00', '10:00', '11:00', '12:00', '1:00', '2:00', '3:00'];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const colleges = ['SRM', 'VIT', 'BITS', 'NIT', 'IIT', 'Amrita', 'Anna University', 'Manipal', 'KIIT', 'LPU', 'DTU', 'IIIT'];

function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left - rect.width / 2) / 25);
    mouseY.set((e.clientY - rect.top - rect.height / 2) / 25);
  }, [mouseX, mouseY]);

  return (
    <section className="lh" ref={ref} onMouseMove={handleMouseMove}>
      <div className="lh-bg">
        <motion.div className="lh-blob lh-blob-1" style={{ y: bgY }} />
        <motion.div className="lh-blob lh-blob-2" style={{ y: bgY }} />
        <motion.div className="lh-blob lh-blob-3" style={{ y: bgY }} />
        <div className="lh-grid" />
        <div className="lh-icons">
          <FiCalendar className="lh-float-icon lh-fi-1" />
          <FiBook className="lh-float-icon lh-fi-2" />
          <FiClock className="lh-float-icon lh-fi-3" />
          <FiUsers className="lh-float-icon lh-fi-4" />
          <FiCpu className="lh-float-icon lh-fi-5" />
        </div>
      </div>

      <div className="lh-inner">
        <div className="lh-left">
          <motion.div className="lh-badge" variants={fadeUp} initial="hidden" animate="visible" custom={0}>
            <Zap size={14} />
            AI-Powered Scheduling Platform
          </motion.div>

          <motion.h1 className="lh-title" variants={fadeUp} initial="hidden" animate="visible" custom={1}>
            Automatic<br />
            <span className="lh-gradient-text">Timetable</span><br />
            Scheduler
          </motion.h1>

          <motion.div className="lh-typing" variants={fadeUp} initial="hidden" animate="visible" custom={2}>
            <span className="lh-typing-label">Generate</span>{' '}
            <TypeAnimation
              sequence={['Conflict-Free', 2000, 'Smart Scheduling', 2000, 'AI Powered', 2000]}
              wrapper="span"
              speed={40}
              repeat={Infinity}
              className="lh-typing-text"
            />
          </motion.div>

          <motion.p className="lh-desc" variants={fadeUp} initial="hidden" animate="visible" custom={3}>
            Upload your Excel configuration and let our AI engine generate optimized,
            conflict-free timetables in seconds. Built for modern educational institutions.
          </motion.p>

          <motion.div className="lh-btns" variants={fadeUp} initial="hidden" animate="visible" custom={4}>
            <Link to="/upload" className="lh-btn-primary">
              Generate Timetable
              <FiArrowRight size={18} />
            </Link>
            <a href="#how-it-works" className="lh-btn-outline">
              <FiPlay size={16} />
              Watch Demo
            </a>
          </motion.div>

          <motion.div className="lh-trust" variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            <div className="lh-trust-avatars">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="lh-trust-avatar" style={{ background: ['#2563EB', '#7C3AED', '#06B6D4', '#22C55E'][i] }}>
                  <FiUser size={14} />
                </div>
              ))}
            </div>
            <div className="lh-trust-info">
              <strong>100+ Institutions</strong>
              <span>trust our platform</span>
            </div>
          </motion.div>
        </div>

        <div className="lh-right">
          <motion.div
            className="lh-mockup"
            style={{ rotateX: springY, rotateY: springX }}
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            <div className="lh-mockup-frame">
              <div className="lh-mockup-dots">
                <span /><span /><span />
              </div>
              <div className="lh-mockup-content">
                <div className="lh-mockup-header">
                  <span className="lh-mockup-title">Dashboard</span>
                  <span className="lh-mockup-badge">Live</span>
                </div>
                <div className="lh-mockup-grid">
                  <div className="lh-mockup-stat">
                    <FiCalendar size={16} />
                    <div><span className="lh-ms-val">24</span><span className="lh-ms-label">Classes/Day</span></div>
                  </div>
                  <div className="lh-mockup-stat">
                    <FiUsers size={16} />
                    <div><span className="lh-ms-val">42</span><span className="lh-ms-label">Faculty</span></div>
                  </div>
                  <div className="lh-mockup-stat">
                    <FiZap size={16} />
                    <div><span className="lh-ms-val">98%</span><span className="lh-ms-label">Optimized</span></div>
                  </div>
                  <div className="lh-mockup-stat">
                    <FiAlertTriangle size={16} />
                    <div><span className="lh-ms-val">0</span><span className="lh-ms-label">Conflicts</span></div>
                  </div>
                </div>
                <div className="lh-mockup-chart">
                  <div className="lh-chart-bars">
                    {[65, 45, 80, 55, 70, 40, 90].map((h, i) => (
                      <div key={i} className="lh-chart-bar" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="lh-mockup-table">
                  <div className="lh-mt-row"><span>Math</span><span>9:00</span><span>Room 101</span></div>
                  <div className="lh-mt-row"><span>Physics</span><span>10:00</span><span>Lab A</span></div>
                  <div className="lh-mt-row"><span>CS Theory</span><span>11:00</span><span>Room 204</span></div>
                </div>
              </div>
            </div>

            <motion.div
              className="lh-float-card lh-fc-1"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <FiCheckCircle size={16} />
              <span>0 Conflicts</span>
            </motion.div>
            <motion.div
              className="lh-float-card lh-fc-2"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            >
              <FiUploadCloud size={16} />
              <span>Data Uploaded</span>
            </motion.div>
            <motion.div
              className="lh-float-card lh-fc-3"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            >
              <FiTrendingUp size={16} />
              <span>98% Optimized</span>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <a href="#clients" className="lh-scroll" aria-label="Scroll down">
        <motion.div
          className="lh-scroll-mouse"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <div className="lh-scroll-wheel" />
        </motion.div>
        <span>Scroll Down</span>
      </a>
    </section>
  );
}

function Clients() {
  return (
    <section className="lcl" id="clients">
      <div className="lcl-inner">
        <motion.p
          className="lcl-label"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          Trusted by leading institutions
        </motion.p>
        <div className="lcl-marquee-wrap">
          <Marquee speed={40} gradient={false} pauseOnHover>
            {colleges.map((c) => (
              <div key={c} className="lcl-card">
                <FiGlobe size={20} />
                <span>{c}</span>
              </div>
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="lfe" id="features">
      <div className="lfe-inner">
        <motion.div
          className="lfe-header"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <span className="lfe-label">Features</span>
          <h2 className="lfe-title">Everything you need for<br /><span className="lfe-gradient">perfect scheduling</span></h2>
          <p className="lfe-subtitle">Powerful tools designed to automate every aspect of timetable generation and management.</p>
        </motion.div>

        <motion.div
          className="lfe-grid"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div key={i} className="lfe-card" variants={fadeUp} custom={i}>
                <div className="lfe-card-glow" style={{ background: f.color }} />
                <div className="lfe-card-icon" style={{ background: `${f.color}12`, color: f.color }}>
                  <Icon size={24} />
                </div>
                <h3 className="lfe-card-title">{f.title}</h3>
                <p className="lfe-card-desc">{f.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="lhw" id="how-it-works">
      <div className="lhw-inner">
        <motion.div
          className="lhw-header"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <span className="lhw-label">How It Works</span>
          <h2 className="lhw-title">From upload to timetable<br />in <span className="lhw-gradient">five simple steps</span></h2>
        </motion.div>

        <div className="lhw-timeline">
          <div className="lhw-line" />
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={i}
                className={`lhw-step ${i % 2 === 0 ? 'lhw-step-left' : 'lhw-step-right'}`}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                custom={i}
              >
                <div className="lhw-step-dot">
                  <span className="lhw-step-num">{s.num}</span>
                </div>
                <div className="lhw-step-card">
                  <div className="lhw-step-icon">
                    <Icon size={22} />
                  </div>
                  <h3 className="lhw-step-title">{s.title}</h3>
                  <p className="lhw-step-desc">{s.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LivePreview() {
  const { ref, inView } = useInView({ threshold: 0.3, triggerOnce: true });
  const [revealIdx, setRevealIdx] = useState(-1);

  useEffect(() => {
    if (!inView) return;
    let idx = 0;
    const timer = setInterval(() => {
      setRevealIdx(idx);
      idx++;
      if (idx >= timetableData.length * timetableData[0].length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [inView]);

  const subjectColors = {
    Mathematics: '#2563EB', Physics: '#7C3AED', Chemistry: '#06B6D4',
    English: '#22C55E', 'CS Lab': '#F59E0B', 'CS Theory': '#EC4899',
    'Physics Lab': '#8B5CF6', Break: '#94A3B8', Lunch: '#94A3B8',
  };

  return (
    <section className="llp" id="live-preview">
      <div className="llp-inner">
        <motion.div
          className="llp-header"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <span className="llp-label">Live Preview</span>
          <h2 className="llp-title">See your timetable<br /><span className="llp-gradient">come to life</span></h2>
          <p className="llp-subtitle">Watch as cells fill automatically with optimized schedules.</p>
        </motion.div>

        <motion.div
          className="llp-table-wrap"
          ref={ref}
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <div className="llp-table">
            <div className="llp-thead">
              <div className="llp-th llp-th-time">Time</div>
              {days.map((d) => <div key={d} className="llp-th">{d}</div>)}
            </div>
            {timeSlots.map((t, ri) => (
              <div key={ri} className="llp-trow">
                <div className="llp-td llp-td-time">{t}</div>
                {days.map((d, ci) => {
                  const cellIdx = ri * days.length + ci;
                  const subject = timetableData[ri]?.[ci] || '';
                  const color = subjectColors[subject] || '#64748B';
                  const revealed = cellIdx <= revealIdx;
                  return (
                    <div
                      key={ci}
                      className={`llp-td ${revealed ? 'llp-td-revealed' : ''} ${subject === 'Break' || subject === 'Lunch' ? 'llp-td-break' : ''}`}
                      style={revealed ? { borderColor: `${color}30` } : {}}
                    >
                      {revealed && (
                        <motion.div
                          className="llp-cell"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <span className="llp-cell-subject" style={{ color }}>{subject}</span>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function DashboardShowcase() {
  return (
    <section className="lds">
      <div className="lds-inner">
        <motion.div
          className="lds-header"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <span className="lds-label">Dashboard</span>
          <h2 className="lds-title">Professional analytics<br /><span className="lds-gradient">at your fingertips</span></h2>
          <p className="lds-subtitle">Comprehensive dashboard with charts, statistics, and real-time insights.</p>
        </motion.div>

        <motion.div
          className="lds-laptop"
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <div className="lds-laptop-frame">
            <div className="lds-laptop-notch">
              <FiMousePointer size={12} />
            </div>
            <div className="lds-laptop-screen">
              <div className="lds-screen-sidebar">
                <FiCalendar size={18} />
                <FiUploadCloud size={18} />
                <FiCpu size={18} />
                <FiBarChart2 size={18} />
                <FiSettings size={18} />
              </div>
              <div className="lds-screen-main">
                <div className="lds-screen-topbar">
                  <span>Dashboard Overview</span>
                  <span className="lds-live-dot" />
                </div>
                <div className="lds-screen-stats">
                  <div className="lds-stat-card"><FiCalendar size={14} /><span>24</span></div>
                  <div className="lds-stat-card"><FiUsers size={14} /><span>42</span></div>
                  <div className="lds-stat-card"><FiBook size={14} /><span>18</span></div>
                  <div className="lds-stat-card"><FiZap size={14} /><span>98%</span></div>
                </div>
                <div className="lds-screen-charts">
                  <div className="lds-chart-area">
                    <svg viewBox="0 0 200 80" className="lds-sparkline">
                      <polyline
                        points="0,60 30,40 60,50 90,25 120,35 150,15 180,20 200,10"
                        fill="none"
                        stroke="#2563EB"
                        strokeWidth="2"
                      />
                      <polyline
                        points="0,60 30,40 60,50 90,25 120,35 150,15 180,20 200,10"
                        fill="url(#sparkGrad)"
                        stroke="none"
                      />
                      <defs>
                        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div className="lds-chart-bars">
                    {[40, 65, 50, 80, 35, 70, 55].map((h, i) => (
                      <motion.div
                        key={i}
                        className="lds-bar"
                        initial={{ height: 0 }}
                        whileInView={{ height: `${h}%` }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                        viewport={{ once: true }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="lds-laptop-base" />
        </motion.div>
      </div>
    </section>
  );
}

function Statistics() {
  return (
    <section className="lst">
      <div className="lst-inner">
        <motion.div
          className="lst-header"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <span className="lst-label">By the Numbers</span>
          <h2 className="lst-title">Trusted by educators<br /><span className="lst-gradient">across India</span></h2>
        </motion.div>

        <motion.div
          className="lst-grid"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={i} className="lst-card" variants={fadeUp} custom={i}>
                <div className="lst-card-icon"><Icon size={28} /></div>
                <div className="lst-card-value">
                  <CountUp end={s.value} duration={2.5} enableScrollSpy scrollSpyOnce />
                  <span>{s.suffix}</span>
                </div>
                <div className="lst-card-label">{s.label}</div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function WhyChooseUs() {
  return (
    <section className="lwc" id="why-choose">
      <div className="lwc-inner">
        <motion.div
          className="lwc-header"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <span className="lwc-label">Comparison</span>
          <h2 className="lwc-title">Manual vs<br /><span className="lwc-gradient">Automatic Scheduling</span></h2>
        </motion.div>

        <motion.div
          className="lwc-table"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <div className="lwc-thead">
            <div className="lwc-th lwc-th-feature">Feature</div>
            <div className="lwc-th lwc-th-manual">
              <FiX size={16} />
              Manual Method
            </div>
            <div className="lwc-th lwc-th-auto">
              <FiCheck size={16} />
              Automatic Scheduler
            </div>
          </div>
          {comparisonRows.map((r, i) => {
            const Icon = r.icon;
            return (
              <motion.div
                key={i}
                className="lwc-trow"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
              >
                <div className="lwc-td lwc-td-feature">
                  <Icon size={18} />
                  {r.feature}
                </div>
                <div className="lwc-td lwc-td-manual">{r.manual}</div>
                <div className="lwc-td lwc-td-auto">{r.auto}</div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function Testimonials() {
  const [active, setActive] = useState(0);
  const total = testimonials.length;

  useEffect(() => {
    const timer = setInterval(() => setActive((p) => (p + 1) % total), 5000);
    return () => clearInterval(timer);
  }, [total]);

  return (
    <section className="ltm">
      <div className="ltm-inner">
        <motion.div
          className="ltm-header"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <span className="ltm-label">Testimonials</span>
          <h2 className="ltm-title">What educators<br /><span className="ltm-gradient">are saying</span></h2>
        </motion.div>

        <div className="ltm-carousel">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              className="ltm-card"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
            >
              <div className="ltm-stars">
                {[...Array(testimonials[active].rating)].map((_, i) => (
                  <FiStar key={i} size={16} className="ltm-star" />
                ))}
              </div>
              <p className="ltm-quote">&ldquo;{testimonials[active].quote}&rdquo;</p>
              <div className="ltm-author">
                <div className="ltm-avatar" style={{ background: ['#2563EB', '#7C3AED', '#06B6D4', '#22C55E', '#F59E0B'][active] }}>
                  {testimonials[active].name.charAt(0)}
                </div>
                <div>
                  <strong className="ltm-name">{testimonials[active].name}</strong>
                  <span className="ltm-role">{testimonials[active].role}</span>
                  <span className="ltm-college">{testimonials[active].college}</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="ltm-dots">
            {testimonials.map((_, i) => (
              <button
                key={i}
                className={`ltm-dot ${i === active ? 'ltm-dot-active' : ''}`}
                onClick={() => setActive(i)}
                aria-label={`Testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <section className="lfaq" id="faq">
      <div className="lfaq-inner">
        <motion.div
          className="lfaq-header"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <span className="lfaq-label">FAQ</span>
          <h2 className="lfaq-title">Frequently asked<br /><span className="lfaq-gradient">questions</span></h2>
        </motion.div>

        <div className="lfaq-list">
          {faqData.map((item, i) => (
            <motion.div
              key={i}
              className={`lfaq-item ${openIdx === i ? 'lfaq-item-open' : ''}`}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
            >
              <button
                className="lfaq-question"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                aria-expanded={openIdx === i}
              >
                <span>{item.q}</span>
                <motion.div
                  className="lfaq-chevron"
                  animate={{ rotate: openIdx === i ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <FiChevronDown size={20} />
                </motion.div>
              </button>
              <AnimatePresence>
                {openIdx === i && (
                  <motion.div
                    className="lfaq-answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p>{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="lcta">
      <div className="lcta-bg">
        <div className="lcta-blob lcta-blob-1" />
        <div className="lcta-blob lcta-blob-2" />
      </div>
      <div className="lcta-inner">
        <motion.div
          className="lcta-content"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2 className="lcta-title">Ready to Generate Your<br /><span className="lcta-gradient">Timetable?</span></h2>
          <p className="lcta-desc">Upload your Excel configuration and let our AI engine create conflict-free, optimized timetables in seconds.</p>
          <div className="lcta-btns">
            <Link to="/upload" className="lcta-btn-primary">
              Upload Excel
              <FiArrowRight size={18} />
            </Link>
            <Link to="/upload" className="lcta-btn-outline">
              Generate Now
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Zap({ size, className }) {
  return <FiZap size={size} className={className} />;
}

function FiUser({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="landing">
      <Hero />
      <Clients />
      <Features />
      <HowItWorks />
      <LivePreview />
      <DashboardShowcase />
      <Statistics />
      <WhyChooseUs />
      <Testimonials />
      <FAQ />
      <CTA />
      <LandingFooter />
    </div>
  );
}
