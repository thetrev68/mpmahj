import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { GameBoard } from '@/components/game/GameBoard';
import { fixtures } from '@/test/fixtures';

describe('US-031: Leave Game (Integration)', () => {
  it('sends LeaveGame command, shows overlay, then navigates to lobby with toast', async () => {
    const mockWs = createMockWebSocket();
    const initialState = fixtures.gameStates.playingDiscarding;
    const { user } = renderWithProviders(<GameBoard initialState={initialState} ws={mockWs} />);

    await user.click(screen.getByTestId('leave-game-button'));
    await user.click(screen.getByRole('button', { name: /leave game now/i }));

    // Command is sent immediately (before the 1500ms delay)
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { LeaveGame: { player: initialState.your_seat } },
        },
      })
    );

    // "Leaving game..." overlay visible while waiting for delayed navigation (AC-3)
    expect(screen.getByTestId('leave-loading-overlay')).toBeInTheDocument();

    // Wait for 1500ms delay → onLeaveConfirmed → lobby renders with toast (AC-6)
    await waitFor(
      () => expect(screen.getByTestId('lobby-screen-placeholder')).toBeInTheDocument(),
      { timeout: 3000 }
    );
    expect(screen.getByTestId('leave-toast')).toBeInTheDocument();
    expect(screen.getByText('You left the game.')).toBeInTheDocument();
  }, 10000);
});
