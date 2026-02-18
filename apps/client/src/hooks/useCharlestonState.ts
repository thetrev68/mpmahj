/**
 * useCharlestonState Hook
 *
 * Manages all Charleston phase state in a single, testable hook.
 * Extracted from GameBoard.tsx lines 144-171 as part of Phase 2 refactoring.
 *
 * Related: GAMEBOARD_REFACTORING_PLAN.md Phase 2
 */

import { useState, useCallback } from 'react';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { CharlestonTimer } from '@/lib/game-events/types';

/**
 * Selection error state
 */
export interface SelectionError {
  tileId: string;
  message: string;
}

/**
 * Voting state
 */
interface VotingState {
  hasSubmitted: boolean;
  myVote: CharlestonVote | null;
  votedPlayers: Seat[];
  result: CharlestonVote | null;
  breakdown: Record<Seat, CharlestonVote> | null;
  showResultOverlay: boolean;
}

/**
 * Message state
 */
interface MessageState {
  botPass: string | null;
  botVote: string | null;
  error: string | null;
}

/**
 * Charleston state return type
 */
export interface CharlestonState {
  // State
  readyPlayers: Seat[];
  hasSubmittedPass: boolean;
  selectionError: SelectionError | null;
  blindPassCount: number;
  timer: CharlestonTimer | null;
  timerRemaining: number | null;
  voting: VotingState;
  messages: MessageState;

  // Actions
  reset: () => void;
  markPlayerReady: (seat: Seat) => void;
  submitPass: () => void;
  setHasSubmittedPass: (value: boolean) => void;
  setBlindPassCount: (count: number) => void;
  setTimer: (timer: CharlestonTimer | null) => void;
  setTimerRemaining: (seconds: number | null) => void;
  submitVote: (vote: CharlestonVote) => void;
  markPlayerVoted: (seat: Seat) => void;
  setVoteResult: (result: CharlestonVote, breakdown: Record<Seat, CharlestonVote>) => void;
  dismissVoteResult: () => void;
  setBotPassMessage: (message: string | null) => void;
  setBotVoteMessage: (message: string | null) => void;
  setErrorMessage: (message: string | null) => void;
  setSelectionError: (error: SelectionError | null) => void;
}

/**
 * Custom hook for managing Charleston phase state
 *
 * Consolidates 15+ useState calls from GameBoard.tsx into a single,
 * testable state container with clear actions.
 *
 * @example
 * ```tsx
 * const charleston = useCharlestonState();
 *
 * // Mark player ready
 * charleston.markPlayerReady('East');
 *
 * // Submit vote
 * charleston.submitVote('Continue');
 *
 * // Reset on stage change
 * useEffect(() => {
 *   charleston.reset();
 * }, [stage]);
 * ```
 */
export function useCharlestonState(): CharlestonState {
  // Pass state
  const [readyPlayers, setReadyPlayers] = useState<Seat[]>([]);
  const [hasSubmittedPass, setHasSubmittedPass] = useState(false);
  const [selectionError, setSelectionError] = useState<SelectionError | null>(null);
  const [blindPassCount, setBlindPassCount] = useState(0);

  // Timer state
  const [timer, setTimer] = useState<CharlestonTimer | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);

  // Voting state
  const [hasSubmittedVote, setHasSubmittedVote] = useState(false);
  const [myVote, setMyVote] = useState<CharlestonVote | null>(null);
  const [votedPlayers, setVotedPlayers] = useState<Seat[]>([]);
  const [voteResult, setVoteResult] = useState<CharlestonVote | null>(null);
  const [voteBreakdown, setVoteBreakdown] = useState<Record<Seat, CharlestonVote> | null>(null);
  const [showVoteResultOverlay, setShowVoteResultOverlay] = useState(false);

  // Message state
  const [botPassMessage, setBotPassMessage] = useState<string | null>(null);
  const [botVoteMessage, setBotVoteMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Reset all state to initial values
   * Called when Charleston stage changes
   */
  const reset = useCallback(() => {
    setReadyPlayers([]);
    setHasSubmittedPass(false);
    setSelectionError(null);
    setBlindPassCount(0);
    setTimer(null);
    setTimerRemaining(null);
    setHasSubmittedVote(false);
    setMyVote(null);
    setVotedPlayers([]);
    setVoteResult(null);
    setVoteBreakdown(null);
    setShowVoteResultOverlay(false);
    setBotPassMessage(null);
    setBotVoteMessage(null);
    setErrorMessage(null);
  }, []);

  /**
   * Mark a player as ready (submitted their pass)
   * Prevents duplicates
   */
  const markPlayerReady = useCallback((seat: Seat) => {
    setReadyPlayers((prev) => {
      if (prev.includes(seat)) return prev;
      return [...prev, seat];
    });
  }, []);

  /**
   * Mark current player's pass as submitted
   */
  const submitPass = useCallback(() => {
    setHasSubmittedPass(true);
  }, []);

  const handleSetHasSubmittedPass = useCallback((value: boolean) => {
    setHasSubmittedPass(value);
  }, []);

  /**
   * Submit vote for Charleston continuation
   * Marks vote as submitted and records choice
   */
  const submitVote = useCallback((vote: CharlestonVote) => {
    setHasSubmittedVote(true);
    setMyVote(vote);
  }, []);

  /**
   * Mark a player as having voted
   * Prevents duplicates
   */
  const markPlayerVoted = useCallback((seat: Seat) => {
    setVotedPlayers((prev) => {
      if (prev.includes(seat)) return prev;
      return [...prev, seat];
    });
  }, []);

  /**
   * Set vote result and breakdown
   * Automatically shows result overlay
   */
  const handleSetVoteResult = useCallback(
    (result: CharlestonVote, breakdown: Record<Seat, CharlestonVote>) => {
      setVoteResult(result);
      setVoteBreakdown(breakdown);
      setShowVoteResultOverlay(true);
    },
    []
  );

  /**
   * Dismiss vote result overlay
   * Keeps result/breakdown data for reference
   */
  const dismissVoteResult = useCallback(() => {
    setShowVoteResultOverlay(false);
  }, []);

  return {
    // State
    readyPlayers,
    hasSubmittedPass,
    selectionError,
    blindPassCount,
    timer,
    timerRemaining,
    voting: {
      hasSubmitted: hasSubmittedVote,
      myVote,
      votedPlayers,
      result: voteResult,
      breakdown: voteBreakdown,
      showResultOverlay: showVoteResultOverlay,
    },
    messages: {
      botPass: botPassMessage,
      botVote: botVoteMessage,
      error: errorMessage,
    },

    // Actions
    reset,
    markPlayerReady,
    submitPass,
    setHasSubmittedPass: handleSetHasSubmittedPass,
    setBlindPassCount,
    setTimer,
    setTimerRemaining,
    submitVote,
    markPlayerVoted,
    setVoteResult: handleSetVoteResult,
    dismissVoteResult,
    setBotPassMessage,
    setBotVoteMessage,
    setErrorMessage,
    setSelectionError,
  };
}
