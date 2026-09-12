import { useState, useCallback } from 'react';
import { importWorkbook, downloadImportTemplate } from '../services/uploadService';
import { toast } from 'react-toastify';

/**
 * Extract a readable error message from various FastAPI error response formats.
 */
function extractErrorMessage(err, fallback) {
  const data = err.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data.detail === 'string') return data.detail;
  if (data.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
    return data.detail.message || fallback;
  }
  if (Array.isArray(data.detail)) {
    return data.detail.map((d) => d.msg || d.error).filter(Boolean).join('; ') || fallback;
  }
  return data.message || fallback;
}

/**
 * Custom hook for the Smart Timetable bulk Excel import.
 *
 * The workbook is validated all at once by the backend (sheets, columns,
 * cell values and cross-sheet relationships). On failure, `importErrors`
 * holds the structured { sheet, row, problem } entries returned by the API.
 */
export function useUpload() {
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [importError, setImportError] = useState(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const importFile = useCallback(async (file) => {
    setIsImporting(true);
    setImportProgress(0);
    setImportError(null);
    setImportErrors([]);
    setImportResult(null);

    try {
      const result = await importWorkbook(file, setImportProgress);
      setImportResult(result);
      toast.success(result.message || 'Workbook imported successfully!');
      return result;
    } catch (err) {
      const data = err.response?.data;
      const message = extractErrorMessage(err, err.message || 'Import failed');
      if (data && Array.isArray(data.errors) && data.errors.length > 0) {
        setImportErrors(data.errors);
      }
      setImportError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  }, []);

  const downloadTemplate = useCallback(async () => {
    setIsDownloadingTemplate(true);
    try {
      const blob = await downloadImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'smart_timetable_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Sample Excel template downloaded.');
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to download the template');
      toast.error(message);
      throw err;
    } finally {
      setIsDownloadingTemplate(false);
    }
  }, []);

  const resetUpload = useCallback(() => {
    setImportResult(null);
    setImportError(null);
    setImportErrors([]);
    setImportProgress(0);
  }, []);

  return {
    importFile,
    downloadTemplate,
    importProgress,
    isImporting,
    isDownloadingTemplate,
    importResult,
    importErrors,
    importError,
    resetUpload,
  };
}
