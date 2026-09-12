import { LuCoffee } from 'react-icons/lu';

/**
 * BreakCell - table cell spanning all working-day rows for a break interval.
 * Break is not a teaching period; it's an interval between periods.
 *
 * Props:
 *   rowSpan {number} Working day count
 */
export default function BreakCell({ rowSpan }) {
  return (
    <td className="setup-preview-cell setup-preview-cell--break" rowSpan={rowSpan}>
      <span className="setup-preview-break-label">
        <LuCoffee size={16} className="setup-preview-break-icon" />
        <span className="setup-preview-break-text">BREAK</span>
      </span>
    </td>
  );
}
