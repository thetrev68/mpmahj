/**
 * Event Handler Type Definitions
 *
 * Pure function types for handling WebSocket game events.
 * Handlers return declarative actions (state updates, UI changes, side effects)
 * rather than executing them directly, enabling testability and composability.
 */

import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { PassDirection } from '@/types/bindings/generated/PassDirection';
import type { SetupStage } from '@/types/bindings/generated/SetupStage';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { TimerMode } from '@/types/bindings/generated/TimerMode';

/**
 * State updater function for GameState
 * Takes previous state, returns new state (or null if unchanged)
 */
export type StateUpdater = (prev: GameStateSnapshot | null) => GameStateSnapshot | null;

/**
 * UI state actions that handlers can declare
 * Covers all UI state mutations (dice roll, overlays, timers, etc.)
 */
export type UIStateAction =
  // Setup phase UI
  | { type: 'SET_DICE_ROLL'; value: number }
  | { type: 'SET_SHOW_DICE_OVERLAY'; value: boolean }
  | { type: 'SET_SETUP_PHASE'; phase: SetupStage }
  // Charleston UI
  | { type: 'RESET_CHARLESTON_STATE' }
  | { type: 'SET_READY_PLAYERS'; value: Seat[] }
  | { type: 'ADD_READY_PLAYER'; seat: Seat }
  | { type: 'SET_HAS_SUBMITTED_PASS'; value: boolean }
  | { type: 'SET_CHARLESTON_TIMER'; timer: CharlestonTimer | null }
  | { type: 'SET_TIMER_REMAINING_SECONDS'; value: number | null }
  | { type: 'SET_INCOMING_FROM_SEAT'; seat: Seat | null }
  | { type: 'SET_BOT_PASS_MESSAGE'; message: string | null }
  | { type: 'SET_PASS_DIRECTION'; direction: PassDirection | null }
  | { type: 'SET_BLIND_PASS_COUNT'; count: number }
  | { type: 'SET_HIGHLIGHTED_TILE_IDS'; ids: string[] }
  | { type: 'SET_LEAVING_TILE_IDS'; ids: string[] }
  // Charleston voting UI
  | { type: 'SET_HAS_SUBMITTED_VOTE'; value: boolean }
  | { type: 'SET_MY_VOTE'; vote: CharlestonVote | null }
  | { type: 'SET_VOTED_PLAYERS'; value: Seat[] }
  | { type: 'ADD_VOTED_PLAYER'; seat: Seat }
  | { type: 'SET_VOTE_RESULT'; result: CharlestonVote | null }
  | { type: 'SET_VOTE_BREAKDOWN'; breakdown: Record<Seat, CharlestonVote> | null }
  | { type: 'SET_SHOW_VOTE_RESULT_OVERLAY'; value: boolean }
  | { type: 'SET_BOT_VOTE_MESSAGE'; message: string | null }
  // Playing phase UI
  | { type: 'SET_CURRENT_TURN'; seat: Seat }
  | { type: 'SET_TURN_STAGE'; stage: TurnStage }
  // Error/message handling
  | { type: 'SET_ERROR_MESSAGE'; message: string | null }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'CLEAR_SELECTION_ERROR' };

/**
 * Charleston timer state
 */
export interface CharlestonTimer {
  stage: CharlestonStage;
  durationSeconds: number;
  startedAtMs: number;
  expiresAtMs: number;
  mode: TimerMode;
}

/**
 * Side effects that handlers can declare
 * These are executed by the SideEffectManager after state updates
 */
export type SideEffect =
  | {
      type: 'TIMEOUT';
      id: string;
      ms: number;
      callback: () => void;
    }
  | {
      type: 'CLEAR_TIMEOUT';
      id: string;
    }
  | {
      type: 'PLAY_SOUND';
      sound: string;
    };

/**
 * Result returned by event handlers
 * Contains declarative actions to be executed by the event bridge
 */
export interface EventHandlerResult {
  /** Game state updates (applied to gameState via setState) */
  stateUpdates: StateUpdater[];
  /** UI state actions (dispatched to UI state management) */
  uiActions: UIStateAction[];
  /** Side effects (timeouts, sounds, etc.) */
  sideEffects: SideEffect[];
}

/**
 * Context provided to event handlers
 * Keep this minimal to avoid coupling
 */
export interface EventContext {
  /** Current game state (from server) */
  gameState: GameStateSnapshot | null;
}

/**
 * Empty result (no actions)
 */
export const EMPTY_RESULT: EventHandlerResult = {
  stateUpdates: [],
  uiActions: [],
  sideEffects: [],
};
