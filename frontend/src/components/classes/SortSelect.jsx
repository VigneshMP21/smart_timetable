import { FiSliders } from 'react-icons/fi';

/**
 * SortSelect - dropdown to pick the class list sort order.
 * @param {string} value - Current sort key, e.g. "class_name:asc".
 * @param {function} onChange - Called with the new sort key.
 */
export default function SortSelect({ value, onChange }) {
  return (
    <div className="class-sort">
      <FiSliders className="class-sort-icon" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Sort classes"
      >
        <option value="class_name:asc">Name (A–Z)</option>
        <option value="class_name:desc">Name (Z–A)</option>
        <option value="created_at:desc">Newest</option>
        <option value="created_at:asc">Oldest</option>
      </select>
    </div>
  );
}
