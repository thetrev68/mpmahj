import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { LeaveConfirmationDialog } from './LeaveConfirmationDialog';

describe('LeaveConfirmationDialog', () => {
  const defaultProps = {
    isOpen: true,
    isLoading: false,
    isCriticalPhase: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  test('renders when open', () => {
    renderWithProviders(<LeaveConfirmationDialog {...defaultProps} />);
    expect(screen.getByTestId('leave-confirmation-dialog')).toBeInTheDocument();
  });

  test('does not render when closed', () => {
    renderWithProviders(<LeaveConfirmationDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('leave-confirmation-dialog')).not.toBeInTheDocument();
  });

  test('shows critical warning in critical phase', () => {
    renderWithProviders(<LeaveConfirmationDialog {...defaultProps} isCriticalPhase={true} />);
    expect(screen.getByText(/Leaving now will forfeit your current action/i)).toBeInTheDocument();
  });

  test('calls confirm handler', async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <LeaveConfirmationDialog {...defaultProps} onConfirm={onConfirm} />
    );
    await user.click(screen.getByRole('button', { name: /leave game now/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  test('calls cancel handler', async () => {
    const onCancel = vi.fn();
    const { user } = renderWithProviders(
      <LeaveConfirmationDialog {...defaultProps} onCancel={onCancel} />
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
