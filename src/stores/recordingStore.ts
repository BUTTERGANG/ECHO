/** Recording-in-progress state (handoff §7, §8 Step 2). */
import { create } from 'zustand';

export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'transcribing';

interface RecordingState {
  status: RecordingStatus;
  durationMs: number;
  error: string | null;
  setStatus: (s: RecordingStatus) => void;
  setDuration: (ms: number) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  status: 'idle',
  durationMs: 0,
  error: null,
  setStatus: (status) => set({ status }),
  setDuration: (durationMs) => set({ durationMs }),
  setError: (error) => set({ error }),
  reset: () => set({ status: 'idle', durationMs: 0, error: null }),
}));
