import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LuCoffee, LuUtensils, LuChevronDown, LuCheck, LuX } from 'react-icons/lu';
import {
  ordinal,
  MAX_BREAK_MINUTES,
  MAX_LUNCH_MINUTES,
} from '../../utils/setupConfig';

const MENU_GAP = 6;
const MENU_MAX_HEIGHT = 260;
const MENU_Z_INDEX = 1500;

function useMenuPosition(triggerRef, open) {
  const [style, setStyle] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: MENU_MAX_HEIGHT,
  });

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const below = vh - rect.bottom - MENU_GAP;
      const above = rect.top - MENU_GAP;
      const openBelow = below >= above;
      const maxHeight = Math.min(
        MENU_MAX_HEIGHT,
        Math.max(64, openBelow ? below : above)
      );
      const width = rect.width;
      const left = Math.max(MENU_GAP, Math.min(rect.left, vw - MENU_GAP - width));
      const top = openBelow
        ? rect.bottom + MENU_GAP
        : Math.max(MENU_GAP, rect.top - MENU_GAP - maxHeight);
      setStyle({ top, left, width, maxHeight });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [triggerRef, open]);

  return style;
}

function DropdownMenu({ triggerRef, menuRef, ariaLabelledby, open, children }) {
  const style = useMenuPosition(triggerRef, open);

  return createPortal(
    <motion.ul
      ref={menuRef}
      className="setup-select-menu"
      role="listbox"
      aria-labelledby={ariaLabelledby}
      style={{
        position: 'fixed',
        top: style.top,
        left: style.left,
        width: style.width,
        maxHeight: style.maxHeight,
        zIndex: MENU_Z_INDEX,
      }}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      {children}
    </motion.ul>,
    document.body
  );
}

/**
 * breakAfterLabel - "After 2nd Period"
 */
function breakAfterLabel(periodNumber) {
  return `After ${ordinal(periodNumber)} Period`;
}

/**
 * PeriodMultiSelect - multi-select dropdown for choosing break positions.
 * Options show "After 1st Period", "After 2nd Period", etc.
 */
