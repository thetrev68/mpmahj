import { describe, expect, test } from 'vitest';
import {
  canDiscardSelectedTile,
  canSubmitCharlestonPass,
  canSubmitCourtesyPass,
  getInstructionText,
  getActionBarPhaseMeta,
} from './ActionBarDerivations';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';

describe('ActionBarDerivations', () => {
  describe('getActionBarPhaseMeta', () => {
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

  describe('getInstructionText', () => {
    test('returns setup rolling instruction for East and wait copy for others', () => {
      expect(getInstructionText({ Setup: 'RollingDice' }, 'East', 0)).toBe(
        'Roll dice to start the game'
      );
      expect(getInstructionText({ Setup: 'RollingDice' }, 'South', 0)).toBe(
        'Waiting for East to roll dice'
      );
    });

    test('returns charleston instruction with target courtesy count, not selection count', () => {
      expect(getInstructionText({ Charleston: 'FirstLeft' }, 'South', 0)).toBe(
        'Select 3 tiles to pass'
      );
      // courtesyPassCount (4th arg) drives the copy, not selectedCount
      expect(getInstructionText({ Charleston: 'CourtesyAcross' }, 'South', 0, 2)).toBe(
        'Select 2 tiles for courtesy pass'
      );
      expect(getInstructionText({ Charleston: 'CourtesyAcross' }, 'South', 0, 1)).toBe(
        'Select 1 tile for courtesy pass'
      );
      // falls back to selectedCount when courtesyPassCount is omitted
      expect(getInstructionText({ Charleston: 'CourtesyAcross' }, 'South', 3)).toBe(
        'Select 3 tiles for courtesy pass'
      );
    });

    test('returns playing instruction for drawing and discarding turns', () => {
      expect(getInstructionText({ Playing: { Drawing: { player: 'South' } } }, 'South', 0)).toBe(
        'Drawing tile...'
      );
      expect(getInstructionText({ Playing: { Discarding: { player: 'South' } } }, 'South', 0)).toBe(
        'Select a tile to discard'
      );
      expect(getInstructionText({ Playing: { Discarding: { player: 'West' } } }, 'South', 0)).toBe(
        "West's turn to discard"
      );
    });
  });
});
