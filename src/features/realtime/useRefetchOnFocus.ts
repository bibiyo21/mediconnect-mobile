import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Runs `refetch` when the screen regains focus, but not on the first focus (the query already fetched).
 * The callback is read from a ref, so a new function identity on each render never re-runs the focus effect.
 */
export function useRefetchOnFocus(refetch: () => unknown): void {
  const latest = useRef(refetch);
  const first = useRef(true);

  useEffect(() => {
    latest.current = refetch;
  }, [refetch]);

  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      latest.current();
    }, []),
  );
}
