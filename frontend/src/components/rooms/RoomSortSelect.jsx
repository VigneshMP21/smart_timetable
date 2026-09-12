import { FiSliders } from 'react-icons/fi';

/**
 * RoomSortSelect - dropdown to pick the room list sort order.
 * @param {string} value - Current sort key, e.g. "room_no:asc".
 * @param {function} onChange - Called with the new sort key.
 */
export default function RoomSortSelect({ value, onChange }) {
  return (
    <div className="class-sort">
      <FiSliders className="class-sort-icon" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Sort rooms"
      >
        <option value="room_no:asc">Room No (A–Z)</option>
        <option value="room_no:desc">Room No (Z–A)</option>
        <option value="created_at:desc">Newest</option>
        <option value="created_at:asc">Oldest</option>
      </select>
    </div>
  );
}
