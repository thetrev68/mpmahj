/**
 * Tests for useCharlestonState Hook
 *
 * Tests the Charleston phase state management hook using React Testing Library's renderHook
 */

import { describe, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCharlestonState } from './useCharlestonState';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { TimerMode } from '@/types/bindings/generated/TimerMode';

describe('useCharlestonState', () => {
  describe('initial state', () => {
    test('returns correct initial state', () => {
      const { result } = renderHook(() => useCharlestonState());

      expect(result.current.readyPlayers).toEqual([]);
      expect(result.current.hasSubmittedPass).toBe(false);
      expect(result.current.selectionError).toBeNull();
      expect(result.current.timer).toBeNull();
      expect(result.current.timerRemaining).toBeNull();
      expect(result.current.voting.hasSubmitted).toBe(false);
      expect(result.current.voting.myVote).toBeNull();
      expect(result.current.voting.votedPlayers).toEqual([]);
      expect(result.current.voting.result).toBeNull();
      expect(result.current.voting.breakdown).toBeNull();
      expect(result.current.voting.showResultOverlay).toBe(false);
      expect(result.current.messages.botPass).toBeNull();
      expect(result.current.messages.botVote).toBeNull();
      expect(result.current.messages.error).toBeNull();
    });
  });

  describe('reset()', () => {
    test('clears all state to initial values', () => {
      const { result } = renderHook(() => useCharlestonState());

      // Set various state values
      act(() => {
        result.current.markPlayerReady('East');
        result.current.markPlayerReady('South');
        result.current.submitPass();
        result.current.setTimer({
          stage: 'FirstRight' as CharlestonStage,
          durationSeconds: 30,
          startedAtMs: Date.now(),
          expiresAtMs: Date.now() + 30000,
          mode: 'Visible' as TimerMode,
        });
        result.current.setTimerRemaining(25);
        result.current.submitVote('Continue');
        result.current.markPlayerVoted('West');
        result.current.setVoteResult('Continue', {
          East: 'Continue',
          South: 'Continue',
          West: 'Stop',
          North: 'Continue',
        });
        result.current.setBotPassMessage('Test bot message');
        result.current.setBotVoteMessage('Test vote message');
        result.current.setErrorMessage('Test error');
      });

      // Verify state was set
      expect(result.current.readyPlayers).toContain('East');
      expect(result.current.hasSubmittedPass).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify all state cleared
      expect(result.current.readyPlayers).toEqual([]);
      expect(result.current.hasSubmittedPass).toBe(false);
      expect(result.current.selectionError).toBeNull();
      expect(result.current.timer).toBeNull();
      expect(result.current.timerRemaining).toBeNull();
      expect(result.current.voting.hasSubmitted).toBe(false);
      expect(result.current.voting.myVote).toBeNull();
      expect(result.current.voting.votedPlayers).toEqual([]);
      expect(result.current.voting.result).toBeNull();
      expect(result.current.voting.breakdown).toBeNull();
      expect(result.current.voting.showResultOverlay).toBe(false);
      expect(result.current.messages.botPass).toBeNull();
      expect(result.current.messages.botVote).toBeNull();
      expect(result.current.messages.error).toBeNull();
    });
  });

  describe('markPlayerReady()', () => {
    test('adds player to readyPlayers list', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.markPlayerReady('East');
      });

      expect(result.current.readyPlayers).toEqual(['East']);
    });

    test('adds multiple players in order', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.markPlayerReady('East');
        result.current.markPlayerReady('South');
        result.current.markPlayerReady('West');
      });

      expect(result.current.readyPlayers).toEqual(['East', 'South', 'West']);
    });

    test('does not add duplicate players', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.markPlayerReady('East');
        result.current.markPlayerReady('East');
      });

      expect(result.current.readyPlayers).toEqual(['East']);
    });
  });

  describe('submitPass()', () => {
    test('sets hasSubmittedPass to true', () => {
      const { result } = renderHook(() => useCharlestonState());

      expect(result.current.hasSubmittedPass).toBe(false);

      act(() => {
        result.current.submitPass();
      });

      expect(result.current.hasSubmittedPass).toBe(true);
    });
  });

  describe('setTimer()', () => {
    test('sets timer state', () => {
      const { result } = renderHook(() => useCharlestonState());

      const timer = {
        stage: 'FirstRight' as CharlestonStage,
        durationSeconds: 30,
        startedAtMs: 1000,
        expiresAtMs: 31000,
        mode: 'Visible' as TimerMode,
      };

      act(() => {
        result.current.setTimer(timer);
      });

      expect(result.current.timer).toEqual(timer);
    });

    test('clears timer when null', () => {
      const { result } = renderHook(() => useCharlestonState());

      const timer = {
        stage: 'FirstRight' as CharlestonStage,
        durationSeconds: 30,
        startedAtMs: 1000,
        expiresAtMs: 31000,
        mode: 'Visible' as TimerMode,
      };

      act(() => {
        result.current.setTimer(timer);
      });

      expect(result.current.timer).toEqual(timer);

      act(() => {
        result.current.setTimer(null);
      });

      expect(result.current.timer).toBeNull();
    });
  });

  describe('setTimerRemaining()', () => {
    test('updates timer remaining seconds', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.setTimerRemaining(15);
      });

      expect(result.current.timerRemaining).toBe(15);
    });

    test('clears remaining when null', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.setTimerRemaining(15);
        result.current.setTimerRemaining(null);
      });

      expect(result.current.timerRemaining).toBeNull();
    });
  });

  describe('voting state', () => {
    test('submitVote() sets vote and marks submitted', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.submitVote('Continue');
      });

      expect(result.current.voting.hasSubmitted).toBe(true);
      expect(result.current.voting.myVote).toBe('Continue');
    });

    test('markPlayerVoted() adds player to votedPlayers', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.markPlayerVoted('East');
        result.current.markPlayerVoted('South');
      });

      expect(result.current.voting.votedPlayers).toEqual(['East', 'South']);
    });

    test('markPlayerVoted() does not add duplicates', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.markPlayerVoted('East');
        result.current.markPlayerVoted('East');
      });

      expect(result.current.voting.votedPlayers).toEqual(['East']);
    });

    test('setVoteResult() sets result and breakdown', () => {
      const { result } = renderHook(() => useCharlestonState());

      const breakdown: Record<Seat, CharlestonVote> = {
        East: 'Continue',
        South: 'Continue',
        West: 'Stop',
        North: 'Continue',
      };

      act(() => {
        result.current.setVoteResult('Continue', breakdown);
      });

      expect(result.current.voting.result).toBe('Continue');
      expect(result.current.voting.breakdown).toEqual(breakdown);
      expect(result.current.voting.showResultOverlay).toBe(true);
    });

    test('dismissVoteResult() hides overlay but keeps result', () => {
      const { result } = renderHook(() => useCharlestonState());

      const breakdown: Record<Seat, CharlestonVote> = {
        East: 'Continue',
        South: 'Continue',
        West: 'Stop',
        North: 'Continue',
      };

      act(() => {
        result.current.setVoteResult('Continue', breakdown);
      });

      expect(result.current.voting.showResultOverlay).toBe(true);

      act(() => {
        result.current.dismissVoteResult();
      });

      expect(result.current.voting.showResultOverlay).toBe(false);
      expect(result.current.voting.result).toBe('Continue'); // Result preserved
      expect(result.current.voting.breakdown).toEqual(breakdown); // Breakdown preserved
    });
  });

  describe('message state', () => {
    test('setBotPassMessage() sets bot pass message', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.setBotPassMessage('East (Bot) has passed tiles.');
      });

      expect(result.current.messages.botPass).toBe('East (Bot) has passed tiles.');
    });

    test('setBotPassMessage(null) clears message', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.setBotPassMessage('Test message');
        result.current.setBotPassMessage(null);
      });

      expect(result.current.messages.botPass).toBeNull();
    });

    test('setBotVoteMessage() sets bot vote message', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.setBotVoteMessage('West (Bot) has voted');
      });

      expect(result.current.messages.botVote).toBe('West (Bot) has voted');
    });

    test('setBotVoteMessage(null) clears message', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.setBotVoteMessage('Test message');
        result.current.setBotVoteMessage(null);
      });

      expect(result.current.messages.botVote).toBeNull();
    });

    test('setErrorMessage() sets error message', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.setErrorMessage('Invalid selection');
      });

      expect(result.current.messages.error).toBe('Invalid selection');
    });

    test('setErrorMessage(null) clears message', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.setErrorMessage('Test error');
        result.current.setErrorMessage(null);
      });

      expect(result.current.messages.error).toBeNull();
    });
  });

  describe('selectionError state', () => {
    test('can set selection error with tileId and message', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.setSelectionError({ tileId: 'tile-123', message: 'Cannot select Joker' });
      });

      expect(result.current.selectionError).toEqual({
        tileId: 'tile-123',
        message: 'Cannot select Joker',
      });
    });

    test('can clear selection error', () => {
      const { result } = renderHook(() => useCharlestonState());

      act(() => {
        result.current.setSelectionError({ tileId: 'tile-123', message: 'Cannot select Joker' });
        result.current.setSelectionError(null);
      });

      expect(result.current.selectionError).toBeNull();
    });
  });
});
