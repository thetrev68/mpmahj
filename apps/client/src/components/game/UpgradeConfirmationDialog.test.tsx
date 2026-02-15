/**
 * Tests for UpgradeConfirmationDialog (US-016)
 */

import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpgradeConfirmationDialog } from './UpgradeConfirmationDialog';

describe('UpgradeConfirmationDialog', () => {
  const defaultProps = {
    isOpen: true,
    meldType: 'Pung' as const,
    upgrade: 'Kong' as const,
    tile: 22, // Dot 5
    meldIndex: 0,
    mySeat: 'East' as const,
    isLoading: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  test('renders dialog when isOpen=true (AC-2)', () => {
    render(<UpgradeConfirmationDialog {...defaultProps} />);
    expect(screen.getByTestId('upgrade-confirmation-dialog')).toBeInTheDocument();
  });

  test('does not render when isOpen=false', () => {
    render(<UpgradeConfirmationDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('upgrade-confirmation-dialog')).not.toBeInTheDocument();
  });

  test('shows confirmation message with tile and upgrade type (AC-2)', () => {
    render(<UpgradeConfirmationDialog {...defaultProps} />);
    // Multiple elements may match due to title + sr-only text
    expect(screen.getAllByText(/Upgrade.*Pung.*Kong/i).length).toBeGreaterThan(0);
  });

  test('shows Confirm Upgrade button (AC-3)', () => {
    render(<UpgradeConfirmationDialog {...defaultProps} />);
    expect(screen.getByTestId('upgrade-confirm-button')).toBeInTheDocument();
  });

  test('calls onConfirm with correct command when confirmed (AC-3)', () => {
    const onConfirm = vi.fn();
    render(<UpgradeConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByTestId('upgrade-confirm-button'));

    expect(onConfirm).toHaveBeenCalledWith({
      AddToExposure: {
        player: 'East',
        meld_index: 0,
        tile: 22,
      },
    });
  });

  test('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<UpgradeConfirmationDialog {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('upgrade-cancel-button'));

    expect(onCancel).toHaveBeenCalled();
  });

  test('shows loading state when isLoading=true (AC-3 — dialog shows loading)', () => {
    render(<UpgradeConfirmationDialog {...defaultProps} isLoading={true} />);
    expect(screen.getByTestId('upgrade-confirm-button')).toBeDisabled();
    expect(screen.getByTestId('upgrade-cancel-button')).toBeDisabled();
  });

  test('cancel button is enabled when not loading', () => {
    render(<UpgradeConfirmationDialog {...defaultProps} isLoading={false} />);
    expect(screen.getByTestId('upgrade-cancel-button')).not.toBeDisabled();
  });

  test('shows Kong→Quint upgrade text correctly (AC-5)', () => {
    render(<UpgradeConfirmationDialog {...defaultProps} meldType="Kong" upgrade="Quint" />);
    expect(screen.getAllByText(/Upgrade.*Kong.*Quint/i).length).toBeGreaterThan(0);
  });

  test('closes on Escape key (accessibility)', () => {
    const onCancel = vi.fn();
    render(<UpgradeConfirmationDialog {...defaultProps} onCancel={onCancel} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalled();
  });

  test('confirms on Enter key when not loading (accessibility)', () => {
    const onConfirm = vi.fn();
    render(<UpgradeConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onConfirm).toHaveBeenCalled();
  });

  test('has aria-modal and role=dialog for screen readers', () => {
    render(<UpgradeConfirmationDialog {...defaultProps} />);
    const dialog = screen.getByTestId('upgrade-confirmation-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
