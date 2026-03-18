import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/test-utils';
import { createMockWebSocket, type MockWebSocket } from '@/test/mocks/websocket';
import { GameBoard } from '@/components/game/GameBoard';
import { eventSequences, gameStates } from '@/test/fixtures';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';

type WebSocketCtor = new (url: string) => WebSocket;

function setupWebSocketMock() {
  const instances: MockWebSocket[] = [];

  const WebSocketMock = vi.fn(function (this: WebSocket, url: string) {
    const ws = createMockWebSocket(url);
    instances.push(ws);
    return ws as unknown as WebSocket;
  }) as unknown as WebSocketCtor;

  Object.assign(WebSocketMock, {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  });

  // @ts-expect-error test override
  global.WebSocket = WebSocketMock;
  // @ts-expect-error test override
  window.WebSocket = WebSocketMock;

  return { instances };
}

describe('US-037: Disconnect / Reconnect (Integration)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  test('recovers from disconnect with auth-first handshake and state resync', async () => {
    const { instances } = setupWebSocketMock();
    const reconnectFlow = eventSequences.reconnectFlowSequence;
    renderWithProviders(<GameBoard initialState={gameStates.midGameCharleston} />);

    const firstSocket = instances[0];
    expect(firstSocket).toBeDefined();

    act(() => {
      firstSocket.triggerOpen();
      firstSocket.triggerMessage({
        kind: 'AuthSuccess',
        payload: {
          player_id: 'player-west',
          display_name: 'WestPlayer',
          session_token: '33333333-3333-3333-3333-333333333333',
          seat: 'West',
        },
      });
    });

    fireEvent.click(screen.getAllByTestId(/^tile-0-/)[0]);
    fireEvent.click(screen.getAllByTestId(/^tile-1-/)[0]);
    expect(screen.getByTestId('selection-counter')).toHaveTextContent('2/3');

    act(() => {
      firstSocket.triggerClose(1006, 'network drop');
    });

    expect(screen.getByTestId('connection-status-banner')).toBeInTheDocument();
    expect(screen.getByTestId('disconnect-interaction-lock')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const reconnectSocket = instances[instances.length - 1];
    expect(reconnectSocket).toBeDefined();

    act(() => {
      reconnectSocket.triggerOpen();
    });

    expect(reconnectSocket.send).toHaveBeenCalled();

    const reconnectAuth = JSON.parse(reconnectSocket.send.mock.calls[0][0] as string) as {
      kind: string;
      payload: { method: string; credentials?: { token: string } };
    };
    expect(reconnectAuth.kind).toBe('Authenticate');
    expect(reconnectAuth.payload.method).toBe('token');
    expect(reconnectAuth.payload.credentials?.token).toBe('33333333-3333-3333-3333-333333333333');

    act(() => {
      reconnectSocket.triggerMessage(reconnectFlow[0]);
    });

    const hasRequestState = reconnectSocket.send.mock.calls.some((call) => {
      const envelope = JSON.parse(call[0] as string) as {
        kind: string;
        payload?: { command?: { RequestState?: { player: string } } };
      };
      return (
        envelope.kind === 'Command' && envelope.payload?.command?.RequestState?.player === 'West'
      );
    });
    expect(hasRequestState).toBe(true);

    act(() => {
      reconnectSocket.triggerMessage(reconnectFlow[1]);
    });

    expect(screen.getByTestId('reconnected-toast')).toBeInTheDocument();
    expect(screen.queryByTestId('disconnect-interaction-lock')).not.toBeInTheDocument();

    expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');
    expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
  });

  test('preserves discard-pool layout after reconnect snapshot remount in playing phase', async () => {
    const { instances } = setupWebSocketMock();
    const playingState = gameStates.playingDiscarding as GameStateSnapshot;

    renderWithProviders(<GameBoard initialState={playingState} />);

    const initialDiscardPool = screen.getByTestId('discard-pool');
    expect(initialDiscardPool).toHaveClass(
      'grid',
      'grid-cols-[repeat(10,32px)]',
      'lg:grid-cols-[repeat(20,32px)]',
      'gap-0.5',
      'bg-black/15',
      'rounded-lg',
      'p-2',
      'w-full',
      'max-w-[678px]',
      'self-center',
      'justify-self-center'
    );
    expect(initialDiscardPool).not.toHaveClass(
      'absolute',
      'top-1/4',
      'left-1/2',
      '-translate-x-1/2',
      'top-1/2',
      '-translate-y-1/2',
      'overflow-auto'
    );
    expect(screen.getByTestId('discard-pool-tile-0')).not.toHaveAttribute('style');

    const firstSocket = instances[0];
    expect(firstSocket).toBeDefined();

    act(() => {
      firstSocket.triggerOpen();
      firstSocket.triggerMessage({
        kind: 'AuthSuccess',
        payload: {
          player_id: 'player-south',
          display_name: 'SouthPlayer',
          session_token: '44444444-4444-4444-4444-444444444444',
          seat: 'South',
        },
      });
      firstSocket.triggerClose(1006, 'network drop');
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const reconnectSocket = instances[instances.length - 1];
    expect(reconnectSocket).toBeDefined();

    act(() => {
      reconnectSocket.triggerOpen();
      reconnectSocket.triggerMessage({
        kind: 'AuthSuccess',
        payload: {
          player_id: 'player-south',
          display_name: 'SouthPlayer',
          session_token: '44444444-4444-4444-4444-444444444444',
          seat: 'South',
        },
      });
      reconnectSocket.triggerMessage({
        kind: 'StateSnapshot',
        payload: {
          snapshot: {
            ...playingState,
            discard_pile: [...playingState.discard_pile, { tile: 24, discarded_by: 'North' }],
          },
        },
      });
    });

    const remountedDiscardPool = screen.getByTestId('discard-pool');
    expect(remountedDiscardPool).toHaveClass(
      'grid',
      'grid-cols-[repeat(10,32px)]',
      'lg:grid-cols-[repeat(20,32px)]',
      'gap-0.5',
      'bg-black/15',
      'rounded-lg',
      'p-2',
      'w-full',
      'max-w-[678px]',
      'self-center',
      'justify-self-center'
    );
    expect(remountedDiscardPool).not.toHaveClass(
      'absolute',
      'top-1/4',
      'left-1/2',
      '-translate-x-1/2',
      'top-1/2',
      '-translate-y-1/2',
      'overflow-auto'
    );
    expect(screen.getAllByTestId(/^discard-pool-tile-/)).toHaveLength(4);
    expect(screen.getByTestId('discard-pool-tile-3')).not.toHaveAttribute('style');
  });
});
