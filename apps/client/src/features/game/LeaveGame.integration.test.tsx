import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { GameBoard } from '@/components/game/GameBoard';
import { fixtures } from '@/test/fixtures';

describe('US-031: Leave Game (Integration)', () => {
  it('sends LeaveGame command and returns to lobby placeholder after confirmation', async () => {
    const mockWs = createMockWebSocket();
    const initialState = fixtures.gameStates.playingDiscarding;
    const { user } = renderWithProviders(<GameBoard initialState={initialState} ws={mockWs} />);

    await user.click(screen.getByTestId('leave-game-button'));
    await user.click(screen.getByRole('button', { name: /leave game now/i }));

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { LeaveGame: { player: initialState.your_seat } },
        },
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('lobby-screen-placeholder')).toBeInTheDocument();
    expect(screen.getByText('You left the game.')).toBeInTheDocument();
  });
});
