import { motion } from 'framer-motion';
import { LuCalendarDays, LuCheck } from 'react-icons/lu';
import { DAYS_OF_WEEK } from '../../utils/constants';

/**
 * WorkingDaysSelector - Card 1. Toggle chips for every day of the week.
 *
 * Props:
 *   workingDays {string[]} Selected days
 *   onToggle    {fn}       (day: string) => void
 *   error       {string}   Inline validation message
 */
export default function WorkingDaysSelector({ workingDays, onToggle, error }) {
  return (
    <div className="setup-card">
      <div className="setup-card-head">
        <span className="setup-card-icon setup-card-icon--indigo">
          <LuCalendarDays />
        </span>
        <div>
          <h3 className="setup-card-title">Working Days</h3>
          <p className="setup-card-desc">
            Choose which days of the week appear in the timetable.
          </p>
        </div>
      </div>

      <div className="setup-days-grid" role="group" aria-label="Working days">
        {DAYS_OF_WEEK.map((day) => {
          const selected = workingDays.includes(day);
          return (
            <motion.button
              key={day}
              type="button"
              className={`setup-day-chip ${selected ? 'selected' : ''}`}
              onClick={() => onToggle(day)}
              aria-pressed={selected}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <span className="setup-day-check">
                {selected && <LuCheck size={13} />}
              </span>
              <span className="setup-day-name">{day}</span>
            </motion.button>
          );
        })}
      </div>

      {error && <p className="setup-field-error setup-error-block">{error}</p>}
      {!error && (
        <p className="setup-field-hint">
          {workingDays.length > 0
            ? `${workingDays.length} day${workingDays.length > 1 ? 's' : ''} selected`
            : 'No working days selected'}
        </p>
      )}
    </div>
  );
}
