import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useGameBoardBridge } from './useGameBoardBridge';
import type { UseGameSocketReturn } from '@/hooks/useGameSocket';
import type { UseGameEventsReturn } from '@/hooks/useGameEvents';
import type { WebSocketLike } from './useGameBoardBridge';

const useGameEventsMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useGameEvents', () => ({
  useGameEvents: useGameEventsMock,
}));

function createSocketClient(partial: Partial<UseGameSocketReturn> = {}): UseGameSocketReturn {
  return {
    connectionState: 'connected',
    lifecycleState: 'authenticated',
    send: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    connect: vi.fn(),
    disconnect: vi.fn(),
    playerId: null,
    sessionToken: null,
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
    ...partial,
  };
}

function createGameEventsReturn(partial: Partial<UseGameEventsReturn> = {}): UseGameEventsReturn {
  return {
    gameState: null,
    snapshotRevision: 0,
    sendCommand: vi.fn(),
    sideEffectManager: {} as UseGameEventsReturn['sideEffectManager'],
    eventBus: {
      on: vi.fn(() => vi.fn()),
      emit: vi.fn(),
    },
    ...partial,
  };
}

describe('useGameBoardBridge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameEventsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('disables interactions when internal socket lifecycle is disconnected', () => {
    const socketClient = createSocketClient({
      connectionState: 'disconnected',
      lifecycleState: 'disconnected',
    });
    useGameEventsMock.mockReturnValue(createGameEventsReturn());

    const { result } = renderHook(() =>
      useGameBoardBridge({
        socketClient,
        dispatchUIAction: vi.fn(),
      })
    );

    expect(result.current.usingInternalSocket).toBe(true);
    expect(result.current.interactionsDisabled).toBe(true);
  });

  test('disables interactions while socket lifecycle is resync_pending', () => {
    const socketClient = createSocketClient({
      connectionState: 'connected',
      lifecycleState: 'resync_pending',
    });
    useGameEventsMock.mockReturnValue(createGameEventsReturn());

    const { result } = renderHook(() =>
      useGameBoardBridge({
        socketClient,
        dispatchUIAction: vi.fn(),
      })
    );

    expect(result.current.interactionsDisabled).toBe(true);
  });

  test('enables interactions when lifecycle is authenticated', () => {
    const socketClient = createSocketClient({
      connectionState: 'connected',
      lifecycleState: 'authenticated',
    });
    useGameEventsMock.mockReturnValue(createGameEventsReturn());

    const { result } = renderHook(() =>
      useGameBoardBridge({
        socketClient,
        dispatchUIAction: vi.fn(),
      })
    );

    expect(result.current.interactionsDisabled).toBe(false);
  });

  test('forwards lifecycleState from socketClient', () => {
    const socketClient = createSocketClient({ lifecycleState: 'resync_pending' });
    useGameEventsMock.mockReturnValue(createGameEventsReturn());

    const { result } = renderHook(() =>
      useGameBoardBridge({
        socketClient,
        dispatchUIAction: vi.fn(),
      })
    );

    expect(result.current.lifecycleState).toBe('resync_pending');
  });

  test('returns authenticated lifecycleState when using injected ws', () => {
    const fakeWs: WebSocketLike = {
      send: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const socketClient = createSocketClient({ lifecycleState: 'reconnecting' });
    useGameEventsMock.mockReturnValue(createGameEventsReturn());

    const { result } = renderHook(() =>
      useGameBoardBridge({
        ws: fakeWs,
        socketClient,
        dispatchUIAction: vi.fn(),
      })
    );

    expect(result.current.lifecycleState).toBe('authenticated');
  });

  test('delegates command sending to event bridge when connected', () => {
    const sendCommand = vi.fn();
    const socketClient = createSocketClient({ connectionState: 'connected' });
    useGameEventsMock.mockReturnValue(createGameEventsReturn({ sendCommand }));

    const { result } = renderHook(() =>
      useGameBoardBridge({
        socketClient,
        dispatchUIAction: vi.fn(),
      })
    );

    act(() => {
      result.current.sendCommand({ DrawTile: { player: 'East' } });
    });

    expect(sendCommand).toHaveBeenCalledWith({ DrawTile: { player: 'East' } });
  });
});

describe('useGameBoardBridge ws decode path', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameEventsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createFakeWs(): WebSocketLike & {
    handlers: Map<string, Array<(e: MessageEvent) => void>>;
    emit: (type: string, data: string) => void;
  } {
    const handlers = new Map<string, Array<(e: MessageEvent) => void>>();
    return {
      handlers,
      send: vi.fn(),
      addEventListener(type: string, handler: (e: MessageEvent) => void) {
        if (!handlers.has(type)) handlers.set(type, []);
        handlers.get(type)!.push(handler);
      },
      removeEventListener(type: string, handler: (e: MessageEvent) => void) {
        const list = handlers.get(type);
        if (list)
          handlers.set(
            type,
            list.filter((h) => h !== handler)
          );
      },
      emit(type: string, data: string) {
        handlers.get(type)?.forEach((h) => h({ data } as MessageEvent));
      },
    };
  }

  test('forwards a valid decoded envelope to the subscribe listener', () => {
    const fakeWs = createFakeWs();
    const socketClient = createSocketClient();
    const listener = vi.fn();

    // Capture the subscribe call made by useGameEvents
    useGameEventsMock.mockImplementation(
      ({ socket }: { socket: { subscribe: typeof socketClient.subscribe } }) => {
        socket.subscribe('Event', listener);
        return createGameEventsReturn();
      }
    );

    renderHook(() =>
      useGameBoardBridge({
        ws: fakeWs,
        socketClient,
        dispatchUIAction: vi.fn(),
      })
    );

    const validMessage = JSON.stringify({
      kind: 'Event',
      payload: { event: { Public: { TileDrawn: { player: 'East' } } } },
    });

    act(() => {
      fakeWs.emit('message', validMessage);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    const received = listener.mock.calls[0][0];
    expect(received.kind).toBe('Event');
  });

  test('rejects malformed JSON and does not call the listener', () => {
    const fakeWs = createFakeWs();
    const socketClient = createSocketClient();
    const listener = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    useGameEventsMock.mockImplementation(
      ({ socket }: { socket: { subscribe: typeof socketClient.subscribe } }) => {
        socket.subscribe('Event', listener);
        return createGameEventsReturn();
      }
    );

    renderHook(() =>
      useGameBoardBridge({
        ws: fakeWs,
        socketClient,
        dispatchUIAction: vi.fn(),
      })
    );

    act(() => {
      fakeWs.emit('message', 'not valid json{{{');
    });

    expect(listener).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[WS] Rejected inbound message:',
      expect.any(String),
      undefined
    );

    warnSpy.mockRestore();
  });

  test('rejects a message with an unknown envelope kind and does not call the listener', () => {
    const fakeWs = createFakeWs();
    const socketClient = createSocketClient();
    const listener = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    useGameEventsMock.mockImplementation(
      ({ socket }: { socket: { subscribe: typeof socketClient.subscribe } }) => {
        socket.subscribe('Event', listener);
        return createGameEventsReturn();
      }
    );

    renderHook(() =>
      useGameBoardBridge({
        ws: fakeWs,
        socketClient,
        dispatchUIAction: vi.fn(),
      })
    );

    act(() => {
      fakeWs.emit('message', JSON.stringify({ kind: 'UnknownKind', payload: {} }));
    });

    expect(listener).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
