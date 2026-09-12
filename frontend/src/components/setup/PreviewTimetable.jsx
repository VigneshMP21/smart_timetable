import { motion } from 'framer-motion';
import { LuTable, LuCircleAlert, LuCalendarOff } from 'react-icons/lu';
import TimetableHeader from './TimetableHeader';
import TimetableDayRow from './TimetableDayRow';

/**
 * PreviewTimetable - A live structural preview generated purely
 * from the setup configuration state. Builds a display timeline that
 * interleaves teaching periods with break/lunch intervals.
 *
 * Props:
 *   config {object} Source-of-truth configuration
 */
export default function PreviewTimetable({ config }) {
  const { workingDays, periods, breakAfter, lunchAfter, numberOfPeriods } = config;

  const noDays = workingDays.length === 0;
  const noPeriods = numberOfPeriods === 0;

  // Count teaching periods (always = numberOfPeriods)
  const teachingPeriodCount = periods.filter((p) => p.isTeaching).length;

  return (
    <motion.section
      className="setup-preview-card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="setup-preview-head">
        <div className="setup-preview-title">
          <span className="setup-preview-title-icon">
            <LuTable />
          </span>
          <div>
            <h2 className="setup-preview-title-text">Preview Timetable</h2>
            <p className="setup-preview-title-sub">
              Live structural preview — updates automatically as you configure
            </p>
          </div>
        </div>
        <span className="setup-preview-live">
          <span className="setup-preview-live-dot" />
          Live
        </span>
      </div>

      {noDays || noPeriods ? (
        <div className="setup-preview-empty">
          {noDays ? <LuCalendarOff size={34} /> : <LuCircleAlert size={34} />}
          <p>
            {noDays
              ? 'Select at least one working day to preview the timetable.'
              : 'Add at least one period to preview the timetable.'}
          </p>
        </div>
      ) : (
        <div className="setup-preview-scroll">
          <table className="setup-preview-table">
            <thead>
              <tr className="setup-preview-header-row">
                <th className="setup-preview-corner" scope="col">
                  Working Day
                </th>
                {periods.map((period, idx) => (
                  <TimetableHeader
                    key={`ph-${period.periodNumber}-${period.isBreak ? 'b' : period.isLunch ? 'l' : 't'}-${idx}`}
                    period={period}
                    isBreak={period.isBreak === true}
                    isLunch={period.isLunch === true}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {workingDays.map((day, index) => (
                <TimetableDayRow
                  key={day}
                  day={day}
                  periods={periods}
                  isFirstRow={index === 0}
                  rowSpan={workingDays.length}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="setup-preview-foot">
        <span>
          {workingDays.length} day{workingDays.length === 1 ? '' : 's'}
        </span>
        <span className="setup-preview-foot-dot" />
        <span>{teachingPeriodCount} period{teachingPeriodCount === 1 ? '' : 's'}</span>
      </div>
    </motion.section>
  );
}
