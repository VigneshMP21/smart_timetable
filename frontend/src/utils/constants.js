export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DEFAULT_WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const SUBJECT_TYPES = ['Theory', 'Lab', 'Elective'];

export const COLORS = {
  primary: '#2563EB',
  secondary: '#06B6D4',
  accent: '#8B5CF6',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  bg: '#F8FAFC',
  card: '#FFFFFF',
};

export const SUBJECT_COLORS = {
  Theory: { bg: '#EFF6FF', border: '#2563EB', text: '#1E40AF' },
  Lab: { bg: '#F0FDF4', border: '#22C55E', text: '#166534' },
  Elective: { bg: '#FAF5FF', border: '#8B5CF6', text: '#6B21A8' },
  Free: { bg: '#F8FAFC', border: '#CBD5E1', text: '#94A3B8' },
  Lunch: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' },
  Break: { bg: '#F0F9FF', border: '#06B6D4', text: '#155E75' },
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
  PROFILE: '/profile',
  UPLOAD: '/upload',
  GENERATE: '/generate',
  RESULT: '/result',
  CLASS_VIEW: '/result/class/:className',
  FACULTY_VIEW: '/result/faculty/:facultyName',
  STATISTICS: '/statistics',
  SETTINGS: '/settings',
  ABOUT: '/about',
};

export const UPLOAD_ERRORS = {
  INVALID_TYPE: 'Please upload an Excel file (.xlsx or .xls)',
  TOO_LARGE: 'File size must be less than 10MB',
  GENERAL: 'Upload failed. Please try again.',
};

export const CHART_COLORS = [
  '#2563EB', '#06B6D4', '#8B5CF6', '#22C55E',
  '#F59E0B', '#EF4444', '#EC4899', '#14B8A6',
  '#F97316', '#6366F1', '#84CC16', '#0EA5E9',
];
