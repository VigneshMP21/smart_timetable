import api from './api';
import { downloadBlob } from '../utils/helpers';

/**
 * Download the timetable as an Excel file.
 */
export async function downloadExcel() {
  const response = await api.get('/download/excel', { responseType: 'blob' });
  downloadBlob(response.data, 'timetable_schedule.xlsx');
}

/**
 * Download the timetable as a PDF file.
 */
export async function downloadPDF() {
  const response = await api.get('/download/pdf', { responseType: 'blob' });
  downloadBlob(response.data, 'timetable_schedule.pdf');
}

/**
 * Download the timetable as a Word (.docx) file.
 */
export async function downloadWord() {
  const response = await api.get('/download/word', { responseType: 'blob' });
  downloadBlob(response.data, 'timetable_schedule.docx');
}
