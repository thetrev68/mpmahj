import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMeldActions } from './useMeldActions';
import { buildMinimalSnapshot } from '@/test/fixtures';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { UIStateAction } from '@/lib/game-events/types';

function buildGameState(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  return buildMinimalSnapshot({
    your_seat: 'South',
    current_turn: 'South',
    phase: { Playing: { Discarding: { player: 'South' } } },
    players: [
      {
        seat: 'East',
        player_id: 'east',
        is_bot: false,
        status: 'Active',
        tile_count: 13,
        exposed_melds: [],
      },
      {
        seat: 'South',
        player_id: 'south',
        is_bot: false,
        status: 'Active',
        tile_count: 14,
        exposed_melds: [
          {
            meld_type: 'Quint',
            tiles: [5, 5, 5, 42, 42],
            called_tile: 5,
            joker_assignments: { 3: 5, 4: 6 },
          },
        ],
      },
      {
        seat: 'West',
        player_id: 'west',
        is_bot: false,
        status: 'Active',
        tile_count: 13,
        exposed_melds: [
          {
            meld_type: 'Quint',
            tiles: [11, 11, 11, 42, 42],
            called_tile: 11,
            joker_assignments: { 3: 11, 4: 12 },
          },
        ],
      },
      {
        seat: 'North',
        player_id: 'north',
        is_bot: false,
        status: 'Active',
        tile_count: 13,
        exposed_melds: [],
      },
    ],
    your_hand: [5, 11, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
    ...overrides,
  });
}

describe('useMeldActions', () => {
  it('computes exchangeable jokers for both opponent and local exposed melds', () => {
    const gameState = buildGameState();

    const { result } = renderHook(() =>
      useMeldActions({
        gameState,
        isDiscardingStage: true,
        isMyTurn: true,
        readOnly: false,
        isBusy: false,
        sendCommand: vi.fn(),
      })
    );

    expect(result.current.exchangeableJokersBySeat).toEqual({
      East: {},
      South: { 0: [3] },
      West: { 0: [3] },
      North: {},
    });
  });

  it('clicking a valid joker sets pendingExchangeOpportunity', () => {
    const gameState = buildGameState();

    const { result } = renderHook(() =>
      useMeldActions({
        gameState,
        isDiscardingStage: true,
        isMyTurn: true,
        readOnly: false,
        isBusy: false,
        sendCommand: vi.fn(),
      })
    );

    act(() => {
      result.current.handleJokerTileClick('West', 0, 3);
    });

    expect(result.current.pendingExchangeOpportunity).toEqual({
      targetSeat: 'West',
      meldIndex: 0,
      tilePosition: 3,
      representedTile: 11,
    });
  });

  it('confirm path prefers staged tiles before concealed hand', () => {
    const gameState = buildGameState({
      your_hand: [11, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    });
    const sendCommand = vi.fn();

    const { result } = renderHook(() =>
      useMeldActions({
        gameState,
        isDiscardingStage: true,
        isMyTurn: true,
        readOnly: false,
        isBusy: false,
        sendCommand,
      })
    );

    act(() => {
      result.current.handleJokerTileClick('West', 0, 3);
    });

    act(() => {
      result.current.handleConfirmExchange([11], [18, 19, 20]);
    });

    expect(sendCommand).toHaveBeenCalledWith({
      ExchangeJoker: {
        player: 'South',
        target_seat: 'West',
        meld_index: 0,
        replacement: 11,
      },
    });
    expect(result.current.jokerExchangeLoading).toBe(true);
    expect(result.current.inlineError).toBeNull();
  });

  it('falls back to concealed hand after excluding staged instances', () => {
    const gameState = buildGameState({
      your_hand: [11, 11, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
    });
    const sendCommand = vi.fn();

    const { result } = renderHook(() =>
      useMeldActions({
        gameState,
        isDiscardingStage: true,
        isMyTurn: true,
        readOnly: false,
        isBusy: false,
        sendCommand,
      })
    );

    act(() => {
      result.current.handleJokerTileClick('West', 0, 3);
    });

    act(() => {
      result.current.handleConfirmExchange([18], [11, 11, 19]);
    });

    expect(sendCommand).toHaveBeenCalledOnce();
  });

  it('shows inline error when no matching exchange tile is available', () => {
    const gameState = buildGameState();
    const sendCommand = vi.fn();

    const { result } = renderHook(() =>
      useMeldActions({
        gameState,
        isDiscardingStage: true,
        isMyTurn: true,
        readOnly: false,
        isBusy: false,
        sendCommand,
      })
    );

    act(() => {
      result.current.handleJokerTileClick('West', 0, 3);
    });

    act(() => {
      result.current.handleConfirmExchange([], [18, 19, 20]);
    });

    expect(sendCommand).not.toHaveBeenCalled();
    expect(result.current.inlineError).toBe("You don't have 3 Crack to exchange.");
    expect(result.current.jokerExchangeLoading).toBe(false);
  });

  it('closes the dialog on success ui action', () => {
    const gameState = buildGameState();

    const { result } = renderHook(() =>
      useMeldActions({
        gameState,
        isDiscardingStage: true,
        isMyTurn: true,
        readOnly: false,
        isBusy: false,
        sendCommand: vi.fn(),
      })
    );

    act(() => {
      result.current.handleJokerTileClick('West', 0, 3);
    });

    act(() => {
      const action: UIStateAction = {
        type: 'SET_JOKER_EXCHANGED',
        player: 'South',
        target_seat: 'West',
        joker: 42,
        replacement: 11,
      };
      result.current.handleUiAction(action);
    });

    expect(result.current.pendingExchangeOpportunity).toBeNull();
    expect(result.current.jokerExchangeLoading).toBe(false);
  });

  it('closes the dialog when turn ownership is lost', () => {
    const sendCommand = vi.fn();
    const { result, rerender } = renderHook(
      ({
        gameState,
        isDiscardingStage,
        isMyTurn,
      }: {
        gameState: GameStateSnapshot;
        isDiscardingStage: boolean;
        isMyTurn: boolean;
      }) =>
        useMeldActions({
          gameState,
          isDiscardingStage,
          isMyTurn,
          readOnly: false,
          isBusy: false,
          sendCommand,
        }),
      {
        initialProps: {
          gameState: buildGameState(),
          isDiscardingStage: true,
          isMyTurn: true,
        },
      }
    );

    act(() => {
      result.current.handleJokerTileClick('West', 0, 3);
    });

    rerender({
      gameState: buildGameState({
        current_turn: 'West',
        phase: { Playing: { Discarding: { player: 'West' } } },
      }),
      isDiscardingStage: false,
      isMyTurn: false,
    });

    expect(result.current.pendingExchangeOpportunity).toBeNull();
  });

  it('closes the dialog in read-only mode and removes affordances when busy', () => {
    const sendCommand = vi.fn();
    const { result, rerender } = renderHook(
      ({ readOnly, isBusy }: { readOnly: boolean; isBusy: boolean }) =>
        useMeldActions({
          gameState: buildGameState(),
          isDiscardingStage: true,
          isMyTurn: true,
          readOnly,
          isBusy,
          sendCommand,
        }),
      {
        initialProps: { readOnly: false, isBusy: false },
      }
    );

    act(() => {
      result.current.handleJokerTileClick('West', 0, 3);
    });

    rerender({ readOnly: true, isBusy: false });
    expect(result.current.pendingExchangeOpportunity).toBeNull();

    rerender({ readOnly: false, isBusy: true });
    expect(result.current.exchangeableJokersBySeat.West).toEqual({});
  });
});
