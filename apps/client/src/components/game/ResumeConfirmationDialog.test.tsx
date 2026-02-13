import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { ResumeConfirmationDialog } from './ResumeConfirmationDialog';

describe('ResumeConfirmationDialog', () => {
  it('renders warning details', () => {
    renderWithProviders(
      <ResumeConfirmationDialog
        isOpen={true}
        moveNumber={42}
        currentMove={87}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('resume-confirmation-dialog')).toBeInTheDocument();
    expect(screen.getByText(/45 moves will be lost/i)).toBeInTheDocument();
  });

  it('calls confirm and cancel handlers', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { user } = renderWithProviders(
      <ResumeConfirmationDialog
        isOpen={true}
        moveNumber={10}
        currentMove={14}
        isLoading={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByTestId('confirm-resume-button'));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
