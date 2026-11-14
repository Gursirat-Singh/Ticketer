import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/api.js';

/** Runs an async loader whenever deps change. Ignores results of stale calls. */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const run = useRef(0);

  const load = useCallback(async () => {
    const id = ++run.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      if (id === run.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (id === run.current) setState({ data: null, loading: false, error: errorMessage(err) });
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
