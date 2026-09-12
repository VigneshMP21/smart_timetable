import api from './api';

/**
 * Fetch paginated subject records.
 * @param {Object} options - { search, page, per_page, sort_by, order }
 * @returns {Promise<Object>} { records, total, page, per_page, total_pages }
 */
export async function fetchSubjects({ search = '', page = 1, per_page = 10, sort_by = 'created_at', order = 'desc' } = {}) {
  const response = await api.get('/subjects', { params: { search, page, per_page, sort_by, order } });
  return response.data;
}

/**
 * Upload an Excel file (.xlsx/.xls) containing subject rows.
 * The backend parses + validates the file but does NOT persist anything.
 * @param {File} file - The Excel file to validate.
 * @returns {Promise<Object>} { status, message, records, error_count }
 */
export async function uploadSubjectsExcel(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/subjects/upload', formData);
  return response.data;
}

/**
 * Persist one or more subject records.
 * @param {Array<Object>} records - [{ subject_code, subject_name, branch_classes }]
 * @returns {Promise<Object>} { status, message, inserted, errors }
 */
export async function saveSubjects(records) {
  const response = await api.post('/subjects/create', { records });
  return response.data;
}

/**
 * Create a single subject record manually.
 * @param {Object} payload - { subject_code, subject_name, branch_classes }
 * @returns {Promise<Object>} { status, message, inserted, errors }
 */
export async function createSubject(payload) {
  const response = await api.post('/subjects/create', payload);
  return response.data;
}

/**
 * Update an existing subject record.
 * @param {string} id - Id of the subject to edit.
 * @param {Object} payload - { subject_code?, subject_name?, branch_classes? }
 * @returns {Promise<Object>} Updated subject record.
 */
export async function updateSubject(id, payload) {
  const response = await api.put(`/subjects/${id}`, payload);
  return response.data;
}

/**
 * Delete a subject record.
 * @param {string} id - Id of the subject to delete.
 * @returns {Promise<Object>} { status, message, deleted_id }
 */
export async function deleteSubject(id) {
  const response = await api.delete(`/subjects/${id}`);
  return response.data;
}

/**
 * Delete multiple subject records at once.
 * @param {Array<string>} ids - Ids of the subjects to delete.
 * @returns {Promise<Object>} { status, message, deleted_ids, missing_ids }
 */
export async function deleteSubjectsBatch(ids) {
  const response = await api.post('/subjects/delete-batch', { ids });
  return response.data;
}

/**
 * Delete every subject record.
 * @returns {Promise<Object>} { status, message, total, deleted }
 */
export async function deleteAllSubjects() {
  const response = await api.post('/subjects/delete-all');
  return response.data;
}
