/**
 * Unit Tests: MahjongValidationDialog
 *
 * Tests for the dialog shown when a player has won via a called discard
 * and must submit their hand for server validation.
 *
 * Related: US-019 (AC-4)
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { MahjongValidationDialog } from './MahjongValidationDialog';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

describe('MahjongValidationDialog', () => {
  const defaultProps = {
    isOpen: true,
    concealedHand: [0, 0, 0, 11, 11, 11, 22, 22, 22, 6, 6, 6, 26] as number[], // 13 tiles
    calledTile: 26 as number, // 9-Dot (the 14th tile called from discard)
    discardedBy: 'East' as const,
    mySeat: 'South' as const,
    isLoading: false,
    onSubmit: vi.fn<(cmd: GameCommand) => void>(),
  };

  it('renders the dialog when isOpen is true', () => {
    renderWithProviders(<MahjongValidationDialog {...defaultProps} />);
    expect(screen.getByTestId('mahjong-validation-dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    renderWithProviders(<MahjongValidationDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('mahjong-validation-dialog')).not.toBeInTheDocument();
  });

  it('renders all 13 concealed tiles', () => {
    renderWithProviders(<MahjongValidationDialog {...defaultProps} />);
    // 13 concealed + 1 called tile = 14 total tile elements
    for (let i = 0; i < 13; i++) {
      expect(screen.getByTestId(`concealed-tile-${i}`)).toBeInTheDocument();
    }
  });

  it('renders the called tile with a gold border highlight', () => {
    renderWithProviders(<MahjongValidationDialog {...defaultProps} />);
    const calledTileEl = screen.getByTestId('called-tile');
    expect(calledTileEl).toBeInTheDocument();
    // Should have a label indicating it's the called tile
    expect(screen.getByText(/called tile/i)).toBeInTheDocument();
  });

  it('shows discarded-by information', () => {
    renderWithProviders(<MahjongValidationDialog {...defaultProps} />);
    expect(screen.getByText(/east/i)).toBeInTheDocument();
  });

  it('submits DeclareMahjong with winning_tile = calledTile (not null)', async () => {
    const onSubmit = vi.fn<(cmd: GameCommand) => void>();
    const { user } = renderWithProviders(
      <MahjongValidationDialog {...defaultProps} onSubmit={onSubmit} />
    );

    await user.click(screen.getByRole('button', { name: /submit for validation/i }));

    expect(onSubmit).toHaveBeenCalledOnce();
    const cmd = onSubmit.mock.calls[0][0] as { DeclareMahjong: { winning_tile: number | null } };
    expect(cmd.DeclareMahjong.winning_tile).toBe(defaultProps.calledTile);
    expect(cmd.DeclareMahjong.winning_tile).not.toBeNull();
  });

  it('submits DeclareMahjong with correct player seat', async () => {
    const onSubmit = vi.fn<(cmd: GameCommand) => void>();
    const { user } = renderWithProviders(
      <MahjongValidationDialog {...defaultProps} onSubmit={onSubmit} />
    );

    await user.click(screen.getByRole('button', { name: /submit for validation/i }));

    const cmd = onSubmit.mock.calls[0][0] as { DeclareMahjong: { player: string } };
    expect(cmd.DeclareMahjong.player).toBe('South');
  });

  it('submits hand including both concealed tiles and the called tile', async () => {
    const onSubmit = vi.fn<(cmd: GameCommand) => void>();
    const { user } = renderWithProviders(
      <MahjongValidationDialog {...defaultProps} onSubmit={onSubmit} />
    );

    await user.click(screen.getByRole('button', { name: /submit for validation/i }));

    const cmd = onSubmit.mock.calls[0][0] as {
      DeclareMahjong: { hand: { concealed: number[] } };
    };
    // concealed in hand should contain all 13 tiles + the called tile = 14
    expect(cmd.DeclareMahjong.hand.concealed).toHaveLength(14);
    expect(cmd.DeclareMahjong.hand.concealed).toContain(defaultProps.calledTile);
  });

  it('disables submit button and shows spinner while loading', () => {
    renderWithProviders(<MahjongValidationDialog {...defaultProps} isLoading={true} />);
    const submitBtn = screen.getByRole('button', { name: /validating/i });
    expect(submitBtn).toBeDisabled();
  });

  it('does not have a cancel button (player is committed after calling)', () => {
    renderWithProviders(<MahjongValidationDialog {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });
});
