/**
 * ManualTimetable - Manual timetable workspace (Phase 2).
 *
 * Purpose:
 *   A professional blank-canvas workspace where users will later drag & drop
 *   classes onto a grid. Presentational for now.
 *
 * Props:
 *   None.
 *
 * Logic:
 *   - Toolbar buttons are intentionally disabled (cursor: not-allowed) to
 *     communicate the future workflow.
 *   - The canvas is a large dotted grid with a centered placeholder.
 *
 * Future integration point:
 *   Replace the canvas placeholder with an interactive drag & drop grid,
 *   backed by the manual timetable API.
 */
import {
  LuGraduationCap,
  LuBuilding2,
  LuBookOpen,
  LuPencilRuler,
  LuMousePointerClick,
  LuCalendarCheck,
  LuListChecks,
  LuDownload,
} from 'react-icons/lu';

const TOOLBAR_BUTTONS = [
  { label: 'Add Class', icon: LuGraduationCap },
  { label: 'Add Room', icon: LuBuilding2 },
  { label: 'Add Subject', icon: LuBookOpen },
];

export default function ManualTimetable() {
  return (
    <div className="dash-page">
      <div className="dash-page-head">
        <span className="dash-eyebrow">Workspace</span>
        <h1>Manually Create Timetable</h1>
        <p>
          Build your schedule by hand on a blank canvas. Drag classes into
          periods and validate your layout as you go.
        </p>
      </div>

      <div className="dash-manual">
        {/* Toolbar (UI only) */}
        <div className="dash-toolbar" role="toolbar" aria-label="Canvas toolbar">
          {TOOLBAR_BUTTONS.map((btn) => (
            <button
              type="button"
              className="dash-toolbar-btn"
              key={btn.label}
              disabled
              title="Coming soon"
            >
              <btn.icon aria-hidden="true" />
              {btn.label}
            </button>
          ))}
          <span className="dash-toolbar-sep" aria-hidden="true" />
          <button type="button" className="dash-toolbar-btn" disabled title="Coming soon">
            <LuListChecks aria-hidden="true" />
            Validate
          </button>
          <button type="button" className="dash-toolbar-btn" disabled title="Coming soon">
            <LuDownload aria-hidden="true" />
            Export
          </button>
          <span className="dash-toolbar-hint">
            <LuMousePointerClick aria-hidden="true" />
            Drag &amp; drop coming soon
          </span>
        </div>

        {/* Blank canvas */}
        <div className="dash-canvas">
          <span className="dash-canvas-corner tl" aria-hidden="true" />
          <span className="dash-canvas-corner tr" aria-hidden="true" />
          <span className="dash-canvas-corner bl" aria-hidden="true" />
          <span className="dash-canvas-corner br" aria-hidden="true" />

          <div className="dash-canvas-inner">
            <span className="dash-canvas-icon">
              <LuPencilRuler aria-hidden="true" />
            </span>
            <h3>Your timetable canvas</h3>
            <p>
              This is where you'll design periods, drag classes and preview
              your week in real time. The workspace is ready and waiting.
            </p>
            <div className="dash-canvas-badges">
              <span className="dash-canvas-badge">
                <LuCalendarCheck aria-hidden="true" /> Drag &amp; Drop
              </span>
              <span className="dash-canvas-badge">Conflict Validation</span>
              <span className="dash-canvas-badge">Live Preview</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
