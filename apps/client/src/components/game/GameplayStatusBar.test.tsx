import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { GameplayStatusBar } from './GameplayStatusBar';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';

function renderStatusBar(
  phase: GamePhase,
  overrides?: Partial<ComponentProps<typeof GameplayStatusBar>>
) {
  return renderWithProviders(
    <GameplayStatusBar phase={phase} mySeat="South" readOnly={false} {...overrides} />
  );
}

describe('GameplayStatusBar', () => {
  it('renders drawing copy for my turn', () => {
    renderStatusBar({ Playing: { Drawing: { player: 'South' } } });

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent('Your turn — Drawing');
  });

  it('renders drawing copy for another player turn', () => {
    renderStatusBar({ Playing: { Drawing: { player: 'West' } } });

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent("West's turn — Drawing");
  });

  it('keeps discard status contextual instead of repeating the action-bar instruction', () => {
    renderStatusBar({ Playing: { Discarding: { player: 'South' } } });

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Your turn — Select a tile to discard'
    );
    expect(screen.getByTestId('gameplay-status-bar')).not.toHaveTextContent(
      'Select 1 tile to discard, then press Proceed'
    );
  });

  it('shortens call window copy when I can act', () => {
    renderStatusBar({
      Playing: {
        CallWindow: {
          tile: 5,
          discarded_by: 'East',
          can_act: ['South'],
          pending_intents: [],
          timer: 10,
        },
      },
    });

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Call window open — Call or Pass'
    );
    expect(screen.getByTestId('gameplay-status-bar')).not.toHaveTextContent(
      'Select claim tiles or press Proceed'
    );
  });

  it('renders call window waiting copy when I cannot act', () => {
    renderStatusBar({
      Playing: {
        CallWindow: {
          tile: 5,
          discarded_by: 'East',
          can_act: ['West'],
          pending_intents: [],
          timer: 10,
        },
      },
    });

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Call window open — Waiting for call resolution'
    );
  });

  it('renders Charleston voting status for a submitted vote', () => {
    renderStatusBar(
      { Charleston: 'VotingToContinue' },
      { hasSubmittedVote: true, myVote: 'Stop', votedPlayers: ['South'] }
    );

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'You voted to STOP — waiting for other players'
    );
  });

  it('renders Charleston standard pass status before submit', () => {
    renderStatusBar({ Charleston: 'FirstRight' });
    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent('Charleston — Pass right');
  });

  it('renders Charleston standard pass status after submit', () => {
    renderStatusBar({ Charleston: 'FirstRight' }, { hasSubmittedPass: true });
    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Charleston — Passing right, waiting for tiles'
    );
  });

  it('renders Charleston blind pass status before submit without leaking tile identity', () => {
    renderStatusBar({ Charleston: 'FirstLeft' });
    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Charleston Blind Pass — Select tiles to pass left'
    );
  });

  it('renders Charleston blind pass status after submit without leaking tile identity', () => {
    renderStatusBar({ Charleston: 'SecondRight' }, { hasSubmittedPass: true });
    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Charleston Blind Pass — Waiting for resolution'
    );
  });

  it('renders courtesy pass status before submit', () => {
    renderStatusBar({ Charleston: 'CourtesyAcross' });
    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Charleston — Courtesy pass'
    );
  });

  it('renders courtesy pass status after submit', () => {
    renderStatusBar({ Charleston: 'CourtesyAcross' }, { hasSubmittedPass: true });
    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Charleston — Courtesy pass submitted'
    );
  });

  it('renders in read-only mode during gameplay', () => {
    renderStatusBar({ Playing: { Discarding: { player: 'South' } } }, { readOnly: true });

    expect(screen.getByTestId('gameplay-status-bar')).toBeInTheDocument();
  });

  it('does not render outside Charleston or playing phases', () => {
    renderStatusBar({ Setup: 'RollingDice' });

    expect(screen.queryByTestId('gameplay-status-bar')).not.toBeInTheDocument();
  });
});
