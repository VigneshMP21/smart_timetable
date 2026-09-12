import { motion } from 'framer-motion';
import { FiGithub, FiCode, FiBook, FiMail } from 'react-icons/fi';
import './About.css';

const techStack = [
  { name: 'React.js', desc: 'UI Framework' },
  { name: 'Vite', desc: 'Build Tool' },
  { name: 'React Router', desc: 'Client Routing' },
  { name: 'Axios', desc: 'HTTP Client' },
  { name: 'Chart.js', desc: 'Data Visualization' },
  { name: 'Framer Motion', desc: 'Animations' },
  { name: 'FastAPI', desc: 'Backend API' },
  { name: 'SQLite', desc: 'Database' },
];

const features = [
  'Excel file upload with drag-and-drop',
  'Automatic timetable generation',
  'Conflict-free scheduling with backtracking',
  'Faculty workload optimization',
  'Lab session consecutive allocation',
  'PDF and Excel export',
  'Interactive statistics and charts',
  'Responsive design for all devices',
];

/**
 * About page with project info, tech stack, and features.
 */
export default function About() {
  return (
    <div className="page-wrapper">
      <div className="container">
        <motion.div
          className="about-page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="page-header text-center">
            <h1>About This Project</h1>
            <p>Smart Timetable - Intelligent scheduling for educational institutions.</p>
          </div>

          <div className="about-hero">
            <h2>Smart Timetable</h2>
            <p className="about-version">Version 1.0.0</p>
            <p className="about-desc">
              An intelligent timetable scheduling system that generates conflict-free
              class schedules using advanced algorithms including greedy scheduling,
              backtracking repair, and genetic optimization.
            </p>
          </div>

          <div className="about-sections">
            <motion.div
              className="about-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="about-card-header">
                <FiCode size={20} />
                <h3>Technology Stack</h3>
              </div>
              <div className="tech-grid">
                {techStack.map((tech, i) => (
                  <div key={i} className="tech-item">
                    <span className="tech-name">{tech.name}</span>
                    <span className="tech-desc">{tech.desc}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="about-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="about-card-header">
                <FiBook size={20} />
                <h3>Features</h3>
              </div>
              <ul className="about-features">
                {features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              className="about-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="about-card-header">
                <FiMail size={20} />
                <h3>Contact & Support</h3>
              </div>
              <div className="about-contact">
                <p>For support or contributions, visit the GitHub repository or reach out via email.</p>
                <div className="about-links">
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="about-link">
                    <FiGithub size={16} /> GitHub
                  </a>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="about-footer">
            <p>&copy; {new Date().getFullYear()} Smart Timetable. All rights reserved.</p>
            <p>Licensed under the MIT License.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
