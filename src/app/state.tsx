/**
 * Mobile sub-view for the State Board (the workbench's left deck). On desktop
 * the board is a permanent pane; on mobile it's reached from the Home header.
 */
import { Screen } from '@/components/ui/Screen';
import { StateBoard } from '@/components/workbench/StateBoard';

export default function StateScreen() {
  return (
    <Screen scroll>
      <StateBoard />
    </Screen>
  );
}
