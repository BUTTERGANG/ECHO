import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useTheme } from '@/hooks/use-theme';
import { unlock } from '@/services/vault';

/**
 * Full-screen gate shown when at-rest encryption is enabled but locked.
 * Rendered by the root layout in place of the app until the key is in memory.
 */
export function UnlockGate() {
  const theme = useTheme();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onUnlock = async () => {
    if (!passphrase || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await unlock(passphrase);
      if (!ok) {
        setError('Incorrect passphrase.');
        setPassphrase('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.body}>
        <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="lock-closed" size={40} color={theme.accent} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>ECHO is locked</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Enter your passphrase to unlock your journal on this device.
        </Text>

        <TextInput
          value={passphrase}
          onChangeText={setPassphrase}
          placeholder="Passphrase"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          autoFocus
          onSubmitEditing={onUnlock}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: error ? theme.danger : theme.border },
          ]}
        />
        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <Button label="Unlock" icon="lock-open" onPress={onUnlock} loading={busy} fullWidth size="lg" style={styles.btn} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  body: { alignItems: 'center', gap: 14, paddingHorizontal: 8 },
  iconCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
  input: {
    alignSelf: 'stretch',
    marginTop: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
  },
  error: { fontSize: 14, fontWeight: '500' },
  btn: { marginTop: 8 },
});
