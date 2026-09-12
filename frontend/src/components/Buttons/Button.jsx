import { motion } from 'framer-motion';
import './Button.css';

/**
 * Reusable button component with variants and loading state.
 * @param {string} variant - 'primary', 'secondary', 'outline', 'danger', 'success'
 * @param {string} size - 'sm', 'md', 'lg'
 * @param {boolean} loading - Show loading spinner
 * @param {boolean} disabled - Disable button
 * @param {ReactNode} children - Button content
 * @param {function} onClick - Click handler
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  ...props
}) {
  const classes = `btn btn-${variant} btn-${size} ${className}`;

  return (
    <motion.button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="btn-spinner" aria-hidden="true">
          <span className="spinner-dot" />
          <span className="spinner-dot" />
          <span className="spinner-dot" />
        </span>
      )}
      <span className={loading ? 'btn-loading-text' : ''}>{children}</span>
    </motion.button>
  );
}
