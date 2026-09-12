import { motion } from 'framer-motion';
import { FiUsers, FiBook, FiClock, FiCalendar, FiAlertTriangle, FiZap } from 'react-icons/fi';
import './StatisticsCard.css';

const iconMap = {
  classes: FiUsers,
  subjects: FiBook,
  faculty: FiUsers,
  timetables: FiCalendar,
  time: FiClock,
  conflicts: FiAlertTriangle,
  utilization: FiZap,
  total: FiBook,
};

/**
 * Statistics card displaying a metric with icon and value.
 * @param {string} label - Card label
 * @param {number|string} value - Metric value
 * @param {string} type - Icon type key
 * @param {string} color - Accent color
 * @param {number} delay - Animation delay
 */
export default function StatisticsCard({ label, value, type = 'total', color, delay = 0 }) {
  const Icon = iconMap[type] || FiBook;

  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <div className="stat-card-icon" style={{ background: `${color || 'var(--primary)'}15`, color: color || 'var(--primary)' }}>
        <Icon size={24} />
      </div>
      <div className="stat-card-info">
        <p className="stat-card-value">{value ?? '--'}</p>
        <p className="stat-card-label">{label}</p>
      </div>
    </motion.div>
  );
}
