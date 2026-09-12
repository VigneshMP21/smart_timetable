import { motion } from 'framer-motion';
import Button from '../Buttons/Button';
import WorkingDaysSelector from './WorkingDaysSelector';
import GeneralTiming from './GeneralTiming';
import BreakConfiguration from './BreakConfiguration';
import PeriodConfiguration from './PeriodConfiguration';
import { LuSave, LuRotateCcw } from 'react-icons/lu';

const configVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
  },
};

/**
 * SetupConfiguration - the full configuration section (Section header,
 * Cards 1-4 + actions), stacked vertically below the preview.
 */
export default function SetupConfiguration({
  config,
  errors,
  warnings,
  conflictError,
  onDispatch,
  onSave,
  onReset,
  isSaving = false,
  periodOptions,
  onToggleBreakAfter,
  onSetLunchAfter,
}) {
  return (
    <motion.div
      className="setup-config"
      variants={configVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.06 }}
    >
      <div className="setup-section-head">
        <span className="setup-section-badge">Section 02</span>
        <h2 className="setup-section-title">Setup Configuration</h2>
        <p className="setup-section-desc">
          Configure working days, periods, timings and breaks.
        </p>
      </div>

      <motion.div variants={cardVariants}>
        <WorkingDaysSelector
          workingDays={config.workingDays}
          onToggle={(day) => onDispatch({ type: 'TOGGLE_DAY', day })}
          error={errors.workingDays}
        />
      </motion.div>

      <motion.div variants={cardVariants}>
        <GeneralTiming
          config={config}
          onPeriods={(value) =>
            onDispatch({ type: 'SET_NUMBER_OF_PERIODS', value })
          }
          onCollegeStart={(value) =>
            onDispatch({ type: 'SET_COLLEGE_START', value })
          }
          onCollegeEnd={(value) => onDispatch({ type: 'SET_COLLEGE_END', value })}
          onDuration={(value) =>
            onDispatch({ type: 'SET_PERIOD_DURATION', value })
          }
          errors={errors}
        />
      </motion.div>

      <motion.div variants={cardVariants}>
        <BreakConfiguration
          periodOptions={periodOptions}
          breakAfter={config.breakAfter}
          lunchAfter={config.lunchAfter}
          breakTime={config.breakTime}
          lunchTime={config.lunchTime}
          numberOfPeriods={config.numberOfPeriods}
          onToggleBreakAfter={onToggleBreakAfter}
          onSetLunchAfter={onSetLunchAfter}
          onBreakTime={(value) => onDispatch({ type: 'SET_BREAK_TIME', value })}
          onLunchTime={(value) => onDispatch({ type: 'SET_LUNCH_TIME', value })}
          errors={errors}
          conflictError={conflictError}
        />
      </motion.div>

      <motion.div variants={cardVariants}>
        <PeriodConfiguration
          periods={config.periods}
          onPeriodTime={(periodNumber, field, value) =>
            onDispatch({ type: 'SET_PERIOD', periodNumber, field, value })
          }
          errors={errors}
        />
      </motion.div>

      {warnings.length > 0 && (
        <div className="setup-warning-note">
          <span>{warnings[0]}</span>
        </div>
      )}

      <motion.div className="setup-actions" variants={cardVariants}>
        <Button variant="primary" size="lg" onClick={onSave} loading={isSaving}>
          <LuSave size={16} /> Save Configuration
        </Button>
        <Button variant="outline" size="lg" onClick={onReset}>
          <LuRotateCcw size={16} /> Reset Defaults
        </Button>
      </motion.div>
    </motion.div>
  );
}
