/**
 * Event Handler Type Definitions
 *
 * Pure function types for handling WebSocket game events.
 * Handlers return declarative actions (state updates, UI changes, side effects)
 * rather than executing them directly, enabling testability and composability.
 */

import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { GameResult } from '@/types/bindings/generated/GameResult';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { PassDirection } from '@/types/bindings/generated/PassDirection';
import type { SetupStage } from '@/types/bindings/generated/SetupStage';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { TimerMode } from '@/types/bindings/generated/TimerMode';
import type { CallResolution } from '@/types/bindings/generated/CallResolution';
import type { CallTieBreakReason } from '@/types/bindings/generated/CallTieBreakReason';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { MeldType } from '@/types/bindings/generated/MeldType';
import type { MoveHistorySummary } from '@/types/bindings/generated/MoveHistorySummary';
import type { HistoryMode } from '@/types/bindings/generated/HistoryMode';
import type { HintData } from '@/types/bindings/generated/HintData';

/**
 * State updater function for game state.
 * Takes the previous server snapshot and returns the next snapshot (or null).
 *
 * NOTE: As of Phase 1 slice 1.2, useGameEvents calls deriveClientGameView() after
 * applying all updaters, so the public state returned from the hook is ClientGameState.
 * The updater signature remains GameStateSnapshot | null so existing handlers and
 * test fixtures do not need to change.
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
  | { type: 'SET_OPPONENT_STAGED_COUNT'; seat: Seat; count: number }
  | { type: 'CLEAR_OPPONENT_STAGED_COUNTS' }
  | { type: 'SET_HAS_SUBMITTED_PASS'; value: boolean }
  | { type: 'SET_CHARLESTON_TIMER'; timer: CharlestonTimer | null }
  | { type: 'SET_TIMER_REMAINING_SECONDS'; value: number | null }
  | { type: 'SET_INCOMING_FROM_SEAT'; seat: Seat | null }
  | { type: 'SET_BOT_PASS_MESSAGE'; message: string | null }
  | { type: 'SET_PASS_DIRECTION'; direction: PassDirection | null }
  | {
      type: 'SET_STAGED_INCOMING';
      payload: {
        tiles: Tile[];
        from: Seat | null;
        context: import('@/types/bindings/generated/IncomingContext').IncomingContext;
      };
    }
  | { type: 'FLIP_STAGED_TILE'; tileId: string }
  | { type: 'ABSORB_STAGED_TILE'; tileId: string }
  | { type: 'SET_STAGED_OUTGOING'; tileIds: string[] }
  | { type: 'CLEAR_STAGING' }
  | { type: 'SET_HIGHLIGHTED_TILE_IDS'; ids: string[] }
  | { type: 'SET_LEAVING_TILE_IDS'; ids: string[] }
  // Courtesy pass UI (US-007)
  | { type: 'SET_COURTESY_PARTNER_PROPOSAL'; count: number }
  | { type: 'SET_COURTESY_AGREEMENT'; count: number }
  | { type: 'SET_COURTESY_MISMATCH'; partnerProposal: number; agreedCount: number }
  | { type: 'SET_COURTESY_ZERO' }
  | { type: 'RESET_COURTESY_STATE' }
  // Charleston voting UI
  | { type: 'SET_HAS_SUBMITTED_VOTE'; value: boolean }
  | { type: 'SET_MY_VOTE'; vote: CharlestonVote | null }
  | { type: 'SET_VOTED_PLAYERS'; value: Seat[] }
  | { type: 'ADD_VOTED_PLAYER'; seat: Seat }
  | { type: 'SET_VOTE_RESULT'; result: CharlestonVote | null }
  | { type: 'SET_VOTE_BREAKDOWN'; breakdown: Partial<Record<Seat, CharlestonVote>> | null }
  | { type: 'SET_SHOW_VOTE_RESULT_OVERLAY'; value: boolean }
  | { type: 'SET_BOT_VOTE_MESSAGE'; message: string | null }
  // Playing phase UI
  | { type: 'SET_CURRENT_TURN'; seat: Seat }
  | { type: 'SET_TURN_STAGE'; stage: TurnStage }
  | { type: 'SET_IS_PROCESSING'; value: boolean }
  | { type: 'SET_STAGED_INCOMING_DRAW_TILE'; tileId: string; tile: Tile }
  | { type: 'SET_MOST_RECENT_DISCARD'; tile: number | null }
  | { type: 'SET_DISCARD_ANIMATION_TILE'; tile: number | null }
  | { type: 'OPEN_CALL_WINDOW'; params: OpenCallWindowParams }
  | { type: 'UPDATE_CALL_WINDOW_PROGRESS'; canAct: Seat[]; intents: CallIntentSummary[] }
  | { type: 'CLOSE_CALL_WINDOW' }
  | { type: 'MARK_CALL_WINDOW_RESPONDED'; message?: string }
  | { type: 'SET_CALL_WINDOW_TIMER'; remaining: number | null }
  | { type: 'SHOW_RESOLUTION_OVERLAY'; data: ResolutionOverlayData }
  | { type: 'DISMISS_RESOLUTION_OVERLAY' }
  // IOU overlay
  | {
      type: 'SET_IOU_STATE';
      state: {
        active: boolean;
        debts: Array<[Seat, number]>;
        resolved: boolean;
        summary?: string;
      } | null;
    }
  | { type: 'RESOLVE_IOU'; summary: string }
  | { type: 'CLEAR_IOU' }
  // Error/message handling
  | { type: 'SET_ERROR_MESSAGE'; message: string | null }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'CLEAR_SELECTION_ERROR' }
  // Retry state clears
  | { type: 'CLEAR_PENDING_VOTE_RETRY' }
  | { type: 'CLEAR_PENDING_DRAW_RETRY' }
  // Playing phase lifecycle
  | { type: 'RESET_PLAYING_STATE' }
  | { type: 'CLEAR_STAGED_INCOMING_DRAW_TILE' }
  // Mahjong declaration / end-game (US-018)
  | { type: 'SET_MAHJONG_DECLARED'; player: Seat }
  | { type: 'SET_MAHJONG_VALIDATED'; player: Seat; valid: boolean; pattern: string | null }
  | { type: 'SET_HAND_DECLARED_DEAD'; player: Seat; reason: string }
  | { type: 'SET_GAME_OVER'; winner: Seat | null; result: GameResult }
  | { type: 'SET_HEAVENLY_HAND'; pattern: string; base_score: number }
  // US-019: Called discard Mahjong validation
  | { type: 'SET_AWAITING_MAHJONG_VALIDATION'; caller: Seat; calledTile: Tile; discardedBy: Seat }
  | { type: 'SET_CALLED_FROM'; discardedBy: Seat }
  // US-020: Dead hand / player skipped
  | { type: 'SET_PLAYER_SKIPPED'; player: Seat; reason: string }
  | { type: 'SET_PLAYER_FORFEITED'; player: Seat; reason: string | null }
  // US-021: Wall game / draw
  | { type: 'SET_WALL_EXHAUSTED'; remaining_tiles: number }
  | { type: 'SET_GAME_ABANDONED'; reason: string }
  // US-014/015: Joker exchange
  | {
      type: 'SET_JOKER_EXCHANGED';
      player: Seat;
      target_seat: Seat;
      joker: Tile;
      replacement: Tile;
    }
  // US-016: Meld upgrade
  | { type: 'SET_MELD_UPGRADED'; player: Seat; meld_index: number; new_meld_type: MeldType };

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
 * Call window opening parameters
 */
