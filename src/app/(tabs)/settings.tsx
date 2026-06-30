import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { WHISPER_MODELS } from '@/constants/config';
import { Radii } from '@/constants/theme';
import { deleteAllData } from '@/db/queries/admin';
import { decryptAllTranscripts } from '@/db/queries/entries';
import { useTheme } from '@/hooks/use-theme';
import { clearAllAudio } from '@/services/audioStore';
import { exportAllData } from '@/services/export';
import { disableEncryption, lock } from '@/services/vault';
import { useEntryStore } from '@/stores/entryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useVaultStore } from '@/stores/vaultStore';

function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: theme.textSecondary }]}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    aiSummariesEnabled,
    setAiSummariesEnabled,
    syncEnabled,
    setSyncEnabled,
    whisperModel,
    setWhisperModel,
  } = useSettingsStore();

  const setEntries = useEntryStore((s) => s.setEntries);

  const onExport = async () => {
    try {
      const fileName = await exportAllData();
      Alert.alert('Export complete', `Your data was downloaded as ${fileName}.`);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete all data?',
      'This permanently erases every entry, summary, habit, and recording on this device. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllData();
              await clearAllAudio();
              setEntries([]);
              Alert.alert('Deleted', 'All of your data has been erased from this device.');
            } catch (e) {
              Alert.alert('Delete failed', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );

  const vaultStatus = useVaultStore((s) => s.status);
  const encryptionEnabled = vaultStatus !== 'disabled';

  const onToggleEncryption = (next: boolean) => {
    if (next) {
      router.push('/encrypt-setup');
      return;
    }
    Alert.alert('Turn off encryption?', 'Your entries will be stored unencrypted on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Turn off',
        style: 'destructive',
        onPress: async () => {
          try {
            await decryptAllTranscripts(); // must run while still unlocked
            await disableEncryption();
          } catch (e) {
            Alert.alert('Encryption', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      <SectionHeader title="Privacy" />
      <Card padded={false} style={styles.group}>
        <ToggleRow
          label="AI summaries"
          hint="Send transcript text (never audio) to Claude. Off by default."
          value={aiSummariesEnabled}
          onValueChange={setAiSummariesEnabled}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <ToggleRow
          label="Encrypted sync"
          hint="Coming soon."
          value={syncEnabled}
          onValueChange={setSyncEnabled}
          disabled
        />
      </Card>
      <Text style={[styles.note, { color: theme.textSecondary }]}>
        Audio never leaves this device and transcription runs locally. Entries marked private are
        excluded from all AI analysis and sync.
      </Text>

      {Platform.OS === 'web' ? (
        <>
          <SectionHeader title="Security" />
          <Card padded={false} style={styles.group}>
            <ToggleRow
              label="Encrypt journal"
              hint="Encrypt entries on this device with a passphrase."
              value={encryptionEnabled}
              onValueChange={onToggleEncryption}
            />
            {vaultStatus === 'unlocked' ? (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Lock now"
                  style={styles.actionRow}
                  onPress={() => lock()}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.accent} />
                  <Text style={[styles.actionLabel, { color: theme.text }]}>Lock now</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </Pressable>
              </>
            ) : null}
          </Card>
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            The key is derived from your passphrase and never leaves this device. There is no
            recovery if you forget it.
          </Text>
        </>
      ) : null}

      <SectionHeader title="Transcription model" />
      <View style={styles.segment}>
        {WHISPER_MODELS.map((m) => {
          const selected = whisperModel === m;
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Transcription model ${m}`}
              onPress={() => setWhisperModel(m)}
              style={[
                styles.segmentItem,
                { backgroundColor: selected ? theme.accent : theme.backgroundElement },
              ]}>
              <Text style={[styles.segmentText, { color: selected ? theme.accentText : theme.text }]}>
                {m}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.note, { color: theme.textSecondary }]}>
        Larger models are more accurate but need more memory. Default is “small”.
      </Text>

      <SectionHeader title="Your data" />
      <Card padded={false} style={styles.group}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Export all data"
          style={styles.actionRow}
          onPress={onExport}>
          <Ionicons name="download-outline" size={20} color={theme.accent} />
          <Text style={[styles.actionLabel, { color: theme.text }]}>Export all data</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete all data"
          style={styles.actionRow}
          onPress={confirmDelete}>
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
          <Text style={[styles.actionLabel, { color: theme.danger }]}>Delete all data</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
      </Card>

      <SectionHeader title="About" />
      <Card padded={false} style={styles.group}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="How ECHO works"
          style={styles.actionRow}
          onPress={() => router.push('/onboarding')}>
          <Ionicons name="information-circle-outline" size={20} color={theme.accent} />
          <Text style={[styles.actionLabel, { color: theme.text }]}>How ECHO works</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
      </Card>
      <Text style={[styles.version, { color: theme.textSecondary }]}>ECHO v1.0.0</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  group: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 16 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: '500' },
  rowHint: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  actionLabel: { fontSize: 16, flex: 1 },
  version: { fontSize: 13, textAlign: 'center', marginTop: 24 },
});
