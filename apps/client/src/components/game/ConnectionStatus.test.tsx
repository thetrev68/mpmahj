import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { ConnectionStatus } from './ConnectionStatus';

describe('ConnectionStatus', () => {
  test('renders reconnect banner with attempt count while reconnecting', () => {
    renderWithProviders(
      <ConnectionStatus
        isReconnecting={true}
        reconnectAttempt={3}
        canManualRetry={false}
        onRetryNow={vi.fn()}
        showReconnectedToast={false}
      />
    );

    expect(screen.getByTestId('connection-status-banner')).toBeInTheDocument();
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
    expect(screen.getByTestId('reconnect-attempt-badge')).toHaveTextContent('attempt 3');
    expect(screen.queryByTestId('retry-now-button')).not.toBeInTheDocument();
  });

  test('renders Retry Now button when manual retry is available', async () => {
    const onRetryNow = vi.fn();
    const { user } = renderWithProviders(
      <ConnectionStatus
        isReconnecting={true}
        reconnectAttempt={6}
        canManualRetry={true}
        onRetryNow={onRetryNow}
        showReconnectedToast={false}
      />
    );

    await user.click(screen.getByTestId('retry-now-button'));
    expect(onRetryNow).toHaveBeenCalledTimes(1);
  });

  test('renders reconnected toast', () => {
    renderWithProviders(
      <ConnectionStatus
        isReconnecting={false}
        reconnectAttempt={0}
        canManualRetry={false}
        onRetryNow={vi.fn()}
        showReconnectedToast={true}
      />
    );

    expect(screen.getByTestId('reconnected-toast')).toBeInTheDocument();
    expect(screen.getByText(/reconnected/i)).toBeInTheDocument();
  });
});