export interface OpenCallWindowParams {
  tile: number;
  discardedBy: Seat;
  canCall: Seat[];
  timerDuration: number;
  timerStart: number;
}

/**
 * Call resolution overlay data
 */
export interface ResolutionOverlayData {
  resolution: CallResolution;
  tieBreak: CallTieBreakReason | null;
  allCallers: CallIntentSummary[];
  discardedBy: Seat;
}

/**
 * Narrow notification union for the surviving `server-event` channel.
 *
 * This is intentionally limited to the event variants currently consumed by
 * hinting and history features. It replaces the old raw server-event rebroadcast.
 */
export type ServerEventNotification =
  | { type: 'hint-update'; hint: HintData }
  | { type: 'history-list'; entries: MoveHistorySummary[] }
  | { type: 'history-error'; message: string }
  | { type: 'history-truncated'; fromMove: number }
  | {
      type: 'state-restored';
      moveNumber: number;
      description: string;
      mode: HistoryMode;
    }
  | { type: 'undo-requested'; requester: Seat; targetMove: number }
  | { type: 'undo-vote-registered'; voter: Seat; approved: boolean }
  | { type: 'undo-request-resolved'; approved: boolean }
  | { type: 'history-move-tile-discarded'; player: Seat; tile: Tile }
  | { type: 'history-move-call-window-opened'; tile: Tile; discardedBy: Seat }
  | { type: 'history-move-call-window-closed' }
  | { type: 'history-move-tiles-passing'; direction: PassDirection };

/**
 * Side effects that handlers can declare
 * These are executed by the SideEffectManager after state updates
 */
export type SideEffect =
  | {
      type: 'TIMEOUT';
      id: string;
      ms: number;
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
 * Empty result (no actions)
 */
export const EMPTY_RESULT: EventHandlerResult = {
  stateUpdates: [],
  uiActions: [],
  sideEffects: [],
};
