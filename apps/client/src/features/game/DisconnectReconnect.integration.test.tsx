import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/test-utils';
import { createMockWebSocket, type MockWebSocket } from '@/test/mocks/websocket';
import { GameBoard } from '@/components/game/GameBoard';
import { eventSequences, gameStates } from '@/test/fixtures';

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
          session_token: 'session-token-initial',
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
    expect(reconnectAuth.payload.method).toBe('jwt');
    expect(reconnectAuth.payload.credentials?.token).toBe('session-token-initial');

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
});
