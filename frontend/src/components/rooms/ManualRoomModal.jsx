import { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';

/**
 * ManualRoomModal - form to add a new room or edit an existing one.
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {function} onClose - Closes the modal.
 * @param {boolean} busy - True while the save request is in flight.
 * @param {function} onSave - async (payload, record) => Promise; parent closes on success.
 * @param {Object|null} record - The room being edited, or null to create.
 */
export default function ManualRoomModal({ isOpen, onClose, busy, onSave, record = null }) {
  const [form, setForm] = useState({ room_no: '', class_short_code: '', section: 'A' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setForm({
        room_no: record?.room_no || '',
        class_short_code: record?.class_short_code || '',
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
    if (!form.room_no.trim()) nextErrors.room_no = 'Room No is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = { room_no: form.room_no.trim() };
    if (form.class_short_code.trim()) payload.class_short_code = form.class_short_code.trim().toUpperCase();
    if (form.section.trim()) payload.section = form.section.trim().toUpperCase();
    await onSave(payload, record);
  };

  const isEdit = Boolean(record);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Room' : 'Add Room Manually'} size="sm">
      <form className="class-form" onSubmit={handleSubmit} noValidate>
        <div className="class-form-field">
          <label htmlFor="room-no">Room No</label>
          <input
            id="room-no"
            type="text"
            value={form.room_no}
            onChange={(e) => handleChange('room_no', e.target.value.toUpperCase())}
            placeholder="e.g. A-101"
            autoFocus
          />
          {errors.room_no && <span className="class-form-error">{errors.room_no}</span>}
        </div>

        <div className="class-form-row">
          <div className="class-form-field">
            <label htmlFor="room-code">Class Short Code</label>
            <input
              id="room-code"
              type="text"
              value={form.class_short_code}
              onChange={(e) => handleChange('class_short_code', e.target.value.toUpperCase())}
              placeholder="e.g. CSE (optional)"
            />
          </div>
          <div className="class-form-field">
            <label htmlFor="room-section">Section</label>
            <input
              id="room-section"
              type="text"
              value={form.section}
              onChange={(e) => handleChange('section', e.target.value.toUpperCase())}
              placeholder="e.g. A"
            />
          </div>
        </div>

        <button type="submit" className="class-btn class-btn-primary class-btn-block" disabled={busy}>
          {busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Room'}
        </button>
      </form>
    </Modal>
  );
}
