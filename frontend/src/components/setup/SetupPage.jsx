import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { LuSettings2 } from 'react-icons/lu';
import PreviewTimetable from './PreviewTimetable';
import SetupConfiguration from './SetupConfiguration';
import {
  buildDefaultConfig,
  loadSetupConfig,
  saveSetupConfig,
  validateSetupConfig,
  clampInt,
  isValidTime,
  makePeriod,
  derivePeriods,
  addMinutes,
  sanitizeConfig,
  configToCamelCase,
  MIN_PERIODS,
  MAX_PERIODS,
  MAX_DURATION_MINUTES,
  MAX_BREAK_MINUTES,
  MAX_LUNCH_MINUTES,
  periodLabel,
} from '../../utils/setupConfig';
import { getSetupConfig, saveSetupConfig as saveSetupConfigRemote } from '../../services/setupConfigService';
import './SetupPage.css';

function derivedPeriods(state) {
  return derivePeriods(
    state.collegeStartTime,
    state.periodDuration,
    state.numberOfPeriods,
    {
      breakAfter: state.breakAfter,
      lunchAfter: state.lunchAfter,
      breakTime: state.breakTime,
      lunchTime: state.lunchTime,
    }
  );
}

function setupReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return buildDefaultConfig();

    case 'INIT':
      return action.payload || buildDefaultConfig();

    case 'TOGGLE_DAY': {
      const workingDays = state.workingDays.includes(action.day)
        ? state.workingDays.filter((d) => d !== action.day)
        : [...state.workingDays, action.day];
      return { ...state, workingDays };
    }

    case 'SET_NUMBER_OF_PERIODS': {
      const count = clampInt(action.value, MIN_PERIODS, MAX_PERIODS);
      const breakAfter = state.breakAfter.filter((p) => p < count);
      const lunchAfter = state.lunchAfter != null && state.lunchAfter >= count
        ? null
        : state.lunchAfter;
      const next = { ...state, numberOfPeriods: count, breakAfter, lunchAfter };
      return {
        ...next,
        periods: isValidTime(state.collegeStartTime) ? derivedPeriods(next) : state.periods,
      };
    }

    case 'SET_COLLEGE_START':
      return {
        ...state,
        collegeStartTime: action.value,
        periods: isValidTime(action.value)
          ? derivePeriods(action.value, state.periodDuration, state.numberOfPeriods, {
              breakAfter: state.breakAfter,
              lunchAfter: state.lunchAfter,
              breakTime: state.breakTime,
              lunchTime: state.lunchTime,
            })
          : state.periods,
      };

    case 'SET_COLLEGE_END':
      return { ...state, collegeEndTime: action.value };

    case 'SET_PERIOD_DURATION': {
      const duration = clampInt(action.value, 1, MAX_DURATION_MINUTES);
      const next = { ...state, periodDuration: duration };
      return {
        ...next,
        periods: isValidTime(state.collegeStartTime) ? derivedPeriods(next) : state.periods,
      };
    }

    case 'SET_PERIOD':
      return {
        ...state,
        periods: state.periods.map((period) =>
          period.periodNumber === action.periodNumber && period.isTeaching
            ? makePeriod(
                period.periodNumber,
                action.field === 'startTime' ? action.value : period.startTime,
                action.field === 'endTime' ? action.value : period.endTime,
                true, false, false,
              )
            : period
        ),
      };

    case 'TOGGLE_BREAK_AFTER': {
      const breakAfter = state.breakAfter.includes(action.period)
        ? state.breakAfter.filter((p) => p !== action.period)
        : [...state.breakAfter, action.period];
      const next = { ...state, breakAfter };
      return {
        ...next,
        periods: isValidTime(state.collegeStartTime) ? derivedPeriods(next) : state.periods,
      };
    }

    case 'SET_LUNCH_AFTER': {
      const next = { ...state, lunchAfter: action.period };
      return {
        ...next,
        periods: isValidTime(state.collegeStartTime) ? derivedPeriods(next) : state.periods,
      };
    }

    case 'SET_BREAK_TIME': {
      const breakTime = clampInt(action.value, 1, MAX_BREAK_MINUTES);
      const next = { ...state, breakTime };
      return {
        ...next,
        periods: isValidTime(state.collegeStartTime) ? derivedPeriods(next) : state.periods,
      };
    }

    case 'SET_LUNCH_TIME': {
      const lunchTime = clampInt(action.value, 1, MAX_LUNCH_MINUTES);
      const next = { ...state, lunchTime };
      return {
        ...next,
        periods: isValidTime(state.collegeStartTime) ? derivedPeriods(next) : state.periods,
      };
    }

    default:
      return state;
  }
}

