import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useTheme } from '@/hooks/use-theme';
import { encryptAllTranscripts } from '@/db/queries/entries';
import { enableEncryption } from '@/services/vault';

const MIN_LEN = 8;

export default function EncryptSetupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onEnable = async () => {
    setError(null);
    if (pass.length < MIN_LEN) return setError(`Use at least ${MIN_LEN} characters.`);
    if (pass !== confirm) return setError('Passphrases do not match.');
    setBusy(true);
    try {
      await enableEncryption(pass);
      await encryptAllTranscripts();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const field = (value: string, set: (v: string) => void, placeholder: string, autoFocus = false) => (
    <TextInput
      value={value}
      onChangeText={set}
      placeholder={placeholder}
      placeholderTextColor={theme.textSecondary}
      secureTextEntry
      autoFocus={autoFocus}
      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
    />
  );

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="shield-checkmark" size={28} color={theme.accent} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Encrypt your journal</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Your entries will be encrypted on this device with a key derived from your passphrase.
        </Text>
      </View>

      {field(pass, setPass, 'Passphrase', true)}
      {field(confirm, setConfirm, 'Confirm passphrase')}
      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

      <View style={[styles.warning, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="warning-outline" size={18} color={theme.warning} />
        <Text style={[styles.warningText, { color: theme.textSecondary }]}>
          There is no recovery. If you forget this passphrase, your encrypted entries cannot be read
          again — not even by us.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        <Button label="Enable encryption" icon="lock-closed" onPress={onEnable} loading={busy} disabled={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 8, marginBottom: 20 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 340 },
  input: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    marginBottom: 12,
  },
  error: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  warning: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 12, marginTop: 4 },
  warningText: { flex: 1, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
});
