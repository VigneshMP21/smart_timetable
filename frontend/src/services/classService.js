import api from './api';

/**
 * Fetch paginated class records.
 * @param {Object} options - { search, page, per_page, sort_by, order }
 * @returns {Promise<Object>} { records, total, page, per_page, total_pages }
 */
export async function fetchClasses({ search = '', page = 1, per_page = 10, sort_by = 'created_at', order = 'desc' } = {}) {
  const response = await api.get('/classes', { params: { search, page, per_page, sort_by, order } });
  return response.data;
}

/**
 * Upload an Excel file (.xlsx/.xls) containing class rows.
 * The backend parses + validates the file but does NOT persist anything.
 * @param {File} file - The Excel file to validate.
 * @returns {Promise<Object>} { status, message, records, error_count }
 */
export async function uploadClassesExcel(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/classes/upload', formData);
  return response.data;
}

/**
 * Persist one or more class records.
 * @param {Array<Object>} records - [{ class_name, short_code, section }]
 * @returns {Promise<Object>} { status, message, inserted, errors }
 */
export async function saveClasses(records) {
  const response = await api.post('/classes/create', { records });
  return response.data;
}

/**
 * Create a single class record manually.
 * @param {Object} payload - { class_name, short_code, section }
 * @returns {Promise<Object>} { status, message, inserted, errors }
 */
export async function createClass(payload) {
  const response = await api.post('/classes/create', payload);
  return response.data;
}

/**
 * Update an existing class record.
 * @param {number|string} id - Id of the class to edit.
 * @param {Object} payload - { class_name?, short_code?, section? }
 * @returns {Promise<Object>} Updated class record.
 */
export async function updateClass(id, payload) {
  const response = await api.put(`/classes/${id}`, payload);
  return response.data;
}

/**
 * Delete a class record.
 * @param {number|string} id - Id of the class to delete.
 * @returns {Promise<Object>} { status, message, deleted_id }
 */
export async function deleteClass(id) {
  const response = await api.delete(`/classes/${id}`);
  return response.data;
}

/**
 * Delete multiple class records at once.
 * @param {Array<number|string>} ids - Ids of the classes to delete.
 * @returns {Promise<Object>} { status, message, deleted_ids, missing_ids }
 */
export async function deleteClassesBatch(ids) {
  const response = await api.post('/classes/delete-batch', { ids });
  return response.data;
}

/**
 * Delete every class record.
 * @returns {Promise<Object>} { status, message, total, deleted }
 */
export async function deleteAllClasses() {
  const response = await api.post('/classes/delete-all');
  return response.data;
}
