import { motion } from 'framer-motion';
import { FiInbox } from 'react-icons/fi';

/**
 * EmptyState - friendly placeholder shown when the class list is empty.
 * @param {object} icon - Optional react-icons component (default FiInbox).
 * @param {string} title - Main heading text.
 * @param {string} subtitle - Secondary supporting text.
 * @param {string} actionLabel - Optional action button label.
 * @param {function} onAction - Optional action button handler.
 */
export default function EmptyState({
  icon: Icon = FiInbox,
  title,
  subtitle,
  actionLabel,
  onAction,
}) {
  return (
    <motion.div
      className="class-empty"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="class-empty-icon">
        <Icon size={36} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
      {actionLabel && onAction && (
        <button type="button" className="class-btn class-btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
