/** Debounced wrapper around `searchEntries` (see src/db/queries/search.ts). */
import { useEffect, useState } from 'react';

import { searchEntries } from '@/db/queries/search';
import type { Entry } from '@/db/schema';

const DEBOUNCE_MS = 250;

export function useEntrySearch(query: string) {
  const [results, setResults] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchEntries(trimmed);
        if (!cancelled) setResults(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { results, loading };
}
