import { useEffect, useRef } from 'react';
import './common.css';

/**
 * SelectionCheckbox - styled table checkbox supporting the indeterminate state
 * used by "select all on this page" headers.
 * @param {boolean} checked - Whether the box is checked.
 * @param {boolean} indeterminate - Whether the box shows the dash state.
 * @param {function} onChange - Called with the next event when clicked.
 * @param {string} label - Accessible label.
 * @param {boolean} disabled - Disables the input.
 */
export default function SelectionCheckbox({ checked = false, indeterminate = false, onChange, label = 'Select row', disabled = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate && !checked;
    }
  }, [indeterminate, checked]);

  return (
    <label className="selection-checkbox">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
      />
      <span className="selection-checkbox-ui" aria-hidden="true" />
    </label>
  );
}
