import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { UnlockGate } from '@/components/UnlockGate';
import { useRunMigrations } from '@/db/migrate';
import { hydrateVault } from '@/services/vault';
import { useVaultStore } from '@/stores/vaultStore';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { success, error } = useRunMigrations();
  const vaultHydrated = useVaultStore((s) => s.hydrated);
  const vaultStatus = useVaultStore((s) => s.status);

  // Read persisted encryption state once on start.
  useEffect(() => {
    hydrateVault();
  }, []);

  const ready = success && vaultHydrated;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <ThemedText type="subtitle">Database error</ThemedText>
            <ThemedText type="small">{error.message}</ThemedText>
          </View>
        ) : !ready ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : vaultStatus === 'locked' ? (
          <UnlockGate />
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="entry/[id]" options={{ headerShown: true, title: 'Entry' }} />
            <Stack.Screen name="compose" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="encrypt-setup" options={{ presentation: 'modal', headerShown: false }} />
          </Stack>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
