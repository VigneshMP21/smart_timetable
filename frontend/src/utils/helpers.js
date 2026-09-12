/**
 * Format a number with commas as thousand separators.
 */
export function formatNumber(num) {
  if (num == null) return '0';
  return Number(num).toLocaleString();
}

/**
 * Truncate text to a given length with ellipsis.
 */
export function truncate(str, length = 50) {
  if (!str) return '';
  return str.length > length ? str.slice(0, length) + '...' : str;
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert a day abbreviation or lowercase to proper case.
 */
export function formatDay(day) {
  if (!day) return '';
  return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
}

/**
 * Get the color class for a subject type.
 */
export function getSubjectTypeColor(type) {
  const colors = {
    Theory: { bg: '#EFF6FF', border: '#2563EB', text: '#1E40AF' },
    Lab: { bg: '#F0FDF4', border: '#22C55E', text: '#166534' },
    Elective: { bg: '#FAF5FF', border: '#8B5CF6', text: '#6B21A8' },
    Free: { bg: '#F8FAFC', border: '#CBD5E1', text: '#94A3B8' },
    Lunch: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' },
    Break: { bg: '#F0F9FF', border: '#06B6D4', text: '#155E75' },
  };
  return colors[type] || colors.Theory;
}

/**
 * Download a blob as a file.
 */
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Format file size from bytes to human-readable string.
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in seconds to mm:ss format.
 */
export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

/**
 * Generate a random color from a predefined palette.
 */
export function getHashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

export function getColorFromString(str) {
  const colors = ['#2563EB', '#06B6D4', '#8B5CF6', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];
  const index = Math.abs(getHashCode(str)) % colors.length;
  return colors[index];
}

/**
 * Group an array by a key.
 */
export function groupBy(arr, key) {
  return arr.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
}
