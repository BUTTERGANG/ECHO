import { EntriesStream } from '@/components/EntriesStream';
import { Screen } from '@/components/ui/Screen';
import { StateBoard } from '@/components/workbench/StateBoard';
import { TelemetryDeck } from '@/components/workbench/TelemetryDeck';
import { Workbench } from '@/components/workbench/Workbench';
import { useResponsive } from '@/hooks/useResponsive';

export default function HomeScreen() {
  const { isDesktop } = useResponsive();

  // Desktop: unfold into the 3-pane analytical workbench. Mobile/tablet: the
  // clean single-column capture stream (decks reachable as sub-views).
  if (isDesktop) {
    return (
      <Workbench
        left={<StateBoard />}
        center={<EntriesStream columns={1} />}
        right={<TelemetryDeck />}
      />
    );
  }

  return (
    <Screen padded={false}>
      <EntriesStream />
    </Screen>
  );
}
