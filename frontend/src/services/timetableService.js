import api from './api';

/**
 * Generate a timetable using the backend scheduling algorithm.
 * @returns {Promise<Object>} Generated timetable data.
 */
export async function generateTimetable() {
  const response = await api.post('/generate');
  return response.data;
}

/**
 * Get statistics for the generated timetable.
 * @returns {Promise<Object>} Faculty statistics and summary.
 */
export async function getStatistics() {
  const response = await api.get('/statistics');
  return response.data;
}

/**
 * Check backend health status.
 * @returns {Promise<Object>} Health check response.
 */
export async function checkHealth() {
  const response = await api.get('/health');
  return response.data;
}

/**
 * Load the currently saved timetable (including manual edits).
 * @returns {Promise<Object>} Saved timetable data.
 */
export async function loadTimetable() {
  const response = await api.get('/timetable');
  return response.data;
}

/**
 * Save a full-grid manual edit for a single class.
 * @param {number} classId - ID of the class being edited.
 * @param {Array<Object>} entries - All timetable cells for the class.
 * @returns {Promise<Object>} Refreshed full timetable.
 */
export async function saveTimetableEdits(classId, entries) {
  const response = await api.post('/timetable/update', { class_id: classId, entries });
  return response.data;
}

/**
 * Delete all saved timetable entries.
 * @returns {Promise<Object>} Reset confirmation.
 */
export async function resetTimetable() {
  const response = await api.post('/timetable/reset');
  return response.data;
}
