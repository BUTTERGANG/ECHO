/** Lightweight cache of the entry feed (handoff §7). */
import { create } from 'zustand';

import type { Entry } from '@/db/schema';

interface EntryState {
  entries: Entry[];
  setEntries: (entries: Entry[]) => void;
  prependEntry: (entry: Entry) => void;
  upsertEntry: (entry: Entry) => void;
}

export const useEntryStore = create<EntryState>((set) => ({
  entries: [],
  setEntries: (entries) => set({ entries }),
  prependEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries] })),
  upsertEntry: (entry) =>
    set((s) => {
      const idx = s.entries.findIndex((e) => e.id === entry.id);
      if (idx === -1) return { entries: [entry, ...s.entries] };
      const next = s.entries.slice();
      next[idx] = entry;
      return { entries: next };
    }),
}));
