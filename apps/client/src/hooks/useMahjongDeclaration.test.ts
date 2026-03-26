import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMahjongDeclaration } from './useMahjongDeclaration';
import { buildMinimalSnapshot, gameStates } from '@/test/fixtures';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { UIStateAction } from '@/lib/game-events/types';

function setup(overrides?: Partial<GameStateSnapshot>) {
  const sendCommand = vi.fn();
  const setPlayingProcessing = vi.fn();
  const gameState = overrides
    ? buildMinimalSnapshot(overrides)
    : (gameStates.playingDiscarding as GameStateSnapshot);
  const hook = renderHook(() =>
    useMahjongDeclaration({ gameState, sendCommand, setPlayingProcessing })
  );
  return { ...hook, sendCommand, setPlayingProcessing, gameState };
}

describe('useMahjongDeclaration', () => {
  // ── Dialog lifecycle ────────────────────────────────────────────────

  it('opens and confirms mahjong dialog', () => {
    const { result, sendCommand, setPlayingProcessing, gameState } = setup();

    act(() => result.current.handleDeclareMahjong());
    expect(result.current.showMahjongDialog).toBe(true);

    act(() => {
      result.current.handleMahjongConfirm({
        DeclareMahjong: {
          player: gameState.your_seat,
          hand: { concealed: [], counts: [], exposed: [], joker_assignments: null },
          winning_tile: null,
        },
      });
    });

    expect(result.current.mahjongDialogLoading).toBe(true);
    expect(setPlayingProcessing).toHaveBeenCalledWith(true);
    expect(sendCommand).toHaveBeenCalled();
  });

  it('cancel resets dialog and loading state', () => {
    const { result } = setup();

    act(() => result.current.handleDeclareMahjong());
    expect(result.current.showMahjongDialog).toBe(true);

    act(() => result.current.handleMahjongCancel());
    expect(result.current.showMahjongDialog).toBe(false);
    expect(result.current.mahjongDialogLoading).toBe(false);
  });

  it('cancel after confirm clears loading state', () => {
    const { result, gameState } = setup();

    act(() => result.current.handleDeclareMahjong());
    act(() => {
      result.current.handleMahjongConfirm({
        DeclareMahjong: {
          player: gameState.your_seat,
          hand: { concealed: [], counts: [], exposed: [], joker_assignments: null },
          winning_tile: null,
        },
      });
    });
    expect(result.current.mahjongDialogLoading).toBe(true);

    act(() => result.current.handleMahjongCancel());
    expect(result.current.mahjongDialogLoading).toBe(false);
    expect(result.current.showMahjongDialog).toBe(false);
  });

  // ── Validation submit (called-discard flow) ─────────────────────────

  it('handleMahjongValidationSubmit sends command and sets loading', () => {
    const { result, sendCommand, setPlayingProcessing, gameState } = setup();

    const command = {
      DeclareMahjong: {
        player: gameState.your_seat,
        hand: { concealed: [], counts: [], exposed: [], joker_assignments: null },
        winning_tile: 5,
      },
    };

    act(() => result.current.handleMahjongValidationSubmit(command));

    expect(result.current.awaitingValidationLoading).toBe(true);
    expect(setPlayingProcessing).toHaveBeenCalledWith(true);
    expect(sendCommand).toHaveBeenCalledWith(command);
  });

  // ── UI Actions ──────────────────────────────────────────────────────

  describe('SET_MAHJONG_DECLARED', () => {
    it('sets declared message for announcing player', () => {
      const { result } = setup();

      act(() => {
        result.current.handleUiAction({ type: 'SET_MAHJONG_DECLARED', player: 'East' });
      });

      expect(result.current.mahjongDeclaredMessage).toBe('East is declaring Mahjong...');
    });
  });

  describe('SET_AWAITING_MAHJONG_VALIDATION', () => {
    it('stores called tile and discardedBy', () => {
      const { result } = setup();

      act(() => {
        result.current.handleUiAction({
          type: 'SET_AWAITING_MAHJONG_VALIDATION',
          caller: 'South',
          calledTile: 5,
          discardedBy: 'North',
        });
      });

      expect(result.current.awaitingMahjongValidation).toEqual({
        calledTile: 5,
        discardedBy: 'North',
      });
    });
  });

  describe('SET_MAHJONG_VALIDATED', () => {
    it('valid=true clears all loading, dialog, and message state', () => {
      const { result } = setup();

      // Set up state that validation should clear
      act(() => result.current.handleDeclareMahjong());
      act(() => {
        result.current.handleUiAction({ type: 'SET_MAHJONG_DECLARED', player: 'South' });
      });
      act(() => {
        result.current.handleUiAction({
          type: 'SET_AWAITING_MAHJONG_VALIDATION',
          caller: 'South',
          calledTile: 5,
          discardedBy: 'North',
        });
      });

      act(() => {
        result.current.handleUiAction({
          type: 'SET_MAHJONG_VALIDATED',
          player: 'South',
          valid: true,
          pattern: 'Consecutive Run',
        });
      });

      expect(result.current.mahjongDialogLoading).toBe(false);
      expect(result.current.awaitingValidationLoading).toBe(false);
      expect(result.current.awaitingMahjongValidation).toBeNull();
      expect(result.current.mahjongDeclaredMessage).toBeNull();
    });

    it('valid=false clears dialog, resets processing, sets dead hand notice', () => {
      const { result, setPlayingProcessing } = setup();

      act(() => result.current.handleDeclareMahjong());
      expect(result.current.showMahjongDialog).toBe(true);

      act(() => {
        result.current.handleUiAction({
          type: 'SET_MAHJONG_VALIDATED',
          player: 'South',
          valid: false,
          pattern: null,
        });
      });

      expect(result.current.showMahjongDialog).toBe(false);
      expect(result.current.mahjongDialogLoading).toBe(false);
      expect(setPlayingProcessing).toHaveBeenCalledWith(false);
      expect(result.current.deadHandNotice).toBe(
        'Invalid Mahjong - Hand does not match any pattern'
      );
    });
  });

  describe('SET_PLAYER_SKIPPED', () => {
    it('sets skip notice message', () => {
      const { result } = setup();

      act(() => {
        result.current.handleUiAction({
          type: 'SET_PLAYER_SKIPPED',
          player: 'North',
          reason: 'dead hand',
        });
      });

      expect(result.current.deadHandNotice).toBe("North's turn was skipped (dead hand)");
    });
  });

  // ── Dead hand state ─────────────────────────────────────────────────

  describe('SET_HAND_DECLARED_DEAD', () => {
    it('local player gets overlay and dead hand notice', () => {
      const { result, gameState } = setup();

      act(() => {
        result.current.handleUiAction({
          type: 'SET_HAND_DECLARED_DEAD',
          player: gameState.your_seat,
          reason: 'Invalid claim',
        });
      });

      expect(result.current.isDeadHand(gameState.your_seat)).toBe(true);
      expect(result.current.showDeadHandOverlay).toBe(true);
      expect(result.current.deadHandOverlayData).toEqual({
        player: gameState.your_seat,
        reason: 'Invalid claim',
      });
      expect(result.current.deadHandNotice).toBe(
        'You have a dead hand. You will be skipped for the rest of the game.'
      );
    });

    it('remote player does NOT get overlay', () => {
      const { result } = setup();

      act(() => {
        result.current.handleUiAction({
          type: 'SET_HAND_DECLARED_DEAD',
          player: 'North',
          reason: 'Incorrect meld',
        });
      });

      expect(result.current.isDeadHand('North')).toBe(true);
      expect(result.current.showDeadHandOverlay).toBe(false);
      expect(result.current.deadHandOverlayData).toBeNull();
      expect(result.current.deadHandNotice).toBe("North's hand is declared dead: Incorrect meld");
    });

    it('multiple dead hand declarations accumulate', () => {
      const { result } = setup();

      act(() => {
        result.current.handleUiAction({
          type: 'SET_HAND_DECLARED_DEAD',
          player: 'North',
          reason: 'Invalid claim',
        });
      });
      act(() => {
        result.current.handleUiAction({
          type: 'SET_HAND_DECLARED_DEAD',
          player: 'West',
          reason: 'Incorrect meld',
        });
      });

      expect(result.current.isDeadHand('North')).toBe(true);
      expect(result.current.isDeadHand('West')).toBe(true);
      expect(result.current.deadHandPlayers.size).toBe(2);
    });

    it('duplicate dead hand for same player does not grow the Set', () => {
      const { result } = setup();

      act(() => {
        result.current.handleUiAction({
          type: 'SET_HAND_DECLARED_DEAD',
          player: 'North',
          reason: 'Invalid claim',
        });
      });
      act(() => {
        result.current.handleUiAction({
          type: 'SET_HAND_DECLARED_DEAD',
          player: 'North',
          reason: 'Different reason',
        });
      });

      expect(result.current.deadHandPlayers.size).toBe(1);
    });
  });

  // ── Overlay visibility control ──────────────────────────────────────

  it('setDeadHandOverlayVisible can dismiss the overlay', () => {
    const { result, gameState } = setup();

    act(() => {
      result.current.handleUiAction({
        type: 'SET_HAND_DECLARED_DEAD',
        player: gameState.your_seat,
        reason: 'Invalid claim',
      });
    });
    expect(result.current.showDeadHandOverlay).toBe(true);

    act(() => result.current.setDeadHandOverlayVisible(false));
    expect(result.current.showDeadHandOverlay).toBe(false);
    // Data preserved even after dismiss
    expect(result.current.deadHandOverlayData).not.toBeNull();
  });

  // ── Unhandled actions ───────────────────────────────────────────────

  it('handleUiAction returns false for unhandled action types', () => {
    const { result } = setup();

    let returned: boolean | undefined;
    act(() => {
      returned = result.current.handleUiAction({
        type: 'SET_DICE_ROLL',
        values: [3, 4],
      } as unknown as UIStateAction);
    });

    expect(returned).toBe(false);
  });

  // ── Initial state from snapshot ─────────────────────────────────────

  it('initializes dead players from snapshot player status', () => {
    const { result } = setup({
      players: [
        {
          seat: 'East',
          player_id: 'p-east',
          is_bot: false,
          status: 'Dead',
          tile_count: 13,
          exposed_melds: [],
        },
        {
          seat: 'South',
          player_id: 'p-south',
          is_bot: false,
          status: 'Active',
          tile_count: 14,
          exposed_melds: [],
        },
        {
          seat: 'West',
          player_id: 'p-west',
          is_bot: true,
          status: 'Active',
          tile_count: 13,
          exposed_melds: [],
        },
        {
          seat: 'North',
          player_id: 'p-north',
          is_bot: true,
          status: 'Dead',
          tile_count: 13,
          exposed_melds: [],
        },
      ],
    });

    expect(result.current.isDeadHand('East')).toBe(true);
    expect(result.current.isDeadHand('North')).toBe(true);
    expect(result.current.isDeadHand('South')).toBe(false);
    expect(result.current.isDeadHand('West')).toBe(false);
    expect(result.current.deadHandPlayers.size).toBe(2);
  });
});
