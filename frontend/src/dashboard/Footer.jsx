/**
 * Footer - Glassmorphism footer pinned to the bottom of the dashboard.
 *
 * Purpose:
 *   Shows version info, the technology stack and the copyright line.
 *
 * Props:
 *   None - renders static info (year is computed at runtime).
 *
 * Logic:
 *   - No state; the shell's flex layout (min-height: 100vh + flex:1 body)
 *     keeps this footer at the bottom of the viewport even on short pages.
 *
 * Future integration point:
 *   Read version/build info from package metadata or an API when desired.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="dash-footer">
      <span>
        © {year} <strong>Smart Timetable</strong>. All rights reserved.
      </span>

      <span className="dash-footer-group">
        <span className="dash-footer-version">v1.0.0</span>
        <span>Made with</span>
        <span className="dash-footer-heart" aria-hidden="true">
          ♥
        </span>
        <span className="dash-footer-chip">React</span>
        <span className="dash-footer-chip">FastAPI</span>
        <span className="dash-footer-chip">Supabase</span>
      </span>
    </footer>
  );
}
