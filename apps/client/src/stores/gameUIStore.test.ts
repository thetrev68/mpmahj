/**
 * Tests for gameUIStore
 *
 * Verifies that dispatch() correctly applies UIStateAction to store state.
 * Representative coverage: one test per major action group plus edge cases.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { useGameUIStore } from './gameUIStore';

function getState() {
  return useGameUIStore.getState();
}

describe('gameUIStore', () => {
  beforeEach(() => {
    useGameUIStore.getState().reset();
  });

  // ── Initial state ──────────────────────────────────────────────────────

  test('initial state is clean', () => {
    const s = getState();
    expect(s.diceRoll).toBeNull();
    expect(s.callWindow).toBeNull();
    expect(s.readyPlayers).toEqual([]);
    expect(s.errorMessage).toBeNull();
    expect(s.gameOver).toBeNull();
  });

  // ── Setup ──────────────────────────────────────────────────────────────

  test('SET_DICE_ROLL updates diceRoll', () => {
    useGameUIStore.getState().dispatch({ type: 'SET_DICE_ROLL', value: 6 });
    expect(getState().diceRoll).toBe(6);
  });

  test('SET_SHOW_DICE_OVERLAY updates showDiceOverlay', () => {
    useGameUIStore.getState().dispatch({ type: 'SET_SHOW_DICE_OVERLAY', value: true });
    expect(getState().showDiceOverlay).toBe(true);
  });

  test('SET_SETUP_PHASE updates setupPhase', () => {
    useGameUIStore.getState().dispatch({ type: 'SET_SETUP_PHASE', phase: 'RollingDice' });
    expect(getState().setupPhase).toBe('RollingDice');
  });

  // ── Charleston pass tracking ───────────────────────────────────────────

  test('ADD_READY_PLAYER appends unique seat', () => {
    useGameUIStore.getState().dispatch({ type: 'ADD_READY_PLAYER', seat: 'East' });
    useGameUIStore.getState().dispatch({ type: 'ADD_READY_PLAYER', seat: 'East' }); // duplicate
    useGameUIStore.getState().dispatch({ type: 'ADD_READY_PLAYER', seat: 'West' });
    expect(getState().readyPlayers).toEqual(['East', 'West']);
  });

  test('SET_READY_PLAYERS replaces the list', () => {
    useGameUIStore.getState().dispatch({ type: 'ADD_READY_PLAYER', seat: 'East' });
    useGameUIStore.getState().dispatch({ type: 'SET_READY_PLAYERS', value: ['South', 'North'] });
    expect(getState().readyPlayers).toEqual(['South', 'North']);
  });

  test('SET_HAS_SUBMITTED_PASS updates flag', () => {
    useGameUIStore.getState().dispatch({ type: 'SET_HAS_SUBMITTED_PASS', value: true });
    expect(getState().hasSubmittedPass).toBe(true);
    useGameUIStore.getState().dispatch({ type: 'SET_HAS_SUBMITTED_PASS', value: false });
    expect(getState().hasSubmittedPass).toBe(false);
  });

  test('RESET_CHARLESTON_STATE clears pass-related fields', () => {
    useGameUIStore.getState().dispatch({ type: 'ADD_READY_PLAYER', seat: 'East' });
    useGameUIStore.getState().dispatch({ type: 'SET_HAS_SUBMITTED_PASS', value: true });
    useGameUIStore.getState().dispatch({ type: 'SET_BOT_PASS_MESSAGE', message: 'hello' });
    useGameUIStore.getState().dispatch({ type: 'RESET_CHARLESTON_STATE' });
    const s = getState();
    expect(s.readyPlayers).toEqual([]);
    expect(s.hasSubmittedPass).toBe(false);
    expect(s.botPassMessage).toBeNull();
  });

  test('SET_OPPONENT_STAGED_COUNT and CLEAR_OPPONENT_STAGED_COUNTS', () => {
    useGameUIStore
      .getState()
      .dispatch({ type: 'SET_OPPONENT_STAGED_COUNT', seat: 'South', count: 2 });
    expect(getState().opponentStagedCounts).toEqual({ South: 2 });
    useGameUIStore.getState().dispatch({ type: 'CLEAR_OPPONENT_STAGED_COUNTS' });
    expect(getState().opponentStagedCounts).toEqual({});
  });

  test('SET_STAGING_INCOMING and CLEAR_STAGING', () => {
    useGameUIStore.getState().dispatch({
      type: 'SET_STAGED_INCOMING',
      payload: { stage: 'FirstLeft', tiles: [1, 2, 3], from: 'East', context: 'Charleston' },
    });
    expect(getState().stagedIncoming?.tiles).toEqual([1, 2, 3]);
    expect(getState().stagedIncoming?.absorbedTileIndexes).toEqual([]);
    useGameUIStore.getState().dispatch({ type: 'CLEAR_STAGING' });
    expect(getState().stagedIncoming).toBeNull();
  });

  // ── Courtesy pass ──────────────────────────────────────────────────────

  test('SET_COURTESY_MISMATCH stores mismatch data', () => {
    useGameUIStore.getState().dispatch({
      type: 'SET_COURTESY_MISMATCH',
      partnerProposal: 2,
      agreedCount: 1,
    });
    expect(getState().courtesyMismatch).toEqual({ partnerProposal: 2, agreedCount: 1 });
  });

  test('SET_COURTESY_AGREEMENT clears mismatch', () => {
    useGameUIStore.getState().dispatch({
      type: 'SET_COURTESY_MISMATCH',
      partnerProposal: 2,
      agreedCount: 1,
    });
    useGameUIStore.getState().dispatch({ type: 'SET_COURTESY_AGREEMENT', count: 2 });
    expect(getState().courtesyAgreement).toBe(2);
    expect(getState().courtesyMismatch).toBeNull();
  });

  test('RESET_COURTESY_STATE clears courtesy fields', () => {
    useGameUIStore.getState().dispatch({ type: 'SET_COURTESY_PARTNER_PROPOSAL', count: 3 });
    useGameUIStore.getState().dispatch({ type: 'RESET_COURTESY_STATE' });
    expect(getState().courtesyPartnerProposal).toBeNull();
    expect(getState().courtesyAgreement).toBeNull();
  });

  // ── Charleston voting ──────────────────────────────────────────────────

  test('ADD_VOTED_PLAYER appends unique seat', () => {
    useGameUIStore.getState().dispatch({ type: 'ADD_VOTED_PLAYER', seat: 'North' });
    useGameUIStore.getState().dispatch({ type: 'ADD_VOTED_PLAYER', seat: 'North' }); // duplicate
    useGameUIStore.getState().dispatch({ type: 'ADD_VOTED_PLAYER', seat: 'West' });
    expect(getState().votedPlayers).toEqual(['North', 'West']);
  });

  test('SET_VOTE_RESULT and SET_SHOW_VOTE_RESULT_OVERLAY', () => {
    useGameUIStore.getState().dispatch({ type: 'SET_VOTE_RESULT', result: 'Continue' });
    useGameUIStore.getState().dispatch({ type: 'SET_SHOW_VOTE_RESULT_OVERLAY', value: true });
    expect(getState().voteResult).toBe('Continue');
    expect(getState().showVoteResultOverlay).toBe(true);
  });

  // ── Playing phase ──────────────────────────────────────────────────────

  test('OPEN_CALL_WINDOW creates call window state', () => {
    useGameUIStore.getState().dispatch({
      type: 'OPEN_CALL_WINDOW',
      params: {
        tile: 5,
        discardedBy: 'South',
        canCall: ['East', 'West'],
        timerDuration: 10,
        timerStart: 1000,
      },
    });
    const cw = getState().callWindow;
    expect(cw).not.toBeNull();
    expect(cw?.tile).toBe(5);
    expect(cw?.responded).toBe(false);
    expect(cw?.canAct).toEqual(['East', 'West']);
    expect(cw?.intents).toEqual([]);
  });

  test('UPDATE_CALL_WINDOW_PROGRESS updates canAct and intents', () => {
    useGameUIStore.getState().dispatch({
      type: 'OPEN_CALL_WINDOW',
      params: {
        tile: 5,
        discardedBy: 'South',
        canCall: ['East', 'West'],
        timerDuration: 10,
        timerStart: 1000,
      },
    });
    useGameUIStore.getState().dispatch({
      type: 'UPDATE_CALL_WINDOW_PROGRESS',
      canAct: ['East'],
      intents: [{ seat: 'East', kind: { Meld: { meld_type: 'Pung' } } }],
    });
    expect(getState().callWindow?.canAct).toEqual(['East']);
    expect(getState().callWindow?.intents).toHaveLength(1);
  });

  test('UPDATE_CALL_WINDOW_PROGRESS is no-op when callWindow is null', () => {
    // Ensure no crash and state unchanged
    useGameUIStore.getState().dispatch({
      type: 'UPDATE_CALL_WINDOW_PROGRESS',
      canAct: ['East'],
      intents: [],
    });
    expect(getState().callWindow).toBeNull();
  });

  test('MARK_CALL_WINDOW_RESPONDED sets responded flag', () => {
    useGameUIStore.getState().dispatch({
      type: 'OPEN_CALL_WINDOW',
      params: {
        tile: 3,
        discardedBy: 'East',
        canCall: ['South'],
        timerDuration: 5,
        timerStart: 500,
      },
    });
    useGameUIStore.getState().dispatch({
      type: 'MARK_CALL_WINDOW_RESPONDED',
      message: 'Passed',
    });
    expect(getState().callWindow?.responded).toBe(true);
    expect(getState().callWindow?.respondedMessage).toBe('Passed');
  });

  test('CLOSE_CALL_WINDOW clears callWindow', () => {
    useGameUIStore.getState().dispatch({
      type: 'OPEN_CALL_WINDOW',
      params: {
        tile: 1,
        discardedBy: 'North',
        canCall: ['East'],
        timerDuration: 8,
        timerStart: 100,
      },
    });
    useGameUIStore.getState().dispatch({ type: 'CLOSE_CALL_WINDOW' });
    expect(getState().callWindow).toBeNull();
  });

  test('SHOW_RESOLUTION_OVERLAY and DISMISS_RESOLUTION_OVERLAY', () => {
    const data = {
      resolution: 'NoCall' as const,
      tieBreak: null,
      allCallers: [],
      discardedBy: 'South' as const,
    };
    useGameUIStore.getState().dispatch({ type: 'SHOW_RESOLUTION_OVERLAY', data });
    expect(getState().resolutionOverlay).not.toBeNull();
    useGameUIStore.getState().dispatch({ type: 'DISMISS_RESOLUTION_OVERLAY' });
    expect(getState().resolutionOverlay).toBeNull();
  });

  test('SET_IS_PROCESSING updates flag', () => {
    useGameUIStore.getState().dispatch({ type: 'SET_IS_PROCESSING', value: true });
    expect(getState().isProcessing).toBe(true);
  });

  test('SET_ERROR_MESSAGE and clear via null', () => {
    useGameUIStore.getState().dispatch({ type: 'SET_ERROR_MESSAGE', message: 'Oops' });
    expect(getState().errorMessage).toBe('Oops');
    useGameUIStore.getState().dispatch({ type: 'SET_ERROR_MESSAGE', message: null });
    expect(getState().errorMessage).toBeNull();
  });

  // ── IOU ───────────────────────────────────────────────────────────────

  test('SET_IOU_STATE, RESOLVE_IOU, CLEAR_IOU lifecycle', () => {
    useGameUIStore.getState().dispatch({
      type: 'SET_IOU_STATE',
      state: { active: true, debts: [['East', 1]], resolved: false, summary: undefined },
    });
    expect(getState().iouState?.active).toBe(true);

    useGameUIStore.getState().dispatch({ type: 'RESOLVE_IOU', summary: 'All settled' });
    expect(getState().iouState?.resolved).toBe(true);
    expect(getState().iouState?.summary).toBe('All settled');

    useGameUIStore.getState().dispatch({ type: 'CLEAR_IOU' });
    expect(getState().iouState).toBeNull();
  });

  test('SET_IOU_STATE with null clears iouState', () => {
    useGameUIStore.getState().dispatch({
      type: 'SET_IOU_STATE',
      state: { active: true, debts: [], resolved: false },
    });
    useGameUIStore.getState().dispatch({ type: 'SET_IOU_STATE', state: null });
    expect(getState().iouState).toBeNull();
  });

  // ── End-game ──────────────────────────────────────────────────────────

  test('SET_GAME_OVER stores winner and result', () => {
    const result = {
      winner: 'East' as const,
      winning_pattern: 'Test',
      score_breakdown: null,
      final_scores: {},
      final_hands: {},
      next_dealer: 'South' as const,
      end_condition: 'Win' as const,
    };
    useGameUIStore.getState().dispatch({ type: 'SET_GAME_OVER', winner: 'East', result });
    expect(getState().gameOver?.winner).toBe('East');
  });

  test('SET_HAND_DECLARED_DEAD accumulates entries', () => {
    useGameUIStore
      .getState()
      .dispatch({ type: 'SET_HAND_DECLARED_DEAD', player: 'South', reason: 'Discard' });
    useGameUIStore
      .getState()
      .dispatch({ type: 'SET_HAND_DECLARED_DEAD', player: 'West', reason: 'NoTiles' });
    expect(getState().deadHandPlayers).toHaveLength(2);
    expect(getState().deadHandPlayers[0].player).toBe('South');
  });

  test('SET_PLAYER_SKIPPED accumulates entries', () => {
    useGameUIStore
      .getState()
      .dispatch({ type: 'SET_PLAYER_SKIPPED', player: 'North', reason: 'Dead' });
    expect(getState().skippedPlayers).toHaveLength(1);
    expect(getState().skippedPlayers[0].player).toBe('North');
  });

  test('SET_WALL_EXHAUSTED stores remaining tiles', () => {
    useGameUIStore.getState().dispatch({ type: 'SET_WALL_EXHAUSTED', remaining_tiles: 2 });
    expect(getState().wallExhausted?.remaining_tiles).toBe(2);
  });

  test('SET_HEAVENLY_HAND stores pattern and score', () => {
    useGameUIStore.getState().dispatch({
      type: 'SET_HEAVENLY_HAND',
      pattern: 'All Bams',
      base_score: 500,
    });
    expect(getState().heavenlyHand?.pattern).toBe('All Bams');
    expect(getState().heavenlyHand?.base_score).toBe(500);
  });

  test('SET_CALLED_FROM stores calledFrom seat', () => {
    useGameUIStore.getState().dispatch({ type: 'SET_CALLED_FROM', discardedBy: 'West' });
    expect(getState().calledFrom).toBe('West');
  });

  // ── No-op actions ─────────────────────────────────────────────────────

  test('CLEAR_SELECTION is a no-op (handled by useTileSelection)', () => {
    // Should not throw and should not mutate any store field.
    expect(() => useGameUIStore.getState().dispatch({ type: 'CLEAR_SELECTION' })).not.toThrow();
  });

  test('ABSORB_STAGED_TILE records which blind tile was kept out of the outgoing bundle', () => {
    useGameUIStore.getState().dispatch({
      type: 'SET_STAGED_INCOMING',
      payload: { stage: 'FirstLeft', tiles: [1, 2, 3], from: null, context: 'Charleston' },
    });

    useGameUIStore.getState().dispatch({ type: 'ABSORB_STAGED_TILE', tileIndex: 2 });

    expect(getState().stagedIncoming?.absorbedTileIndexes).toEqual([2]);
  });

  test('SET_NEWLY_RECEIVED_TILES and CLEAR_NEWLY_RECEIVED_TILES update the rack-local handoff list', () => {
    useGameUIStore.getState().dispatch({ type: 'SET_NEWLY_RECEIVED_TILES', ids: ['1-0', '2-0'] });
    expect(getState().newlyReceivedTileIds).toEqual(['1-0', '2-0']);

    useGameUIStore.getState().dispatch({ type: 'CLEAR_NEWLY_RECEIVED_TILES' });
    expect(getState().newlyReceivedTileIds).toEqual([]);
  });

  // ── reset() ───────────────────────────────────────────────────────────

  test('reset() restores initial state', () => {
    useGameUIStore.getState().dispatch({ type: 'SET_DICE_ROLL', value: 4 });
    useGameUIStore.getState().dispatch({ type: 'SET_ERROR_MESSAGE', message: 'err' });
    useGameUIStore.getState().dispatch({ type: 'ADD_READY_PLAYER', seat: 'East' });
    useGameUIStore.getState().reset();
    const s = getState();
    expect(s.diceRoll).toBeNull();
    expect(s.errorMessage).toBeNull();
    expect(s.readyPlayers).toEqual([]);
  });
});
