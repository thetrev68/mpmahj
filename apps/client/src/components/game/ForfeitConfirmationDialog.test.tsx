import { describe, expect, test, vi } from 'vitest';
import { useState } from 'react';
import { renderWithProviders, screen } from '@/test/test-utils';
import { ForfeitConfirmationDialog } from './ForfeitConfirmationDialog';

describe('ForfeitConfirmationDialog', () => {
  const defaultProps = {
    isOpen: true,
    isLoading: false,
    penaltyPoints: 100,
    reason: null as string | null,
    onReasonChange: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  test('renders when open', () => {
    renderWithProviders(<ForfeitConfirmationDialog {...defaultProps} />);
    expect(screen.getByTestId('forfeit-confirmation-dialog')).toBeInTheDocument();
  });

  test('does not render when closed', () => {
    renderWithProviders(<ForfeitConfirmationDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('forfeit-confirmation-dialog')).not.toBeInTheDocument();
  });

  test('calls reason change handler', async () => {
    const onReasonChange = vi.fn();
    const ControlledDialog = () => {
      const [reason, setReason] = useState<string | null>(null);
      return (
        <ForfeitConfirmationDialog
          {...defaultProps}
          reason={reason}
          onReasonChange={(value) => {
            onReasonChange(value);
            setReason(value);
          }}
        />
      );
    };
    const { user } = renderWithProviders(<ControlledDialog />);

    await user.type(screen.getByRole('textbox', { name: /reason/i }), 'Poor connection');
    expect(onReasonChange).toHaveBeenLastCalledWith('Poor connection');
  });

  test('calls confirm handler', async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <ForfeitConfirmationDialog {...defaultProps} onConfirm={onConfirm} />
    );
    await user.click(screen.getByRole('button', { name: /forfeit game now/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  test('calls cancel handler', async () => {
    const onCancel = vi.fn();
    const { user } = renderWithProviders(
      <ForfeitConfirmationDialog {...defaultProps} onCancel={onCancel} />
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
