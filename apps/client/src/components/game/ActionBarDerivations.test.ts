import { describe, expect, test } from 'vitest';
import {
  canDiscardSelectedTile,
  canSubmitCharlestonPass,
  canSubmitCharlestonVote,
  canSubmitCourtesyPass,
  getCharlestonVoteChoice,
  getCharlestonVoteWaitingMessage,
  getCharlestonStatusText,
  getInstructionText,
  getActionBarPhaseMeta,
} from './ActionBarDerivations';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';

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

    test('evaluates courtesy pass proposal/submission and discard selection constraints', () => {
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
      expect(
        canSubmitCourtesyPass({
          selectedTilesCount: 0,
          isBusy: false,
        })
      ).toBe(true);
      expect(
        canSubmitCourtesyPass({
          selectedTilesCount: 3,
          isBusy: false,
        })
      ).toBe(true);

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

  describe('getCharlestonStatusText', () => {
    const baseVoteOptions = { hasSubmittedVote: false, votedPlayers: [] as Seat[] };

    test('returns stage-specific text for standard pass stages before and after submit', () => {
      expect(getCharlestonStatusText('FirstRight', { ...baseVoteOptions })).toBe(
        'Charleston — Pass right'
      );
      expect(
        getCharlestonStatusText('FirstRight', { ...baseVoteOptions, hasSubmittedPass: true })
      ).toBe('Charleston — Passing right, waiting for tiles');

      expect(getCharlestonStatusText('FirstAcross', { ...baseVoteOptions })).toBe(
        'Charleston — Pass across'
      );
      expect(
        getCharlestonStatusText('FirstAcross', { ...baseVoteOptions, hasSubmittedPass: true })
      ).toBe('Charleston — Passing across, waiting for tiles');

      expect(getCharlestonStatusText('SecondLeft', { ...baseVoteOptions })).toBe(
        'Charleston — Pass left'
      );
      expect(
        getCharlestonStatusText('SecondLeft', { ...baseVoteOptions, hasSubmittedPass: true })
      ).toBe('Charleston — Passing left, waiting for tiles');

      expect(getCharlestonStatusText('SecondAcross', { ...baseVoteOptions })).toBe(
        'Charleston — Pass across'
      );
      expect(
        getCharlestonStatusText('SecondAcross', { ...baseVoteOptions, hasSubmittedPass: true })
      ).toBe('Charleston — Passing across, waiting for tiles');
    });

    test('returns blind-pass text for FirstLeft and SecondRight without leaking tile identity', () => {
      expect(getCharlestonStatusText('FirstLeft', { ...baseVoteOptions })).toBe(
        'Charleston Blind Pass — Select tiles to pass left'
      );
      expect(
        getCharlestonStatusText('FirstLeft', { ...baseVoteOptions, hasSubmittedPass: true })
      ).toBe('Charleston Blind Pass — Waiting for resolution');

      expect(getCharlestonStatusText('SecondRight', { ...baseVoteOptions })).toBe(
        'Charleston Blind Pass — Select tiles to pass right'
      );
      expect(
        getCharlestonStatusText('SecondRight', { ...baseVoteOptions, hasSubmittedPass: true })
      ).toBe('Charleston Blind Pass — Waiting for resolution');
    });

    test('returns voting-stage text based on vote state', () => {
      expect(getCharlestonStatusText('VotingToContinue', { ...baseVoteOptions })).toBe(
        'Charleston vote — Continue or stop'
      );
      expect(
        getCharlestonStatusText('VotingToContinue', {
          hasSubmittedVote: true,
          myVote: 'Stop',
          votedPlayers: ['South'],
        })
      ).toBe('You voted to STOP — waiting for other players');
      expect(
        getCharlestonStatusText('VotingToContinue', {
          hasSubmittedVote: true,
          myVote: 'Continue',
          votedPlayers: ['South'],
        })
      ).toBe('You voted to CONTINUE — waiting for other players');
      expect(
        getCharlestonStatusText('VotingToContinue', {
          hasSubmittedVote: false,
          votedPlayers: ['East', 'South', 'West'],
          totalPlayers: 4,
        })
      ).toBe('Waiting for North...');
      // Partial votes still pending → waiting message takes priority over count
      expect(
        getCharlestonStatusText('VotingToContinue', {
          hasSubmittedVote: false,
          votedPlayers: ['East', 'South'],
          totalPlayers: 4,
        })
      ).toBe('Waiting for West, North...');
      // All players voted → count is shown (waiting message is null when count >= total)
      expect(
        getCharlestonStatusText('VotingToContinue', {
          hasSubmittedVote: false,
          votedPlayers: ['East', 'South', 'West', 'North'],
          totalPlayers: 4,
        })
      ).toBe('4/4 players voted');
    });

    test('returns courtesy-pass text before and after submit', () => {
      expect(getCharlestonStatusText('CourtesyAcross', { ...baseVoteOptions })).toBe(
        'Charleston — Courtesy pass'
      );
      expect(
        getCharlestonStatusText('CourtesyAcross', { ...baseVoteOptions, hasSubmittedPass: true })
      ).toBe('Charleston — Courtesy pass submitted');
    });
  });

  describe('getInstructionText', () => {
    test('returns setup rolling instruction for East and wait copy for others', () => {
      expect(getInstructionText({ Setup: 'RollingDice' }, 'East')).toBe(
        'Roll dice to start the game'
      );
      expect(getInstructionText({ Setup: 'RollingDice' }, 'South')).toBe(
        'Waiting for East to roll dice'
      );
    });

    test('returns charleston instruction copy, including fixed courtesy guidance', () => {
      expect(getInstructionText({ Charleston: 'FirstLeft' }, 'South')).toBe(
        'Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed.'
      );
      expect(getInstructionText({ Charleston: 'SecondRight' }, 'South')).toBe(
        'Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed.'
      );
      expect(getInstructionText({ Charleston: 'VotingToContinue' }, 'South')).toBe(
        'Round vote. Stage up to 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready.'
      );
      expect(getInstructionText({ Charleston: 'CourtesyAcross' }, 'South')).toBe(
        'Select 0–3 tiles to pass across, then press Proceed.'
      );
      expect(getInstructionText({ Charleston: 'CourtesyAcross' }, 'South')).toBe(
        'Select 0–3 tiles to pass across, then press Proceed.'
      );
    });

    test('returns playing instruction for drawing and discarding turns', () => {
      expect(getInstructionText({ Playing: { Drawing: { player: 'South' } } }, 'South')).toBe(
        'Drawing tile...'
      );
      expect(getInstructionText({ Playing: { Discarding: { player: 'South' } } }, 'South')).toBe(
        'Select 1 tile to discard, then press Proceed. If you are Mahjong, press Mahjong.'
      );
      expect(getInstructionText({ Playing: { Discarding: { player: 'West' } } }, 'South')).toBe(
        'Waiting for West to discard.'
      );
      expect(
        getInstructionText(
          {
            Playing: {
              CallWindow: {
                tile: 5,
                discarded_by: 'East',
                can_act: ['South'],
                pending_intents: [],
                timer: 10,
              },
            },
          },
          'South',
          '5 Dot was discarded by East. Press Proceed to skip, or stage matching tiles and press Proceed to claim. If you are Mahjong, press Mahjong.'
        )
      ).toContain('Press Proceed to skip');
    });
  });
});
