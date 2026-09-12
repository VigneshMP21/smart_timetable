import { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';

/**
 * ManualClassModal - form to add a new class or edit an existing one.
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {function} onClose - Closes the modal.
 * @param {boolean} busy - True while the save request is in flight.
 * @param {function} onSave - async (payload, record) => Promise; parent closes on success.
 * @param {Object|null} record - The class being edited, or null to create.
 */
export default function ManualClassModal({ isOpen, onClose, busy, onSave, record = null }) {
  const [form, setForm] = useState({ class_name: '', short_code: '', section: 'A' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setForm({
        class_name: record?.class_name || '',
        short_code: record?.short_code || '',
        section: record?.section || 'A',
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
    if (!form.class_name.trim()) nextErrors.class_name = 'Class name is required.';
    if (!form.short_code.trim()) nextErrors.short_code = 'Short code is required.';
    if (!form.section.trim()) nextErrors.section = 'Section is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSave({
      class_name: form.class_name.trim(),
      short_code: form.short_code.trim(),
      section: form.section.trim(),
    }, record);
  };

  const isEdit = Boolean(record);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Class' : 'Add Class Manually'} size="sm">
      <form className="class-form" onSubmit={handleSubmit} noValidate>
        <div className="class-form-field">
          <label htmlFor="class-name">Class Name</label>
          <input
            id="class-name"
            type="text"
            value={form.class_name}
            onChange={(e) => handleChange('class_name', e.target.value)}
            placeholder="e.g. Computer Science Engineering"
            autoFocus
          />
          {errors.class_name && <span className="class-form-error">{errors.class_name}</span>}
        </div>

        <div className="class-form-row">
          <div className="class-form-field">
            <label htmlFor="class-code">Short Code</label>
            <input
              id="class-code"
              type="text"
              value={form.short_code}
              onChange={(e) => handleChange('short_code', e.target.value.toUpperCase())}
              placeholder="e.g. CSE"
            />
            {errors.short_code && <span className="class-form-error">{errors.short_code}</span>}
          </div>
          <div className="class-form-field">
            <label htmlFor="class-section">Section</label>
            <input
              id="class-section"
              type="text"
              value={form.section}
              onChange={(e) => handleChange('section', e.target.value.toUpperCase())}
              placeholder="e.g. A"
            />
            {errors.section && <span className="class-form-error">{errors.section}</span>}
          </div>
        </div>

        <button type="submit" className="class-btn class-btn-primary class-btn-block" disabled={busy}>
          {busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Class'}
        </button>
      </form>
    </Modal>
  );
}
