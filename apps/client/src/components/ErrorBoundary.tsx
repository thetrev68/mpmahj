import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
}

function DefaultFallback({ onReset }: { onReset: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center"
      data-testid="error-boundary-fallback"
      role="alert"
    >
      <p className="text-sm font-medium text-destructive">Something went wrong.</p>
      <button
        type="button"
        className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        data-testid="error-boundary-reset-button"
        onClick={onReset}
      >
        Try Again
      </button>
    </div>
  );
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.hasError &&
      this.props.resetKeys !== undefined &&
      prevProps.resetKeys !== undefined &&
      !arraysShallowEqual(this.props.resetKeys, prevProps.resetKeys)
    ) {
      this.setState({ hasError: false });
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <DefaultFallback onReset={() => this.setState({ hasError: false })} />
        )
      );
    }
    return this.props.children;
  }
}

function arraysShallowEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

export { ErrorBoundary, DefaultFallback };
