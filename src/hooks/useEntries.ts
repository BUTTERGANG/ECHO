/** Query entries from the DB into the entry store (handoff §8 Step 4). */
import { useCallback, useEffect, useState } from 'react';

import { getEntries } from '@/db/queries/entries';
import { useEntryStore } from '@/stores/entryStore';

export function useEntries(limit = 50) {
  const entries = useEntryStore((s) => s.entries);
  const setEntries = useEntryStore((s) => s.setEntries);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await getEntries({ limit }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [limit, setEntries]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
