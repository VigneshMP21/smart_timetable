import { DAYS_OF_WEEK, DEFAULT_WORKING_DAYS } from './constants';

/**
 * setupConfig.js - Pure helpers for the Setup (timetable configuration) feature.
 *
 * All time values are stored internally as 24-hour "HH:MM" strings so that
 * arithmetic is unambiguous. 12-hour AM/PM rendering happens only at display
 * time via `formatTime` / `formatRange`.
 *
 * This module is deliberately UI-agnostic so a Supabase-backed persistence
 * layer can later replace `loadSetupConfig` / `saveSetupConfig` without
 * touching the components.
 *
 * NEW DATA MODEL:
 * - breakAfter: number[] - teaching period numbers AFTER which break occurs
 * - lunchAfter: number | null - teaching period number AFTER which lunch occurs
 * - numberOfPeriods: number - TEACHING periods only (breaks/lunch don't count)
 *
 * Old model (for migration):
 * - breakPeriods: number[] - period numbers treated as breaks
 * - lunchBreakPeriod: number | null - period number treated as lunch
 */

export const MAX_PERIODS = 15;
export const MIN_PERIODS = 1;
export const MAX_DURATION_MINUTES = 180;
export const MAX_BREAK_MINUTES = 120;
export const MAX_LUNCH_MINUTES = 120;

const STORAGE_KEY = 'setup_config';
const TIME_REGEX = /^\d{2}:\d{2}$/;

/* ----------------------------------------------------------------
   Numeric / time utilities
---------------------------------------------------------------- */

