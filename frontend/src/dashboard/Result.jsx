import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUsers, FiBook, FiCalendar, FiClock, FiDownload, FiFileText, FiFile, FiCpu, FiEdit3, FiTrash2 } from 'react-icons/fi';
import StatisticsCard from '../components/StatisticsCard/StatisticsCard';
import Button from '../components/Buttons/Button';
import Loader from '../components/Loader/Loader';
import { useAppContext } from '../context/AppContext';
import { useDownload } from '../hooks/useDownload';
import { useTimetable } from '../hooks/useTimetable';
import { formatDuration } from '../utils/helpers';
import { toast } from 'react-toastify';
import './Result.css';

export default function Result() {
  const navigate = useNavigate();
  const { timetableData, isGenerating, isLoadingTimetable, generationTime, isDownloading, loadTimetable } = useAppContext();
  const { downloadExcelFile, downloadPDFFile, downloadWordFile } = useDownload();
  const { reset } = useTimetable();
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (timetableData || isGenerating || isLoadingTimetable) return;
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
  }, [timetableData, isGenerating, isLoadingTimetable, navigate]);

  if (isGenerating || (!timetableData && isLoadingTimetable)) {
    return <Loader message="Loading timetable..." />;
  }

  if (!timetableData) {
    return null;
  }

  const timetable = timetableData.timetable || {};
  const classNames = Object.keys(timetable);
  let totalSubjects = new Set();
  let totalFaculty = new Set();
  let totalEntries = 0;

  classNames.forEach((cls) => {
    Object.values(timetable[cls]).forEach((periods) => {
      periods.forEach((entry) => {
        totalEntries++;
        if (entry.subject && entry.subject !== 'Free Period' && entry.subject !== 'Lunch Break' && entry.subject !== 'Break') {
          totalSubjects.add(entry.subject);
          if (entry.faculty && entry.faculty !== '-') {
            totalFaculty.add(entry.faculty);
          }
        }
      });
    });
  });

  const cards = [
    { label: 'Total Classes', value: classNames.length, type: 'classes', color: '#2563EB' },
    { label: 'Total Faculty', value: totalFaculty.size, type: 'faculty', color: '#06B6D4' },
    { label: 'Subjects', value: totalSubjects.size, type: 'subjects', color: '#8B5CF6' },
    { label: 'Timetable Entries', value: totalEntries, type: 'total', color: '#22C55E' },
    { label: 'Generation Time', value: formatDuration(generationTime), type: 'time', color: '#F59E0B' },
    { label: 'Status', value: timetableData.status === 'success' ? 'Success' : timetableData.status, type: 'conflicts', color: timetableData.status === 'success' ? '#22C55E' : '#EF4444' },
  ];

  const handleReset = async () => {
    if (!window.confirm('Reset your timetable? All of your saved schedules will be removed.')) return;
    setIsResetting(true);
    try {
      const ok = await reset();
      if (ok) navigate('/generate');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="page-header">
            <h1>Result Dashboard</h1>
            <p>Timetable generated successfully. Review, edit and download your schedule.</p>
          </div>

          <div className="result-cards">
            {cards.map((card, i) => (
              <StatisticsCard
                key={i}
                label={card.label}
                value={card.value}
                type={card.type}
                color={card.color}
                delay={i * 0.08}
              />
            ))}
          </div>

          <div className="result-actions">
            <Button variant="primary" size="lg" onClick={() => navigate('/result/class/' + encodeURIComponent(classNames[0] || ''))}>
              <FiUsers size={18} /> View Class Timetable
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/result/faculty/' + encodeURIComponent(totalFaculty.values().next().value || ''))}>
              <FiCalendar size={18} /> View Faculty Timetable
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/result/class/' + encodeURIComponent(classNames[0] || '') + '?edit=1')}>
              <FiEdit3 size={18} /> Edit Timetable
            </Button>
            <Button variant="outline" size="lg" onClick={downloadExcelFile} loading={isDownloading}>
              <FiDownload size={18} /> Download Excel
            </Button>
            <Button variant="outline" size="lg" onClick={downloadPDFFile} loading={isDownloading}>
              <FiFileText size={18} /> Download PDF
            </Button>
            <Button variant="outline" size="lg" onClick={downloadWordFile} loading={isDownloading}>
              <FiFile size={18} /> Download Word
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/generate')}>
              <FiCpu size={18} /> Generate Again
            </Button>
            <Button variant="danger" size="lg" onClick={handleReset} loading={isResetting}>
              <FiTrash2 size={18} /> Reset Timetable
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
