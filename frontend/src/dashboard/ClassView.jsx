import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiPrinter, FiChevronDown, FiEdit3, FiSave, FiX, FiTrash2, FiCpu } from 'react-icons/fi';
import TimetableCard from '../components/TimetableCard/TimetableCard';
import Button from '../components/Buttons/Button';
import Loader from '../components/Loader/Loader';
import { useAppContext } from '../context/AppContext';
import { useTimetable } from '../hooks/useTimetable';
import { getPreviewData } from '../services/uploadService';
import { extractErrorList } from '../utils/errors';
import { facultyTeachesClass } from '../utils/facultyBranches';
import { toast } from 'react-toastify';
import './ClassView.css';

const KEY = (day, period) => `${day}|${period}`;

/**
 * Editable grid cell: subject + faculty dropdowns for teaching/free slots.
 * Break and lunch cells are locked.
 */
function EditableCell({ day, period, cell, locked, subjects, facultyBySubject, onChange }) {
  if (locked) {
    return <div className={`tt-cell tt-cell-locked ${cell?.type === 'Lunch' ? 'lunch' : 'break'}`}>{cell?.subject}</div>;
  }

  const subjectId = cell?.subjectId || '';
  const facultyOptions = subjectId ? facultyBySubject[subjectId] || [] : [];

  return (
    <div className="tt-cell tt-cell-edit">
      <select
        className="tt-edit-subject"
        value={subjectId}
        onChange={(e) => {
          const nextSubject = e.target.value;
          const firstFaculty = nextSubject ? (facultyBySubject[nextSubject] || [])[0]?.id || '' : '';
          onChange(day, period, { subjectId: nextSubject, facultyId: firstFaculty });
        }}
        aria-label={`Subject - ${day} period ${period}`}
      >
        <option value="">Free Period</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>{s.subject_name}</option>
        ))}
      </select>
      <select
        className="tt-edit-faculty"
        value={cell?.facultyId || ''}
        onChange={(e) => onChange(day, period, { subjectId, facultyId: e.target.value })}
        disabled={!subjectId || facultyOptions.length === 0}
        aria-label={`Faculty - ${day} period ${period}`}
      >
        <option value="">{facultyOptions.length ? 'Faculty' : 'No faculty'}</option>
        {facultyOptions.map((f) => (
          <option key={f.id} value={f.id}>{f.faculty_name}</option>
        ))}
      </select>
    </div>
  );
}

