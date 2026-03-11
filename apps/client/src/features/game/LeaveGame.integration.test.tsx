import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { GameBoard } from '@/components/game/GameBoard';
import { LobbyScreen } from '@/pages/LobbyScreen';
import { fixtures } from '@/test/fixtures';
import { useRoomStore } from '@/stores/roomStore';
import type { UseGameSocketReturn } from '@/hooks/useGameSocket';

const { signOutFromSupabase } = vi.hoisted(() => ({
  signOutFromSupabase: vi.fn(async () => undefined),
}));

vi.mock('@/lib/supabaseAuth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabaseAuth')>('@/lib/supabaseAuth');
  return {
    ...actual,
    signOutFromSupabase,
    getAccessTokenFromSupabaseSession: vi.fn(async () => null),
  };
});

function createLobbySocketStub(): UseGameSocketReturn {
  return {
    connectionState: 'connected',
    lifecycleState: 'authenticated',
    send: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    connect: vi.fn(),
    disconnect: vi.fn(),
    playerId: 'test-player',
    sessionToken: '11111111-1111-1111-1111-111111111111',
    seat: 'East',
    reconnectAttempt: 0,
    isReconnecting: false,
    canManualRetry: false,
    retryNow: vi.fn(),
    recoveryAction: 'none',
    recoveryMessage: null,
    clearRecoveryAction: vi.fn(),
    showReconnectedToast: false,
    dismissReconnectedToast: vi.fn(),
  };
}

function TestShell({
  boardWs,
  lobbySocket,
}: {
  boardWs: ReturnType<typeof createMockWebSocket>;
  lobbySocket: UseGameSocketReturn;
}) {
  const currentRoom = useRoomStore((state) => state.currentRoom);

  if (currentRoom) {
    return <GameBoard initialState={fixtures.gameStates.playingDiscarding} ws={boardWs} />;
  }

  return <LobbyScreen socket={lobbySocket} />;
}

describe('game exit and logout integration', () => {
  beforeEach(() => {
    signOutFromSupabase.mockClear();
    localStorage.clear();
    useRoomStore.setState({
      currentRoom: {
        room_id: 'room-123',
        seat: 'East',
        status: 'playing',
      },
      availableRooms: [],
      selectedRoom: null,
      roomCreation: {
        isCreating: false,
        error: null,
        retryCount: 0,
      },
      roomJoining: {
        isJoining: false,
        error: null,
      },
      lobbyNotice: null,
    });
  });

  it('start over sends LeaveGame and returns to the real lobby with actions', async () => {
    const boardWs = createMockWebSocket();
    boardWs.triggerOpen();
    const lobbySocket = createLobbySocketStub();
    const { user } = renderWithProviders(<TestShell boardWs={boardWs} lobbySocket={lobbySocket} />);

    await user.click(screen.getByTestId('start-over-button'));
    await user.click(screen.getByRole('button', { name: /leave game now/i }));

    expect(boardWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { LeaveGame: { player: fixtures.gameStates.playingDiscarding.your_seat } },
        },
      })
    );

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /join room/i })).toBeInTheDocument();
      },
      { timeout: 4000 }
    );

    expect(screen.getByTestId('lobby-notice')).toHaveTextContent(
      'You left the game and can start a new one.'
    );
    expect(useRoomStore.getState().currentRoom).toBeNull();
  }, 10000);

  it('logs out from the game and returns to the lobby login state', async () => {
    const boardWs = createMockWebSocket();
    boardWs.triggerOpen();
    const lobbySocket = createLobbySocketStub();
    const { user } = renderWithProviders(<TestShell boardWs={boardWs} lobbySocket={lobbySocket} />);

    await user.click(screen.getByTestId('logout-button'));

    await waitFor(() => {
      expect(screen.getByTestId('lobby-notice')).toHaveTextContent('You have been logged out.');
    });

    expect(signOutFromSupabase).toHaveBeenCalledTimes(1);
    expect(useRoomStore.getState().currentRoom).toBeNull();
  });
});
