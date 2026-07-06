/**
 * User profile anchors for the State Board (left deck of the workbench):
 * date of birth (drives precise-age + milestone math) and the timestamp of the
 * user's last major "pivot" (a self-marked life/work inflection point that the
 * board counts days from).
 *
 * Persisted like settingsStore: localStorage on web, no-op on native until
 * AsyncStorage is wired. These are demographic anchors, not journal content.
 */
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

interface ProfileState {
  /** Epoch-ms of date of birth, or null until the user sets it. */
  dateOfBirth: number | null;
  /** Epoch-ms of the last user-marked pivot, or null. */
  lastPivotAt: number | null;

  setDateOfBirth: (ms: number | null) => void;
  markPivot: (ms?: number) => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const storage = createJSONStorage<Partial<ProfileState>>(() =>
  Platform.OS === 'web' && typeof localStorage !== 'undefined' ? localStorage : noopStorage,
);

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      dateOfBirth: null,
      lastPivotAt: null,
      setDateOfBirth: (dateOfBirth) => set({ dateOfBirth }),
      markPivot: (ms) => set({ lastPivotAt: ms ?? Date.now() }),
    }),
    {
      name: 'echo-profile',
      version: 1,
      storage,
      partialize: (s) => ({ dateOfBirth: s.dateOfBirth, lastPivotAt: s.lastPivotAt }),
    },
  ),
);
