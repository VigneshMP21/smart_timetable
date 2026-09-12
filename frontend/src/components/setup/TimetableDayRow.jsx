import { motion } from 'framer-motion';
import BreakCell from './BreakCell';
import LunchBreakCell from './LunchBreakCell';

/**
 * TimetableDayRow - one row per working day. Periods are now interleaved
 * with break/lunch intervals in the `periods` array. Each item has an
 * isTeaching/isBreak/isLunch flag.
 *
 * Props:
 *   day        {string} Day name
 *   periods    {array} Period objects (teaching + break + lunch intervals)
 *   isFirstRow {boolean}
 *   rowSpan    {number} Working day count (for spanned cells)
 */
export default function TimetableDayRow({
  day,
  periods,
  isFirstRow,
  rowSpan,
}) {
  return (
    <motion.tr
      className="setup-preview-row"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <th className="setup-preview-day" scope="row">
        <span className="setup-preview-day-dot" />
        {day}
      </th>
      {periods.map((period, idx) => {
        if (period.isBreak) {
          if (!isFirstRow) return null;
          return (
            <BreakCell
              key={`break-${idx}`}
              rowSpan={rowSpan}
            />
          );
        }
        if (period.isLunch) {
          if (!isFirstRow) return null;
          return (
            <LunchBreakCell
              key={`lunch-${idx}`}
              rowSpan={rowSpan}
            />
          );
        }
        return (
          <td
            key={`teach-${period.periodNumber}-${idx}`}
            className="setup-preview-cell setup-preview-cell--empty"
          />
        );
      })}
    </motion.tr>
  );
}
