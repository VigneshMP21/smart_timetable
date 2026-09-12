import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiSearch, FiCheck, FiX, FiChevronDown } from 'react-icons/fi';

const GAP = 6;
const VIEWPORT_MARGIN = 8;
const MAX_MENU_HEIGHT = 300;

/**
 * MultiSelectClassDropdown - searchable multi-select of branch/class short codes.
 *
 * The backend stores `branch_classes` as distinct class short codes (e.g.
 * ["CSE", "ECE"]), so the dropdown de-duplicates the classes list by short code
 * and lets the user toggle each branch on/off.
 *
 * The option list is rendered through a portal into <body> so it always floats
 * above the modal overlay (z-index 11000 vs the modal's 10000) and is never
 * clipped by a scrollable modal container. Its position is viewport-aware:
 * it opens below the control when there is room, flips above it otherwise, and
 * is clamped inside the viewport so every option stays reachable on desktop
 * and mobile.
 *
 * @param {Array<Object>} classes - All classes from the DB: [{ id, class_name, short_code, section }].
 * @param {Array<string>} value - Currently selected short codes.
 * @param {function} onChange - Called with the new array of short codes.
 * @param {string} placeholder - Placeholder for the closed control.
 * @param {boolean} disabled - Disables interaction.
 */
export default function MultiSelectClassDropdown({
  classes = [],
  value = [],
  onChange,
  placeholder = 'Select branch/class',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [anchor, setAnchor] = useState(null);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  const options = useMemo(() => {
    const byCode = new Map();
    classes.forEach((c) => {
      const code = String(c.short_code || '').trim().toUpperCase();
      if (!code) return;
      if (!byCode.has(code)) {
        byCode.set(code, { code, names: new Set(), sections: new Set() });
      }
      const entry = byCode.get(code);
      if (c.class_name) entry.names.add(c.class_name);
      if (c.section) entry.sections.add(c.section);
    });
    return [...byCode.values()]
      .map((entry) => ({
        code: entry.code,
        label: [...entry.names].filter(Boolean).join(', ') || entry.code,
        sections: [...entry.sections].sort().join(', '),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [classes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.code.toLowerCase().includes(q) ||
        o.label.toLowerCase().includes(q) ||
        o.sections.toLowerCase().includes(q)
    );
  }, [options, query]);

  const selectedSet = useMemo(
    () => new Set(value.map((v) => String(v).trim().toUpperCase())),
    [value]
  );

  const toggle = (code) => {
    if (disabled) return;
    const next = selectedSet.has(code)
      ? value.filter((v) => String(v).trim().toUpperCase() !== code)
      : [...value, code];
    onChange(next);
  };

  const remove = (code) => {
    if (disabled) return;
    onChange(value.filter((v) => String(v).trim().toUpperCase() !== code));
  };

  const positionMenu = useCallback(() => {
    const control = containerRef.current;
    const menu = menuRef.current;
    if (!control) return null;

    const rect = control.getBoundingClientRect();
    const menuHeight = menu ? menu.offsetHeight : MAX_MENU_HEIGHT;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    // Prefer opening below the control; flip above when there is not enough
    // room below (e.g. the modal is centered low on the screen).
    const spaceBelow = viewportH - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const openBelow = spaceBelow >= menuHeight + GAP || spaceBelow >= spaceAbove;

    let top = openBelow
      ? rect.bottom + GAP
      : Math.max(VIEWPORT_MARGIN, rect.top - GAP - menuHeight);

    // Clamp so the menu never spills off the left/right edge of the viewport.
    const width = Math.min(rect.width, viewportW - VIEWPORT_MARGIN * 2);
    const maxLeft = viewportW - width - VIEWPORT_MARGIN;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft));

    return { top, left, width };
  }, []);

  const openMenu = () => {
    if (disabled) return;
    setQuery('');
    setOpen(true);
    setAnchor(positionMenu());
  };

  // Re-measure once the menu is in the DOM so the flip/clamp uses the real
  // rendered height instead of the estimate.
  useLayoutEffect(() => {
    if (open && menuRef.current) {
      setAnchor(positionMenu());
    }
  }, [open, positionMenu]);

  // Close on click outside, Escape, and viewport resize; reposition on scroll.
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (
        containerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const handleClose = () => setOpen(false);
    const handleReposition = () => {
      if (open && containerRef.current) setAnchor(positionMenu());
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleClose);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, positionMenu]);

  return (
    <div className={`subject-multiselect${open ? ' is-open' : ''}`} ref={containerRef}>
      <div className="subject-multiselect-control" onClick={() => (open ? setOpen(false) : openMenu())}>
        {selectedSet.size > 0 ? (
          <div className="subject-chips">
            {value
              .filter((v) => String(v).trim())
              .map((v) => (
                <span className="subject-chip" key={String(v).toUpperCase()}>
                  {String(v).toUpperCase()}
                  <button
                    type="button"
                    className="subject-chip-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(v);
                    }}
                    aria-label={`Remove ${v}`}
                  >
                    <FiX size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
          </div>
        ) : (
          <span className="subject-multiselect-placeholder">{placeholder}</span>
        )}
        <FiChevronDown className="subject-multiselect-chevron" size={16} aria-hidden="true" />
      </div>

      {open &&
        anchor &&
        createPortal(
          <div
            className="subject-multiselect-menu"
            ref={menuRef}
            style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
          >
            <div className="subject-multiselect-search">
              <FiSearch size={14} aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search branch/class..."
                aria-label="Search branch or class"
                autoFocus
              />
            </div>
            <div className="subject-multiselect-options">
              {filtered.length === 0 ? (
                <div className="subject-multiselect-empty">No matching branches.</div>
              ) : (
                filtered.map((o) => {
                  const checked = selectedSet.has(o.code);
                  return (
                    <button
                      type="button"
                      key={o.code}
                      className={`subject-multiselect-option${checked ? ' is-selected' : ''}`}
                      onClick={() => toggle(o.code)}
                    >
                      <span className="subject-checkbox">
                        {checked && <FiCheck size={13} aria-hidden="true" />}
                      </span>
                      <span className="subject-option-text">
                        <strong>{o.code}</strong>
                        <small>{o.label}</small>
                      </span>
                      {o.sections && <span className="subject-option-sections">{o.sections}</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
