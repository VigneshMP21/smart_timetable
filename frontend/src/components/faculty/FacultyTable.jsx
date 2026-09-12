import { motion } from 'framer-motion';
import { FiClock, FiEdit2, FiTrash2 } from 'react-icons/fi';
import SelectionCheckbox from '../common/SelectionCheckbox';
import { displayBranchToken } from '../../utils/facultyBranches';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';
}

/**
 * FacultyTable - displays faculty assignments in a styled table with selection support.
 * @param {Array<Object>} records - [{ id, faculty_name, subject_code, subject_name, branch_classes, created_at }]
 * @param {function} onEdit - Called with the record when the user clicks Edit.
 * @param {function} onDelete - Called with the record when the user clicks Delete.
 * @param {Set} selectedIds - Ids currently selected by the user.
 * @param {function} onToggleSelect - Called with a row id to toggle its selection.
 * @param {function} onToggleSelectAll - Toggles every row on the current page.
 */
export default function FacultyTable({ records, onEdit, onDelete, selectedIds = new Set(), onToggleSelect, onToggleSelectAll }) {
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
                label="Select all faculty assignments on this page"
              />
            </th>
            <th>Faculty</th>
            <th>Subject</th>
            <th>Branch / Class</th>
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
                  label={`Select ${item.faculty_name}`}
                />
              </td>
              <td className="class-name-cell">
                <span className="class-name-inner">
                  <span className="class-avatar faculty-avatar">{initials(item.faculty_name)}</span>
                  <span className="class-name-text">{item.faculty_name}</span>
                </span>
              </td>
              <td>
                <div className="faculty-subject-cell">
                  {item.subject_code && <span className="faculty-subject-code">{item.subject_code}</span>}
                  <span>{item.subject_name}</span>
                </div>
              </td>
              <td>
                <div className="faculty-branch-list">
                  {(item.branch_classes || []).map((code) => (
                    <span className="faculty-branch-chip" key={code}>
                      {displayBranchToken(code, item.section)}
                    </span>
                  ))}
                </div>
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
                  aria-label={`Edit ${item.faculty_name}`}
                >
                  <FiEdit2 size={14} aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  className="class-action-btn class-action-delete"
                  onClick={() => onDelete(item)}
                  aria-label={`Delete ${item.faculty_name}`}
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
