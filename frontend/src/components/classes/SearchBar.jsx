import { FiSearch, FiX } from 'react-icons/fi';

/**
 * SearchBar - controlled search input for the class list.
 * @param {string} value - Current search query.
 * @param {function} onChange - Called with the new query string.
 * @param {string} placeholder - Input placeholder text.
 */
export default function SearchBar({ value, onChange, placeholder = 'Search classes...' }) {
  return (
    <div className="class-search">
      <FiSearch className="class-search-icon" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search classes"
      />
      {value && (
        <button
          type="button"
          className="class-search-clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <FiX size={16} />
        </button>
      )}
    </div>
  );
}