export default function ClassView() {
  const { className: urlClassName } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { timetableData, loadTimetable, isLoadingTimetable } = useAppContext();
  const { saveEdits, reset } = useTimetable();
  const [selectedClass, setSelectedClass] = useState('');
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [editCells, setEditCells] = useState(null);
  const [subjectOptions, setSubjectOptions] = useState({ subjects: [], facultyBySubject: {} });
  const [saveErrors, setSaveErrors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (timetableData) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await loadTimetable();
        if (cancelled) return;
        if (!data?.timetable || Object.keys(data.timetable).length === 0) {
          toast.info('No timetable found. Generate one to get started.');
          navigate('/generate');
        }
      } catch {
        if (!cancelled) navigate('/generate');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [timetableData, loadTimetable, navigate]);

  const classes = useMemo(() => {
    return Object.keys(timetableData?.timetable || {});
  }, [timetableData]);

  useEffect(() => {
    if (!classes.length) return;
    if (urlClassName && classes.includes(urlClassName)) {
      setSelectedClass(urlClassName);
    } else if (classes.length > 0) {
      setSelectedClass(classes[0]);
    }
  }, [classes, urlClassName]);

  const config = timetableData?.config || {};
  const workingDays = config.working_days || [];
  const periods = config.periods || [];
  const teachingPeriods = periods.filter((p) => !p.is_break && !p.is_lunch);

  const classInfo = useMemo(() => {
    if (!timetableData || !selectedClass) return null;
    return (timetableData.classes || []).find(
      (c) => `${c.class_name} - ${c.section}` === selectedClass
    ) || null;
  }, [timetableData, selectedClass]);

  const timetable = useMemo(() => {
    return timetableData?.timetable?.[selectedClass] || {};
  }, [timetableData, selectedClass]);

  const days = workingDays.length ? workingDays : Object.keys(timetable);

  // Load subject/faculty options for the selected class (edit mode).
  useEffect(() => {
    let cancelled = false;
    if (!classInfo) return;
    (async () => {
      try {
        const preview = await getPreviewData();
        if (cancelled) return;
        const shortCode = classInfo.short_code;
        const subjects = (preview.subjects || []).filter(
          (s) => (s.branch_classes || []).includes(shortCode)
        );
        const facultyBySubject = {};
        (preview.faculty || []).forEach((f) => {
          if (!facultyTeachesClass(f, shortCode, classInfo.section)) return;
          if (!facultyBySubject[f.subject_id]) facultyBySubject[f.subject_id] = [];
          facultyBySubject[f.subject_id].push(f);
        });
        const usable = subjects.filter((s) => (facultyBySubject[s.id] || []).length > 0);
        setSubjectOptions({ subjects: usable, facultyBySubject });
      } catch {
        // Editing options unavailable; save will still surface backend errors.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classInfo]);

  const buildEditCells = useCallback(() => {
    const cells = {};
    for (const day of days) {
      const daySlots = timetable[day] || [];
      for (const p of teachingPeriods) {
        const pnum = p.period_number;
        const slot = daySlots.find((s) => s.period === pnum);
        cells[KEY(day, pnum)] = {
          subjectId: slot?.subject_id || null,
          facultyId: slot?.faculty_id || null,
          type: slot?.type || 'Free',
          subject: slot?.subject || '',
        };
      }
    }
    return cells;
  }, [days, teachingPeriods, timetable]);

  const enterEditMode = () => {
    setEditCells(buildEditCells());
    setSaveErrors([]);
    setEditing(true);
  };

  const exitEditMode = () => {
    setEditCells(null);
    setSaveErrors([]);
    setEditing(false);
  };

  const handleCellChange = (day, period, values) => {
    setEditCells((prev) => ({
      ...prev,
      [KEY(day, period)]: { ...prev[KEY(day, period)], ...values },
    }));
  };

  const handleSave = async () => {
    if (!classInfo) return;
    const entries = [];
    for (const day of days) {
      for (const p of teachingPeriods) {
        const pnum = p.period_number;
        const cell = editCells?.[KEY(day, pnum)] || {};
        entries.push({
          day,
          period: pnum,
          subject_id: cell.subjectId || null,
          faculty_id: cell.facultyId || null,
          room_no: null,
        });
      }
    }
    setIsSaving(true);
    setSaveErrors([]);
    try {
      await saveEdits(classInfo.class_id, entries);
      exitEditMode();
    } catch (err) {
      setSaveErrors(extractErrorList(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset your timetable? All of your saved schedules will be removed.')) return;
    const ok = await reset();
    if (ok) navigate('/generate');
  };

  if (isLoadingTimetable && !timetableData) {
    return <Loader message="Loading timetable..." />;
  }

  if (!timetableData || !selectedClass) {
    return null;
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-wrapper">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="class-view-header">
            <div>
              <h1>Class Timetable</h1>
              <p>{editing ? 'Edit subjects and faculty for each period, then save.' : 'View the weekly schedule for each class.'}</p>
            </div>
            <div className="class-view-controls">
              <div className="class-select-wrapper">
                <select
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    if (editing) exitEditMode();
                  }}
                  className="class-select"
                  aria-label="Select class"
                >
                  {classes.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                <FiChevronDown className="class-select-icon" size={16} />
              </div>
              {editing ? (
                <>
                  <Button variant="success" size="sm" onClick={handleSave} loading={isSaving}>
                    <FiSave size={16} /> Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={exitEditMode}>
                    <FiX size={16} /> Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={enterEditMode}>
                    <FiEdit3 size={16} /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/generate')}>
                    <FiCpu size={16} /> Regenerate
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <FiTrash2 size={16} /> Reset
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <FiPrinter size={16} /> Print
                  </Button>
                </>
              )}
            </div>
          </div>

          {saveErrors.length > 0 && (
            <div className="class-view-errors">
              <p className="class-view-errors-title">Timetable has conflicts. Please fix them before saving:</p>
              <ul>
                {saveErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {editing && editCells ? (
            <div className="tt-card">
              <h3 className="tt-title">{selectedClass} - Edit Schedule</h3>
              <div className="tt-table-wrapper">
                <table className="tt-table" role="grid">
                  <thead>
                    <tr>
                      <th className="tt-th day-col">Day</th>
                      {periods.map((p) => (
                        <th key={p.period_number + (p.is_break ? 'b' : p.is_lunch ? 'l' : '')} className={`tt-th ${p.is_lunch ? 'lunch-col' : ''} ${p.is_break ? 'break-col' : ''}`}>
                          <span className="tt-th-label">{p.is_break ? 'Break' : p.is_lunch ? 'Lunch' : `P${p.period_number}`}</span>
                          <span className="tt-th-time">{p.start_time}-{p.end_time}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day) => (
                      <tr key={day}>
                        <td className="tt-td day-cell">{day.slice(0, 3)}</td>
                        {periods.map((p) => {
                          const pnum = p.period_number;
                          const locked = p.is_break || p.is_lunch;
                          return (
                            <td key={pnum + (p.is_break ? 'b' : p.is_lunch ? 'l' : '')} className={`tt-td ${p.is_lunch ? 'lunch-col' : ''} ${p.is_break ? 'break-col' : ''}`}>
                              {locked ? (
                                <div className={`tt-cell tt-cell-locked ${p.is_lunch ? 'lunch' : 'break'}`}>
                                  {p.is_lunch ? 'Lunch Break' : 'Break'}
                                </div>
                              ) : (
                                <EditableCell
                                  day={day}
                                  period={pnum}
                                  cell={editCells[KEY(day, pnum)]}
                                  locked={false}
                                  subjects={subjectOptions.subjects}
                                  facultyBySubject={subjectOptions.facultyBySubject}
                                  onChange={handleCellChange}
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tt-legend">
                <span className="tt-legend-item"><span className="tt-legend-dot" style={{ background: 'var(--primary)' }} /> Pick a subject and its faculty</span>
                <span className="tt-legend-item"><span className="tt-legend-dot" style={{ background: 'var(--border)' }} /> Leave a cell as Free Period</span>
              </div>
            </div>
          ) : (
            <TimetableCard
              timetable={timetable}
              days={days}
              periods={periods}
              title={`${selectedClass} - Weekly Schedule`}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
