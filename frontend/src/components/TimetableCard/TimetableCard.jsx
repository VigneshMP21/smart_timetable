import { motion } from 'framer-motion';
import { getSubjectTypeColor } from '../../utils/helpers';
import './TimetableCard.css';

/**
 * Displays a single timetable cell.
 * @param {Object} entry - { subject, faculty, type }
 */
function TimetableCell({ entry }) {
  if (!entry) return <div className="tt-cell empty" />;

  const isLunch = entry.type === 'Lunch' || entry.subject?.toLowerCase().includes('lunch');
  const isBreak = entry.type === 'Break' || entry.subject?.toLowerCase().includes('break');
  const isFree = entry.type === 'Free' || entry.subject?.toLowerCase().includes('free');
  const colors = getSubjectTypeColor(isLunch ? 'Lunch' : isBreak ? 'Break' : isFree ? 'Free' : entry.type);

  return (
    <div
      className={`tt-cell ${isLunch ? 'lunch' : ''} ${isBreak ? 'break' : ''} ${isFree ? 'free' : ''}`}
      style={{
        background: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        color: colors.text,
      }}
      title={`${entry.subject} - ${entry.faculty}`}
    >
      <span className="tt-cell-subject">{entry.subject}</span>
      {!isFree && !isLunch && !isBreak && (
        <span className="tt-cell-faculty">{entry.faculty}</span>
      )}
    </div>
  );
}

/**
 * Timetable grid displaying class/faculty schedule.
 *
 * `periods` can be either:
 *  - An array of period objects (interleaved: teaching + break/lunch intervals),
 *    each with { period_number, start_time, end_time, is_break, is_lunch }.
 *  - A number (legacy) treated as plain teaching period columns.
 *
 * Day slots are matched to columns by index (the timetable day slots are
 * aligned with the config periods array produced by the backend).
 *
 * @param {Object} timetable - { day: [entries] }
 * @param {Array} days - Array of day names
 * @param {Array|number} periods - Period objects or count
 * @param {string} title - Optional title for the grid
 */
export default function TimetableCard({
  timetable,
  days,
  periods,
  title,
  periodTimes,
}) {
  if (!timetable || days.length === 0) {
    return (
      <div className="tt-empty">
        <p>No timetable data available.</p>
      </div>
    );
  }

  const isArray = Array.isArray(periods);

  const periodLabels = isArray
    ? periods.map((p) => ({
        key: p.is_break
          ? `break_${p.period_number}`
          : p.is_lunch
            ? `lunch_${p.period_number}`
            : p.period_number,
        label: p.is_break ? 'Break' : p.is_lunch ? 'Lunch' : `P${p.period_number}`,
        time:
          p.is_break || p.is_lunch
            ? `${p.start_time}-${p.end_time}`
            : periodTimes?.[p.period_number - 1] || `${p.start_time}-${p.end_time}`,
        variant: p.is_break ? 'break' : p.is_lunch ? 'lunch' : 'normal',
      }))
    : Array.from({ length: periods }, (_, i) => ({
        key: i + 1,
        label: `P${i + 1}`,
        time: periodTimes?.[i] || null,
        variant: 'normal',
      }));

  return (
    <motion.div
      className="tt-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {title && <h3 className="tt-title">{title}</h3>}
      <div className="tt-table-wrapper">
        <table className="tt-table" role="grid">
          <thead>
            <tr>
              <th className="tt-th day-col">Day</th>
              {periodLabels.map((item, idx) => (
                <th
                  key={`${item.key}-${idx}`}
                  className={`tt-th ${item.variant === 'lunch' ? 'lunch-col' : ''} ${item.variant === 'break' ? 'break-col' : ''}`}
                >
                  <span className="tt-th-label">{item.label}</span>
                  {item.time && <span className="tt-th-time">{item.time}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day}>
                <td className="tt-td day-cell">{day.slice(0, 3)}</td>
                {periodLabels.map((item, idx) => {
                  const entries = timetable[day] || [];
                  const entry = entries.find((e) => {
                    if (item.variant === 'break') return e.period === `break_${item.key}` || e.type === 'Break';
                    if (item.variant === 'lunch') return e.period === `lunch_${item.key}` || e.type === 'Lunch';
                    return e.period === item.key;
                  });
                  return (
                    <td
                      key={`${item.key}-${idx}`}
                      className={`tt-td ${item.variant === 'lunch' ? 'lunch-col' : ''} ${item.variant === 'break' ? 'break-col' : ''}`}
                    >
                      <TimetableCell entry={entry} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tt-legend">
        <span className="tt-legend-item"><span className="tt-legend-dot" style={{ background: getSubjectTypeColor('Theory').border }} /> Theory</span>
        <span className="tt-legend-item"><span className="tt-legend-dot" style={{ background: getSubjectTypeColor('Lab').border }} /> Lab</span>
        <span className="tt-legend-item"><span className="tt-legend-dot" style={{ background: getSubjectTypeColor('Elective').border }} /> Elective</span>
        <span className="tt-legend-item"><span className="tt-legend-dot" style={{ background: getSubjectTypeColor('Lunch').border }} /> Lunch</span>
        <span className="tt-legend-item"><span className="tt-legend-dot" style={{ background: getSubjectTypeColor('Break').border }} /> Break</span>
        <span className="tt-legend-item"><span className="tt-legend-dot" style={{ background: getSubjectTypeColor('Free').border }} /> Free</span>
      </div>
    </motion.div>
  );
}
