import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemedText } from '@/components/themed-text';
import { UnlockGate } from '@/components/UnlockGate';
import { resetDb } from '@/db/client';
import { useRunMigrations } from '@/db/migrate';
import { ensureFtsIndexed } from '@/db/queries/search';
import { hydrateVault } from '@/services/vault';
import { useVaultStore } from '@/stores/vaultStore';

// On web, database init can fail transiently — e.g. the sql.js CDN fetch
// hiccups on a slow connection. resetDb() discards the failed worker, so a
// short pause followed by a fresh attempt usually succeeds. We auto-retry up
// to this many times before surfacing the error for a manual retry.
const WEB_AUTO_RETRIES = 3;
const WEB_RETRY_DELAY_MS = 2500;

function shouldAutoRetry(err: Error | null | undefined): boolean {
  return Platform.OS === 'web' && !!err;
}

export default function RootLayout() {
  // `retryKey` forces a full remount of AppContent (and its hooks, including
  // useRunMigrations) so each retry is a genuine fresh attempt.
  const [retryKey, setRetryKey] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [waitingToRetry, setWaitingToRetry] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AppContent will bubble errors up via this callback so the outer shell can
  // decide whether to auto-retry or show the manual retry UI.
  const handleError = useCallback((err: Error | null) => {
    setLastError(err);
  }, []);

  useEffect(() => {
    if (!lastError) return;
    if (!shouldAutoRetry(lastError)) return;
    if (autoRetryCount >= WEB_AUTO_RETRIES) return;

    setWaitingToRetry(true);
    timerRef.current = setTimeout(() => {
      resetDb();
      setAutoRetryCount((c) => c + 1);
      setLastError(null);
      setWaitingToRetry(false);
      setRetryKey((k) => k + 1);
    }, WEB_RETRY_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lastError, autoRetryCount]);

  const handleManualRetry = useCallback(() => {
    resetDb();
    setLastError(null);
    setAutoRetryCount(0);
    setWaitingToRetry(false);
    setRetryKey((k) => k + 1);
  }, []);

  // Vault hydration happens once regardless of DB retries.
  useEffect(() => {
    hydrateVault();
  }, []);

  // Show a waiting screen while the auto-retry timer is counting down so the
  // UI doesn't flash an error between attempts.
  if (waitingToRetry || (lastError && shouldAutoRetry(lastError) && autoRetryCount < WEB_AUTO_RETRIES)) {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <ActivityIndicator />
          <ThemedText type="small" style={styles.loadingText}>
            Starting database…
          </ThemedText>
        </View>
      </SafeAreaProvider>
    );
  }

  // After all auto-retries are exhausted for a web init error, or for
  // non-retryable errors, show the manual retry / error screen.
  if (lastError) {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <ThemedText type="subtitle">Database error</ThemedText>
          <ThemedText type="small">{lastError.message}</ThemedText>
          <Pressable style={styles.retryButton} onPress={handleManualRetry}>
            <ThemedText type="smallBold">Retry</ThemedText>
          </Pressable>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppContent
        key={retryKey}
        onError={handleError}
      />
    </SafeAreaProvider>
  );
}

function AppContent({ onError }: { onError: (err: Error | null) => void }) {
  const colorScheme = useColorScheme();
  const { success, error } = useRunMigrations();
  const vaultHydrated = useVaultStore((s) => s.hydrated);
  const vaultStatus = useVaultStore((s) => s.status);
  const ready = success && vaultHydrated;

  useEffect(() => {
    onError(error ?? null);
  }, [error, onError]);

  // Self-heals the search index for entries that predate this feature (or
  // otherwise missed a write) — cheap to run on every successful boot.
  useEffect(() => {
    if (success) ensureFtsIndexed();
  }, [success]);

  if (error) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ErrorBoundary>
        {!ready ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : vaultStatus === 'locked' ? (
          <UnlockGate />
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="entry/[id]" options={{ headerShown: true, title: 'Entry' }} />
            <Stack.Screen name="state" options={{ headerShown: true, title: 'State' }} />
            <Stack.Screen name="compose" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="encrypt-setup" options={{ presentation: 'modal', headerShown: false }} />
          </Stack>
        )}
      </ErrorBoundary>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.6,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#888',
  },
});
