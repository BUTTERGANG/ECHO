import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { RecordingStatus } from '@/stores/recordingStore';

interface Props {
  status: RecordingStatus;
  onPress: () => void;
}

const LABEL: Record<RecordingStatus, string> = {
  idle: 'Tap to record',
  recording: 'Recording — tap to stop',
  processing: 'Saving…',
  transcribing: 'Transcribing…',
};

/** Large, animated tap target (handoff §8 Step 2, principle §2.2). */
export function RecordButton({ status, onPress }: Props) {
  const theme = useTheme();
  const recording = status === 'recording';
  const busy = status === 'processing' || status === 'transcribing';

  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!recording) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  const color = recording ? theme.danger : busy ? theme.textSecondary : theme.accent;

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        {recording ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              { backgroundColor: theme.danger, transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={LABEL[status]}
          disabled={busy}
          onPress={onPress}
          style={({ pressed }) => [styles.button, { backgroundColor: color }, pressed && styles.pressed]}>
          <Ionicons name={recording ? 'stop' : 'mic'} size={52} color={theme.accentText} />
        </Pressable>
      </View>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{LABEL[status]}</Text>
    </View>
  );
}

const SIZE = 168;
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 20 },
  stage: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.9 },
  label: { fontSize: 16, fontWeight: '500' },
});
