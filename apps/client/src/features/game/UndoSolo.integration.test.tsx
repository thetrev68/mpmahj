import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameBoard } from '@/components/game/GameBoard';
import { fixtures } from '@/test/fixtures';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { renderWithProviders } from '@/test/test-utils';

describe('US-022: Smart Undo (Solo) Integration', () => {
  it('shows solo undo and sends SmartUndo on click', async () => {
    const ws = createMockWebSocket();
    const soloState = {
      ...fixtures.gameStates.playingDiscarding,
      players: fixtures.gameStates.playingDiscarding.players.map((player) =>
        player.seat === 'South' ? { ...player, is_bot: false } : { ...player, is_bot: true }
      ),
    };

    const { user } = renderWithProviders(<GameBoard initialState={soloState} ws={ws} />);

    expect(screen.getByTestId('undo-button')).toBeInTheDocument();
    expect(screen.queryByTestId('request-undo-vote-button')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('undo-button'));

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
              StateRestored: {
                move_number: 15,
                description: 'Undid discard of 5 Dot',
                mode: 'None',
              },
            },
          },
        },
      });
    });

    expect(screen.getByTestId('undo-notice')).toHaveTextContent('Undid: Undid discard of 5 Dot');
  });

  it('supports Ctrl+Z shortcut in solo mode', async () => {
    const ws = createMockWebSocket();
    const soloState = {
      ...fixtures.gameStates.playingDiscarding,
      players: fixtures.gameStates.playingDiscarding.players.map((player) =>
        player.seat === 'South' ? { ...player, is_bot: false } : { ...player, is_bot: true }
      ),
    };

    const { user } = renderWithProviders(<GameBoard initialState={soloState} ws={ws} />);
    await user.keyboard('{Control>}z{/Control}');

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { SmartUndo: { player: 'South' } },
        },
      })
    );
  });
});
