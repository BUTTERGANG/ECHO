import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SLIDES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'mic',
    title: 'Speak your mind',
    body: 'Journaling without the friction of typing. Talk freely — ECHO transcribes your voice right on this device.',
  },
  {
    icon: 'lock-closed',
    title: 'Private by design',
    body: 'Your audio never leaves your device. AI summaries are opt-in, and entries you mark private are never analyzed or synced.',
  },
  {
    icon: 'sparkles',
    title: 'See your patterns',
    body: 'Over time, ECHO surfaces the themes and trends across your entries — always showing you which entries it drew from.',
  },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const next = () => (last ? router.back() : setIndex((i) => i + 1));

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.body}>
        <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name={slide.icon} size={44} color={theme.accent} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{slide.title}</Text>
        <Text style={[styles.text, { color: theme.textSecondary }]}>{slide.body}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === index ? theme.accent : theme.border },
                i === index && styles.dotActive,
              ]}
            />
          ))}
        </View>
        <Button label={last ? 'Get started' : 'Next'} onPress={next} fullWidth size="lg" />
        {!last ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.skip}>
            <Text style={[styles.skipText, { color: theme.textSecondary }]}>Skip</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between', paddingVertical: 24 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 16 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  text: { fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 360 },
  footer: { gap: 16, paddingBottom: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: Radii.pill },
  dotActive: { width: 22 },
  skip: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  skipText: { textAlign: 'center', fontSize: 15, fontWeight: '500' },
});
