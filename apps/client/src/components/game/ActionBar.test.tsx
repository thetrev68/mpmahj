import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { ActionBar } from './ActionBar';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

describe('ActionBar', () => {
  const charlestonPhase: GamePhase = { Charleston: 'FirstLeft' };
  const defaultProps = {
    phase: charlestonPhase,
    mySeat: 'South' as const,
    selectedTiles: [],
    canCommitCharlestonPass: false,
    hasSubmittedPass: false,
    canCommitDiscard: false,
    canProceedCallWindow: false,
    onCommand: vi.fn(),
  };

  test('preserves action-bar testid on the relative full-width root', () => {
    renderWithProviders(<ActionBar {...defaultProps} />);

    expect(screen.getByTestId('action-bar')).toHaveClass('relative', 'w-full', 'h-full');
    expect(screen.getByTestId('action-bar')).not.toHaveClass('fixed');
  });

  test('does not render undo-related UI', () => {
    renderWithProviders(<ActionBar {...defaultProps} />);

    expect(screen.queryByTestId('undo-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('undo-vote-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('request-undo-vote-button')).not.toBeInTheDocument();
  });

  test('sends CommitCharlestonPass when Proceed is clicked in Charleston', async () => {
    const onCommand = vi.fn();
    const { user } = renderWithProviders(
      <ActionBar
        {...defaultProps}
        phase={{ Charleston: 'FirstRight' }}
        selectedTiles={[0, 1, 2]}
        canCommitCharlestonPass={true}
        onCommand={onCommand}
      />
    );

    await user.click(screen.getByTestId('proceed-button'));

    const expected: GameCommand = {
      CommitCharlestonPass: { player: 'South', from_hand: [0, 1, 2], forward_incoming_count: 0 },
    };
    expect(onCommand).toHaveBeenCalledWith(expected);
  });

  test('uses proceed-button testid for discard flow', async () => {
    const onCommand = vi.fn();
    const { user } = renderWithProviders(
      <ActionBar
        {...defaultProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        selectedTiles={[5]}
        canCommitDiscard={true}
        onCommand={onCommand}
      />
    );

    expect(screen.getByTestId('proceed-button')).toBeEnabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();

    await user.click(screen.getByTestId('proceed-button'));

    expect(onCommand).toHaveBeenCalledWith({
      DiscardTile: { player: 'South', tile: 5 },
    });
  });

  test('keeps proceed-button disabled for opponent discard and omits playing-status', () => {
    renderWithProviders(
      <ActionBar {...defaultProps} phase={{ Playing: { Discarding: { player: 'West' } } }} />
    );

    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.queryByTestId('playing-status')).not.toBeInTheDocument();
  });

  test('uses proceed-button testid for call window flow', () => {
    renderWithProviders(
      <ActionBar
        {...defaultProps}
        phase={{
          Playing: {
            CallWindow: {
              tile: 5,
              discarded_by: 'East',
              can_act: ['South'],
              pending_intents: [],
              timer: 10,
            },
          },
        }}
        canProceedCallWindow={true}
        onProceedCallWindow={vi.fn()}
      />
    );

    expect(screen.getByTestId('proceed-button')).toBeEnabled();
    expect(screen.queryByTestId('call-window-proceed-button')).not.toBeInTheDocument();
  });

  test('does not render removed gameplay controls', () => {
    renderWithProviders(
      <ActionBar
        {...defaultProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        selectedTiles={[5]}
        canCommitDiscard={true}
      />
    );

    expect(screen.queryByTestId('get-hint-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exchange-joker-button')).not.toBeInTheDocument();
  });
});
