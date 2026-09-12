/**
 * ResetPassword Page - Set a new password from a recovery link.
 *
 * Purpose:
 *   Supabase sends a password recovery email containing a link that lands on
 *   /reset-password?code=...&type=recovery (or a hash-based token). This page
 *   lets the user choose a new password, updates it through Supabase Auth,
 *   then redirects to the login page.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiLock, FiEye, FiEyeOff, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import AuthLayout from '../components/Auth/AuthLayout';
import PasswordStrength from '../components/Auth/PasswordStrength';
import { validatePassword, validateConfirmPassword } from '../utils/validators';
import './ForgotPassword.css';
import './ResetPassword.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword } = useAuth();

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const recoveryToken = code || tokenHash;

  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCPw, setShowCPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Hash-based recovery links carry the token in the URL fragment, which
  // Supabase auto-detects into a session. Treat the link as valid when either
  // a recovery param is present or a session has been established.
  useEffect(() => {
    let active = true;
    (async () => {
      if (recoveryToken) {
        if (active) { setReady(true); setChecked(true); }
        return;
      }
      let hasSession = false;
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        hasSession = Boolean(data.session);
      }
      if (active) { setReady(hasSession); setChecked(true); }
    })();
    return () => { active = false; };
  }, [recoveryToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const pwResult = validatePassword(password);
    if (!pwResult.valid) { toast.error(pwResult.error); return; }
    const cpwResult = validateConfirmPassword(password, confirmPw);
    if (!cpwResult.valid) { toast.error(cpwResult.error); return; }

    setLoading(true);
    const res = await resetPassword(recoveryToken, password);
    setLoading(false);

    if (res.success) {
      setDone(true);
      toast.success('Password updated successfully!');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } else {
      toast.error(res.error);
    }
  };

  if (done) {
    return (
      <AuthLayout title="Password reset" subtitle="Your password has been updated.">
        <div className="fp-success">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}>
            <FiCheckCircle size={64} className="fp-success-icon" />
          </motion.div>
          <h2 className="login-title" style={{ textAlign: 'center', marginTop: 20 }}>Password Updated!</h2>
          <p className="login-sub" style={{ textAlign: 'center', marginBottom: 28 }}>
            Redirecting you to sign in with your new password...
          </p>
        </div>
      </AuthLayout>
    );
  }

  // No recovery session -> the reset link was invalid, missing, or already used.
  if (checked && !ready) {
    return (
      <AuthLayout title="Reset your password" subtitle="Something went wrong.">
        <div className="fp-form">
          <div className="rp-invalid-icon"><FiAlertTriangle size={28} /></div>
          <h2 className="login-title" style={{ textAlign: 'center' }}>Invalid Reset Link</h2>
          <p className="login-sub" style={{ textAlign: 'center', marginBottom: 24 }}>
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <motion.button
            className="login-submit"
            onClick={() => navigate('/forgot-password')}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            Request New Link
          </motion.button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create a new password"
      subtitle="Choose a strong password for your Smart Timetable account."
    >
      <form className="fp-form" onSubmit={handleSubmit}>
        <h2 className="login-title">New Password</h2>
        <p className="login-sub" style={{ marginBottom: 24 }}>
          Pick a new password for your account.
        </p>

        <div className="login-field">
          <label className="login-label">New Password</label>
          <div className="login-input-wrap">
            <FiLock className="login-input-icon" size={18} />
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button type="button" className="login-eye" onClick={() => setShowPw(!showPw)} aria-label="Toggle password">
              {showPw ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
          <PasswordStrength password={password} />
        </div>

        <div className="login-field">
          <label className="login-label">Confirm Password</label>
          <div className="login-input-wrap">
            <FiLock className="login-input-icon" size={18} />
            <input
              type={showCPw ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
            />
            <button type="button" className="login-eye" onClick={() => setShowCPw(!showCPw)} aria-label="Toggle confirm password">
              {showCPw ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
        </div>

        <motion.button
          type="submit"
          className="login-submit"
          disabled={loading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? <span className="login-spinner" /> : 'Update Password'}
        </motion.button>
      </form>
    </AuthLayout>
  );
}
