import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useGameBoardBridge } from './useGameBoardBridge';
import type { UseGameSocketReturn } from '@/hooks/useGameSocket';
import type { UseGameEventsReturn } from '@/hooks/useGameEvents';

const useGameEventsMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useGameEvents', () => ({
  useGameEvents: useGameEventsMock,
}));

function createSocketClient(partial: Partial<UseGameSocketReturn> = {}): UseGameSocketReturn {
  return {
    connectionState: 'connected',
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

  test('requests state snapshot when connected in room with no game state', () => {
    const socketClient = createSocketClient();
    useGameEventsMock.mockReturnValue(createGameEventsReturn());

    renderHook(() =>
      useGameBoardBridge({
        socketClient,
        dispatchUIAction: vi.fn(),
        currentRoom: { room_id: 'room-1' },
      })
    );

    expect(socketClient.send).toHaveBeenCalledTimes(1);
    const sendMock = socketClient.send as unknown as { mock: { calls: unknown[][] } };
    const envelope = sendMock.mock.calls[0][0] as {
      kind: string;
      payload?: { command?: { RequestState?: { player?: string } } };
    };
    expect(envelope.kind).toBe('Command');
    expect(envelope.payload?.command?.RequestState?.player).toBe('East');
  });

  test('disables interactions when internal socket is disconnected', () => {
    const socketClient = createSocketClient({ connectionState: 'disconnected' });
    useGameEventsMock.mockReturnValue(createGameEventsReturn());

    const { result } = renderHook(() =>
      useGameBoardBridge({
        socketClient,
        dispatchUIAction: vi.fn(),
        currentRoom: null,
      })
    );

    expect(result.current.usingInternalSocket).toBe(true);
    expect(result.current.interactionsDisabled).toBe(true);
  });

  test('delegates command sending to event bridge when connected', () => {
    const sendCommand = vi.fn();
    const socketClient = createSocketClient({ connectionState: 'connected' });
    useGameEventsMock.mockReturnValue(createGameEventsReturn({ sendCommand }));

    const { result } = renderHook(() =>
      useGameBoardBridge({
        socketClient,
        dispatchUIAction: vi.fn(),
        currentRoom: null,
      })
    );

    act(() => {
      result.current.sendCommand({ DrawTile: { player: 'East' } });
    });

    expect(sendCommand).toHaveBeenCalledWith({ DrawTile: { player: 'East' } });
  });
});
