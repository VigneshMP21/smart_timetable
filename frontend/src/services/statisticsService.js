import api from './api';

/**
 * Fetch timetable statistics from the backend.
 * @returns {Promise<Object>} Statistics with summary and faculty_statistics.
 */
export async function fetchStatistics() {
  const response = await api.get('/statistics');
  return response.data;
}
