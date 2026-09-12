import { FiSliders } from 'react-icons/fi';

/**
 * SubjectSortSelect - dropdown to pick the subject list sort order.
 * @param {string} value - Current sort key, e.g. "subject_code:asc".
 * @param {function} onChange - Called with the new sort key.
 */
export default function SubjectSortSelect({ value, onChange }) {
  return (
    <div className="class-sort">
      <FiSliders className="class-sort-icon" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Sort subjects"
      >
        <option value="subject_code:asc">Subject Code (A–Z)</option>
        <option value="subject_code:desc">Subject Code (Z–A)</option>
        <option value="subject_name:asc">Subject Name (A–Z)</option>
        <option value="subject_name:desc">Subject Name (Z–A)</option>
        <option value="created_at:desc">Newest</option>
        <option value="created_at:asc">Oldest</option>
      </select>
    </div>
  );
}
