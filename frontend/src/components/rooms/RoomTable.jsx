import { motion } from 'framer-motion';
import { FiClock, FiEdit2, FiTrash2 } from 'react-icons/fi';
import SelectionCheckbox from '../common/SelectionCheckbox';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function classLabel(item) {
  const code = item.short_code ? ` · ${item.short_code}` : '';
  const section = item.section ? ` · ${item.section}` : '';
  return `${item.class_name}${code}${section}`;
}

/**
 * RoomTable - displays room records in a styled table with a class assignment
 * dropdown per row and selection support.
 * @param {Array<Object>} records - [{ id, room_no, class_short_code, section, class_id, created_at }]
 * @param {Array<Object>} classes - All classes available for assignment.
 * @param {Object} assignedMap - { classId: roomId } of classes already assigned to rooms.
 * @param {function} onEdit - Called with the record when the user clicks Edit.
 * @param {function} onDelete - Called with the record when the user clicks Delete.
 * @param {function} onAssign - async (record, classId|null) => Promise.
 * @param {number|null} assignBusyId - Room id whose dropdown is currently saving.
 * @param {Set} selectedIds - Ids currently selected by the user.
 * @param {function} onToggleSelect - Called with a row id to toggle its selection.
 * @param {function} onToggleSelectAll - Toggles every row on the current page.
 */
export default function RoomTable({ records, classes = [], assignedMap = {}, onEdit, onDelete, onAssign, assignBusyId = null, selectedIds = new Set(), onToggleSelect, onToggleSelectAll }) {
  const pageIds = records.map((item) => item.id);
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someChecked = pageIds.some((id) => selectedIds.has(id));

  return (
    <div className="class-table-wrap">
      <table className="class-table">
        <thead>
          <tr>
            <th className="class-select-th">
              <SelectionCheckbox
                checked={allChecked}
                indeterminate={someChecked && !allChecked}
                onChange={onToggleSelectAll}
                label="Select all rooms on this page"
              />
            </th>
            <th>Room No</th>
            <th>Section</th>
            <th>Class</th>
            <th>Added</th>
            <th className="class-actions-th">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((item, index) => (
            <motion.tr
              key={item.id}
              className={selectedIds.has(item.id) ? 'class-row-selected' : ''}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.4) }}
            >
              <td className="class-select-td">
                <SelectionCheckbox
                  checked={selectedIds.has(item.id)}
                  onChange={() => onToggleSelect(item.id)}
                  label={`Select ${item.room_no}`}
                />
              </td>
              <td className="class-name-cell">
                <span className="class-name-inner">
                  <span className="class-avatar">{String(item.room_no).charAt(0).toUpperCase()}</span>
                  <span className="class-name-text">{item.room_no}</span>
                </span>
              </td>
              <td>
                {item.section ? (
                  <span className="class-section">{item.section}</span>
                ) : (
                  <span className="class-section class-section-empty">—</span>
                )}
              </td>
              <td>
                <select
                  className="room-assign-select"
                  value={item.class_id != null ? String(item.class_id) : ''}
                  disabled={assignBusyId === item.id}
                  onChange={(e) => onAssign(item, e.target.value ? Number(e.target.value) : null)}
                  aria-label={`Assign class to ${item.room_no}`}
                >
                  <option value="">— Select Class —</option>
                  {classes
                    .filter((c) => c.id === item.class_id || !assignedMap[c.id])
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {classLabel(c)}
                      </option>
                    ))}
                </select>
              </td>
              <td className="class-date">
                <span className="class-date-inner">
                  <FiClock size={13} aria-hidden="true" />
                  {formatDate(item.created_at)}
                </span>
              </td>
              <td className="class-actions-cell">
                <button
                  type="button"
                  className="class-action-btn class-action-edit"
                  onClick={() => onEdit(item)}
                  aria-label={`Edit ${item.room_no}`}
                >
                  <FiEdit2 size={14} aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  className="class-action-btn class-action-delete"
                  onClick={() => onDelete(item)}
                  aria-label={`Delete ${item.room_no}`}
                >
                  <FiTrash2 size={14} aria-hidden="true" />
                  Delete
                </button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
