import { LuTimer, LuInfo } from 'react-icons/lu';
import TimeInput from './TimeInput';
import { MAX_PERIODS } from '../../utils/setupConfig';

/**
 * GeneralTiming - Card 2. Number of periods, college hours and period duration.
 *
 * Props:
 *   config   {object} Full setup config
 *   onPeriods    {fn} (n: number) => void
 *   onCollegeStart {fn} (value: string) => void
 *   onCollegeEnd   {fn} (value: string) => void
 *   onDuration     {fn} (n: number) => void
 *   errors   {object} Field-level errors
 */
export default function GeneralTiming({
  config,
  onPeriods,
  onCollegeStart,
  onCollegeEnd,
  onDuration,
  errors,
}) {
  return (
    <div className="setup-card">
      <div className="setup-card-head">
        <span className="setup-card-icon setup-card-icon--violet">
          <LuTimer />
        </span>
        <div>
          <h3 className="setup-card-title">General Timing</h3>
          <p className="setup-card-desc">
            Set the number of periods and the college day boundaries. Period
            timings are generated automatically from these values.
          </p>
        </div>
      </div>

      <div className="setup-form-grid">
        <div className={`setup-field ${errors.numberOfPeriods ? 'has-error' : ''}`}>
          <label className="setup-field-label" htmlFor="setup-periods">
            No. of Periods
          </label>
          <input
            id="setup-periods"
            className="setup-input setup-input--number"
            type="number"
            inputMode="numeric"
            min="1"
            max={MAX_PERIODS}
            step="1"
            value={config.numberOfPeriods}
            onChange={(e) => onPeriods(e.target.value)}
          />
          {errors.numberOfPeriods && (
            <p className="setup-field-error">{errors.numberOfPeriods}</p>
          )}
          {!errors.numberOfPeriods && (
            <p className="setup-field-hint">
              1 to {MAX_PERIODS} periods per day
            </p>
          )}
        </div>

        <div className={`setup-field ${errors.periodDuration ? 'has-error' : ''}`}>
          <label className="setup-field-label" htmlFor="setup-duration">
            Period Duration (minutes)
          </label>
          <input
            id="setup-duration"
            className="setup-input setup-input--number"
            type="number"
            inputMode="numeric"
            min="1"
            max="180"
            step="1"
            value={config.periodDuration}
            onChange={(e) => onDuration(e.target.value)}
          />
          {errors.periodDuration && (
            <p className="setup-field-error">{errors.periodDuration}</p>
          )}
          {!errors.periodDuration && (
            <p className="setup-field-hint">Used for auto-calculated timings</p>
          )}
        </div>

        <TimeInput
          id="setup-college-start"
          label="College Start Time"
          value={config.collegeStartTime}
          onChange={onCollegeStart}
          error={errors.collegeStartTime}
        />

        <TimeInput
          id="setup-college-end"
          label="College End Time"
          value={config.collegeEndTime}
          onChange={onCollegeEnd}
          error={errors.collegeEndTime}
        />
      </div>

      <div className="setup-info-note">
        <LuInfo size={15} />
        <span>
          Changing the start time or duration recalculates every period timing.
          Individual timings can still be edited later.
        </span>
      </div>
    </div>
  );
}
