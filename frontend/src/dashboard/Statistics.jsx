import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import Loader from '../components/Loader/Loader';
import { useAppContext } from '../context/AppContext';
import { useStatistics } from '../hooks/useStatistics';
import { CHART_COLORS } from '../utils/constants';
import './Statistics.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
);

export default function Statistics() {
  const navigate = useNavigate();
  const { statistics, timetableData, isLoadingStatistics } = useAppContext();
  const { loadStatistics } = useStatistics();

  useEffect(() => {
    if (!timetableData) {
      navigate('/generate');
      return;
    }
    if (!statistics) {
      loadStatistics().catch(() => {});
    }
  }, [timetableData, statistics, loadStatistics, navigate]);

  const facultyWorkloadData = useMemo(() => {
    if (!statistics?.faculty_statistics) return null;
    const labels = statistics.faculty_statistics.map((f) => f.faculty_name);
    const hours = statistics.faculty_statistics.map((f) => f.total_hours);
    return {
      labels,
      datasets: [{
        label: 'Hours/Week',
        data: hours,
        backgroundColor: CHART_COLORS.slice(0, hours.length),
        borderRadius: 6,
        barThickness: 32,
      }],
    };
  }, [statistics]);

  const subjectDistributionData = useMemo(() => {
    if (!timetableData?.timetable) return null;
    const subjectCounts = {};
    Object.values(timetableData.timetable).forEach((days) => {
      Object.values(days).forEach((periods) => {
        periods.forEach((entry) => {
          if (entry.subject && !['Free Period', 'Lunch Break', 'Break'].includes(entry.subject)) {
            subjectCounts[entry.subject] = (subjectCounts[entry.subject] || 0) + 1;
          }
        });
      });
    });
    const labels = Object.keys(subjectCounts);
    const data = Object.values(subjectCounts);
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderWidth: 0,
        hoverOffset: 8,
      }],
    };
  }, [timetableData]);

  const classLoadData = useMemo(() => {
    if (!timetableData?.timetable) return null;
    const classNames = Object.keys(timetableData.timetable);
    const loadPerClass = classNames.map((cls) => {
      let count = 0;
      Object.values(timetableData.timetable[cls]).forEach((periods) => {
        periods.forEach((entry) => {
          if (entry.subject && !['Free Period', 'Lunch Break', 'Break'].includes(entry.subject)) {
            count++;
          }
        });
      });
      return count;
    });
    return {
      labels: classNames,
      datasets: [{
        label: 'Scheduled Periods',
        data: loadPerClass,
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#2563EB',
        pointRadius: 5,
        pointHoverRadius: 7,
      }],
    };
  }, [timetableData]);

  const freePeriodsData = useMemo(() => {
    if (!timetableData?.timetable) return null;
    const classNames = Object.keys(timetableData.timetable);
    const freeCounts = classNames.map((cls) => {
      let count = 0;
      Object.values(timetableData.timetable[cls]).forEach((periods) => {
        periods.forEach((entry) => {
          if (entry.subject === 'Free Period' || entry.type === 'Free') count++;
        });
      });
      return count;
    });
    return {
      labels: classNames,
      datasets: [{
        label: 'Free Periods',
        data: freeCounts,
        backgroundColor: '#F59E0B',
        borderRadius: 6,
        barThickness: 32,
      }],
    };
  }, [timetableData]);

  const dailyLoadData = useMemo(() => {
    if (!statistics?.faculty_statistics || statistics.faculty_statistics.length === 0) return null;
    const allDays = new Set();
    statistics.faculty_statistics.forEach((f) => {
      if (f.daily_load) Object.keys(f.daily_load).forEach((d) => allDays.add(d));
    });
    const days = Array.from(allDays);
    const datasets = statistics.faculty_statistics.slice(0, 5).map((f, i) => ({
      label: f.faculty_name,
      data: days.map((d) => f.daily_load?.[d] || 0),
      borderColor: CHART_COLORS[i],
      backgroundColor: `${CHART_COLORS[i]}20`,
      fill: false,
      tension: 0.3,
      pointRadius: 4,
    }));
    return { labels: days, datasets };
  }, [statistics]);

  if (isLoadingStatistics && !statistics) {
    return <Loader message="Loading statistics..." />;
  }

  if (!statistics) {
    return <Loader message="Loading statistics..." />;
  }

  const summary = statistics.summary || {};

  return (
    <div className="page-wrapper">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="page-header">
            <h1>Statistics</h1>
            <p>Visualize faculty workload, subject distribution, and scheduling metrics.</p>
          </div>

          {summary && (
            <div className="stats-summary">
              <div className="stats-summary-item">
                <span className="stats-summary-value">{summary.total_classes || 0}</span>
                <span className="stats-summary-label">Classes</span>
              </div>
              <div className="stats-summary-item">
                <span className="stats-summary-value">{summary.total_subjects || 0}</span>
                <span className="stats-summary-label">Subjects</span>
              </div>
              <div className="stats-summary-item">
                <span className="stats-summary-value">{summary.total_faculty || 0}</span>
                <span className="stats-summary-label">Faculty</span>
              </div>
              <div className="stats-summary-item">
                <span className="stats-summary-value">{summary.total_scheduled_periods || 0}</span>
                <span className="stats-summary-label">Scheduled</span>
              </div>
              <div className="stats-summary-item">
                <span className="stats-summary-value">{(summary.overall_utilization_percentage || 0).toFixed(1)}%</span>
                <span className="stats-summary-label">Utilization</span>
              </div>
            </div>
          )}

          <div className="charts-grid">
            {facultyWorkloadData && (
              <motion.div
                className="chart-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h3 className="chart-title">Faculty Workload</h3>
                <div className="chart-container">
                  <Bar
                    data={facultyWorkloadData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
                        x: { grid: { display: false } },
                      },
                    }}
                  />
                </div>
              </motion.div>
            )}

            {subjectDistributionData && (
              <motion.div
                className="chart-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="chart-title">Subject Distribution</h3>
                <div className="chart-container chart-pie">
                  <Pie
                    data={subjectDistributionData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'right', labels: { padding: 12, usePointStyle: true } },
                      },
                    }}
                  />
                </div>
              </motion.div>
            )}

            {classLoadData && (
              <motion.div
                className="chart-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="chart-title">Class Load</h3>
                <div className="chart-container">
                  <Line
                    data={classLoadData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
                        x: { grid: { display: false } },
                      },
                    }}
                  />
                </div>
              </motion.div>
            )}

            {freePeriodsData && (
              <motion.div
                className="chart-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h3 className="chart-title">Free Periods by Class</h3>
                <div className="chart-container">
                  <Bar
                    data={freePeriodsData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
                        x: { grid: { display: false } },
                      },
                    }}
                  />
                </div>
              </motion.div>
            )}

            {dailyLoadData && (
              <motion.div
                className="chart-card chart-wide"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h3 className="chart-title">Daily Faculty Load Distribution</h3>
                <div className="chart-container">
                  <Line
                    data={dailyLoadData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 16 } } },
                      scales: {
                        y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
                        x: { grid: { display: false } },
                      },
                    }}
                  />
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
