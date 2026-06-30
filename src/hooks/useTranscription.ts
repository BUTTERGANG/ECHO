/**
 * Trigger Whisper transcription for a given audio input (handoff §8 Step 3).
 * Resolves to `whisper.ts` on web / `whisper.native.ts` on native.
 */
import { useCallback, useState } from 'react';

import { transcribe, type AudioInput } from '@/services/whisper';
import { useSettingsStore } from '@/stores/settingsStore';

export function useTranscription() {
  const model = useSettingsStore((s) => s.whisperModel);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (audio: AudioInput): Promise<string | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await transcribe(audio, model);
        setTranscript(result.transcript);
        return result.transcript;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [model],
  );

  return { transcript, isLoading, error, run };
}
