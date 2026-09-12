import api from './api';

/**
 * Fetch paginated room records.
 * @param {Object} options - { search, page, per_page, sort_by, order }
 * @returns {Promise<Object>} { records, total, page, per_page, total_pages }
 */
export async function fetchRooms({ search = '', page = 1, per_page = 10, sort_by = 'created_at', order = 'desc' } = {}) {
  const response = await api.get('/rooms', { params: { search, page, per_page, sort_by, order } });
  return response.data;
}

/**
 * Upload an Excel file (.xlsx/.xls) containing room rows.
 * The backend parses + validates the file but does NOT persist anything.
 * @param {File} file - The Excel file to validate.
 * @returns {Promise<Object>} { status, message, records, error_count }
 */
export async function uploadRoomsExcel(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/rooms/upload', formData);
  return response.data;
}

/**
 * Persist one or more room records.
 * @param {Array<Object>} records - [{ room_no }]
 * @returns {Promise<Object>} { status, message, inserted, errors }
 */
export async function saveRooms(records) {
  const response = await api.post('/rooms/create', { records });
  return response.data;
}

/**
 * Create a single room record manually.
 * @param {Object} payload - { room_no }
 * @returns {Promise<Object>} { status, message, inserted, errors }
 */
export async function createRoom(payload) {
  const response = await api.post('/rooms/create', payload);
  return response.data;
}

/**
 * Update an existing room record.
 * @param {number|string} id - Id of the room to edit.
 * @param {Object} payload - { room_no? }
 * @returns {Promise<Object>} Updated room record.
 */
export async function updateRoom(id, payload) {
  const response = await api.put(`/rooms/${id}`, payload);
  return response.data;
}

/**
 * Automatically assign unassigned classes to unassigned rooms in a continuous
 * manner (sorted class -> sorted room).
 * @returns {Promise<Object>} { status, message, assigned, unassigned_classes, unassigned_rooms }
 */
export async function autoAssignRooms() {
  const response = await api.post('/rooms/auto-assign');
  return response.data;
}

/**
 * Clear the class assignment from every room.
 * @returns {Promise<Object>} { status, message, cleared }
 */
export async function unassignAllRooms() {
  const response = await api.post('/rooms/unassign-all');
  return response.data;
}

/**
 * Delete a room record.
 * @param {number|string} id - Id of the room to delete.
 * @returns {Promise<Object>} { status, message, deleted_id }
 */
export async function deleteRoom(id) {
  const response = await api.delete(`/rooms/${id}`);
  return response.data;
}

/**
 * Delete multiple room records at once.
 * @param {Array<number|string>} ids - Ids of the rooms to delete.
 * @returns {Promise<Object>} { status, message, deleted_ids, missing_ids, blocked_ids, blocked_room_numbers }
 */
export async function deleteRoomsBatch(ids) {
  const response = await api.post('/rooms/delete-batch', { ids });
  return response.data;
}

/**
 * Delete every room record.
 * @returns {Promise<Object>} { status, message, total, deleted, skipped, blocked_room_numbers }
 */
export async function deleteAllRooms() {
  const response = await api.post('/rooms/delete-all');
  return response.data;
}
