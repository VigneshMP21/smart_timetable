import { FiSliders } from 'react-icons/fi';

/**
 * FacultySortSelect - dropdown to pick the faculty list sort order.
 * @param {string} value - Current sort key, e.g. "faculty_name:asc".
 * @param {function} onChange - Called with the new sort key.
 */
export default function FacultySortSelect({ value, onChange }) {
  return (
    <div className="class-sort">
      <FiSliders className="class-sort-icon" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Sort faculty"
      >
        <option value="faculty_name:asc">Faculty Name (A–Z)</option>
        <option value="faculty_name:desc">Faculty Name (Z–A)</option>
        <option value="subject_name:asc">Subject (A–Z)</option>
        <option value="subject_name:desc">Subject (Z–A)</option>
        <option value="created_at:desc">Newest</option>
        <option value="created_at:asc">Oldest</option>
      </select>
    </div>
  );
}
