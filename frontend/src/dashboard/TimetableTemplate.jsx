/**
 * TimetableTemplate - Template picker page (Phase 2).
 *
 * Purpose:
 *   Lets users preview and (later) choose a starting layout for generation.
 *   Purely presentational for now — no persistence.
 *
 * Props:
 *   None.
 *
 * Logic:
 *   - Template data is declared as a local config array.
 *   - Cards carry CSS gradient tokens via inline custom properties.
 *
 * Future integration point:
 *   Wire card clicks to select/store a template (e.g. context + API) and
 *   populate the ghost card with saved user templates.
 */
import { motion } from 'framer-motion';
import {
  LuLayoutTemplate,
  LuSchool,
  LuGraduationCap,
  LuPlus,
  LuArrowRight,
} from 'react-icons/lu';

const TEMPLATES = [
  {
    name: 'Default Template',
    icon: LuLayoutTemplate,
    grad1: '#2563eb',
    grad2: '#7c3aed',
    description:
      'The standard 5-day academic week with 7 daily periods and a dedicated lunch break. The fastest way to get started.',
    tags: ['5 Days', '7 Periods'],
  },
  {
    name: 'College Template',
    icon: LuSchool,
    grad1: '#7c3aed',
    grad2: '#06b6d4',
    description:
      'A 6-day structure built for larger colleges, with 8 periods per day and support for lab sessions and tutorials.',
    tags: ['6 Days', '8 Periods'],
  },
  {
    name: 'University Template',
    icon: LuGraduationCap,
    grad1: '#06b6d4',
    grad2: '#2563eb',
    description:
      'Flexible, department-based layouts for universities with electives, cross-faculty sharing and varied workloads.',
    tags: ['Flexible', 'Departments'],
  },
];

export default function TimetableTemplate() {
  return (
    <div className="dash-page">
      <div className="dash-page-head">
        <span className="dash-eyebrow">Templates</span>
        <h1>Time Table Templates</h1>
        <p>
          Pick a starting structure for your timetable. Templates define the
          weekly rhythm — days, periods and breaks — before anything is generated.
        </p>
      </div>

      <section className="dash-templates" aria-label="Timetable templates">
        {TEMPLATES.map((tpl, i) => (
          <motion.article
            key={tpl.name}
            className="dash-tpl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.4, ease: 'easeOut' }}
            style={{ ['--tpl-grad-1']: tpl.grad1, ['--tpl-grad-2']: tpl.grad2 }}
          >
            <div className="dash-tpl-cover">
              <tpl.icon aria-hidden="true" />
            </div>
            <div className="dash-tpl-body">
              <h3>{tpl.name}</h3>
              <p>{tpl.description}</p>
              <div className="dash-tpl-tags">
                <span className="dash-tpl-tag pill-ready">
                  Ready for Future Integration
                </span>
                {tpl.tags.map((tag) => (
                  <span className="dash-tpl-tag pill-days" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.article>
        ))}

        {/* Ghost card for future custom templates */}
        <motion.article
          className="dash-tpl dash-tpl-ghost"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.4, ease: 'easeOut' }}
        >
          <LuPlus aria-hidden="true" />
          <span>Create your own template</span>
          <LuArrowRight aria-hidden="true" />
        </motion.article>
      </section>
    </div>
  );
}
