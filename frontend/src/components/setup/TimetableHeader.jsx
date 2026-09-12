import { motion } from 'framer-motion';
import { periodLabel, formatShortRange } from '../../utils/setupConfig';

/**
 * TimetableHeader - one <th> per column: teaching periods get ordinal name,
 * break/lunch columns get a special label.
 *
 * Props:
 *   period       {object} { periodNumber, startTime, endTime, isTeaching, isBreak, isLunch }
 *   isBreak      {boolean}
 *   isLunch      {boolean}
 */
export default function TimetableHeader({ period, isBreak, isLunch }) {
  const variant = isBreak ? 'break' : isLunch ? 'lunch' : 'normal';
  const name = isBreak
    ? 'BREAK'
    : isLunch
      ? 'LUNCH'
      : periodLabel(period.periodNumber);

  return (
    <motion.th
      className={`setup-preview-th setup-preview-th--${variant}`}
      scope="col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <span className="setup-preview-th-name">{name}</span>
      <span className="setup-preview-th-time">
        {formatShortRange(period.startTime, period.endTime)}
      </span>
    </motion.th>
  );
}
