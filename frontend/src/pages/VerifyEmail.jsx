/**
 * VerifyEmail Page - Email confirmation screen.
 *
 * Purpose:
 *   Supabase sends a confirmation email containing a link that lands on
 *   /verify-email?token_hash=...&type=email. This page:
 *   - Auto-verifies the account when a token_hash is present in the URL.
 *   - Shows a "check your email" prompt (with resend) right after sign up.
 *   - Displays success or error states after attempting verification.
 */
import { useEffect, useCallback, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMail, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/Auth/AuthLayout';
import './VerifyEmail.css';

const STATUS = {
  pending: 'pending',
  verifying: 'verifying',
  success: 'success',
  error: 'error',
};

export default function VerifyEmail() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { verifyEmail, resendConfirmation } = useAuth();

  const tokenHash = searchParams.get('token_hash');
  const email = location.state?.email || '';
  const [status, setStatus] = useState(tokenHash ? STATUS.verifying : STATUS.pending);

  const runVerification = useCallback(
    async (t) => {
      setStatus(STATUS.verifying);
      const res = await verifyEmail(t);
      if (res.success) {
        setStatus(STATUS.success);
        toast.success(res.message || 'Email verified successfully!');
      } else {
        setStatus(STATUS.error);
        toast.error(res.error);
      }
    },
    [verifyEmail]
  );

  useEffect(() => {
    if (tokenHash && status === STATUS.verifying) {
      runVerification(tokenHash);
    }
  }, [tokenHash, status, runVerification]);

  const handleResend = async () => {
    if (!email) {
      toast.error('Email address missing. Please sign up again.');
      return;
    }
    const res = await resendConfirmation(email);
    if (res.success) {
      toast.success('Confirmation email resent!');
    } else {
      toast.error(res.error);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="One more step before you can sign in."
    >
      <div className="ve-form">
        {status === STATUS.verifying && (
          <>
            <div className="ve-icon"><FiMail size={28} /></div>
            <h2 className="login-title" style={{ textAlign: 'center' }}>Verifying Your Email</h2>
            <p className="login-sub" style={{ textAlign: 'center', marginBottom: 28 }}>
              Please wait while we confirm your email address...
            </p>
            <div className="login-spinner" style={{ margin: '0 auto' }} />
          </>
        )}

        {status === STATUS.success && (
          <>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
              <FiCheckCircle size={72} className="ve-success-icon" />
            </motion.div>
            <h2 className="login-title" style={{ textAlign: 'center', marginTop: 24 }}>Email Verified!</h2>
            <p className="login-sub" style={{ textAlign: 'center', marginBottom: 28 }}>
              Your account is now active. You can sign in with your email and password.
            </p>
            <Link to="/login" className="login-submit" style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}>
              Go to Sign In
            </Link>
          </>
        )}

        {status === STATUS.error && (
          <>
            <div className="rp-invalid-icon"><FiAlertTriangle size={28} /></div>
            <h2 className="login-title" style={{ textAlign: 'center' }}>Verification Failed</h2>
            <p className="login-sub" style={{ textAlign: 'center', marginBottom: 28 }}>
              This verification link is invalid or has expired.
              {email ? ' You can request a new link below.' : ' Please register again to receive a new link.'}
            </p>
            {email && (
              <button type="button" className="login-submit" onClick={handleResend} style={{ border: 'none' }}>
                Resend Confirmation Email
              </button>
            )}
            <p className="login-footer"><Link to="/login" className="login-link">Back to Sign In</Link></p>
          </>
        )}

        {status === STATUS.pending && (
          <>
            <div className="ve-icon"><FiMail size={28} /></div>
            <h2 className="login-title" style={{ textAlign: 'center' }}>Check Your Email</h2>
            <p className="login-sub" style={{ textAlign: 'center', marginBottom: 28 }}>
              We sent a confirmation link to<br />
              <strong>{email || 'your email'}</strong>
            </p>
            <p className="login-sub" style={{ textAlign: 'center', marginBottom: 28 }}>
              Click the link in the email to activate your account, then sign in.
            </p>

            <button type="button" className="login-submit" onClick={handleResend} style={{ border: 'none' }}>
              Resend Confirmation Email
            </button>
            <p className="login-footer"><Link to="/login" className="login-link">Back to Sign In</Link></p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
