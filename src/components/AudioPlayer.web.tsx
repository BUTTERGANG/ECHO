/**
 * Playback for a stored recording — WEB.
 *
 * Loads the entry's audio blob from IndexedDB into an off-DOM HTMLAudioElement
 * and exposes a play/pause + scrub-free progress control. Renders nothing if
 * the entry has no playable audio. Native resolves to `AudioPlayer.tsx`.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { getAudioObjectURL } from '@/services/audioStore';
import { useTheme } from '@/hooks/use-theme';

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ audioPath }: { audioPath: string | null }) {
  const theme = useTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [available, setAvailable] = useState<boolean>(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    const audio = new Audio();
    audioRef.current = audio;

    audio.addEventListener('timeupdate', () => setPosition(audio.currentTime));
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('ended', () => {
      setPlaying(false);
      setPosition(0);
    });

    (async () => {
      url = await getAudioObjectURL(audioPath);
      if (cancelled || !url) return;
      audio.src = url;
      setAvailable(true);
    })();

    return () => {
      cancelled = true;
      audio.pause();
      audioRef.current = null;
      if (url) URL.revokeObjectURL(url);
    };
  }, [audioPath]);

  if (!available) return null;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <Card style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause audio' : 'Play audio'}
        onPress={toggle}
        hitSlop={8}>
        <Ionicons name={playing ? 'pause-circle' : 'play-circle'} size={36} color={theme.accent} />
      </Pressable>
      <View style={styles.body}>
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
        </View>
        <Text style={[styles.time, { color: theme.textSecondary }]}>
          {fmt(position)} / {fmt(duration)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  body: { flex: 1, gap: 6 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  time: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
