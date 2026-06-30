/**
 * Audio recording lifecycle — NATIVE (iOS/Android).
 *
 * STUB: surfaces recording-store state and the intended control surface.
 * The expo-audio `useAudioRecorder` wiring (mic permission, start/stop,
 * persist to FILE_PATHS.audioDir, then hand off to transcription) lands in
 * the native phase — deliberately not imported yet so the scaffold typechecks
 * without device APIs. Web resolves to `useRecording.ts` (MediaRecorder).
 */
import { useCallback } from 'react';

import { useRecordingStore } from '@/stores/recordingStore';
import type { RecordingResult } from './useRecording.types';

const NATIVE_TODO = 'Recording is not wired up on native yet — see the native phase.';

export function useRecording() {
  const status = useRecordingStore((s) => s.status);
  const durationMs = useRecordingStore((s) => s.durationMs);
  const error = useRecordingStore((s) => s.error);
  const setError = useRecordingStore((s) => s.setError);

  const startRecording = useCallback(async (): Promise<void> => {
    setError(NATIVE_TODO);
  }, [setError]);

  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    setError(NATIVE_TODO);
    return null;
  }, [setError]);

  return { status, durationMs, error, startRecording, stopRecording };
}
