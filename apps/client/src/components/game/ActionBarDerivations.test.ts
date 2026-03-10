import { describe, expect, test } from 'vitest';
import {
  canDiscardSelectedTile,
  canSubmitCharlestonPass,
  canSubmitCharlestonVote,
  canSubmitCourtesyPass,
  getCharlestonVoteChoice,
  getCharlestonVoteWaitingMessage,
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

    test('evaluates charleston vote eligibility and inferred vote choice', () => {
      expect(canSubmitCharlestonVote(0, false, false)).toBe(true);
      expect(canSubmitCharlestonVote(3, false, false)).toBe(true);
      expect(canSubmitCharlestonVote(1, false, false)).toBe(false);
      expect(canSubmitCharlestonVote(3, true, false)).toBe(false);
      expect(canSubmitCharlestonVote(0, false, true)).toBe(false);

      expect(getCharlestonVoteChoice(0)).toBe('Stop');
      expect(getCharlestonVoteChoice(3)).toBe('Continue');
      expect(getCharlestonVoteChoice(2)).toBeNull();
      expect(getCharlestonVoteWaitingMessage(['East', 'South', 'West'])).toBe(
        'Waiting for North...'
      );
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
        'Charleston. Select 3 tiles to pass left, then press Proceed.'
      );
      expect(getInstructionText({ Charleston: 'VotingToContinue' }, 'South', 0)).toBe(
        'Round vote. Stage 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready.'
      );
      // courtesyPassCount (4th arg) drives the copy, not selectedCount
      expect(getInstructionText({ Charleston: 'CourtesyAcross' }, 'South', 0, 2)).toBe(
        'Courtesy pass. Select 2 tiles for your across partner, then press Proceed.'
      );
      expect(getInstructionText({ Charleston: 'CourtesyAcross' }, 'South', 0, 1)).toBe(
        'Courtesy pass. Select 1 tile for your across partner, then press Proceed.'
      );
      // falls back to selectedCount when courtesyPassCount is omitted
      expect(getInstructionText({ Charleston: 'CourtesyAcross' }, 'South', 3)).toBe(
        'Courtesy pass. Select 3 tiles for your across partner, then press Proceed.'
      );
    });

    test('returns playing instruction for drawing and discarding turns', () => {
      expect(getInstructionText({ Playing: { Drawing: { player: 'South' } } }, 'South', 0)).toBe(
        'Drawing tile...'
      );
      expect(getInstructionText({ Playing: { Discarding: { player: 'South' } } }, 'South', 0)).toBe(
        'Select 1 tile to discard, then press Proceed. If you are Mahjong, press Mahjong.'
      );
      expect(getInstructionText({ Playing: { Discarding: { player: 'West' } } }, 'South', 0)).toBe(
        'Waiting for West to discard.'
      );
    });
  });
});
