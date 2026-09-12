/**
 * ComingSoon - Shared "Ready for Future Integration" placeholder page.
 *
 * Purpose:
 *   Gives every Phase 2 management page a polished, premium placeholder so
 *   the UI is visually complete before the CRUD/API layer is wired up.
 *
 * Props:
 *   icon       {LucideIcon} - Hero icon rendered in the gradient core.
 *   title      {string}     - Page heading (e.g. "Add Class").
 *   subtitle   {string}     - Short page subtitle under the heading.
 *   description{string}     - Longer copy shown inside the card.
 *   features   {string[]}   - Feature chips previewing future capability.
 *   grad1/grad2 {string}    - Gradient hex stops for the icon core.
 *
 * Logic:
 *   - Renders the standard page header, then an animated glass card with
 *     spinning orbit rings, floating chips and a "Ready for Future
 *     Integration" pill.
 *
 * Future integration point:
 *   Replace the inner card with the real form/table when APIs arrive;
 *   keep this component for "coming soon" screens that still need a home.
 */
import { LuCheck, LuSparkles } from 'react-icons/lu';

export default function ComingSoon({
  icon: Icon,
  title,
  subtitle,
  description,
  features = [],
  grad1 = '#2563eb',
  grad2 = '#7c3aed',
}) {
  return (
    <div className="dash-page">
      <div className="dash-page-head">
        <span className="dash-eyebrow">Smart Timetable</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="dash-cs-wrap">
        <div className="dash-cs-card">
          {/* Animated orbit illustration */}
          <div className="dash-cs-orbit" aria-hidden="true">
            <span className="dash-cs-ring" />
            <span className="dash-cs-ring r2" />
            <span className="dash-cs-ring r3" />
            <span
              className="dash-cs-chip"
              style={{ top: -2, left: '18%' }}
            >
              <LuCheck />
            </span>
            <span
              className="dash-cs-chip"
              style={{ bottom: 4, right: '12%', animationDelay: '1.2s' }}
            >
              <LuSparkles />
            </span>
            <span
              className="dash-cs-core"
              style={{ ['--cs-grad-1' ]: grad1, ['--cs-grad-2']: grad2 }}
            >
              <Icon />
            </span>
          </div>

          <h2>{title}</h2>
          <p className="dash-cs-sub">{description}</p>

          {features.length > 0 && (
            <div className="dash-cs-feats">
              {features.map((feature) => (
                <span className="dash-cs-feat" key={feature}>
                  <LuCheck aria-hidden="true" />
                  {feature}
                </span>
              ))}
            </div>
          )}

          <span className="dash-cs-pill">
            <LuSparkles aria-hidden="true" />
            Ready for Future Integration
          </span>
        </div>
      </div>
    </div>
  );
}