export function clampInt(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Convert "HH:MM" to minutes since midnight. Returns NaN when invalid. */
export function timeToMinutes(time) {
  if (!time || typeof time !== 'string') return Number.NaN;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

/** Convert minutes since midnight back to "HH:MM", wrapping across midnight. */
export function minutesToTime(minutes) {
  const total = ((Math.trunc(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Add minutes to a "HH:MM" string, wrapping past midnight. */
export function addMinutes(time, minutes) {
  const base = timeToMinutes(time);
  if (Number.isNaN(base)) return time;
  return minutesToTime(base + minutes);
}

/** End - start in minutes. Returns 0 when either value is invalid. */
export function diffMinutes(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return end - start;
}

export function isValidTime(time) {
  return TIME_REGEX.test(time) && !Number.isNaN(timeToMinutes(time));
}

/** "09:00" -> "09:00 AM", "16:00" -> "04:00 PM" */
export function formatTime(time) {
  const minutes = timeToMinutes(time);
  if (Number.isNaN(minutes)) return time || '--:--';
  const hours = Math.floor(minutes / 60) % 12 || 12;
  const mins = String(minutes % 60).padStart(2, '0');
  const meridian = minutes < 720 ? 'AM' : 'PM';
  return `${String(hours).padStart(2, '0')}:${mins} ${meridian}`;
}

/** "09:00 AM - 09:50 AM" */
export function formatRange(startTime, endTime) {
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

/** Compact "09:00 AM–09:50 AM" used inside table headers. */
export function formatShortRange(startTime, endTime) {
  return `${formatTime(startTime)}\u2013${formatTime(endTime)}`;
}

/** "9th", "1st", "2nd", "3rd" */
export function ordinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

/** "9th Period" */
export function periodLabel(n) {
  return `${ordinal(n)} Period`;
}

/* ----------------------------------------------------------------
   Period derivation
----------------------------------------------------------------- */

/**
 * Build a contiguous run of periods starting at `startTime`.
 * 
 * NEW MODEL:
 * - `count` = number of TEACHING periods only
 * - `breakAfter` = array of teaching period numbers AFTER which break occurs
 * - `lunchAfter` = teaching period number AFTER which lunch occurs
 * - Break/lunch are intervals BETWEEN teaching periods, not periods themselves
 * 
 * Example: 8 teaching periods, breakAfter=[2], lunchAfter=[5]
 * Timeline: 1, 2, BREAK, 3, 4, 5, LUNCH, 6, 7, 8
 * Total displayed slots = 8 teaching + 1 break + 1 lunch = 10 slots
 * But teaching period count = 8
 */
export function derivePeriods(startTime, duration, count, options = {}) {
  const {
    breakAfter = [],
    lunchAfter = null,
    breakTime = 0,
    lunchTime = 0,
  } = options;
  
  const breakAfterSet = new Set(breakAfter);
  const periods = [];
  let start = startTime;
  
  for (let i = 1; i <= count; i += 1) {
    // Add teaching period
    const end = addMinutes(start, duration);
    periods.push({
      periodNumber: i,
      startTime: start,
      endTime: end,
      totalMinutes: diffMinutes(start, end),
      isTeaching: true,
    });
    start = end;
    
    // Add break interval AFTER this teaching period if configured
    if (breakAfterSet.has(i)) {
      const breakEnd = addMinutes(start, breakTime);
      periods.push({
        periodNumber: i, // Same number as the period before break
        startTime: start,
        endTime: breakEnd,
        totalMinutes: diffMinutes(start, breakEnd),
        isTeaching: false,
        isBreak: true,
      });
      start = breakEnd;
    }
    
    // Add lunch interval AFTER this teaching period if configured
    if (lunchAfter === i) {
      const lunchEnd = addMinutes(start, lunchTime);
      periods.push({
        periodNumber: i, // Same number as the period before lunch
        startTime: start,
        endTime: lunchEnd,
        totalMinutes: diffMinutes(start, lunchEnd),
        isTeaching: false,
        isLunch: true,
      });
      start = lunchEnd;
    }
  }
  return periods;
}

/**
 * Get only the teaching periods from a derived periods array.
 * Useful for counting actual teaching periods.
 */
export function getTeachingPeriods(periods) {
  return periods.filter(p => p.isTeaching);
}

/**
 * Get the count of teaching periods.
 */
export function getTeachingPeriodCount(periods) {
  return periods.filter(p => p.isTeaching).length;
}

/** Rebuild a single period entry from its start/end times. */
export function makePeriod(periodNumber, startTime, endTime, isTeaching = true, isBreak = false, isLunch = false) {
  const validStart = isValidTime(startTime) ? startTime : '';
  const validEnd = isValidTime(endTime) ? endTime : '';
  return {
    periodNumber,
    startTime: validStart,
    endTime: validEnd,
    totalMinutes: diffMinutes(validStart, validEnd),
    isTeaching,
    isBreak,
    isLunch,
  };
}

/* ----------------------------------------------------------------
   Defaults
----------------------------------------------------------------- */

export function buildDefaultConfig() {
  const numberOfPeriods = 9;
  const collegeStartTime = '09:00';
  const collegeEndTime = '16:00';
  const periodDuration = 50;
  const breakTime = 10;
  const lunchTime = 40;
  const breakAfter = [3]; // After 3rd period
  const lunchAfter = 6;   // After 6th period

  return {
    workingDays: [...DEFAULT_WORKING_DAYS],
    numberOfPeriods,
    collegeStartTime,
    collegeEndTime,
    periodDuration,
    breakTime,
    lunchTime,
    breakAfter,
    lunchAfter,
    periods: derivePeriods(collegeStartTime, periodDuration, numberOfPeriods, {
      breakAfter,
      lunchAfter,
      breakTime,
      lunchTime,
    }),
  };
}

/**
 * Convert a persisted config document (which may use snake_case keys, as
 * produced by external clients) into the camelCase shape `sanitizeConfig`
 * understands. Unknown/missing keys are left as undefined so sanitizeConfig
 * falls back to defaults.
 */
export function configToCamelCase(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const periods = Array.isArray(raw.periods)
    ? raw.periods.map((p) => {
        if (!p || typeof p !== 'object') return null;
        return {
          periodNumber: p.periodNumber ?? p.period_number,
          startTime: p.startTime ?? p.start_time,
          endTime: p.endTime ?? p.end_time,
          totalMinutes: p.totalMinutes ?? p.total_minutes,
          isTeaching: p.isTeaching ?? true,
          isBreak: p.isBreak ?? false,
          isLunch: p.isLunch ?? false,
        };
      })
    : undefined;

  // Handle both old (breakPeriods, lunchBreakPeriod) and new (breakAfter, lunchAfter) keys
  const breakAfter = raw.breakAfter ?? raw.break_after ?? 
    (Array.isArray(raw.breakPeriods) ? raw.breakPeriods.map(p => p) : []);
  const lunchAfter = raw.lunchAfter ?? raw.lunch_after ?? raw.lunchBreakPeriod ?? raw.lunch_break_period;

  return {
    workingDays: raw.workingDays ?? raw.working_days,
    numberOfPeriods: raw.numberOfPeriods ?? raw.number_of_periods,
    collegeStartTime: raw.collegeStartTime ?? raw.college_start_time,
    collegeEndTime: raw.collegeEndTime ?? raw.college_end_time,
    periodDuration: raw.periodDuration ?? raw.period_duration,
    breakTime: raw.breakTime ?? raw.break_time,
    lunchTime: raw.lunchTime ?? raw.lunch_time,
    breakAfter,
    lunchAfter,
    periods,
  };
}

/**
 * Merge an untrusted persisted object with the defaults, clamping every value
 * and re-deriving anything that is stale or malformed.
 *
 * MIGRATION: Supports both old model (breakPeriods, lunchBreakPeriod) and
 * new model (breakAfter, lunchAfter).
 */
export function sanitizeConfig(raw) {
  if (!raw || typeof raw !== 'object') return buildDefaultConfig();

  const numberOfPeriods = clampInt(raw.numberOfPeriods, MIN_PERIODS, MAX_PERIODS);
  const workingDays = (Array.isArray(raw.workingDays) ? raw.workingDays : []).filter((day) =>
    DAYS_OF_WEEK.includes(day)
  );
  const days = workingDays.length ? workingDays : [...DEFAULT_WORKING_DAYS];

  const periodDuration = clampInt(raw.periodDuration, 1, MAX_DURATION_MINUTES);
  const breakTime = clampInt(raw.breakTime, 1, MAX_BREAK_MINUTES);
  const lunchTime = clampInt(raw.lunchTime, 1, MAX_LUNCH_MINUTES);
  const collegeStartTime = isValidTime(raw.collegeStartTime) ? raw.collegeStartTime : '09:00';
  const collegeEndTime = isValidTime(raw.collegeEndTime) ? raw.collegeEndTime : '16:00';

  // Migration: old model used breakPeriods (periods treated as break),
  // new model uses breakAfter (periods AFTER which break occurs).
  // For migration, convert old breakPeriods to breakAfter.
  let breakAfter = [];
  if (Array.isArray(raw.breakAfter)) {
    breakAfter = raw.breakAfter
      .map(Number)
      .filter((p) => Number.isInteger(p) && p >= MIN_PERIODS && p < numberOfPeriods)
      .sort((a, b) => a - b);
  } else if (Array.isArray(raw.breakPeriods)) {
    // Old model: breakPeriods meant "this period IS a break".
    // New model: breakAfter means "break AFTER this period".
    // For migration, convert: if break was period 3, now break after period 2.
    breakAfter = raw.breakPeriods
      .map(Number)
      .map((p) => p - 1) // Convert: period that WAS break -> period BEFORE which break was
      .filter((p) => Number.isInteger(p) && p >= MIN_PERIODS && p < numberOfPeriods)
      .sort((a, b) => a - b);
  }

  // Migration: old model used lunchBreakPeriod, new model uses lunchAfter.
  let lunchAfter = null;
  if (raw.lunchAfter != null) {
    const lunchCandidate = Number(raw.lunchAfter);
    if (Number.isInteger(lunchCandidate) && lunchCandidate >= MIN_PERIODS && lunchCandidate < numberOfPeriods) {
      lunchAfter = lunchCandidate;
    }
  } else if (raw.lunchBreakPeriod != null) {
    // Old model: lunchBreakPeriod meant "this period IS lunch".
    // New model: lunchAfter means "lunch AFTER this period".
    const lunchCandidate = Number(raw.lunchBreakPeriod) - 1;
    if (Number.isInteger(lunchCandidate) && lunchCandidate >= MIN_PERIODS && lunchCandidate < numberOfPeriods) {
      lunchAfter = lunchCandidate;
    }
  }

  // The periods array may contain old-format entries (without isTeaching flags)
  // or new-format entries. If stored periods don't have isTeaching, we should
  // still accept them but re-derive to get correct timings.
  const storedPeriods =
    Array.isArray(raw.periods) && raw.periods.length > 0
      ? raw.periods.map((p, index) =>
          makePeriod(
            p?.periodNumber ?? p?.period_number ?? (index + 1),
            p?.startTime || p?.start_time || '',
            p?.endTime || p?.end_time || '',
            p?.isTeaching ?? true,
            p?.isBreak ?? false,
            p?.isLunch ?? false,
          )
        )
      : null;

  const periods =
    storedPeriods && storedPeriods.some((p) => isValidTime(p.startTime) && isValidTime(p.endTime))
      ? storedPeriods
      : derivePeriods(collegeStartTime, periodDuration, numberOfPeriods, {
          breakAfter,
          lunchAfter,
          breakTime,
          lunchTime,
        });

  return {
    workingDays: days,
    numberOfPeriods,
    collegeStartTime,
    collegeEndTime,
    periodDuration,
    breakTime,
    lunchTime,
    breakAfter,
    lunchAfter,
    periods,
  };
}

/* ----------------------------------------------------------------
   Persistence seam (swap for Supabase later)
---------------------------------------------------------------- */

export function loadSetupConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return sanitizeConfig(raw);
  } catch {
    return buildDefaultConfig();
  }
}

export function saveSetupConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function clearSetupConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable - ignore */
  }
}

/* ----------------------------------------------------------------
   Validation
---------------------------------------------------------------- */

/**
 * Validate the whole configuration and produce field-level errors plus a list
 * of non-blocking warnings. Returns:
 *   { valid, errors: {field: message}, warnings: [string] }
 */
export function validateSetupConfig(config) {
  const errors = {};
  const warnings = [];

  if (!config.workingDays || config.workingDays.length === 0) {
    errors.workingDays = 'At least one working day must be selected.';
  }

  if (!config.numberOfPeriods || config.numberOfPeriods < MIN_PERIODS) {
    errors.numberOfPeriods = 'At least one period is required.';
  } else if (config.numberOfPeriods > MAX_PERIODS) {
    errors.numberOfPeriods = `A maximum of ${MAX_PERIODS} periods is allowed.`;
  }

  if (!isValidTime(config.collegeStartTime)) {
    errors.collegeStartTime = 'College start time is required.';
  }
  if (!isValidTime(config.collegeEndTime)) {
    errors.collegeEndTime = 'College end time is required.';
  }
  if (
    isValidTime(config.collegeStartTime) &&
    isValidTime(config.collegeEndTime) &&
    timeToMinutes(config.collegeEndTime) <= timeToMinutes(config.collegeStartTime)
  ) {
    errors.collegeEndTime = 'College end time must be later than start time.';
  }

  if (!config.periodDuration || config.periodDuration <= 0) {
    errors.periodDuration = 'Period duration must be greater than 0 minutes.';
  }

  if (!config.breakTime || config.breakTime <= 0) {
    errors.breakTime = 'Break time must be greater than 0 minutes.';
  }
  if (!config.lunchTime || config.lunchTime <= 0) {
    errors.lunchTime = 'Lunch time must be greater than 0 minutes.';
  }

  // Validate breakAfter and lunchAfter using the new model
  const breakAfter = Array.isArray(config.breakAfter) ? config.breakAfter : [];
  const lunchAfter = config.lunchAfter;

  // Rule: Break and Lunch cannot be after the same period
  if (lunchAfter != null && breakAfter.includes(lunchAfter)) {
    errors.breakAfter = 'Break and Lunch cannot both be scheduled after the same period.';
  }

  // Rule: Break/Lunch after the final period is not allowed
  if (lunchAfter != null && lunchAfter >= config.numberOfPeriods) {
    errors.lunchAfter = 'Lunch must be scheduled before the final period.';
  }
  for (const b of breakAfter) {
    if (b >= config.numberOfPeriods) {
      errors.breakAfter = 'Break must be scheduled before the final period.';
      break;
    }
  }

  // Validate period timings (teaching periods only)
  const periods = Array.isArray(config.periods) ? config.periods : [];
  const teachingPeriods = periods.filter(
    (p) => p.isTeaching === true || p.isTeaching === undefined
  );

  for (const period of teachingPeriods) {
    if (!isValidTime(period.startTime) || !isValidTime(period.endTime)) {
      errors.periods = `Please set valid start and end times for ${periodLabel(period.periodNumber)}.`;
      break;
    }
    if (timeToMinutes(period.endTime) <= timeToMinutes(period.startTime)) {
      errors.periods = `${periodLabel(period.periodNumber)} end time must be later than its start time.`;
      break;
    }
  }

  // Check teaching periods don't overlap
  if (!errors.periods) {
    for (let i = 0; i < teachingPeriods.length; i += 1) {
      for (let j = i + 1; j < teachingPeriods.length; j += 1) {
        const a = teachingPeriods[i];
        const b = teachingPeriods[j];
        const aStart = timeToMinutes(a.startTime);
        const aEnd = timeToMinutes(a.endTime);
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        if (aStart < bEnd && bStart < aEnd) {
          errors.periods = `${periodLabel(a.periodNumber)} and ${periodLabel(b.periodNumber)} timings overlap.`;
          break;
        }
      }
      if (errors.periods) break;
    }
  }

  // Warn if last teaching period extends beyond college end time
  if (!errors.periods && teachingPeriods.length > 0) {
    const lastPeriod = teachingPeriods[teachingPeriods.length - 1];
    if (
      lastPeriod &&
      isValidTime(lastPeriod.endTime) &&
      isValidTime(config.collegeEndTime) &&
      timeToMinutes(lastPeriod.endTime) > timeToMinutes(config.collegeEndTime)
    ) {
      warnings.push('The last period extends beyond the college end time.');
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, warnings };
}
