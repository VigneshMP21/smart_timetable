import { useCallback } from 'react';
import { downloadExcel, downloadPDF, downloadWord } from '../services/downloadService';
import { useAppContext } from '../context/AppContext';
import { toast } from 'react-toastify';
import { extractErrorMessage } from '../utils/errors';

/**
 * Custom hook for downloading the timetable in Excel, PDF or Word format.
 */
export function useDownload() {
  const { setIsDownloading } = useAppContext();

  const downloadExcelFile = useCallback(async () => {
    setIsDownloading(true);
    try {
      await downloadExcel();
      toast.success('Excel file downloaded successfully!');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to download Excel file'));
    } finally {
      setIsDownloading(false);
    }
  }, [setIsDownloading]);

  const downloadPDFFile = useCallback(async () => {
    setIsDownloading(true);
    try {
      await downloadPDF();
      toast.success('PDF file downloaded successfully!');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to download PDF file'));
    } finally {
      setIsDownloading(false);
    }
  }, [setIsDownloading]);

  const downloadWordFile = useCallback(async () => {
    setIsDownloading(true);
    try {
      await downloadWord();
      toast.success('Word file downloaded successfully!');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to download Word file'));
    } finally {
      setIsDownloading(false);
    }
  }, [setIsDownloading]);

  return { downloadExcelFile, downloadPDFFile, downloadWordFile };
}
