/**
 * Profile Page - Display and edit the signed-in user's profile.
 *
 * Purpose:
 *   Shows the profile picture placeholder, full name, email, college,
 *   department, role, phone, created date, and last login. Editable fields
 *   are persisted through the backend PUT /auth/profile endpoint.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiUser, FiMail, FiGrid, FiBook, FiShield, FiPhone,
  FiCalendar, FiClock, FiSave, FiCheck,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Buttons/Button';
import './Profile.css';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const ROLE_LABELS = {
  user: 'User',
  admin: 'Administrator',
};

export default function Profile() {
  const { user, updateProfile } = useAuth();

  const [form, setForm] = useState({
    full_name: '',
    college_name: '',
    department: '',
    phone_number: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        college_name: user.college_name || '',
        department: user.department || '',
        phone_number: user.phone_number || '',
      });
    }
  }, [user]);

  if (!user) return null;

  const initials = user.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast.error('Full name is required.');
      return;
    }
    setSaving(true);
    const res = await updateProfile({
      full_name: form.full_name.trim(),
      college_name: form.college_name.trim(),
      department: form.department.trim(),
      phone_number: form.phone_number.trim(),
    });
    setSaving(false);
    if (res.success) {
      setSaved(true);
      toast.success('Profile updated successfully!');
      setTimeout(() => setSaved(false), 2500);
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="container">
        <motion.div
          className="profile-page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="page-header">
            <h1>My Profile</h1>
            <p>View and update your personal information.</p>
          </div>

          <div className="profile-grid">
            {/* Identity card */}
            <div className="profile-card profile-identity">
              <div className="profile-avatar">{initials}</div>
              <h2 className="profile-name">{user.full_name || 'Your Name'}</h2>
              <p className="profile-email">{user.email}</p>
              <span className={`profile-badge profile-badge--${user.role || 'user'}`}>
                {ROLE_LABELS[user.role] || user.role || 'User'}
              </span>
              <div className="profile-meta">
                <div className="profile-meta-item">
                  <FiCalendar size={15} />
                  <div>
                    <span className="profile-meta-label">Member Since</span>
                    <span className="profile-meta-value">{formatDate(user.created_at)}</span>
                  </div>
                </div>
                <div className="profile-meta-item">
                  <FiClock size={15} />
                  <div>
                    <span className="profile-meta-label">Last Login</span>
                    <span className="profile-meta-value">{formatDateTime(user.last_login || user.last_sign_in_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Editable details */}
            <div className="profile-card">
              <h3 className="profile-section-title">Personal Information</h3>

              <div className="profile-field">
                <label className="profile-label" htmlFor="p-full-name">
                  <FiUser size={14} /> Full Name
                </label>
                <input
                  id="p-full-name"
                  className="profile-input"
                  value={form.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div className="profile-field">
                <label className="profile-label" htmlFor="p-college">
                  <FiGrid size={14} /> College Name
                </label>
                <input
                  id="p-college"
                  className="profile-input"
                  value={form.college_name}
                  onChange={(e) => handleChange('college_name', e.target.value)}
                  placeholder="Your college / institution"
                />
              </div>

              <div className="profile-field">
                <label className="profile-label" htmlFor="p-dept">
                  <FiBook size={14} /> Department
                </label>
                <input
                  id="p-dept"
                  className="profile-input"
                  value={form.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  placeholder="e.g. Computer Science"
                />
              </div>

              <div className="profile-field">
                <label className="profile-label" htmlFor="p-phone">
                  <FiPhone size={14} /> Phone Number
                </label>
                <input
                  id="p-phone"
                  className="profile-input"
                  value={form.phone_number}
                  onChange={(e) => handleChange('phone_number', e.target.value)}
                  placeholder="9876543210"
                />
              </div>

              <div className="profile-field">
                <label className="profile-label" htmlFor="p-email">
                  <FiMail size={14} /> Email
                </label>
                <input id="p-email" className="profile-input profile-input--readonly" value={user.email || ''} readOnly disabled />
                <p className="profile-hint">Email cannot be changed here.</p>
              </div>

              <div className="profile-field">
                <label className="profile-label">
                  <FiShield size={14} /> Role
                </label>
                <input
                  className="profile-input profile-input--readonly"
                  value={ROLE_LABELS[user.role] || user.role || 'User'}
                  readOnly
                  disabled
                />
                <p className="profile-hint">Your role is managed by an administrator.</p>
              </div>

              <div className="profile-actions">
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <span className="profile-saving">Saving...</span>
                  ) : saved ? (
                    <>
                      <FiCheck size={16} /> Saved
                    </>
                  ) : (
                    <>
                      <FiSave size={16} /> Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
