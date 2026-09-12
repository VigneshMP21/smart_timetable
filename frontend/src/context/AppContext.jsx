import { createContext, useContext, useReducer, useCallback } from 'react';
import { loadTimetable as fetchTimetable } from '../services/timetableService';

const AppContext = createContext(null);

const initialState = {
  previewData: null,
  timetableData: null,
  statistics: null,
  uploadSummary: null,
  generationTime: null,
  isUploading: false,
  isGenerating: false,
  isDownloading: false,
  isLoadingStatistics: false,
  isLoadingTimetable: false,
  error: null,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_PREVIEW_DATA':
      return { ...state, previewData: action.payload, error: null };
    case 'SET_TIMETABLE_DATA':
      return { ...state, timetableData: action.payload, error: null };
    case 'SET_STATISTICS':
      return { ...state, statistics: action.payload, error: null };
    case 'SET_UPLOAD_SUMMARY':
      return { ...state, uploadSummary: action.payload };
    case 'SET_GENERATION_TIME':
      return { ...state, generationTime: action.payload };
    case 'SET_IS_UPLOADING':
      return { ...state, isUploading: action.payload };
    case 'SET_IS_GENERATING':
      return { ...state, isGenerating: action.payload };
    case 'SET_IS_DOWNLOADING':
      return { ...state, isDownloading: action.payload };
    case 'SET_IS_LOADING_STATISTICS':
      return { ...state, isLoadingStatistics: action.payload };
    case 'SET_IS_LOADING_TIMETABLE':
      return { ...state, isLoadingTimetable: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET_TIMETABLE':
      return { ...state, timetableData: null, statistics: null };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setPreviewData = useCallback((data) => dispatch({ type: 'SET_PREVIEW_DATA', payload: data }), []);
  const setTimetableData = useCallback((data) => dispatch({ type: 'SET_TIMETABLE_DATA', payload: data }), []);
  const setStatistics = useCallback((data) => dispatch({ type: 'SET_STATISTICS', payload: data }), []);
  const setUploadSummary = useCallback((data) => dispatch({ type: 'SET_UPLOAD_SUMMARY', payload: data }), []);
  const setGenerationTime = useCallback((data) => dispatch({ type: 'SET_GENERATION_TIME', payload: data }), []);
  const setIsUploading = useCallback((val) => dispatch({ type: 'SET_IS_UPLOADING', payload: val }), []);
  const setIsGenerating = useCallback((val) => dispatch({ type: 'SET_IS_GENERATING', payload: val }), []);
  const setIsDownloading = useCallback((val) => dispatch({ type: 'SET_IS_DOWNLOADING', payload: val }), []);
  const setIsLoadingStatistics = useCallback((val) => dispatch({ type: 'SET_IS_LOADING_STATISTICS', payload: val }), []);
  const setIsLoadingTimetable = useCallback((val) => dispatch({ type: 'SET_IS_LOADING_TIMETABLE', payload: val }), []);
  const setError = useCallback((err) => dispatch({ type: 'SET_ERROR', payload: err }), []);
  const resetTimetable = useCallback(() => dispatch({ type: 'RESET_TIMETABLE' }), []);

  const loadTimetable = useCallback(async () => {
    setIsLoadingTimetable(true);
    try {
      const data = await fetchTimetable();
      setTimetableData(data);
      return data;
    } finally {
      setIsLoadingTimetable(false);
    }
  }, [setIsLoadingTimetable, setTimetableData]);

  const value = {
    ...state,
    setPreviewData,
    setTimetableData,
    setStatistics,
    setUploadSummary,
    setGenerationTime,
    setIsUploading,
    setIsGenerating,
    setIsDownloading,
    setIsLoadingStatistics,
    setIsLoadingTimetable,
    setError,
    resetTimetable,
    loadTimetable,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
