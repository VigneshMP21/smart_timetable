import { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import MultiSelectClassDropdown from './MultiSelectClassDropdown';

/**
 * ManualSubjectModal - form to add a new subject or edit an existing one.
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {function} onClose - Closes the modal.
 * @param {boolean} busy - True while the save request is in flight.
 * @param {function} onSave - async (payload, record) => Promise; parent closes on success.
 * @param {Object|null} record - The subject being edited, or null to create.
 * @param {Array<Object>} classes - All classes used to populate the branch dropdown.
 */
export default function ManualSubjectModal({ isOpen, onClose, busy, onSave, record = null, classes = [] }) {
  const [form, setForm] = useState({ subject_code: '', subject_name: '', branch_classes: [] });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setForm({
        subject_code: record?.subject_code || '',
        subject_name: record?.subject_name || '',
        branch_classes: record?.branch_classes || [],
      });
      setErrors({});
    }
  }, [isOpen, record]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.subject_code.trim()) nextErrors.subject_code = 'Subject code is required.';
    if (!form.subject_name.trim()) nextErrors.subject_name = 'Subject name is required.';
    if (!form.branch_classes.length) nextErrors.branch_classes = 'Select at least one branch/class.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSave(
      {
        subject_code: form.subject_code.trim(),
        subject_name: form.subject_name.trim(),
        branch_classes: form.branch_classes,
      },
      record
    );
  };

  const isEdit = Boolean(record);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Subject' : 'Add Subject Manually'} size="md">
      <form className="class-form" onSubmit={handleSubmit} noValidate>
        <div className="class-form-field">
          <label htmlFor="subject-code">Subject Code</label>
          <input
            id="subject-code"
            type="text"
            value={form.subject_code}
            onChange={(e) => handleChange('subject_code', e.target.value.toUpperCase())}
            placeholder="e.g. MA201"
            autoFocus
          />
          {errors.subject_code && <span className="class-form-error">{errors.subject_code}</span>}
        </div>

        <div className="class-form-field">
          <label htmlFor="subject-name">Subject Name</label>
          <input
            id="subject-name"
            type="text"
            value={form.subject_name}
            onChange={(e) => handleChange('subject_name', e.target.value)}
            placeholder="e.g. Engineering Mathematics"
          />
          {errors.subject_name && <span className="class-form-error">{errors.subject_name}</span>}
        </div>

        <div className="class-form-field">
          <label>Branch / Class</label>
          <MultiSelectClassDropdown
            classes={classes}
            value={form.branch_classes}
            onChange={(branches) => handleChange('branch_classes', branches)}
            disabled={busy}
            placeholder="Select one or more branches"
          />
          {errors.branch_classes && <span className="class-form-error">{errors.branch_classes}</span>}
        </div>

        <button type="submit" className="class-btn class-btn-primary class-btn-block" disabled={busy}>
          {busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Subject'}
        </button>
      </form>
    </Modal>
  );
}
