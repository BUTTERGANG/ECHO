import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { useTheme } from '@/hooks/use-theme';
import type { AiSummary } from '@/db/schema';

const PARTS: { key: keyof AiSummary; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'whatSaid', title: 'What you said', icon: 'chatbubble-ellipses-outline' },
  { key: 'unseen', title: "What you didn't see", icon: 'eye-outline' },
  { key: 'action', title: 'One small action', icon: 'checkmark-circle-outline' },
];

/** AI summary three-part display (handoff §8 Step 6). */
export function SummaryBlock({ summary }: { summary: AiSummary }) {
  const theme = useTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={16} color={theme.accent} />
        <Text style={[styles.headerText, { color: theme.accent }]}>AI reflection</Text>
      </View>
      {PARTS.map((part) => {
        const text = (summary[part.key] as string | null) ?? '';
        if (!text) return null;
        return (
          <View key={part.key} style={styles.part}>
            <View style={styles.partHeader}>
              <Ionicons name={part.icon} size={15} color={theme.textSecondary} />
              <Text style={[styles.partTitle, { color: theme.textSecondary }]}>{part.title}</Text>
            </View>
            <Text style={[styles.partBody, { color: theme.text }]}>{text}</Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  part: { gap: 4 },
  partHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  partTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  partBody: { fontSize: 15, lineHeight: 22 },
});
