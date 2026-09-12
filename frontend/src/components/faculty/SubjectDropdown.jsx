import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiSearch, FiCheck, FiX, FiChevronDown } from 'react-icons/fi';

const GAP = 6;
const VIEWPORT_MARGIN = 8;
const MAX_MENU_HEIGHT = 300;

/**
 * SubjectDropdown - searchable single-select for the subject dropdown.
 *
 * The Add Faculty manual form binds each faculty member to exactly one
 * subject, so this is a single-select (unlike the branch multi-select). The
 * option list is rendered through a portal into <body> so it always floats
 * above the modal overlay (z-index 11000 vs the modal's 10000) and is never
 * clipped by a scrollable modal container. Its position is viewport-aware:
 * it opens below the control when there is room, flips above it otherwise,
 * and is clamped inside the viewport so every option stays reachable.
 *
 * @param {Array<Object>} subjects - Subjects from the DB: [{ id, subject_code, subject_name, branch_classes }].
 * @param {string|null} value - Currently selected subject id.
 * @param {function} onChange - Called with the selected subject id (or null when cleared).
 * @param {string} placeholder - Placeholder for the closed control.
 * @param {boolean} disabled - Disables interaction.
 */
export default function SubjectDropdown({
  subjects = [],
  value = null,
  onChange,
  placeholder = 'Select a subject',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [anchor, setAnchor] = useState(null);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  const options = useMemo(() => {
    return subjects
      .filter((s) => s.subject_name)
      .map((s) => ({
        id: s.id,
        code: String(s.subject_code || ''),
        name: String(s.subject_name || ''),
        branches: s.branch_classes || [],
      }))
      .sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name));
  }, [subjects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.code.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q) ||
        o.branches.some((b) => String(b).toLowerCase().includes(q))
    );
  }, [options, query]);

  const selected = useMemo(
    () => options.find((o) => o.id === value) || null,
    [options, value]
  );

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

  const select = (option) => {
    if (disabled) return;
    onChange(option.id);
    setOpen(false);
  };

  const clear = (e) => {
    if (disabled) return;
    e.stopPropagation();
    onChange(null);
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
    <div className={`faculty-select${open ? ' is-open' : ''}`} ref={containerRef}>
      <div
        className="faculty-select-control"
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        {selected ? (
          <span className="faculty-select-value">
            {selected.code && <span className="faculty-select-code">{selected.code}</span>}
            <span className="faculty-select-name">{selected.name}</span>
          </span>
        ) : (
          <span className="faculty-select-placeholder">{placeholder}</span>
        )}
        <span className="faculty-select-control-icons">
          {selected && (
            <button
              type="button"
              className="faculty-select-clear"
              onClick={clear}
              aria-label="Clear subject"
            >
              <FiX size={14} aria-hidden="true" />
            </button>
          )}
          <FiChevronDown className="faculty-select-chevron" size={16} aria-hidden="true" />
        </span>
      </div>

      {open &&
        anchor &&
        createPortal(
          <div
            className="faculty-select-menu"
            ref={menuRef}
            style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
          >
            <div className="faculty-select-search">
              <FiSearch size={14} aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search subjects..."
                aria-label="Search subjects"
                autoFocus
              />
            </div>
            <div className="faculty-select-options">
              {filtered.length === 0 ? (
                <div className="faculty-select-empty">
                  No matching subjects. Add them in the Subjects module first.
                </div>
              ) : (
                filtered.map((o) => {
                  const checked = selected?.id === o.id;
                  return (
                    <button
                      type="button"
                      key={o.id}
                      className={`faculty-select-option${checked ? ' is-selected' : ''}`}
                      onClick={() => select(o)}
                    >
                      <span className="faculty-radio">
                        {checked && <FiCheck size={13} aria-hidden="true" />}
                      </span>
                      <span className="faculty-option-text">
                        <span className="faculty-option-title">
                          {o.code && <span className="faculty-option-code">{o.code}</span>}
                          <strong>{o.name}</strong>
                        </span>
                        {o.branches.length > 0 && (
                          <span className="faculty-option-branches">
                            {o.branches.slice(0, 4).join(' · ')}
                            {o.branches.length > 4 ? ` +${o.branches.length - 4}` : ''}
                          </span>
                        )}
                      </span>
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
