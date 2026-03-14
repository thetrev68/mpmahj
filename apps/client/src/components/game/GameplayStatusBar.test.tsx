import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { GameplayStatusBar } from './GameplayStatusBar';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

function renderStatusBar(turnStage: TurnStage) {
  return renderWithProviders(
    <GameplayStatusBar turnStage={turnStage} mySeat="South" readOnly={false} />
  );
}

describe('GameplayStatusBar', () => {
  it('renders drawing copy for my turn', () => {
    renderStatusBar({ Drawing: { player: 'South' } });

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent('Your turn — Drawing');
  });

  it('renders drawing copy for another player turn', () => {
    renderStatusBar({ Drawing: { player: 'West' } });

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent("West's turn — Drawing");
  });

  it('renders discarding copy for my turn', () => {
    renderStatusBar({ Discarding: { player: 'South' } });

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Your turn — Select a tile to discard'
    );
  });

  it('renders discarding copy for another player turn', () => {
    renderStatusBar({ Discarding: { player: 'West' } });

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Waiting for West to discard'
    );
  });

  it('renders call window copy when I can act', () => {
    renderStatusBar({
      CallWindow: {
        tile: 5,
        discarded_by: 'East',
        can_act: ['South'],
        pending_intents: [],
        timer: 10,
      },
    });

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Call window open — Select claim tiles or press Proceed'
    );
  });

  it('renders call window copy when I cannot act', () => {
    renderStatusBar({
      CallWindow: {
        tile: 5,
        discarded_by: 'East',
        can_act: ['West'],
        pending_intents: [],
        timer: 10,
      },
    });

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Call window open — Waiting for call resolution'
    );
  });

  it('is hidden in read-only mode', () => {
    renderWithProviders(
      <GameplayStatusBar
        turnStage={{ Discarding: { player: 'South' } }}
        mySeat="South"
        readOnly={true}
      />
    );

    expect(screen.queryByTestId('gameplay-status-bar')).not.toBeInTheDocument();
  });
});
