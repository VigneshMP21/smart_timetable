import Modal from '../Modal/Modal';
import { FiAlertTriangle } from 'react-icons/fi';

/**
 * BulkDeleteModal - confirmation dialog for "Delete selected" and "Delete all".
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {function} onClose - Closes the modal.
 * @param {boolean} busy - True while the delete request is in flight.
 * @param {number} count - Number of rows that will be deleted.
 * @param {string} entityLabel - Singular noun shown to the user, e.g. "room".
 * @param {string} scope - 'selected' or 'all' - changes the wording.
 * @param {string|null} warning - Optional extra warning (e.g. rooms in use by the timetable are skipped).
 * @param {function} onConfirm - async () => Promise; parent closes on success.
 */
export default function BulkDeleteModal({
  isOpen,
  onClose,
  busy,
  count = 0,
  entityLabel = 'item',
  scope = 'selected',
  warning = null,
  onConfirm,
}) {
  const verb = scope === 'all' ? 'every' : `${count} selected`;
  const title = scope === 'all' ? `Delete All ${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)}s` : 'Delete Selected';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="class-delete-body">
        <span className="class-delete-icon">
          <FiAlertTriangle size={22} aria-hidden="true" />
        </span>
        <p className="class-delete-text">
          {scope === 'all' ? (
            <>Are you sure you want to delete <strong>all {entityLabel}s</strong> ({count} record{count === 1 ? '' : 's'})? This action cannot be undone.</>
          ) : (
            <>Are you sure you want to delete <strong>{verb} {entityLabel}{count === 1 ? '' : 's'}</strong>? This action cannot be undone.</>
          )}
        </p>
      </div>
      {warning && <p className="bulk-modal-warning">{warning}</p>}
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
          {busy ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}
