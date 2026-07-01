import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort catch for render/lifecycle errors anywhere below the root
 * layout — e.g. a bug in a screen or hook, not just the known DB-boot path
 * `_layout.tsx` already handles via `useRunMigrations`'s `error` state. Class
 * components are the only way to implement this in React; there is no hook
 * equivalent (see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary).
 *
 * This cannot catch errors thrown during module evaluation (before React
 * renders anything) or inside async callbacks/timers — only errors thrown
 * while rendering, in lifecycle methods, or in constructors of the tree
 * below it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <ThemedText type="subtitle" themeColor="danger">
            Something went wrong
          </ThemedText>
          <ThemedText type="small">{this.state.error.message}</ThemedText>
        </View>
      );
    }
    return this.props.children;
  }
}
