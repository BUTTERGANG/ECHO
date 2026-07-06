/**
 * Runtime migration runner — WEB.
 *
 * On web, migrations run inside the database worker as part of its one-time
 * init (see `sqlWorker.ts` — it applies the same drizzle-kit migrations
 * bundle the native migrator uses). This hook just drives that init and
 * mirrors the `{ success, error }` shape of drizzle's `useMigrations`, so
 * the root layout treats both platforms identically.
 */
import { useEffect, useState } from 'react';

import { initDb } from './client';

interface MigrationState {
  success: boolean;
  error?: Error;
}

export function useRunMigrations(): MigrationState {
  const [state, setState] = useState<MigrationState>({ success: false });

  useEffect(() => {
    let cancelled = false;
    initDb()
      .then(() => {
        if (!cancelled) setState({ success: true });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ success: false, error: err instanceof Error ? err : new Error(String(err)) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
