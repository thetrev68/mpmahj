import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useHistoryData, getActionCategory, getActionLabel } from './useHistoryData';
import type { ServerEventNotification } from '@/lib/game-events/types';

function createEventBus() {
  const listeners = new Set<(event: ServerEventNotification) => void>();

  return {
    onServerEvent: (handler: (event: ServerEventNotification) => void) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
    emit: (event: ServerEventNotification) => {
      listeners.forEach((handler) => handler(event));
    },
  };
}

describe('useHistoryData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests history when opened and stores HistoryList entries', () => {
    const sendCommand = vi.fn();
    const eventBus = createEventBus();

    const { result } = renderHook(() =>
      useHistoryData({
        isOpen: true,
        mySeat: 'East',
        sendCommand,
        eventBus,
      })
    );

    // The hook defers the initial request via setTimeout(fn, 0); flush it.
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(sendCommand).toHaveBeenCalledWith({ RequestHistory: { player: 'East' } });

    const historyEvent: ServerEventNotification = {
      type: 'history-list',
      entries: [
        {
          move_number: 1,
          timestamp: '2026-02-10T12:00:00Z',
          seat: 'South',
          action: { DiscardTile: { tile: 18 } },
          description: 'Discarded 1 Dot',
        },
      ],
    };

    act(() => {
      eventBus.emit(historyEvent);
    });

    expect(result.current.moves).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('retries history request up to three attempts when no response arrives', () => {
    const sendCommand = vi.fn();
    const eventBus = createEventBus();

    const { result } = renderHook(() =>
      useHistoryData({
        isOpen: true,
        mySeat: 'North',
        sendCommand,
        eventBus,
      })
    );

    // Flush the 0ms bootstrap timer so the first request fires.
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(sendCommand).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(sendCommand).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(sendCommand).toHaveBeenCalledTimes(3);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(sendCommand).toHaveBeenCalledTimes(3);
    expect(result.current.error).toBe('Failed to load history. Retrying...');
    expect(result.current.isLoading).toBe(false);
  });

  it('applies player, action, and search filters', () => {
    const sendCommand = vi.fn();
    const eventBus = createEventBus();

    const { result } = renderHook(() =>
      useHistoryData({
        isOpen: true,
        mySeat: 'East',
        sendCommand,
        eventBus,
      })
    );

    act(() => {
      eventBus.emit({
        type: 'history-list',
        entries: [
          {
            move_number: 1,
            timestamp: '2026-02-10T12:00:00Z',
            seat: 'East',
            action: { DiscardTile: { tile: 18 } },
            description: 'Discarded 1 Dot',
          },
          {
            move_number: 2,
            timestamp: '2026-02-10T12:01:00Z',
            seat: 'South',
            action: { DrawTile: { tile: 20, visible: false } },
            description: 'Drew tile from wall',
          },
        ],
      });
    });

    expect(result.current.filteredMoves).toHaveLength(2);

    act(() => {
      result.current.setPlayerFilter('East');
    });
    expect(result.current.filteredMoves).toHaveLength(1);

    act(() => {
      result.current.setPlayerFilter('All');
      result.current.toggleActionFilter('Draw');
    });
    expect(result.current.filteredMoves).toHaveLength(1);
    expect(result.current.filteredMoves[0].seat).toBe('South');

    act(() => {
      result.current.setSearchQuery('wall');
    });
    expect(result.current.filteredMoves).toHaveLength(1);
  });

  it('appends real-time TileDiscarded events as new history moves', () => {
    const sendCommand = vi.fn();
    const eventBus = createEventBus();

    const { result } = renderHook(() =>
      useHistoryData({
        isOpen: true,
        mySeat: 'West',
        sendCommand,
        eventBus,
      })
    );

    act(() => {
      eventBus.emit({
        type: 'history-list',
        entries: [
          {
            move_number: 20,
            timestamp: '2026-02-10T12:00:00Z',
            seat: 'East',
            action: { DiscardTile: { tile: 18 } },
            description: 'Discarded 1 Dot',
          },
        ],
      });
    });

    act(() => {
      eventBus.emit({
        type: 'history-move-tile-discarded',
        player: 'South',
        tile: 19,
      });
    });

    expect(result.current.moves).toHaveLength(2);
    expect(result.current.moves[1].move_number).toBe(21);
    expect(result.current.pulsingMoveNumber).toBe(21);
  });
});

describe('useHistoryData helpers', () => {
  it('maps action categories and labels', () => {
    expect(getActionCategory({ DiscardTile: { tile: 10 } })).toBe('Discard');
    expect(getActionCategory({ PassTiles: { direction: 'Across', count: 3 } })).toBe('Charleston');
    expect(getActionLabel({ CallWindowOpened: { tile: 5 } })).toBe('Call Window Opened');
    expect(getActionLabel('PauseGame')).toBe('Pause Game');
  });
});
