import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayingPhaseStoreBridge } from './usePlayingPhaseStoreBridge';
import { useGameUIStore } from '@/stores/gameUIStore';
import type { UIStateAction } from '@/lib/game-events/types';

function dispatch(action: UIStateAction) {
  act(() => {
    useGameUIStore.getState().dispatch(action);
  });
}

describe('usePlayingPhaseStoreBridge', () => {
  beforeEach(() => {
    useGameUIStore.getState().reset();
    vi.clearAllMocks();
  });

  function createBaseOptions() {
    return {
      animations: {
        setIncomingFromSeat: vi.fn(),
        setHighlightedTileIds: vi.fn(),
        setLeavingTileIds: vi.fn(),
      },
      autoDraw: {
        clearPendingDrawRetry: vi.fn(),
      },
      clearSelection: vi.fn(),
      historyPlayback: {
        clearPendingUndoOnError: vi.fn(),
      },
      incomingAnimationDurationMs: 1500,
      isDiscardingStage: true,
      isTileMovementEnabled: true,
      mahjong: {
        handleUiAction: vi.fn(),
      },
      meldActions: {
        handleUiAction: vi.fn(),
      },
      playing: {
        discardAnimationTile: null,
        stagedIncomingTile: null,
        setDiscardAnimation: vi.fn(),
        setStagedIncomingTile: vi.fn(),
      },
    };
  }

  it('uses the latest clearSelection callback for CLEAR_SELECTION signals', () => {
    const base = createBaseOptions();
    const clearSelectionA = vi.fn();
    const clearSelectionB = vi.fn();

    const { rerender } = renderHook(
      ({ clearSelection }: { clearSelection: () => void }) =>
        usePlayingPhaseStoreBridge({
          ...base,
          clearSelection,
        }),
      {
        initialProps: { clearSelection: clearSelectionA },
      }
    );

    dispatch({ type: 'CLEAR_SELECTION' });
    expect(clearSelectionA).toHaveBeenCalledTimes(1);

    rerender({ clearSelection: clearSelectionB });
    dispatch({ type: 'CLEAR_SELECTION' });

    expect(clearSelectionA).toHaveBeenCalledTimes(1);
    expect(clearSelectionB).toHaveBeenCalledTimes(1);
  });

  it('forwards dead-hand entries in append order without replaying already-processed entries', () => {
    const base = createBaseOptions();
    const mahjongHandleUiAction = vi.fn();

    renderHook(() =>
      usePlayingPhaseStoreBridge({
        ...base,
        mahjong: { handleUiAction: mahjongHandleUiAction },
      })
    );

    dispatch({ type: 'SET_HAND_DECLARED_DEAD', player: 'East', reason: 'Dead hand 1' });
    dispatch({ type: 'SET_HAND_DECLARED_DEAD', player: 'West', reason: 'Dead hand 2' });

    expect(mahjongHandleUiAction).toHaveBeenNthCalledWith(1, {
      type: 'SET_HAND_DECLARED_DEAD',
      player: 'East',
      reason: 'Dead hand 1',
    });
    expect(mahjongHandleUiAction).toHaveBeenNthCalledWith(2, {
      type: 'SET_HAND_DECLARED_DEAD',
      player: 'West',
      reason: 'Dead hand 2',
    });

    dispatch({ type: 'SET_HAND_DECLARED_DEAD', player: 'North', reason: 'Dead hand 3' });

    expect(mahjongHandleUiAction).toHaveBeenCalledTimes(3);
    expect(mahjongHandleUiAction).toHaveBeenLastCalledWith({
      type: 'SET_HAND_DECLARED_DEAD',
      player: 'North',
      reason: 'Dead hand 3',
    });
  });

  it('uses the latest mahjong handler when processing store actions after rerender', () => {
    const base = createBaseOptions();
    const firstMahjongHandler = vi.fn();
    const secondMahjongHandler = vi.fn();

    const { rerender } = renderHook(
      ({ handleUiAction }: { handleUiAction: (action: UIStateAction) => void }) =>
        usePlayingPhaseStoreBridge({
          ...base,
          mahjong: { handleUiAction },
        }),
      {
        initialProps: { handleUiAction: firstMahjongHandler },
      }
    );

    rerender({ handleUiAction: secondMahjongHandler });
    dispatch({ type: 'SET_MAHJONG_DECLARED', player: 'South' });

    expect(firstMahjongHandler).not.toHaveBeenCalled();
    expect(secondMahjongHandler).toHaveBeenCalledWith({
      type: 'SET_MAHJONG_DECLARED',
      player: 'South',
    });
  });
});
