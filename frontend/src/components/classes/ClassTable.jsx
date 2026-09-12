import { motion } from 'framer-motion';
import { FiClock, FiEdit2, FiTrash2 } from 'react-icons/fi';
import SelectionCheckbox from '../common/SelectionCheckbox';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * ClassTable - displays class records in a styled table with selection support.
 * @param {Array<Object>} records - [{ id, class_name, short_code, section, created_at }]
 * @param {function} onEdit - Called with the record when the user clicks Edit.
 * @param {function} onDelete - Called with the record when the user clicks Delete.
 * @param {Set} selectedIds - Ids currently selected by the user.
 * @param {function} onToggleSelect - Called with a row id to toggle its selection.
 * @param {function} onToggleSelectAll - Toggles every row on the current page.
 */
export default function ClassTable({ records, onEdit, onDelete, selectedIds = new Set(), onToggleSelect, onToggleSelectAll }) {
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
                label="Select all classes on this page"
              />
            </th>
            <th>Class Name</th>
            <th>Short Code</th>
            <th>Section</th>
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
                  label={`Select ${item.class_name}`}
                />
              </td>
              <td className="class-name-cell">
                <span className="class-name-inner">
                  <span className="class-avatar">{String(item.class_name).charAt(0).toUpperCase()}</span>
                  <span className="class-name-text">{item.class_name}</span>
                </span>
              </td>
              <td>
                <span className="class-code">{item.short_code}</span>
              </td>
              <td>
                <span className="class-section">{item.section}</span>
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
                  aria-label={`Edit ${item.class_name}`}
                >
                  <FiEdit2 size={14} aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  className="class-action-btn class-action-delete"
                  onClick={() => onDelete(item)}
                  aria-label={`Delete ${item.class_name}`}
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
