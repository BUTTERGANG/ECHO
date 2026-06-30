import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RecordButton } from '@/components/RecordButton';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { createEntry, updateEntry } from '@/db/queries/entries';
import { useRecording } from '@/hooks/useRecording';
import { useTheme } from '@/hooks/use-theme';
import { getAudioObjectURL, putAudio } from '@/services/audioStore';
import { maybeSummarizeEntry } from '@/services/summarize';
import { transcribe } from '@/services/whisper';
import { useEntryStore } from '@/stores/entryStore';
import { useRecordingStore } from '@/stores/recordingStore';
import { useSettingsStore } from '@/stores/settingsStore';

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RecordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { status, durationMs, error, startRecording, stopRecording } = useRecording();

  const model = useSettingsStore((s) => s.whisperModel);
  const aiEnabled = useSettingsStore((s) => s.aiSummariesEnabled);
  const prependEntry = useEntryStore((s) => s.prependEntry);
  const upsertEntry = useEntryStore((s) => s.upsertEntry);
  const setStatus = useRecordingStore((s) => s.setStatus);
  const setError = useRecordingStore((s) => s.setError);
  const reset = useRecordingStore((s) => s.reset);

  const [modelProgress, setModelProgress] = useState<number | undefined>(undefined);

  /** Persist audio → save entry → transcribe → summarize → open the entry. */
  const handleStop = async () => {
    const result = await stopRecording();
    if (!result) return; // mic error already surfaced, or native no-op

    let entryId: string;
    try {
      // 1. Save the entry WITH audio before transcribing, so a Whisper
      //    failure can never lose the recording (mirrors §12.1 resilience).
      const created = await createEntry({ durationMs: result.durationMs, whisperModel: model });
      entryId = created.id;
      const audioPath = await putAudio(created.id, result.blob);
      const withAudio = (await updateEntry(created.id, { audioPath })) ?? { ...created, audioPath };
      prependEntry(withAudio);
    } catch {
      setStatus('idle');
      setError('Could not save the recording. Please try again.');
      return;
    }

    // 2. Transcribe on-device. Entry is already saved, so failures here are
    //    non-fatal — the user keeps the audio and can retry later.
    setStatus('transcribing');
    let objectUrl: string | null = null;
    let transcribeFailed = false;
    try {
      objectUrl = await getAudioObjectURL(`idb:${entryId}`);
      if (objectUrl) {
        const { transcript } = await transcribe(objectUrl, model, setModelProgress);
        const final = await updateEntry(entryId, { transcript });
        if (final) {
          upsertEntry(final);
          void maybeSummarizeEntry(final, aiEnabled);
        }
      }
    } catch {
      // The speech model can fail to load (e.g. blocked cross-origin fetch).
      // The entry + audio are already saved, so tell the user rather than
      // silently landing them on a transcript-less entry.
      transcribeFailed = true;
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setModelProgress(undefined);
    }

    // 3. Open the new entry (audio is saved + playable either way).
    if (transcribeFailed) {
      setStatus('idle');
      setError('Saved your audio, but transcription couldn’t finish. Open the entry to play it back, or try recording again.');
    } else {
      reset();
    }
    router.replace(`/entry/${entryId}`);
  };

  const onPress = () => {
    if (status === 'recording') void handleStop();
    else void startRecording();
  };

  const subtitle =
    status === 'transcribing'
      ? modelProgress !== undefined
        ? `Loading the transcription model… ${modelProgress}%`
        : 'Transcribing on this device…'
      : 'Speak freely. Transcription runs on this device — your audio never leaves it.';

  return (
    <Screen>
      <View style={styles.top}>
        <Text style={[styles.title, { color: theme.text }]}>Capture a thought</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>

      <View style={styles.center}>
        <RecordButton status={status} onPress={onPress} />

        {status === 'recording' ? (
          <Text style={[styles.timer, { color: theme.danger }]}>{formatClock(durationMs)}</Text>
        ) : null}

        {error ? (
          <View style={[styles.notice, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.noticeText, { color: theme.textSecondary }]}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottom}>
        <Button
          label="Type instead"
          icon="create-outline"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/compose')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: 24, gap: 6 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 21 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  timer: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    maxWidth: 360,
  },
  noticeText: { fontSize: 13, flex: 1, lineHeight: 18 },
  bottom: { paddingBottom: 16 },
});
