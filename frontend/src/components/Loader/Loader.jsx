import { motion } from 'framer-motion';
import './Loader.css';

/**
 * Full-page loading spinner with animated messages.
 * @param {string} message - Current loading message
 * @param {number} progress - Progress percentage (0-100), optional
 */
export default function Loader({ message = 'Loading...', progress }) {
  return (
    <div className="loader-overlay" role="alert" aria-busy="true" aria-live="polite">
      <motion.div
        className="loader-content"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="loader-spinner">
          <div className="spinner-ring" />
          <div className="spinner-ring" />
          <div className="spinner-ring" />
        </div>
        <p className="loader-message">{message}</p>
        {progress != null && (
          <div className="loader-progress">
            <div className="loader-progress-bar">
              <motion.div
                className="loader-progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="loader-progress-text">{Math.round(progress)}%</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
