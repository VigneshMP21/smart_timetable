/**
 * Register Page - Premium two-column auth layout.
 *
 * Purpose:
 *   Create a new Supabase account and store the profile in the "profiles"
 *   table (via a Supabase database trigger).
 *
 *   Fields: full name, college, department, email, phone, password,
 *   confirm password, terms accepted.
 *
 *   Note: No role field - every account is automatically created with the
 *   default role "user" (assigned by the database on sign up).
 */
import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiPhone, FiGrid, FiBook, FiArrowLeft } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/Auth/AuthLayout';
import PasswordStrength from '../components/Auth/PasswordStrength';
import SocialLoginButtons from '../components/Auth/SocialLoginButtons';
import { validateName, validateEmail, validatePhone, validatePassword, validateConfirmPassword } from '../utils/validators';
import './Login.css';
import './Register.css';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', college: '', department: '',
    email: '', phone: '', password: '', confirmPassword: '', terms: false,
  });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [showCPw, setShowCPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [touched, setTouched] = useState({});

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;
    setForm((prev) => ({ ...prev, [name]: nextValue }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));

    // Live password-mismatch feedback so the user sees an alert immediately.
    if (name === 'confirmPassword') {
      setTouched((prev) => ({ ...prev, confirmPassword: true }));
      if (value && value !== form.password) {
        setErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match.' }));
      } else if (errors.confirmPassword === 'Passwords do not match.') {
        setErrors((prev) => ({ ...prev, confirmPassword: '' }));
      }
    }

    // Re-check when the password field changes and a confirm value already exists.
    if (name === 'password' && form.confirmPassword) {
      if (value !== form.confirmPassword) {
        setErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match.' }));
      } else if (errors.confirmPassword === 'Passwords do not match.') {
        setErrors((prev) => ({ ...prev, confirmPassword: '' }));
      }
    }
  }, [errors, form.password, form.confirmPassword]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    const validators = {
      name: () => validateName(form.name),
      email: () => validateEmail(form.email),
      phone: () => form.phone ? validatePhone(form.phone) : { valid: true, error: '' },
      password: () => validatePassword(form.password),
      confirmPassword: () => validateConfirmPassword(form.password, form.confirmPassword),
    };

    if (validators[name]) {
      const result = validators[name]();
      if (!result.valid) setErrors((prev) => ({ ...prev, [name]: result.error }));
    }
  }, [form]);

  const isFormValid =
    form.name && form.name.length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.password && form.password.length >= 8 &&
    form.password === form.confirmPassword &&
    form.terms;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    const nameR = validateName(form.name);
    const emailR = validateEmail(form.email);
    const pwR = validatePassword(form.password);
    const cpwR = validateConfirmPassword(form.password, form.confirmPassword);

    if (!nameR.valid) newErrors.name = nameR.error;
    if (!emailR.valid) newErrors.email = emailR.error;
    if (form.phone) { const phR = validatePhone(form.phone); if (!phR.valid) newErrors.phone = phR.error; }
    if (!pwR.valid) newErrors.password = pwR.error;
    if (!cpwR.valid) newErrors.confirmPassword = cpwR.error;
    if (!form.terms) newErrors.terms = 'You must accept the terms.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({ name: true, email: true, phone: true, password: true, confirmPassword: true, terms: true });
      return;
    }

    setLoading(true);
    const result = await register({
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      college: form.college,
      department: form.department,
    });
    setLoading(false);

    if (result.success) {
      toast.success('Account created! Please check your email to verify your account.');
      navigate('/verify-email', { state: { email: form.email } });
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(result.error);
    }
  };

  return (
    <AuthLayout
      title="Start scheduling smarter"
      subtitle="Create your account and generate optimized timetables in minutes."
    >
      <form className={`reg-form ${shake ? 'login-shake' : ''}`} onSubmit={handleSubmit} noValidate>
        <div className="login-header">
          <Link to="/" className="login-back">
            <FiArrowLeft size={15} /> Back to Home
          </Link>
          <h2 className="login-title">Create Account</h2>
          <p className="login-sub">Fill in your details to get started</p>
        </div>

        <div className="login-field">
          <label className="login-label" htmlFor="reg-name">Full Name</label>
          <div className={`login-input-wrap ${errors.name && touched.name ? 'login-input-error' : ''}`}>
            <FiUser className="login-input-icon" size={18} />
            <input id="reg-name" type="text" name="name" placeholder="John Doe" value={form.name} onChange={handleChange} onBlur={handleBlur} autoComplete="name" />
          </div>
          {errors.name && touched.name && <span className="login-error">{errors.name}</span>}
        </div>

        <div className="reg-row">
          <div className="login-field">
            <label className="login-label" htmlFor="reg-college">College Name</label>
            <div className="login-input-wrap">
              <FiGrid className="login-input-icon" size={18} />
              <input id="reg-college" type="text" name="college" placeholder="SRM Institute" value={form.college} onChange={handleChange} autoComplete="organization" />
            </div>
          </div>
          <div className="login-field">
            <label className="login-label" htmlFor="reg-dept">Department</label>
            <div className="login-input-wrap">
              <FiBook className="login-input-icon" size={18} />
              <input id="reg-dept" type="text" name="department" placeholder="Computer Science" value={form.department} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="login-field">
          <label className="login-label" htmlFor="reg-email">Email</label>
          <div className={`login-input-wrap ${errors.email && touched.email ? 'login-input-error' : ''}`}>
            <FiMail className="login-input-icon" size={18} />
            <input id="reg-email" type="email" name="email" placeholder="you@college.edu" value={form.email} onChange={handleChange} onBlur={handleBlur} autoComplete="email" />
          </div>
          {errors.email && touched.email && <span className="login-error">{errors.email}</span>}
        </div>

        <div className="login-field">
          <label className="login-label" htmlFor="reg-phone">Phone Number</label>
          <div className={`login-input-wrap ${errors.phone && touched.phone ? 'login-input-error' : ''}`}>
            <FiPhone className="login-input-icon" size={18} />
            <input id="reg-phone" type="tel" name="phone" placeholder="9876543210" value={form.phone} onChange={handleChange} onBlur={handleBlur} autoComplete="tel" />
          </div>
          {errors.phone && touched.phone && <span className="login-error">{errors.phone}</span>}
        </div>

        <div className="reg-row">
          <div className="login-field">
            <label className="login-label" htmlFor="reg-pw">Password</label>
            <div className={`login-input-wrap ${errors.password && touched.password ? 'login-input-error' : ''}`}>
              <FiLock className="login-input-icon" size={18} />
              <input id="reg-pw" type={showPw ? 'text' : 'password'} name="password" placeholder="Min 8 characters" value={form.password} onChange={handleChange} autoComplete="new-password" />
              <button type="button" className="login-eye" onClick={() => setShowPw(!showPw)} aria-label="Toggle password">
                {showPw ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
            {errors.password && touched.password && <span className="login-error">{errors.password}</span>}
            <PasswordStrength password={form.password} />
          </div>
          <div className="login-field">
            <label className="login-label" htmlFor="reg-cpw">Confirm Password</label>
            <div className={`login-input-wrap ${errors.confirmPassword && touched.confirmPassword ? 'login-input-error' : ''}`}>
              <FiLock className="login-input-icon" size={18} />
              <input id="reg-cpw" type={showCPw ? 'text' : 'password'} name="confirmPassword" placeholder="Re-enter password" value={form.confirmPassword} onChange={handleChange} autoComplete="new-password" />
              <button type="button" className="login-eye" onClick={() => setShowCPw(!showCPw)} aria-label="Toggle confirm password">
                {showCPw ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && touched.confirmPassword && <span className="login-error">{errors.confirmPassword}</span>}
          </div>
        </div>

        <label className={`login-check reg-terms ${errors.terms && touched.terms ? 'reg-terms-error' : ''}`}>
          <input type="checkbox" name="terms" checked={form.terms} onChange={handleChange} />
          <span>I agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link></span>
        </label>
        {errors.terms && touched.terms && <span className="login-error" style={{ marginTop: '-12px', marginBottom: '8px' }}>{errors.terms}</span>}

        <motion.button
          type="submit"
          className="login-submit"
          disabled={!isFormValid || loading}
          whileHover={{ scale: isFormValid && loading ? 1 : 1.01 }}
          whileTap={{ scale: isFormValid && loading ? 1 : 0.98 }}
        >
          {loading ? <span className="login-spinner" /> : 'Create Account'}
        </motion.button>

        <SocialLoginButtons />

        <p className="login-footer">
          Already have an account?{' '}
          <Link to="/login" className="login-link">Sign In</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
