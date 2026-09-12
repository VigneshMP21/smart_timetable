/**
 * PasswordStrength - Animated progress bar showing password strength.
 *
 * @param {string} password - Current password value
 * Shows Weak / Medium / Strong with color-coded bar
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import './PasswordStrength.css';

export default function PasswordStrength({ password = '' }) {
  const { score, label, color } = useMemo(() => {
    if (!password) return { score: 0, label: '', color: 'transparent' };
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[a-z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;

    if (s <= 2) return { score: 1, label: 'Weak', color: '#EF4444' };
    if (s <= 3) return { score: 2, label: 'Medium', color: '#F59E0B' };
    return { score: 3, label: 'Strong', color: '#22C55E' };
  }, [password]);

  if (!password) return null;

  return (
    <div className="ps-wrap">
      <div className="ps-bar-bg">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="ps-bar-segment"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: i < score ? 1 : 0 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
            style={{ background: i < score ? color : '#E2E8F0', transformOrigin: 'left' }}
          />
        ))}
      </div>
      <span className="ps-label" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
