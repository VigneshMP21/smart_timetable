/**
 * ForgotPassword Page - Request a password reset email.
 *
 * Purpose:
 *   Sends a Supabase "reset password" email containing a secure recovery
 *   link. The user clicks the link, lands on /reset-password, and creates a
 *   new password.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/Auth/AuthLayout';
import { validateEmail } from '../utils/validators';
import './ForgotPassword.css';

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = validateEmail(email);
    if (!result.valid) { setEmailError(result.error); return; }

    setLoading(true);
    const res = await forgotPassword(email.trim());
    setLoading(false);

    if (res.success) {
      setSent(true);
      toast.success('Password reset link sent to your email!');
    } else {
      toast.error(res.error);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a secure link to set a new password."
    >
      <div className="fp-steps">
        {['Email', 'Reset Link', 'New Password'].map((label, i) => (
          <div key={i} className={`fp-step-dot ${i <= (sent ? 1 : 0) ? 'fp-step-active' : ''}`}>
            <span>{i < (sent ? 1 : 0) ? '\u2713' : i + 1}</span>
            <span className="fp-step-label">{label}</span>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.form
            key="email"
            className="fp-form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h2 className="login-title">Forgot Password?</h2>
            <p className="login-sub" style={{ marginBottom: 24 }}>
              Enter your registered email and we&apos;ll send you a secure reset link.
            </p>
            <div className="login-field">
              <label className="login-label" htmlFor="fp-email">Email</label>
              <div className={`login-input-wrap ${emailError ? 'login-input-error' : ''}`}>
                <FiMail className="login-input-icon" size={18} />
                <input
                  id="fp-email"
                  type="email"
                  placeholder="you@college.edu"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                />
              </div>
              {emailError && <span className="login-error">{emailError}</span>}
            </div>
            <motion.button
              type="submit"
              className="login-submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? <span className="login-spinner" /> : 'Send Reset Link'}
            </motion.button>
            <p className="login-footer">
              Remember your password? <Link to="/login" className="login-link">Sign In</Link>
            </p>
          </motion.form>
        ) : (
          <motion.div
            key="sent"
            className="fp-success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}>
              <FiCheckCircle size={64} className="fp-success-icon" />
            </motion.div>
            <h2 className="login-title" style={{ textAlign: 'center', marginTop: 20 }}>Check Your Email</h2>
            <p className="login-sub" style={{ textAlign: 'center', marginBottom: 8 }}>
              We sent a password reset link to
            </p>
            <p className="login-sub" style={{ textAlign: 'center', fontWeight: 700, color: '#2563EB' }}>
              {email}
            </p>
            <p className="login-sub" style={{ textAlign: 'center', marginTop: 12 }}>
              The link expires in a few minutes. Didn&apos;t get it? Check your spam folder.
            </p>
            <Link to="/login" className="login-forgot" style={{ textAlign: 'center', display: 'block', marginTop: 20 }}>
              <FiArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back to Sign In
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