function PeriodMultiSelect({ options, selected, onToggle, labelId }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      const inTrigger = triggerRef.current?.contains(e.target);
      const inMenu = menuRef.current?.contains(e.target);
      if (!inTrigger && !inMenu) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="setup-select">
      <button
        type="button"
        ref={triggerRef}
        className="setup-select-trigger"
        id={labelId}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="setup-select-trigger-label">
          {selected.length === 0
            ? 'Select break periods'
            : `${selected.length} break${selected.length > 1 ? 's' : ''} configured`}
        </span>
        <LuChevronDown className={`setup-select-chevron ${open ? 'open' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <DropdownMenu
            key="menu"
            triggerRef={triggerRef}
            menuRef={menuRef}
            ariaLabelledby={labelId}
            open={open}
          >
            {options.map((periodNumber) => {
              const checked = selected.includes(periodNumber);
              return (
                <li key={periodNumber} role="option" aria-selected={checked}>
                  <button
                    type="button"
                    className={`setup-select-option ${checked ? 'is-selected' : ''}`}
                    onClick={() => onToggle(periodNumber)}
                  >
                    <span className={`setup-select-check ${checked ? 'checked' : ''}`}>
                      {checked && <LuCheck size={12} />}
                    </span>
                    <span className="setup-select-option-label">
                      {breakAfterLabel(periodNumber)}
                    </span>
                  </button>
                </li>
              );
            })}
          </DropdownMenu>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * PeriodSingleSelect - dropdown for choosing lunch position.
 */
function PeriodSingleSelect({ options, value, onChange, labelId }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      const inTrigger = triggerRef.current?.contains(e.target);
      const inMenu = menuRef.current?.contains(e.target);
      if (!inTrigger && !inMenu) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="setup-select">
      <button
        type="button"
        ref={triggerRef}
        className="setup-select-trigger"
        id={labelId}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="setup-select-trigger-label">
          {value != null ? breakAfterLabel(value) : 'No lunch break'}
        </span>
        <LuChevronDown className={`setup-select-chevron ${open ? 'open' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <DropdownMenu
            key="menu"
            triggerRef={triggerRef}
            menuRef={menuRef}
            ariaLabelledby={labelId}
            open={open}
          >
            <li role="option" aria-selected={value === null}>
              <button
                type="button"
                className="setup-select-option"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <span className="setup-select-option-label setup-select-option-label--muted">
                  No lunch break
                </span>
              </button>
            </li>
            {options.map((periodNumber) => (
              <li key={periodNumber} role="option" aria-selected={value === periodNumber}>
                <button
                  type="button"
                  className="setup-select-option"
                  onClick={() => {
                    onChange(periodNumber);
                    setOpen(false);
                  }}
                >
                  <span className="setup-select-option-label">
                    {breakAfterLabel(periodNumber)}
                  </span>
                  {value === periodNumber && <LuCheck size={14} className="setup-option-checked" />}
                </button>
              </li>
            ))}
          </DropdownMenu>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * BreakConfiguration - Card 3. Break and Lunch configuration.
 *
 * New model: breakAfter[] and lunchAfter (teaching period numbers AFTER which
 * break/lunch occurs). Break/lunch are intervals, not periods.
 *
 * Props:
 *   periodOptions      {number[]} Valid teaching period numbers (1..N-1)
 *   breakAfter         {number[]} Selected periods after which break occurs
 *   lunchAfter         {number|null} Selected period after which lunch occurs
 *   breakTime          {number} Minutes per break slot
 *   lunchTime          {number} Minutes for the lunch slot
 *   numberOfPeriods    {number} Total teaching periods
 *   onToggleBreakAfter {fn} (period: number) => void
 *   onSetLunchAfter    {fn} (period: number|null) => void
 *   onBreakTime        {fn} (n: number) => void
 *   onLunchTime        {fn} (n: number) => void
 *   errors             {object}
 *   conflictError      {string|null}
 */
export default function BreakConfiguration({
  periodOptions,
  breakAfter,
  lunchAfter,
  breakTime,
  lunchTime,
  numberOfPeriods,
  onToggleBreakAfter,
  onSetLunchAfter,
  onBreakTime,
  onLunchTime,
  errors,
  conflictError,
}) {
  return (
    <div className="setup-card">
      <div className="setup-card-head">
        <span className="setup-card-icon setup-card-icon--cyan">
          <LuCoffee />
        </span>
        <div>
          <h3 className="setup-card-title">Break Configuration</h3>
          <p className="setup-card-desc">
            Breaks and lunch are inserted between teaching periods. Select after
            which period each break should occur. Teaching period count stays
            at {numberOfPeriods}.
          </p>
        </div>
      </div>

      <div className="setup-break-stack">
        <div className="setup-break-durations">
          <div className={`setup-field ${errors.breakTime ? 'has-error' : ''}`}>
            <label className="setup-field-label" htmlFor="setup-break-time">
              Break Time (minutes)
            </label>
            <input
              id="setup-break-time"
              className="setup-input setup-input--number"
              type="number"
              inputMode="numeric"
              min="1"
              max={MAX_BREAK_MINUTES}
              step="1"
              value={breakTime}
              onChange={(e) => onBreakTime(e.target.value)}
            />
            {errors.breakTime ? (
              <p className="setup-field-error">{errors.breakTime}</p>
            ) : (
              <p className="setup-field-hint">Duration of each break</p>
            )}
          </div>

          <div className={`setup-field ${errors.lunchTime ? 'has-error' : ''}`}>
            <label className="setup-field-label" htmlFor="setup-lunch-time">
              Lunch Time (minutes)
            </label>
            <input
              id="setup-lunch-time"
              className="setup-input setup-input--number"
              type="number"
              inputMode="numeric"
              min="1"
              max={MAX_LUNCH_MINUTES}
              step="1"
              value={lunchTime}
              onChange={(e) => onLunchTime(e.target.value)}
            />
            {errors.lunchTime ? (
              <p className="setup-field-error">{errors.lunchTime}</p>
            ) : (
              <p className="setup-field-hint">Duration of the lunch break</p>
            )}
          </div>
        </div>

        <div className="setup-break-divider" />

        <div className={`setup-break-row ${errors.breakAfter ? 'has-error' : ''}`}>
          <div className="setup-break-row-label">
            <span className="setup-break-bullet setup-break-bullet--break" />
            <div>
              <p className="setup-break-name">Break</p>
              <p className="setup-break-sub">Select after which period the break should occur</p>
            </div>
          </div>

          <PeriodMultiSelect
            labelId="setup-break-select"
            options={periodOptions}
            selected={breakAfter}
            onToggle={onToggleBreakAfter}
          />

          {breakAfter.length > 0 && (
            <div className="setup-chip-row">
              {breakAfter.map((period) => (
                <motion.span
                  key={period}
                  className="setup-chip setup-chip--break"
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  {breakAfterLabel(period)}
                  <button
                    type="button"
                    className="setup-chip-remove"
                    onClick={() => onToggleBreakAfter(period)}
                    aria-label={`Remove break after ${period}`}
                  >
                    <LuX size={13} />
                  </button>
                </motion.span>
              ))}
            </div>
          )}

          {(conflictError || errors.breakAfter) && (
            <p className="setup-field-error setup-error-block">
              {conflictError || errors.breakAfter}
            </p>
          )}
        </div>

        <div className="setup-break-divider" />

        <div className={`setup-break-row ${errors.lunchAfter ? 'has-error' : ''}`}>
          <div className="setup-break-row-label">
            <span className="setup-break-bullet setup-break-bullet--lunch" />
            <div>
              <p className="setup-break-name">Lunch Break</p>
              <p className="setup-break-sub">Select after which period the lunch break should occur</p>
            </div>
          </div>

          <PeriodSingleSelect
            labelId="setup-lunch-select"
            options={periodOptions}
            value={lunchAfter}
            onChange={onSetLunchAfter}
          />

          <AnimatePresence>
            {lunchAfter != null && (
              <motion.div
                className="setup-lunch-tag"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
              >
                <LuUtensils size={15} />
                <span>Lunch break after {ordinal(lunchAfter)} Period</span>
              </motion.div>
            )}
          </AnimatePresence>

          {errors.lunchAfter && (
            <p className="setup-field-error setup-error-block">{errors.lunchAfter}</p>
          )}
        </div>
      </div>
    </div>
  );
}
