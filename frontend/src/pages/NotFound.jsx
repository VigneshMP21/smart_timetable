import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiHome, FiAlertTriangle } from 'react-icons/fi';
import Button from '../components/Buttons/Button';
import './NotFound.css';

/**
 * 404 Not Found page for invalid routes.
 */
export default function NotFound() {
  return (
    <div className="notfound-page">
      <motion.div
        className="notfound-content"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="notfound-icon">
          <FiAlertTriangle size={48} />
        </div>
        <h1 className="notfound-code">404</h1>
        <h2 className="notfound-title">Page Not Found</h2>
        <p className="notfound-desc">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button variant="primary" size="lg">
            <FiHome size={18} /> Back to Home
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
