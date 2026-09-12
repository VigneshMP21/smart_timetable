import Modal from '../Modal/Modal';
import { FiAlertTriangle } from 'react-icons/fi';

/**
 * DeleteSubjectModal - confirmation dialog before permanently removing a subject.
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {function} onClose - Closes the modal.
 * @param {boolean} busy - True while the delete request is in flight.
 * @param {Object|null} record - The subject being deleted.
 * @param {function} onConfirm - async () => Promise; parent closes on success.
 */
export default function DeleteSubjectModal({ isOpen, onClose, busy, record, onConfirm }) {
  const name = record?.subject_code ? `${record.subject_code} (${record.subject_name})` : 'this subject';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Subject" size="sm">
      <div className="class-delete-body">
        <span className="class-delete-icon">
          <FiAlertTriangle size={22} aria-hidden="true" />
        </span>
        <p className="class-delete-text">
          Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
        </p>
      </div>
      <div className="class-delete-actions">
        <button
          type="button"
          className="class-btn class-btn-ghost"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="class-btn class-btn-danger"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Deleting...' : 'Delete Subject'}
        </button>
      </div>
    </Modal>
  );
}
