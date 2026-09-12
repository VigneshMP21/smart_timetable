import { formatTime } from '../../utils/setupConfig';

/**
 * TimeInput - styled native time picker with a 12-hour AM/PM caption.
 *
 * Props:
 *   id        {string}   htmlFor / htmlId target
 *   label     {string}   Visible label text
 *   value     {string}   "HH:MM" 24-hour value
 *   onChange  {fn}       (value: string) => void
 *   error     {string}   Optional inline validation message
 *   hint      {string}   Optional helper text
 *   autoFocus {boolean}  Focus on mount (used by period cards)
 */
export default function TimeInput({ id, label, value, onChange, error, hint, autoFocus }) {
  return (
    <div className={`setup-time-field ${error ? 'has-error' : ''}`}>
      <label className="setup-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="setup-time-input-wrap">
        <input
          id={id}
          className="setup-time-input"
          type="time"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          autoFocus={autoFocus}
        />
        <span className="setup-time-meta">{formatTime(value)}</span>
      </div>
      {error && <p className="setup-field-error">{error}</p>}
      {!error && hint && <p className="setup-field-hint">{hint}</p>}
    </div>
  );
}