export default function SetupPage() {
  const [config, dispatch] = useReducer(setupReducer, undefined, loadSetupConfig);
  const [conflictError, setConflictError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const conflictTimer = useRef(null);

  const { errors, warnings } = useMemo(() => validateSetupConfig(config), [config]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await getSetupConfig();
        if (cancelled) return;
        if (remote?.exists && remote.config && Object.keys(remote.config).length > 0) {
          dispatch({ type: 'INIT', payload: sanitizeConfig(configToCamelCase(remote.config)) });
        }
      } catch {
        // Backend unreachable: keep the localStorage copy.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (conflictTimer.current) window.clearTimeout(conflictTimer.current);
    },
    []
  );

  const flashConflict = (message) => {
    setConflictError(message);
    if (conflictTimer.current) window.clearTimeout(conflictTimer.current);
    conflictTimer.current = window.setTimeout(() => setConflictError(null), 4000);
    toast.error(message);
  };

  const periodOptions = Array.from(
    { length: Math.max(0, config.numberOfPeriods - 1) },
    (_, i) => i + 1
  );

  const handleToggleBreakAfter = (period) => {
    if (config.lunchAfter === period) {
      flashConflict('Break and Lunch cannot be scheduled after the same period.');
      return;
    }
    dispatch({ type: 'TOGGLE_BREAK_AFTER', period });
  };

  const handleSetLunchAfter = (period) => {
    if (period !== null && config.breakAfter.includes(period)) {
      flashConflict('Break and Lunch cannot be scheduled after the same period.');
      return;
    }
    dispatch({ type: 'SET_LUNCH_AFTER', period });
  };

  const handleSave = async () => {
    const result = validateSetupConfig(config);
    if (!result.valid) {
      toast.error('Please fix the highlighted configuration issues.');
      return;
    }
    setIsSaving(true);
    try {
      await saveSetupConfigRemote(config);
      saveSetupConfig(config);
      toast.success('Configuration saved successfully!');
    } catch (err) {
      toast.error('Failed to save configuration. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    dispatch({ type: 'RESET' });
    toast.info('Configuration reset to defaults.');
  };

  return (
    <div className="setup-page">
      <div className="dash-page-head setup-page-head">
        <span className="dash-eyebrow">
          <LuSettings2 size={14} /> Timetable Setup
        </span>
        <h1>Set Up</h1>
        <p>
          Configure working days, period timings, breaks and lunch — the
          timetable preview updates live as you make changes.
        </p>
      </div>

      <section className="setup-preview-section" aria-label="Preview timetable">
        <PreviewTimetable config={config} />
      </section>

      <section className="setup-config-section" aria-label="Setup configuration">
        <SetupConfiguration
          config={config}
          errors={errors}
          warnings={warnings}
          conflictError={conflictError}
          onDispatch={dispatch}
          onSave={handleSave}
          onReset={handleReset}
          isSaving={isSaving}
          periodOptions={periodOptions}
          onToggleBreakAfter={handleToggleBreakAfter}
          onSetLunchAfter={handleSetLunchAfter}
        />
      </section>
    </div>
  );
}
