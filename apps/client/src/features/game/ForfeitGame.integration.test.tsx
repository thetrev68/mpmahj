import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { GameBoard } from '@/components/game/GameBoard';
import { fixtures } from '@/test/fixtures';

describe('US-032: Forfeit Game (Integration)', () => {
  it('sends ForfeitGame command with selected reason and shows forfeit status on event', async () => {
    const mockWs = createMockWebSocket();
    const initialState = fixtures.gameStates.playingDiscarding;
    const { user } = renderWithProviders(<GameBoard initialState={initialState} ws={mockWs} />);

    await user.click(screen.getByTestId('forfeit-game-button'));
    await user.type(screen.getByRole('textbox', { name: /reason/i }), 'Poor connection');
    await user.click(screen.getByRole('button', { name: /forfeit game now/i }));

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: {
            ForfeitGame: {
              player: initialState.your_seat,
              reason: 'Poor connection',
            },
          },
        },
      })
    );

    await act(async () => {
      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              PlayerForfeited: {
                player: initialState.your_seat,
                reason: 'Poor connection',
              },
            },
          },
        },
      });
    });

    expect(screen.getByTestId('dead-hand-notice')).toHaveTextContent(
      /You forfeited the game \(Poor connection\)/i
    );
  });
});
