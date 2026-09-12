import { motion } from 'framer-motion';
import { LuLayoutGrid } from 'react-icons/lu';
import TimeInput from './TimeInput';
import { periodLabel } from '../../utils/setupConfig';

function formatMinutes(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '--';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${hours}h ${mins}m`;
}

/**
 * PeriodConfiguration - Card 4. Editable per-period start/end times for
 * teaching periods only. Break/lunch intervals are derived automatically.
 *
 * Props:
 *   periods        {array} All period objects (teaching + break/lunch)
 *   onPeriodTime   {fn} (periodNumber, field, value) => void
 *   errors         {object}
 */
export default function PeriodConfiguration({
  periods,
  onPeriodTime,
  errors,
}) {
  // Only display teaching periods
  const teachingPeriods = periods.filter((p) => p.isTeaching === true || p.isTeaching === undefined);

  return (
    <div className="setup-card">
      <div className="setup-card-head">
        <span className="setup-card-icon setup-card-icon--emerald">
          <LuLayoutGrid />
        </span>
        <div>
          <h3 className="setup-card-title">Period Timing Configuration</h3>
          <p className="setup-card-desc">
            Fine-tune each teaching period individually. Total time is recalculated
            automatically from the start and end times.
          </p>
        </div>
      </div>

      {errors.periods && (
        <p className="setup-field-error setup-error-block">{errors.periods}</p>
      )}

      <div className="setup-periods-grid">
        {teachingPeriods.map((period, index) => (
          <motion.div
            key={period.periodNumber}
            className="setup-period-card"
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
          >
            <div className="setup-period-head">
              <span className="setup-period-number">
                {periodLabel(period.periodNumber)}
              </span>
            </div>

            <div className="setup-period-body">
              <TimeInput
                id={`setup-p${period.periodNumber}-start`}
                label="Start Time"
                value={period.startTime}
                onChange={(value) =>
                  onPeriodTime(period.periodNumber, 'startTime', value)
                }
              />
              <TimeInput
                id={`setup-p${period.periodNumber}-end`}
                label="End Time"
                value={period.endTime}
                onChange={(value) =>
                  onPeriodTime(period.periodNumber, 'endTime', value)
                }
              />
            </div>

            <div className="setup-period-total">
              <span className="setup-period-total-label">Total Time</span>
              <span className="setup-period-total-value">
                {formatMinutes(period.totalMinutes)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
