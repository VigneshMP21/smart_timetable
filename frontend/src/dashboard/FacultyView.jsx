import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiChevronDown } from 'react-icons/fi';
import TimetableCard from '../components/TimetableCard/TimetableCard';
import Loader from '../components/Loader/Loader';
import { useAppContext } from '../context/AppContext';
import { useStatistics } from '../hooks/useStatistics';
import './FacultyView.css';

export default function FacultyView() {
  const { facultyName: urlFacultyName } = useParams();
  const navigate = useNavigate();
  const { timetableData, statistics } = useAppContext();
  const { loadStatistics } = useStatistics();
  const [selectedFaculty, setSelectedFaculty] = useState('');

  useEffect(() => {
    if (!timetableData) {
      navigate('/generate');
      return;
    }
    if (!statistics) {
      loadStatistics().catch(() => {});
    }
  }, [timetableData, statistics, loadStatistics, navigate]);

  const facultyList = useMemo(() => {
    if (!statistics?.faculty_statistics) return [];
    return statistics.faculty_statistics.map((f) => f.faculty_name);
  }, [statistics]);

  useEffect(() => {
    if (facultyList.length > 0 && !selectedFaculty) {
      const name = urlFacultyName && facultyList.includes(urlFacultyName) ? urlFacultyName : facultyList[0];
      setSelectedFaculty(name);
    }
  }, [facultyList, urlFacultyName, selectedFaculty]);

  const facultySchedule = useMemo(() => {
    if (!timetableData?.timetable || !selectedFaculty) return {};
    const schedule = {};
    const timetable = timetableData.timetable;

    Object.entries(timetable).forEach(([className, days]) => {
      Object.entries(days).forEach(([day, periods]) => {
        periods.forEach((entry) => {
          if (entry.faculty === selectedFaculty) {
            if (!schedule[day]) schedule[day] = [];
            schedule[day].push({ ...entry, className });
          }
        });
      });
    });

    Object.keys(schedule).forEach((day) => {
      schedule[day].sort((a, b) => a.period - b.period);
    });

    return schedule;
  }, [timetableData, selectedFaculty]);

  const facultyStats = useMemo(() => {
    if (!statistics?.faculty_statistics || !selectedFaculty) return null;
    return statistics.faculty_statistics.find((f) => f.faculty_name === selectedFaculty);
  }, [statistics, selectedFaculty]);

  if (!timetableData) {
    return <Loader message="Loading timetable..." />;
  }

  const days = Object.keys(facultySchedule);
  const periods = timetableData?.config?.periods || [];

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
              <h1>Faculty Timetable</h1>
              <p>View the weekly schedule for faculty members.</p>
            </div>
            <div className="class-view-controls">
              <div className="class-select-wrapper">
                <select
                  value={selectedFaculty}
                  onChange={(e) => setSelectedFaculty(e.target.value)}
                  className="class-select"
                  aria-label="Select faculty"
                >
                  {facultyList.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <FiChevronDown className="class-select-icon" size={16} />
              </div>
            </div>
          </div>

          <TimetableCard
            timetable={facultySchedule}
            days={days}
            periods={periods}
            title={`${selectedFaculty} - Weekly Schedule`}
          />

          {facultyStats && (
            <div className="faculty-stats-section">
              <h3 className="faculty-stats-title">Workload Summary</h3>
              <div className="faculty-stats-grid">
                <div className="faculty-stat-item">
                  <span className="faculty-stat-label">Total Hours</span>
                  <span className="faculty-stat-value">{facultyStats.total_hours || 0}</span>
                </div>
                <div className="faculty-stat-item">
                  <span className="faculty-stat-label">Classes Taught</span>
                  <span className="faculty-stat-value">{facultyStats.classes_taught?.length || 0}</span>
                </div>
                <div className="faculty-stat-item">
                  <span className="faculty-stat-label">Department</span>
                  <span className="faculty-stat-value">{facultyStats.department || 'N/A'}</span>
                </div>
              </div>
              {facultyStats.daily_load && (
                <div className="daily-load">
                  <h4>Daily Load</h4>
                  <div className="daily-load-bar">
                    {Object.entries(facultyStats.daily_load).map(([day, hours]) => (
                      <div key={day} className="daily-load-item">
                        <div className="daily-load-bar-bg">
                          <div
                            className="daily-load-bar-fill"
                            style={{ height: `${(hours / 8) * 100}%` }}
                          />
                        </div>
                        <span className="daily-load-label">{day.slice(0, 3)}</span>
                        <span className="daily-load-value">{hours}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
