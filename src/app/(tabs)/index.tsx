import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { EntryCard } from '@/components/EntryCard';
import { StreakBadge } from '@/components/StreakBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Radii } from '@/constants/theme';
import { useEntries } from '@/hooks/useEntries';
import { useResponsive } from '@/hooks/useResponsive';
import { useStreak } from '@/hooks/useStreak';
import { useTheme } from '@/hooks/use-theme';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { entries, loading, refresh } = useEntries();
  const streak = useStreak();
  const { columns } = useResponsive();

  return (
    <Screen padded={false}>
      <FlatList
        key={`cols-${columns}`}
        data={entries}
        keyExtractor={(e) => e.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.columnWrap : undefined}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: theme.textSecondary }]}>{greeting()}</Text>
              <Text style={[styles.title, { color: theme.text }]}>Your entries</Text>
            </View>
            <StreakBadge streak={streak} />
          </View>
        }
        renderItem={({ item }) => (
          <View style={columns > 1 ? styles.gridItem : undefined}>
            <EntryCard entry={item} />
          </View>
        )}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.textSecondary} />}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="mic-outline"
              title="No entries yet"
              subtitle="Capture your first thought — record a voice note or jot a quick text entry."
              action={{ label: 'New entry', icon: 'add', onPress: () => router.push('/compose') }}
            />
          )
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New entry"
        onPress={() => router.push('/compose')}
        style={({ pressed }) => [styles.fab, { backgroundColor: theme.accent }, pressed && styles.fabPressed]}>
        <Ionicons name="add" size={28} color={theme.accentText} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, flexGrow: 1 },
  columnWrap: { gap: 12 },
  gridItem: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  greeting: { fontSize: 14, fontWeight: '500' },
  title: { fontSize: 26, fontWeight: '700', marginTop: 2 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.9 },
});
