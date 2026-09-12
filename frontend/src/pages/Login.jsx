/**
 * Login Page - Premium two-column auth layout.
 *
 * Purpose:
 *   Sign in with a Supabase account (email + password).
 *   Features:
 *     - Real-time validation
 *     - Remember Me (persistent vs session-only storage)
 *     - Forgot Password link
 *     - Google / GitHub buttons (UI only - disabled for now)
 */
import { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowLeft } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/Auth/AuthLayout';
import SocialLoginButtons from '../components/Auth/SocialLoginButtons';
import { validateEmail } from '../utils/validators';
import './Login.css';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [touched, setTouched] = useState({});

  const from = location.state?.from || '/dashboard';

  // If the user is already signed in (e.g. email link confirmation redirect), go to the dashboard.
  // Skipped while a login request is in flight: the submit handler navigates after auth settles,
  // and navigating early lets a post-login 401 sign the fresh session back out (Login Required loop).
  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, from, navigate, loading]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }, [errors]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    if (name === 'email') {
      const result = validateEmail(form.email);
      if (!result.valid) setErrors((prev) => ({ ...prev, email: result.error }));
    }
    if (name === 'password' && !form.password) {
      setErrors((prev) => ({ ...prev, password: 'Password is required.' }));
    }
  }, [form]);

  const isFormValid = form.email && form.password &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailResult = validateEmail(form.email);
    const newErrors = {};
    if (!emailResult.valid) newErrors.email = emailResult.error;
    if (!form.password) newErrors.password = 'Password is required.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    const result = await login(form.email.trim(), form.password, rememberMe);
    setLoading(false);

    if (result.success) {
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(result.error);
      setErrors({ password: result.error });
    }
  };

  return (
    <AuthLayout
      title="Welcome back to Smart Timetable"
      subtitle="Sign in to generate conflict-free, optimized timetables for your institution."
    >
      <form className={`login-form ${shake ? 'login-shake' : ''}`} onSubmit={handleSubmit} noValidate>
        <div className="login-header">
          <Link to="/" className="login-back">
            <FiArrowLeft size={15} /> Back to Home
          </Link>
          <h2 className="login-title">Welcome Back</h2>
          <p className="login-sub">Sign in to continue</p>
        </div>

        <div className="login-field">
          <label className="login-label" htmlFor="login-email">Email</label>
          <div className={`login-input-wrap ${errors.email && touched.email ? 'login-input-error' : ''}`}>
            <FiMail className="login-input-icon" size={18} />
            <input
              id="login-email"
              type="email"
              name="email"
              placeholder="you@college.edu"
              value={form.email}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="email"
            />
          </div>
          {errors.email && touched.email && <span className="login-error">{errors.email}</span>}
        </div>

        <div className="login-field">
          <label className="login-label" htmlFor="login-password">Password</label>
          <div className={`login-input-wrap ${errors.password && touched.password ? 'login-input-error' : ''}`}>
            <FiLock className="login-input-icon" size={18} />
            <input
              id="login-password"
              type={showPw ? 'text' : 'password'}
              name="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="current-password"
            />
            <button type="button" className="login-eye" onClick={() => setShowPw(!showPw)} aria-label="Toggle password">
              {showPw ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
          {errors.password && touched.password && <span className="login-error">{errors.password}</span>}
        </div>

        <div className="login-row">
          <label className="login-check">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
          <Link to="/forgot-password" className="login-forgot">Forgot Password?</Link>
        </div>

        <motion.button
          type="submit"
          className="login-submit"
          disabled={!isFormValid || loading}
          whileHover={{ scale: isFormValid && !loading ? 1.01 : 1 }}
          whileTap={{ scale: isFormValid && !loading ? 0.98 : 1 }}
        >
          {loading ? (
            <span className="login-spinner" />
          ) : (
            'Sign In'
          )}
        </motion.button>

        <SocialLoginButtons />

        <p className="login-footer">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="login-link">Create Account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
