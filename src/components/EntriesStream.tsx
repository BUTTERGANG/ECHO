import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { EntryCard } from '@/components/EntryCard';
import { StreakBadge } from '@/components/StreakBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { MaxContentWidth, Radii } from '@/constants/theme';
import type { Entry } from '@/db/schema';
import { useEntries } from '@/hooks/useEntries';
import { useEntrySearch } from '@/hooks/useEntrySearch';
import { useResponsive } from '@/hooks/useResponsive';
import { useStreak } from '@/hooks/useStreak';
import { useTheme } from '@/hooks/use-theme';

type GridItem = Entry | { id: string; placeholder: true };

function isPlaceholder(item: GridItem): item is { id: string; placeholder: true } {
  return 'placeholder' in item;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The entries feed: greeting + search header, card grid, pull-to-refresh, empty
 * states, and the "new entry" FAB. Used standalone on mobile (inside Screen)
 * and as the center pane of the desktop workbench (with `columns={1}`).
 */
export function EntriesStream({ columns: columnsOverride }: { columns?: number } = {}) {
  const theme = useTheme();
  const router = useRouter();
  const { entries, loading, error, refresh } = useEntries();
  const streak = useStreak();
  const responsive = useResponsive();
  const columns = columnsOverride ?? responsive.columns;
  const gutter = responsive.gutter;
  const [query, setQuery] = useState('');
  const { results: searchResults, loading: searching } = useEntrySearch(query);

  const isSearching = query.trim().length > 0;
  const entryData = isSearching ? (searchResults ?? []) : entries;

  // Pad the last multi-column row so a lone card keeps its 1/N width.
  const data: GridItem[] =
    columns > 1 && entryData.length % columns !== 0
      ? [
          ...entryData,
          ...Array.from({ length: columns - (entryData.length % columns) }, (_, i) => ({
            id: `__placeholder_${i}`,
            placeholder: true as const,
          })),
        ]
      : entryData;

  return (
    <View style={styles.fill}>
      <FlatList
        key={`cols-${columns}`}
        data={data}
        keyExtractor={(e) => e.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.columnWrap : undefined}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View>
                <Text style={[styles.greeting, { color: theme.textSecondary }]}>{greeting()}</Text>
                <Text style={[styles.title, { color: theme.text }]}>Your entries</Text>
              </View>
              <View style={styles.headerRight}>
                {responsive.isDesktop ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open state board"
                    onPress={() => router.push('/state')}
                    style={[styles.stateBtn, { borderColor: theme.border }]}>
                    <Ionicons name="pulse-outline" size={18} color={theme.textSecondary} />
                  </Pressable>
                )}
                <StreakBadge streak={streak} />
              </View>
            </View>
            <View
              style={[
                styles.searchRow,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}>
              <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search your entries"
                placeholderTextColor={theme.textSecondary}
                returnKeyType="search"
                style={[styles.searchInput, { color: theme.text }]}
              />
              {query.length > 0 && (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={columns > 1 ? styles.gridItem : undefined}>
            {isPlaceholder(item) ? null : <EntryCard entry={item} />}
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={isSearching ? false : loading} onRefresh={refresh} tintColor={theme.textSecondary} />
        }
        ListEmptyComponent={
          isSearching ? (
            searching ? null : (
              <EmptyState
                icon="search-outline"
                title="No matches"
                subtitle={`Nothing found for "${query.trim()}".`}
              />
            )
          ) : loading ? null : error ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Couldn’t load your entries"
              subtitle={error}
              action={{ label: 'Retry', icon: 'refresh', onPress: refresh }}
            />
          ) : (
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
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { paddingVertical: 16, gap: 12, flexGrow: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  columnWrap: { gap: 12 },
  gridItem: { flex: 1 },
  header: { marginBottom: 16 },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stateBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { fontSize: 14, fontWeight: '500' },
  title: { fontSize: 26, fontWeight: '700', marginTop: 2 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
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
