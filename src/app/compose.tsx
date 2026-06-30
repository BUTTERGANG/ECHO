import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MoodPicker } from '@/components/MoodPicker';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { createEntry } from '@/db/queries/entries';
import { useTheme } from '@/hooks/use-theme';
import { maybeSummarizeEntry } from '@/services/summarize';
import { useEntryStore } from '@/stores/entryStore';
import { useSettingsStore } from '@/stores/settingsStore';

/** Text fallback entry (handoff §3.1 — "Text fallback", P1). */
export default function ComposeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const prependEntry = useEntryStore((s) => s.prependEntry);
  const aiEnabled = useSettingsStore((s) => s.aiSummariesEnabled);

  const [text, setText] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = text.trim().length > 0 && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const entry = await createEntry({
        transcript: text.trim(),
        moodScore: mood ?? undefined,
        isPrivate: isPrivate ? 1 : 0,
      });
      prependEntry(entry);
      // Fire-and-forget; summary appears on next view of the entry.
      void maybeSummarizeEntry(entry, aiEnabled);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <Text style={[styles.title, { color: theme.text }]}>New entry</Text>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What's on your mind?"
          placeholderTextColor={theme.textSecondary}
          multiline
          autoFocus
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        />

        <View style={styles.moodWrap}>
          <MoodPicker value={mood} onChange={setMood} />
        </View>

        <View style={[styles.privateRow, { borderColor: theme.border }]}>
          <View style={styles.flex}>
            <Text style={[styles.privateLabel, { color: theme.text }]}>Private entry</Text>
            <Text style={[styles.privateHint, { color: theme.textSecondary }]}>
              Excluded from all AI analysis and sync.
            </Text>
          </View>
          <Switch value={isPrivate} onValueChange={setIsPrivate} />
        </View>

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
          <Button label="Save entry" icon="checkmark" onPress={onSave} loading={saving} disabled={!canSave} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 16 },
  input: {
    minHeight: 180,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    fontSize: 17,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  moodWrap: { marginTop: 24 },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  privateLabel: { fontSize: 16, fontWeight: '600' },
  privateHint: { fontSize: 13, marginTop: 2 },
  error: { fontSize: 14, lineHeight: 20, marginTop: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
});
