import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGenerate } from '../hooks/useGenerate';
import { useAppContext } from '../context/AppContext';
import './Generate.css';

const MESSAGES = [
  'Loading classes, rooms, subjects and faculty...',
  'Loading your Setup configuration...',
  'Validating data availability...',
  'Checking faculty availability...',
  'Computing subject workloads...',
  'Scheduling faculty-period assignments...',
  'Resolving conflicts with edge coloring...',
  'Building class grids...',
  'Finalizing timetable...',
];

export default function Generate() {
  const navigate = useNavigate();
  const { generate, generationError } = useGenerate();
  const { timetableData } = useAppContext();
  const [currentMessage, setCurrentMessage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;

    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev < MESSAGES.length - 1 ? prev + 1 : prev));
    }, 2500);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 8;
      });
    }, 1500);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, [started]);

  const startGeneration = useCallback(async () => {
    setStarted(true);
    try {
      const result = await generate();
      setProgress(100);
      setTimeout(() => {
        navigate('/result');
      }, 1000);
    } catch (err) {
      setStarted(false);
      setProgress(0);
      setCurrentMessage(0);
    }
  }, [generate, navigate]);

  useEffect(() => {
    if (timetableData && !started) {
      navigate('/result');
    }
  }, [timetableData, started, navigate]);

  return (
    <div className="page-wrapper">
      <div className="container">
        <motion.div
          className="generate-page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="page-header text-center">
            <h1>Generate Timetable</h1>
            <p>Click the button below to start the scheduling algorithm.</p>
          </div>

          {!started ? (
            <div className="generate-start">
              <motion.div
                className="generate-icon-wrapper"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="generate-icon-circle">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
              </motion.div>
              <p className="generate-description">
                The algorithm builds a conflict-free schedule using bipartite
                edge coloring — every faculty and room is guaranteed to appear
                at most once per time slot, with break and lunch periods
                respected automatically.
              </p>
              <motion.button
                className="generate-btn"
                onClick={startGeneration}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Generation
              </motion.button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMessage}
                className="generate-progress"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="generate-progress-spinner">
                  <div className="gp-ring gp-ring-1" />
                  <div className="gp-ring gp-ring-2" />
                  <div className="gp-ring gp-ring-3" />
                </div>
                <p className="generate-progress-message">{MESSAGES[currentMessage]}</p>
                <div className="generate-progress-bar">
                  <motion.div
                    className="generate-progress-fill"
                    animate={{ width: `${Math.min(progress, 100)}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="generate-progress-text">{Math.round(Math.min(progress, 100))}%</span>
                {generationError && (
                  <div className="generate-error">
                    <p>{generationError}</p>
                    <button className="generate-retry" onClick={() => { setStarted(false); setProgress(0); setCurrentMessage(0); }}>
                      Try Again
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      </div>
    </div>
  );
}
