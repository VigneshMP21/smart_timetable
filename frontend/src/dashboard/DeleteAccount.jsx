/**
 * Delete Account Page - Permanently delete the signed-in user's account.
 *
 * Purpose:
 *   Lets the user permanently delete their account and all associated data.
 *   Requires typing the account email as a final confirmation before the
 *   destructive DELETE /auth/account call is made. On success the local
 *   session is cleared and the user is returned to the landing page.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiAlertTriangle, FiTrash2, FiArrowLeft } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Buttons/Button';
import './DeleteAccount.css';

export default function DeleteAccount() {
  const { user, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const matchesEmail = confirmEmail.trim().toLowerCase() === (user.email || '').toLowerCase();
  const canDelete = Boolean(user.email) && matchesEmail && !deleting;

  const handleDelete = async () => {
    if (!matchesEmail) {
      toast.error('Please type your account email to confirm deletion.');
      return;
    }
    setDeleting(true);
    const res = await deleteAccount();
    setDeleting(false);
    if (res.success) {
      toast.success('Your account has been permanently deleted.');
      navigate('/', { replace: true });
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="container">
        <motion.div
          className="delete-account-page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="page-header">
            <h1>Delete Account</h1>
            <p>Permanently remove your account and all associated data.</p>
          </div>

          <div className="delete-account-card">
            <div className="delete-account-warning">
              <FiAlertTriangle size={22} className="delete-account-warning-icon" />
              <div>
                <h3>This action is permanent</h3>
                <p>
                  Once you delete your account, it cannot be recovered. All of the following
                  will be permanently removed:
                </p>
              </div>
            </div>

            <ul className="delete-account-list">
              <li>Your account and profile information</li>
              <li>All classes and class data you have created</li>
              <li>Associated subjects and timetable entries</li>
              <li>Access to all dashboard features</li>
            </ul>

            <div className="delete-account-field">
              <label className="delete-account-label" htmlFor="confirm-email">
                Type <strong>{user.email || 'your email'}</strong> to confirm
              </label>
              <input
                id="confirm-email"
                className="delete-account-input"
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder="Enter your account email"
                autoComplete="off"
              />
              {user.email && confirmEmail && !matchesEmail && (
                <p className="delete-account-error">Email does not match your account email.</p>
              )}
            </div>

            <div className="delete-account-actions">
              <Link to="/profile" className="delete-account-cancel">
                <FiArrowLeft size={16} /> Keep my account
              </Link>
              <Button variant="danger" onClick={handleDelete} disabled={!canDelete} loading={deleting}>
                <FiTrash2 size={16} /> {deleting ? 'Deleting...' : 'Permanently Delete Account'}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
