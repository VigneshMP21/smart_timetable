import { useCallback } from 'react';
import { saveTimetableEdits, resetTimetable } from '../services/timetableService';
import { useAppContext } from '../context/AppContext';
import { toast } from 'react-toastify';
import { extractErrorMessage } from '../utils/errors';

/**
 * Custom hook for saving manual edits and resetting the timetable.
 * Successful saves refresh the shared timetableData so every page stays in sync.
 */
export function useTimetable() {
  const { setTimetableData, resetTimetable: clearTimetable, setIsGenerating } = useAppContext();

  const saveEdits = useCallback(
    async (classId, entries) => {
      try {
        const result = await saveTimetableEdits(classId, entries);
        setTimetableData(result);
        toast.success(result.message || 'Timetable saved successfully!');
        return result;
      } catch (err) {
        const message = extractErrorMessage(err, 'Failed to save timetable');
        toast.error(message);
        throw err;
      }
    },
    [setTimetableData]
  );

  const reset = useCallback(async () => {
    setIsGenerating(true);
    try {
      await resetTimetable();
      clearTimetable();
      toast.info('Timetable has been reset.');
      return true;
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to reset timetable'));
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [setIsGenerating, clearTimetable]);

  return { saveEdits, reset };
}
