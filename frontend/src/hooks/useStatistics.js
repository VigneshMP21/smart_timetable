import { useCallback } from 'react';
import { fetchStatistics } from '../services/statisticsService';
import { useAppContext } from '../context/AppContext';
import { toast } from 'react-toastify';

/**
 * Custom hook for fetching timetable statistics.
 */
export function useStatistics() {
  const { setStatistics, setIsLoadingStatistics } = useAppContext();

  const loadStatistics = useCallback(async () => {
    setIsLoadingStatistics(true);
    try {
      const data = await fetchStatistics();
      setStatistics(data);
      return data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to load statistics';
      toast.error(message);
      throw err;
    } finally {
      setIsLoadingStatistics(false);
    }
  }, [setStatistics, setIsLoadingStatistics]);

  return { loadStatistics };
}
