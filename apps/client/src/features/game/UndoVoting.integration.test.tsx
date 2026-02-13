import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameBoard } from '@/components/game/GameBoard';
import { fixtures } from '@/test/fixtures';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { renderWithProviders } from '@/test/test-utils';

describe('US-023: Smart Undo (Voting) Integration', () => {
  it('requests undo vote and sends VoteUndo from panel', async () => {
    const ws = createMockWebSocket();
    const { user } = renderWithProviders(
      <GameBoard initialState={fixtures.gameStates.playingDiscarding} ws={ws} />
    );

    expect(screen.getByTestId('request-undo-vote-button')).toBeInTheDocument();
    expect(screen.queryByTestId('undo-button')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('request-undo-vote-button'));
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { SmartUndo: { player: 'South' } },
        },
      })
    );

    act(() => {
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              UndoRequested: {
                requester: 'East',
                target_move: 42,
              },
            },
          },
        },
      });
    });

    expect(screen.getByTestId('undo-vote-panel')).toBeInTheDocument();
    expect(screen.getByTestId('undo-vote-summary')).toHaveTextContent('East requested undo');

    await user.click(screen.getByTestId('undo-vote-approve'));
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { VoteUndo: { player: 'South', approve: true } },
        },
      })
    );
  });

  it('shows denied resolution message when undo vote fails', () => {
    const ws = createMockWebSocket();
    renderWithProviders(<GameBoard initialState={fixtures.gameStates.playingDiscarding} ws={ws} />);

    act(() => {
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              UndoRequested: {
                requester: 'East',
                target_move: 24,
              },
            },
          },
        },
      });
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              UndoRequestResolved: {
                approved: false,
              },
            },
          },
        },
      });
    });

    expect(screen.getByTestId('undo-notice')).toHaveTextContent('Undo denied - game continues');
    expect(screen.queryByTestId('undo-vote-panel')).not.toBeInTheDocument();
  });
});
