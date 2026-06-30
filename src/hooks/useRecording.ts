/**
 * Audio recording lifecycle — WEB (MediaRecorder).
 *
 * Captures mic audio in the browser, tracks live duration, and returns the
 * recorded Blob to the caller (the record screen) which persists + transcribes
 * it. Audio never leaves the device. Native resolves to `useRecording.native.ts`.
 *
 * Status ownership: this hook drives `idle` ⇄ `recording`. The downstream
 * `processing`/`transcribing` states are set by the orchestrating screen.
 */
import { useCallback, useEffect, useRef } from 'react';

import { useRecordingStore } from '@/stores/recordingStore';
import type { RecordingResult } from './useRecording.types';

export type { RecordingResult } from './useRecording.types';

/** Preferred capture formats, best-supported first. */
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return ''; // let the browser choose its default
}

function friendlyMicError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was blocked. Allow it in your browser, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found. Connect one and try again.';
  }
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'This browser does not support audio recording.';
  }
  return e instanceof Error ? e.message : 'Could not start recording.';
}

export function useRecording() {
  const status = useRecordingStore((s) => s.status);
  const durationMs = useRecordingStore((s) => s.durationMs);
  const error = useRecordingStore((s) => s.error);
  const setStatus = useRecordingStore((s) => s.setStatus);
  const setDuration = useRecordingStore((s) => s.setDuration);
  const setError = useRecordingStore((s) => s.setError);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const teardown = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  // Release the mic if the screen unmounts mid-recording.
  useEffect(() => teardown, [teardown]);

  const startRecording = useCallback(async (): Promise<void> => {
    if (recorderRef.current) return; // already recording
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('unsupported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;

      startedAtRef.current = Date.now();
      setDuration(0);
      tickRef.current = setInterval(() => {
        setDuration(Date.now() - startedAtRef.current);
      }, 200);

      recorder.start();
      setStatus('recording');
    } catch (e) {
      teardown();
      setStatus('idle');
      setError(friendlyMicError(e));
    }
  }, [setDuration, setError, setStatus, teardown]);

  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    setStatus('processing');

    const result = await new Promise<RecordingResult | null>((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationMs = Date.now() - startedAtRef.current;
        resolve(blob.size > 0 ? { blob, durationMs, mimeType } : null);
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });

    teardown();
    return result;
  }, [setStatus, teardown]);

  return { status, durationMs, error, startRecording, stopRecording };
}
