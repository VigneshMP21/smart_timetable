import { useState, useCallback } from 'react';
import { generateTimetable } from '../services/timetableService';
import { useAppContext } from '../context/AppContext';
import { toast } from 'react-toastify';
import { extractErrorMessage } from '../utils/errors';

/**
 * Custom hook for triggering timetable generation.
 * Manages generation state and stores result in context.
 */
export function useGenerate() {
  const { setTimetableData, setGenerationTime, setIsGenerating } = useAppContext();
  const [generationError, setGenerationError] = useState(null);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setGenerationError(null);
    const startTime = Date.now();

    try {
      const result = await generateTimetable();
      const elapsed = (Date.now() - startTime) / 1000;
      setGenerationTime(elapsed);
      setTimetableData(result);
      toast.success(result.message || 'Timetable generated successfully!');
      return result;
    } catch (err) {
      const message = extractErrorMessage(err, 'Timetable generation failed');
      setGenerationError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [setTimetableData, setGenerationTime, setIsGenerating]);

  return {
    generate,
    generationError,
  };
}
