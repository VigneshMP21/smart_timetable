import api from './api';

/**
 * Fetch paginated faculty assignment records.
 * @param {Object} options - { search, page, per_page, sort_by, order }
 * @returns {Promise<Object>} { records, total, page, per_page, total_pages }
 */
export async function fetchFaculties({ search = '', page = 1, per_page = 10, sort_by = 'created_at', order = 'desc' } = {}) {
  const response = await api.get('/faculties', { params: { search, page, per_page, sort_by, order } });
  return response.data;
}

/**
 * Upload an Excel file (.xlsx/.xls) containing faculty rows.
 * The backend parses + validates the file but does NOT persist anything.
 * @param {File} file - The Excel file to validate.
 * @returns {Promise<Object>} { status, message, records, error_count }
 */
export async function uploadFacultiesExcel(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/faculties/upload', formData);
  return response.data;
}

/**
 * Persist one or more faculty assignments (Excel save step).
 * @param {Array<Object>} records - [{ faculty_name, subject_name, subject_id, branch_classes }]
 * @returns {Promise<Object>} { status, message, inserted, errors }
 */
export async function saveFaculties(records) {
  const response = await api.post('/faculties/create', { records });
  return response.data;
}

/**
 * Create a single faculty assignment manually.
 * @param {Object} payload - { faculty_name, subject_id, subject_name, branch_classes }
 * @returns {Promise<Object>} { status, message, inserted, errors }
 */
export async function createFaculty(payload) {
  const response = await api.post('/faculties/create', payload);
  return response.data;
}

/**
 * Update an existing faculty assignment.
 * @param {string} id - Id of the assignment to edit.
 * @param {Object} payload - { faculty_name?, subject_id?, branch_classes? }
 * @returns {Promise<Object>} Updated faculty record.
 */
export async function updateFaculty(id, payload) {
  const response = await api.put(`/faculties/${id}`, payload);
  return response.data;
}

/**
 * Delete a faculty assignment.
 * @param {string} id - Id of the assignment to delete.
 * @returns {Promise<Object>} { status, message, deleted_id }
 */
export async function deleteFaculty(id) {
  const response = await api.delete(`/faculties/${id}`);
  return response.data;
}

/**
 * Delete multiple faculty assignments at once.
 * @param {Array<string>} ids - Ids of the assignments to delete.
 * @returns {Promise<Object>} { status, message, deleted_ids, missing_ids }
 */
export async function deleteFacultiesBatch(ids) {
  const response = await api.post('/faculties/delete-batch', { ids });
  return response.data;
}

/**
 * Delete every faculty assignment.
 * @returns {Promise<Object>} { status, message, total, deleted }
 */
export async function deleteAllFaculties() {
  const response = await api.post('/faculties/delete-all');
  return response.data;
}
