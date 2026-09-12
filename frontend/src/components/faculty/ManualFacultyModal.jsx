import { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import SubjectDropdown from './SubjectDropdown';
import { parseBranchTokens, displayBranchToken } from '../../utils/facultyBranches';

/**
 * ManualFacultyModal - form to assign a faculty member to a subject manually,
 * or edit an existing assignment.
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {function} onClose - Closes the modal.
 * @param {boolean} busy - True while the save request is in flight.
 * @param {function} onSave - async (payload, record) => Promise; parent closes on success.
 * @param {Object|null} record - The assignment being edited, or null to create.
 * @param {Array<Object>} subjects - All subjects used to populate the subject dropdown.
 */
export default function ManualFacultyModal({ isOpen, onClose, busy, onSave, record = null, subjects = [] }) {
  const [form, setForm] = useState({ faculty_name: '', subject_id: null, branch_text: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      const branchText = (record?.branch_classes || [])
        .map((token) => displayBranchToken(token, record?.section))
        .join(', ');
      setForm({
        faculty_name: record?.faculty_name || '',
        subject_id: record?.subject_id || null,
        branch_text: branchText,
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
    const branchClasses = parseBranchTokens(form.branch_text);
    const nextErrors = {};
    if (!form.faculty_name.trim()) {
      nextErrors.faculty_name = 'Faculty name is required.';
    } else if (form.faculty_name.trim().length < 3) {
      nextErrors.faculty_name = 'Faculty name must be at least 3 characters.';
    }
    if (!form.subject_id) nextErrors.subject_id = 'Select a subject.';
    if (!branchClasses.length) nextErrors.branch_text = 'Enter at least one class/branch (e.g. CSE-1, CSM-2).';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const selected = subjects.find((s) => s.id === form.subject_id);
    const payload = {
      faculty_name: form.faculty_name.trim(),
      subject_id: form.subject_id,
      subject_name: selected?.subject_name,
      branch_classes: branchClasses,
    };
    await onSave(payload, record);
  };

  const isEdit = Boolean(record);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Faculty Assignment' : 'Add Faculty Manually'} size="md">
      <form className="class-form" onSubmit={handleSubmit} noValidate>
        <div className="class-form-field">
          <label htmlFor="faculty-name">Faculty Name</label>
          <input
            id="faculty-name"
            type="text"
            value={form.faculty_name}
            onChange={(e) => handleChange('faculty_name', e.target.value)}
            placeholder="e.g. Dr. Ramesh"
            autoFocus
          />
          {errors.faculty_name && <span className="class-form-error">{errors.faculty_name}</span>}
        </div>

        <div className="class-form-field">
          <label>Subject</label>
          <SubjectDropdown
            subjects={subjects}
            value={form.subject_id}
            onChange={(id) => handleChange('subject_id', id)}
            disabled={busy}
            placeholder="Search & select a subject"
          />
          {errors.subject_id && <span className="class-form-error">{errors.subject_id}</span>}
        </div>

        <div className="class-form-field">
          <label htmlFor="faculty-branches">Classes / Branch &amp; Section</label>
          <input
            id="faculty-branches"
            type="text"
            value={form.branch_text}
            onChange={(e) => handleChange('branch_text', e.target.value)}
            placeholder="e.g. CSE-1, CSM-2 (branch + section per class, comma separated)"
          />
          {errors.branch_text && <span className="class-form-error">{errors.branch_text}</span>}
        </div>

        <button type="submit" className="class-btn class-btn-primary class-btn-block" disabled={busy}>
          {busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Faculty'}
        </button>
      </form>
    </Modal>
  );
}
