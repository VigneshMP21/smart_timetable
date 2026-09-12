import { LuUtensils } from 'react-icons/lu';

/**
 * LunchBreakCell - table cell spanning all working-day rows for the lunch
 * break interval. Lunch is not a teaching period; it's an interval between periods.
 *
 * Props:
 *   rowSpan {number} Working day count
 */
export default function LunchBreakCell({ rowSpan }) {
  return (
    <td className="setup-preview-cell setup-preview-cell--lunch" rowSpan={rowSpan}>
      <span className="setup-preview-lunch-label">
        <LuUtensils size={16} className="setup-preview-lunch-icon" />
        <span className="setup-preview-lunch-text">LUNCH</span>
      </span>
    </td>
  );
}
