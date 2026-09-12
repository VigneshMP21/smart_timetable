import api from './api';

/**
 * Import a 4-sheet Smart Timetable workbook (Classes, Rooms, Subjects,
 * Faculty). The backend validates the whole file before inserting anything
 * inside a single transaction and returns per-sheet imported/skipped counts.
 * @param {File} file - The Excel workbook to import.
 * @param {Function} onProgress - Upload progress callback (0-100).
 * @returns {Promise<Object>} Bulk import summary { classes, rooms, subjects, faculty, imported_total, skipped_total }.
 */
export async function importWorkbook(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload', formData, {
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });

  return response.data;
}

/**
 * Download the sample Smart Timetable template workbook.
 * @returns {Promise<Blob>} The generated .xlsx blob.
 */
export async function downloadImportTemplate() {
  const response = await api.get('/upload/template', { responseType: 'blob' });
  return response.data;
}

/**
 * Get preview of uploaded data (used by the legacy preview/result drilldowns).
 * @returns {Promise<Object>} Preview data with classes, subjects, faculty, rooms, config.
 */
export async function getPreviewData() {
  const response = await api.get('/preview');
  return response.data;
}
