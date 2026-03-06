import { describe, expect, test } from 'vitest';
import {
  canDiscardSelectedTile,
  canSubmitCharlestonPass,
  canSubmitCourtesyPass,
  getActionBarPhaseMeta,
} from './ActionBarDerivations';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';

describe('ActionBarDerivations', () => {
  describe('getActionBarPhaseMeta', () => {
    test('disables forfeit outside playing and in call window', () => {
      const setup: GamePhase = { Setup: 'RollingDice' };
      const charleston: GamePhase = { Charleston: 'FirstLeft' };
      const playingDiscard: GamePhase = { Playing: { Discarding: { player: 'South' } } };
      const callWindow: GamePhase = {
        Playing: {
          CallWindow: {
            tile: 1,
            discarded_by: 'East',
            can_act: ['South'],
            pending_intents: [],
            timer: 10,
          },
        },
      };

      expect(getActionBarPhaseMeta(setup, 'South').canForfeit).toBe(false);
      expect(getActionBarPhaseMeta(charleston, 'South').canForfeit).toBe(false);
      expect(getActionBarPhaseMeta(playingDiscard, 'South').canForfeit).toBe(true);
      expect(getActionBarPhaseMeta(callWindow, 'South').canForfeit).toBe(false);
    });

    test('marks critical phase only for current player turn or callable window', () => {
      const drawingMine: GamePhase = { Playing: { Drawing: { player: 'South' } } };
      const drawingOther: GamePhase = { Playing: { Drawing: { player: 'West' } } };
      const callWindowCanAct: GamePhase = {
        Playing: {
          CallWindow: {
            tile: 1,
            discarded_by: 'East',
            can_act: ['South'],
            pending_intents: [],
            timer: 10,
          },
        },
      };
      const callWindowCannotAct: GamePhase = {
        Playing: {
          CallWindow: {
            tile: 1,
            discarded_by: 'East',
            can_act: ['West'],
            pending_intents: [],
            timer: 10,
          },
        },
      };

      expect(getActionBarPhaseMeta(drawingMine, 'South').isCriticalPhase).toBe(true);
      expect(getActionBarPhaseMeta(drawingOther, 'South').isCriticalPhase).toBe(false);
      expect(getActionBarPhaseMeta(callWindowCanAct, 'South').isCriticalPhase).toBe(true);
      expect(getActionBarPhaseMeta(callWindowCannotAct, 'South').isCriticalPhase).toBe(false);
    });
  });

  describe('eligibility helpers', () => {
    test('evaluates charleston pass based on selected + blind count and busy/submitted state', () => {
      expect(
        canSubmitCharlestonPass({
          selectedTilesCount: 1,
          blindPassCount: 2,
          hasSubmittedPass: false,
          isBusy: false,
        })
      ).toBe(true);
      expect(
        canSubmitCharlestonPass({
          selectedTilesCount: 2,
          blindPassCount: 0,
          hasSubmittedPass: false,
          isBusy: false,
        })
      ).toBe(false);
      expect(
        canSubmitCharlestonPass({
          selectedTilesCount: 3,
          blindPassCount: 0,
          hasSubmittedPass: true,
          isBusy: false,
        })
      ).toBe(false);
      expect(
        canSubmitCharlestonPass({
          selectedTilesCount: 3,
          blindPassCount: 0,
          hasSubmittedPass: false,
          isBusy: true,
        })
      ).toBe(false);
    });

    test('evaluates courtesy pass and discard selection constraints', () => {
      expect(
        canSubmitCourtesyPass({
          selectedTilesCount: 2,
          courtesyPassCount: 2,
          isBusy: false,
        })
      ).toBe(true);
      expect(
        canSubmitCourtesyPass({
          selectedTilesCount: 1,
          courtesyPassCount: 2,
          isBusy: false,
        })
      ).toBe(false);
      expect(
        canSubmitCourtesyPass({
          selectedTilesCount: 2,
          courtesyPassCount: 2,
          isBusy: true,
        })
      ).toBe(false);

      expect(canDiscardSelectedTile(1, false)).toBe(true);
      expect(canDiscardSelectedTile(0, false)).toBe(false);
      expect(canDiscardSelectedTile(2, false)).toBe(false);
      expect(canDiscardSelectedTile(1, true)).toBe(false);
    });
  });
});
