import Modal from '../Modal/Modal';
import { FiAlertTriangle } from 'react-icons/fi';

/**
 * DeleteRoomModal - confirmation dialog before permanently removing a room.
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {function} onClose - Closes the modal.
 * @param {boolean} busy - True while the delete request is in flight.
 * @param {Object|null} record - The room being deleted.
 * @param {function} onConfirm - async () => Promise; parent closes on success.
 */
export default function DeleteRoomModal({ isOpen, onClose, busy, record, onConfirm }) {
  const name = record?.room_no ? `Room ${record.room_no}` : 'this room';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Room" size="sm">
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
          {busy ? 'Deleting...' : 'Delete Room'}
        </button>
      </div>
    </Modal>
  );
}
