import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGameSocket } from './useGameSocket';
import { createMockWebSocket, type MockWebSocket } from '@/test/mocks/websocket';
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

  return {
    instances,
    WebSocketMock,
  };
}

function createStateSnapshot(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  return {
    game_id: 'test-game',
    phase: { Setup: 'RollingDice' },
    current_turn: 'East',
    dealer: 'East',
    round_number: 1,
    turn_number: 1,
    remaining_tiles: 136,
    discard_pile: [],
    players: [],
    house_rules: {
      ruleset: {
        card_year: 2025,
        timer_mode: 'Visible',
        blank_exchange_enabled: false,
        call_window_seconds: 10,
        charleston_timer_seconds: 60,
      },
      analysis_enabled: false,
      concealed_bonus_enabled: false,
      dealer_bonus_enabled: false,
    },
    charleston_state: null,
    your_seat: 'East',
    your_hand: [],
    wall_seed: 12345n,
    wall_draw_index: 0,
    wall_break_point: 18,
    wall_tiles_remaining: 136,
    ...overrides,
  };
}

describe('useGameSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  test('reconnects with token auth and requests state after AuthSuccess', async () => {
    const { instances } = setupWebSocketMock();
    const { result } = renderHook(() => useGameSocket());

    const firstSocket = instances[0];
    expect(firstSocket).toBeDefined();

    act(() => {
      firstSocket.triggerOpen();
    });

    expect(firstSocket.send).toHaveBeenCalled();

    const firstAuth = JSON.parse(firstSocket.send.mock.calls[0][0] as string) as {
      kind: string;
      payload: { method: string };
    };
    expect(firstAuth.kind).toBe('Authenticate');
    expect(firstAuth.payload.method).toBe('guest');

    act(() => {
      firstSocket.triggerMessage({
        kind: 'AuthSuccess',
        payload: {
          player_id: 'p1',
          display_name: 'Player 1',
          session_token: 'token-1',
          seat: 'West',
        },
      });
    });

    expect(localStorage.getItem('session_token')).toBe('token-1');
    expect(localStorage.getItem('session_seat')).toBe('West');

    act(() => {
      firstSocket.triggerClose(1006, 'network drop');
    });

    expect(result.current.isReconnecting).toBe(true);
    expect(result.current.reconnectAttempt).toBe(1);

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
    expect(reconnectAuth.payload.credentials?.token).toBe('token-1');

    act(() => {
      reconnectSocket.triggerMessage({
        kind: 'AuthSuccess',
        payload: {
          player_id: 'p1',
          display_name: 'Player 1',
          session_token: 'token-2',
          seat: 'West',
        },
      });
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

    expect(localStorage.getItem('session_token')).toBe('token-2');
    expect(result.current.showReconnectedToast).toBe(true);
  });

  test('signals return_login on auth error and clears session storage', () => {
    const { instances } = setupWebSocketMock();
    localStorage.setItem('session_token', 'stale-token');
    localStorage.setItem('session_seat', 'East');

    const { result } = renderHook(() => useGameSocket());
    const socket = instances[0];

    act(() => {
      socket.triggerOpen();
      socket.triggerMessage({
        kind: 'Error',
        payload: {
          code: 'AUTH_EXPIRED',
          message: 'Token expired',
        },
      });
    });

    expect(result.current.recoveryAction).toBe('return_login');
    expect(result.current.recoveryMessage).toMatch(/expired/i);
    expect(localStorage.getItem('session_token')).toBeNull();
    expect(localStorage.getItem('session_seat')).toBeNull();
  });

  test('shows Retry Now button after 30s and retryNow triggers immediate reconnect (AC-6)', () => {
    const { instances } = setupWebSocketMock();
    const { result } = renderHook(() => useGameSocket());

    const firstSocket = instances[0];

    act(() => {
      firstSocket.triggerOpen();
      firstSocket.triggerMessage({
        kind: 'AuthSuccess',
        payload: {
          player_id: 'p1',
          display_name: 'Player 1',
          session_token: 'token-1',
          seat: 'East',
        },
      });
      firstSocket.triggerClose(1006, 'network drop');
    });

    expect(result.current.isReconnecting).toBe(true);
    expect(result.current.canManualRetry).toBe(false);

    // Advance to just before 30 s — button should not yet appear.
    act(() => {
      vi.advanceTimersByTime(29_999);
    });
    expect(result.current.canManualRetry).toBe(false);

    // Advance the final millisecond — manualRetryTimer fires.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.canManualRetry).toBe(true);

    // retryNow should kick off a new connection immediately.
    act(() => {
      result.current.retryNow();
    });

    // A new socket instance should exist.
    expect(instances.length).toBeGreaterThan(1);
  });

  test('sends RequestState and enters resync_pending after RoomJoined', () => {
    const { instances } = setupWebSocketMock();
    const { result } = renderHook(() => useGameSocket());

    const socket = instances[0];

    act(() => {
      socket.triggerOpen();
      socket.triggerMessage({
        kind: 'AuthSuccess',
        payload: {
          player_id: 'p1',
          display_name: 'Player 1',
          session_token: 'token-1',
        },
      });
    });

    // After initial AuthSuccess with no room, lifecycle should be authenticated.
    expect(result.current.lifecycleState).toBe('authenticated');

    act(() => {
      socket.triggerMessage({
        kind: 'RoomJoined',
        payload: { room_id: 'room-1', seat: 'East' },
      });
    });

    // Protocol should have sent a RequestState command for the joined seat.
    const hasRequestState = socket.send.mock.calls.some((call) => {
      const envelope = JSON.parse(call[0] as string) as {
        kind: string;
        payload?: { command?: { RequestState?: { player: string } } };
      };
      return (
        envelope.kind === 'Command' && envelope.payload?.command?.RequestState?.player === 'East'
      );
    });
    expect(hasRequestState).toBe(true);

    // Lifecycle should transition to resync_pending while waiting for snapshot.
    expect(result.current.lifecycleState).toBe('resync_pending');
    expect(result.current.seat).toBe('East');

    // Snapshot arrival should clear resync_pending → authenticated.
    act(() => {
      socket.triggerMessage({
        kind: 'StateSnapshot',
        payload: {
          snapshot: createStateSnapshot({ your_seat: 'East', players: [] }),
        },
      });
    });

    expect(result.current.lifecycleState).toBe('authenticated');
  });

  test('signals return_lobby when resync fails with not found', () => {
    const { instances } = setupWebSocketMock();
    const { result } = renderHook(() => useGameSocket());

    const socket = instances[0];

    act(() => {
      socket.triggerOpen();
      socket.triggerMessage({
        kind: 'AuthSuccess',
        payload: {
          player_id: 'p1',
          display_name: 'Player 1',
          session_token: 'token-1',
          seat: 'West',
        },
      });
      socket.triggerClose(1006, 'network drop');
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const reconnectSocket = instances[instances.length - 1];
    act(() => {
      reconnectSocket.triggerOpen();
      reconnectSocket.triggerMessage({
        kind: 'AuthSuccess',
        payload: {
          player_id: 'p1',
          display_name: 'Player 1',
          session_token: 'token-2',
          seat: 'West',
        },
      });
      reconnectSocket.triggerMessage({
        kind: 'Error',
        payload: {
          code: 'ROOM_NOT_FOUND',
          message: 'Room no longer exists',
        },
      });
    });

    expect(result.current.recoveryAction).toBe('return_lobby');
    expect(result.current.recoveryMessage).toMatch(/room/i);
  });
});
