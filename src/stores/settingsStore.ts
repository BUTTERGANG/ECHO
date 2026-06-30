/**
 * User preferences (handoff §7).
 *
 * Persisted so choices survive a reload (zustand `persist`): localStorage on
 * web, a no-op on native until AsyncStorage is wired in the native phase.
 *
 * Privacy invariant (Open Q #5): `aiSummariesEnabled` defaults to **false**.
 * Persistence only stores a value once the user changes it, so a first-run user
 * still starts opted-out — the default must never be flipped by this change.
 */
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { Config, type WhisperModelName } from '@/constants/config';

interface SettingsState {
  /** OFF by default — user opts in (principle §2.1, Open Q #5). */
  aiSummariesEnabled: boolean;
  syncEnabled: boolean;
  whisperModel: WhisperModelName;
  reminderHour: number;
  reminderMinute: number;

  setAiSummariesEnabled: (v: boolean) => void;
  setSyncEnabled: (v: boolean) => void;
  setWhisperModel: (m: WhisperModelName) => void;
  setReminderTime: (hour: number, minute: number) => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** localStorage on web; no-op elsewhere (native persistence lands later). */
const storage = createJSONStorage<Partial<SettingsState>>(() =>
  Platform.OS === 'web' && typeof localStorage !== 'undefined' ? localStorage : noopStorage,
);

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      aiSummariesEnabled: Config.defaults.aiSummariesEnabled,
      syncEnabled: false,
      whisperModel: Config.defaultWhisperModel,
      reminderHour: Config.defaults.reminderHour,
      reminderMinute: Config.defaults.reminderMinute,

      setAiSummariesEnabled: (aiSummariesEnabled) => set({ aiSummariesEnabled }),
      setSyncEnabled: (syncEnabled) => set({ syncEnabled }),
      setWhisperModel: (whisperModel) => set({ whisperModel }),
      setReminderTime: (reminderHour, reminderMinute) => set({ reminderHour, reminderMinute }),
    }),
    {
      name: 'echo-settings',
      version: 1,
      storage,
      // Persist only the preference values, never the action functions.
      partialize: (s) => ({
        aiSummariesEnabled: s.aiSummariesEnabled,
        syncEnabled: s.syncEnabled,
        whisperModel: s.whisperModel,
        reminderHour: s.reminderHour,
        reminderMinute: s.reminderMinute,
      }),
    },
  ),
);
