/**
 * MahjongConfirmationDialog Component Tests
 *
 * Related: US-018 (Declaring Mahjong - Self-Draw), AC-2, AC-3, EC-3
 */

import { describe, test, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { MahjongConfirmationDialog } from './MahjongConfirmationDialog';
import type { Tile } from '@/types/bindings/generated/Tile';

describe('MahjongConfirmationDialog', () => {
  // Odds Only winning hand: 1B×3, 3C×3, 5D×3, 7B×3, 9D×2
  const winningHand: Tile[] = [0, 0, 0, 11, 11, 11, 22, 22, 22, 6, 6, 6, 26, 26];

  const defaultProps = {
    isOpen: true,
    hand: winningHand,
    mySeat: 'South' as const,
    isLoading: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  test('renders when isOpen is true', () => {
    renderWithProviders(<MahjongConfirmationDialog {...defaultProps} />);
    expect(screen.getByTestId('mahjong-confirmation-dialog')).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    renderWithProviders(<MahjongConfirmationDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('mahjong-confirmation-dialog')).not.toBeInTheDocument();
  });

  test('shows confirmation heading', () => {
    renderWithProviders(<MahjongConfirmationDialog {...defaultProps} />);
    expect(screen.getByText(/Declare Mahjong/i)).toBeInTheDocument();
  });

  test('renders Confirm Mahjong button', () => {
    renderWithProviders(<MahjongConfirmationDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /confirm mahjong/i })).toBeInTheDocument();
  });

  test('renders Cancel button', () => {
    renderWithProviders(<MahjongConfirmationDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  test('calls onConfirm with DeclareMahjong command when confirmed (self-draw: winning_tile null)', async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <MahjongConfirmationDialog {...defaultProps} onConfirm={onConfirm} />
    );

    await user.click(screen.getByRole('button', { name: /confirm mahjong/i }));

    expect(onConfirm).toHaveBeenCalledOnce();
    const [command] = onConfirm.mock.calls[0];
    // Command sends a Hand struct built from the tile array
    expect(command.DeclareMahjong.player).toBe('South');
    expect(command.DeclareMahjong.winning_tile).toBeNull();
    expect(command.DeclareMahjong.hand.concealed).toEqual(winningHand);
  });

  test('calls onCancel when Cancel button clicked', async () => {
    const onCancel = vi.fn();
    const { user } = renderWithProviders(
      <MahjongConfirmationDialog {...defaultProps} onCancel={onCancel} />
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('shows loading state when isLoading is true', () => {
    renderWithProviders(<MahjongConfirmationDialog {...defaultProps} isLoading={true} />);
    // Confirm button text changes to "Validating..." when loading
    expect(screen.getByRole('button', { name: /confirm mahjong/i })).toHaveTextContent(
      /Validating/i
    );
  });

  test('disables Confirm button when isLoading (EC-3: double-click prevention)', () => {
    renderWithProviders(<MahjongConfirmationDialog {...defaultProps} isLoading={true} />);
    expect(screen.getByRole('button', { name: /confirm mahjong/i })).toBeDisabled();
  });

  test('disables Cancel button when isLoading', () => {
    renderWithProviders(<MahjongConfirmationDialog {...defaultProps} isLoading={true} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  test('displays all 14 tiles from the hand', () => {
    renderWithProviders(<MahjongConfirmationDialog {...defaultProps} />);
    // 14 positional tile wrappers rendered (tile-pos-0 through tile-pos-13)
    const tiles = screen.getAllByTestId(/^tile-pos-/);
    expect(tiles).toHaveLength(14);
  });
});
