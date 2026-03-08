/**
 * Game UI Store
 *
 * Single authoritative owner for all transient game UI state.
 *
 * Introduced in Phase 4, slice 4.1 of the frontend refactor.
 * Replaces the custom `ui-action` event-bus rebroadcast pattern with a
 * direct Zustand store so UI state has one read site and one write site.
 *
 * Consumers:
 * - `useGameEvents` writes here via `dispatch(action)` on every UIStateAction.
 * - Phase components and overlays will read from here (migration in slices 4.2–4.4).
 *
 * Design constraints:
 * - Do not merge with `roomStore` — game UI concerns are scoped to the active game session.
 * - Do not store server-owned snapshot fields here; those live in the server snapshot and
 *   `ClientGameState`. `SET_CURRENT_TURN` / `SET_TURN_STAGE` are stored to allow future
 *   reads without reaching into the server snapshot, but are currently secondary to it.
 * - `FLIP_STAGED_TILE` and `ABSORB_STAGED_TILE` mutate component-local tile instances and
 *   remain no-ops in the store until the component migration is complete (slices 4.3–4.4).
 * - `CLEAR_SELECTION`, `CLEAR_SELECTION_ERROR`, `CLEAR_PENDING_VOTE_RETRY`,
 *   `CLEAR_PENDING_DRAW_RETRY` are handled by specific local hooks; they are no-ops here
 *   until those hooks are migrated.
 */

import { create } from 'zustand';
import type {
  UIStateAction,
  CharlestonTimer,
  OpenCallWindowParams,
  ResolutionOverlayData,
} from '@/lib/game-events/types';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { PassDirection } from '@/types/bindings/generated/PassDirection';
import type { SetupStage } from '@/types/bindings/generated/SetupStage';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameResult } from '@/types/bindings/generated/GameResult';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { MeldType } from '@/types/bindings/generated/MeldType';
import type { IncomingContext } from '@/types/bindings/generated/IncomingContext';

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

/** Active call window state. Null when no call window is open. */
export interface CallWindowUIState extends OpenCallWindowParams {
  responded: boolean;
  respondedMessage: string | undefined;
  /** Players who have not yet passed — updated by UPDATE_CALL_WINDOW_PROGRESS. */
  canAct: Seat[];
  /** Accumulated call intents — updated by UPDATE_CALL_WINDOW_PROGRESS. */
  intents: CallIntentSummary[];
  /** Timer countdown (seconds remaining), updated by SET_CALL_WINDOW_TIMER. */
  timerRemaining: number | null;
}

/** IOU overlay state for Charleston blind-pass debts. */
export interface IouUIState {
  active: boolean;
  debts: Array<[Seat, number]>;
  resolved: boolean;
  summary: string | undefined;
}

// ---------------------------------------------------------------------------
// Full state shape
// ---------------------------------------------------------------------------

export interface GameUIState {
  // ── Setup phase ────────────────────────────────────────────────────────
  diceRoll: number | null;
  showDiceOverlay: boolean;
  setupPhase: SetupStage | null;

  // ── Charleston – pass tracking ─────────────────────────────────────────
  readyPlayers: Seat[];
  hasSubmittedPass: boolean;
  charlestonTimer: CharlestonTimer | null;
  timerRemainingSeconds: number | null;
  incomingFromSeat: Seat | null;
  botPassMessage: string | null;
  passDirection: PassDirection | null;
  stagedIncoming: { tiles: Tile[]; from: Seat | null; context: IncomingContext } | null;
  stagedOutgoingIds: string[];
  highlightedTileIds: string[];
  leavingTileIds: string[];
  opponentStagedCounts: Partial<Record<Seat, number>>;

  // ── Courtesy pass (US-007) ─────────────────────────────────────────────
  courtesyPartnerProposal: number | null;
  courtesyAgreement: number | null;
  courtesyMismatch: { partnerProposal: number; agreedCount: number } | null;

  // ── Charleston voting ──────────────────────────────────────────────────
  hasSubmittedVote: boolean;
  myVote: CharlestonVote | null;
  votedPlayers: Seat[];
  voteResult: CharlestonVote | null;
  voteBreakdown: Partial<Record<Seat, CharlestonVote>> | null;
  showVoteResultOverlay: boolean;
  botVoteMessage: string | null;

  // ── Playing phase ──────────────────────────────────────────────────────
  /** Mirrors server snapshot current_turn; populated by SET_CURRENT_TURN. */
  currentTurn: Seat | null;
  /** Mirrors server snapshot turn_stage; populated by SET_TURN_STAGE. */
  turnStage: TurnStage | null;
  isProcessing: boolean;
  stagedIncomingDrawTile: { id: string; tile: Tile } | null;
  mostRecentDiscard: number | null;
  discardAnimationTile: number | null;
  callWindow: CallWindowUIState | null;
  resolutionOverlay: ResolutionOverlayData | null;
  iouState: IouUIState | null;

  // ── Mahjong / end-game ─────────────────────────────────────────────────
  mahjongDeclaredPlayer: Seat | null;
  mahjongValidatedResult: { player: Seat; valid: boolean; pattern: string | null } | null;
  awaitingMahjongValidation: { caller: Seat; calledTile: Tile; discardedBy: Seat } | null;
  calledFrom: Seat | null;
  deadHandPlayers: Array<{ player: Seat; reason: string }>;
  gameOver: { winner: Seat | null; result: GameResult } | null;
  heavenlyHand: { pattern: string; base_score: number } | null;
  skippedPlayers: Array<{ player: Seat; reason: string }>;
  forfeitedPlayers: Array<{ player: Seat; reason: string | null }>;
  wallExhausted: { remaining_tiles: number } | null;
  gameAbandoned: { reason: string } | null;
  jokerExchanged: { player: Seat; target_seat: Seat; joker: Tile; replacement: Tile } | null;
  meldUpgraded: { player: Seat; meld_index: number; new_meld_type: MeldType } | null;

  // ── Errors / misc ──────────────────────────────────────────────────────
  errorMessage: string | null;

  // ── Event-driven imperative signals ───────────────────────────────────
  /**
   * Increments each time CLEAR_SELECTION is dispatched so that PlayingPhase
   * can call useTileSelection.clearSelection() via a useEffect watcher.
   */
  clearSelectionSignal: number;
  /**
   * Increments each time CLEAR_PENDING_DRAW_RETRY is dispatched so that
   * PlayingPhase can call useAutoDraw.clearPendingDrawRetry() via a watcher.
   */
  clearPendingDrawRetrySignal: number;
  /**
   * Increments each time CLEAR_PENDING_VOTE_RETRY is dispatched so that
   * CharlestonPhase can cancel its vote retry timer via a watcher.
   */
  clearPendingVoteRetrySignal: number;
  /**
   * Increments each time SET_COURTESY_ZERO is dispatched so that
   * CharlestonPhase can auto-send AcceptCourtesyPass with empty tiles.
   */
  courtesyZeroSignal: number;
}

// ---------------------------------------------------------------------------
// Store interface (state + actions)
// ---------------------------------------------------------------------------

export interface GameUIStore extends GameUIState {
  /** Apply a UIStateAction, updating the relevant state fields. */
  dispatch: (action: UIStateAction) => void;
  /** Reset all state to initial values. Primarily used for test isolation. */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: GameUIState = {
  // Setup
  diceRoll: null,
  showDiceOverlay: false,
  setupPhase: null,
  // Charleston – pass
  readyPlayers: [],
  hasSubmittedPass: false,
  charlestonTimer: null,
  timerRemainingSeconds: null,
  incomingFromSeat: null,
  botPassMessage: null,
  passDirection: null,
  stagedIncoming: null,
  stagedOutgoingIds: [],
  highlightedTileIds: [],
  leavingTileIds: [],
  opponentStagedCounts: {},
  // Courtesy pass
  courtesyPartnerProposal: null,
  courtesyAgreement: null,
  courtesyMismatch: null,
  // Charleston voting
  hasSubmittedVote: false,
  myVote: null,
  votedPlayers: [],
  voteResult: null,
  voteBreakdown: null,
  showVoteResultOverlay: false,
  botVoteMessage: null,
  // Playing
  currentTurn: null,
  turnStage: null,
  isProcessing: false,
  stagedIncomingDrawTile: null,
  mostRecentDiscard: null,
  discardAnimationTile: null,
  callWindow: null,
  resolutionOverlay: null,
  iouState: null,
  // Mahjong / end-game
  mahjongDeclaredPlayer: null,
  mahjongValidatedResult: null,
  awaitingMahjongValidation: null,
  calledFrom: null,
  deadHandPlayers: [],
  gameOver: null,
  heavenlyHand: null,
  skippedPlayers: [],
  forfeitedPlayers: [],
  wallExhausted: null,
  gameAbandoned: null,
  jokerExchanged: null,
  meldUpgraded: null,
  // Misc
  errorMessage: null,
  // Signals
  clearSelectionSignal: 0,
  clearPendingDrawRetrySignal: 0,
  clearPendingVoteRetrySignal: 0,
  courtesyZeroSignal: 0,
};

// ---------------------------------------------------------------------------
// Charleston reset subset (used by RESET_CHARLESTON_STATE)
// ---------------------------------------------------------------------------

const charlestonResetFields: Partial<GameUIState> = {
  readyPlayers: [],
  hasSubmittedPass: false,
  charlestonTimer: null,
  timerRemainingSeconds: null,
  incomingFromSeat: null,
  botPassMessage: null,
  passDirection: null,
  // stagedIncoming intentionally excluded: tiles from previous pass must
  // survive the stage transition so the player can forward them in the new stage.
  stagedOutgoingIds: [],
  highlightedTileIds: [],
  leavingTileIds: [],
  opponentStagedCounts: {},
  courtesyPartnerProposal: null,
  courtesyAgreement: null,
  courtesyMismatch: null,
  hasSubmittedVote: false,
  myVote: null,
  votedPlayers: [],
  voteResult: null,
  voteBreakdown: null,
  showVoteResultOverlay: false,
  botVoteMessage: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameUIStore = create<GameUIStore>((set) => ({
  ...initialState,

  reset: () => set(initialState),

  dispatch: (action: UIStateAction) => {
    set((state) => {
      switch (action.type) {
        // ── Setup ───────────────────────────────────────────────────────
        case 'SET_DICE_ROLL':
          return { diceRoll: action.value };
        case 'SET_SHOW_DICE_OVERLAY':
          return { showDiceOverlay: action.value };
        case 'SET_SETUP_PHASE':
          return { setupPhase: action.phase };

        // ── Charleston – pass tracking ───────────────────────────────────
        case 'RESET_CHARLESTON_STATE':
          return charlestonResetFields;
        case 'SET_READY_PLAYERS':
          return { readyPlayers: action.value };
        case 'ADD_READY_PLAYER':
          return {
            readyPlayers: state.readyPlayers.includes(action.seat)
              ? state.readyPlayers
              : [...state.readyPlayers, action.seat],
          };
        case 'SET_OPPONENT_STAGED_COUNT':
          return {
            opponentStagedCounts: { ...state.opponentStagedCounts, [action.seat]: action.count },
          };
        case 'CLEAR_OPPONENT_STAGED_COUNTS':
          return { opponentStagedCounts: {} };
        case 'SET_HAS_SUBMITTED_PASS':
          return { hasSubmittedPass: action.value };
        case 'SET_CHARLESTON_TIMER':
          return { charlestonTimer: action.timer };
        case 'SET_TIMER_REMAINING_SECONDS':
          return { timerRemainingSeconds: action.value };
        case 'SET_INCOMING_FROM_SEAT':
          return { incomingFromSeat: action.seat };
        case 'SET_BOT_PASS_MESSAGE':
          return { botPassMessage: action.message };
        case 'SET_PASS_DIRECTION':
          return { passDirection: action.direction };
        case 'SET_STAGED_INCOMING':
          return { stagedIncoming: action.payload };
        case 'FLIP_STAGED_TILE':
          // Component-local visual state; no-op in the store until component migration.
          return state;
        case 'ABSORB_STAGED_TILE':
          // Component-local operation; no-op in the store until component migration.
          return state;
        case 'SET_STAGED_OUTGOING':
          return { stagedOutgoingIds: action.tileIds };
        case 'CLEAR_STAGING':
          return { stagedIncoming: null, stagedOutgoingIds: [] };
        case 'SET_HIGHLIGHTED_TILE_IDS':
          return { highlightedTileIds: action.ids };
        case 'SET_LEAVING_TILE_IDS':
          return { leavingTileIds: action.ids };

        // ── Courtesy pass ────────────────────────────────────────────────
        case 'SET_COURTESY_PARTNER_PROPOSAL':
          return { courtesyPartnerProposal: action.count };
        case 'SET_COURTESY_AGREEMENT':
          return { courtesyAgreement: action.count, courtesyMismatch: null };
        case 'SET_COURTESY_MISMATCH':
          return {
            courtesyMismatch: {
              partnerProposal: action.partnerProposal,
              agreedCount: action.agreedCount,
            },
          };
        case 'SET_COURTESY_ZERO':
          return {
            courtesyPartnerProposal: 0,
            courtesyAgreement: 0,
            courtesyZeroSignal: state.courtesyZeroSignal + 1,
          };
        case 'RESET_COURTESY_STATE':
          return { courtesyPartnerProposal: null, courtesyAgreement: null, courtesyMismatch: null };

        // ── Charleston voting ────────────────────────────────────────────
        case 'SET_HAS_SUBMITTED_VOTE':
          return { hasSubmittedVote: action.value };
        case 'SET_MY_VOTE':
          return { myVote: action.vote };
        case 'SET_VOTED_PLAYERS':
          return { votedPlayers: action.value };
        case 'ADD_VOTED_PLAYER':
          return {
            votedPlayers: state.votedPlayers.includes(action.seat)
              ? state.votedPlayers
              : [...state.votedPlayers, action.seat],
          };
        case 'SET_VOTE_RESULT':
          return { voteResult: action.result };
        case 'SET_VOTE_BREAKDOWN':
          return { voteBreakdown: action.breakdown };
        case 'SET_SHOW_VOTE_RESULT_OVERLAY':
          return { showVoteResultOverlay: action.value };
        case 'SET_BOT_VOTE_MESSAGE':
          return { botVoteMessage: action.message };

        // ── Playing phase ────────────────────────────────────────────────
        case 'SET_CURRENT_TURN':
          return { currentTurn: action.seat };
        case 'SET_TURN_STAGE':
          return { turnStage: action.stage };
        case 'SET_IS_PROCESSING':
          return { isProcessing: action.value };
        case 'SET_STAGED_INCOMING_DRAW_TILE':
          return { stagedIncomingDrawTile: { id: action.tileId, tile: action.tile } };
        case 'SET_MOST_RECENT_DISCARD':
          return { mostRecentDiscard: action.tile };
        case 'SET_DISCARD_ANIMATION_TILE':
          return { discardAnimationTile: action.tile };

        case 'OPEN_CALL_WINDOW':
          return {
            callWindow: {
              ...action.params,
              responded: false,
              respondedMessage: undefined,
              canAct: action.params.canCall,
              intents: [],
              timerRemaining: null,
            },
          };
        case 'UPDATE_CALL_WINDOW_PROGRESS':
          if (!state.callWindow) return state;
          return {
            callWindow: { ...state.callWindow, canAct: action.canAct, intents: action.intents },
          };
        case 'CLOSE_CALL_WINDOW':
          return { callWindow: null };
        case 'MARK_CALL_WINDOW_RESPONDED':
          if (!state.callWindow) return state;
          return {
            callWindow: {
              ...state.callWindow,
              responded: true,
              respondedMessage: action.message,
            },
          };
        case 'SET_CALL_WINDOW_TIMER':
          if (!state.callWindow) return state;
          // Early exit when value is unchanged – avoids spurious reference changes
          // that would cause every selectors referencing s.callWindow to re-render.
          if (state.callWindow.timerRemaining === action.remaining) return state;
          return { callWindow: { ...state.callWindow, timerRemaining: action.remaining } };

        case 'SHOW_RESOLUTION_OVERLAY':
          return { resolutionOverlay: action.data };
        case 'DISMISS_RESOLUTION_OVERLAY':
          return { resolutionOverlay: null };

        case 'SET_IOU_STATE':
          return {
            iouState: action.state ? { ...action.state, summary: action.state.summary } : null,
          };
        case 'RESOLVE_IOU':
          if (!state.iouState) return state;
          return { iouState: { ...state.iouState, resolved: true, summary: action.summary } };
        case 'CLEAR_IOU':
          return { iouState: null };

        // ── Errors / misc ────────────────────────────────────────────────
        case 'SET_ERROR_MESSAGE':
          return { errorMessage: action.message };
        case 'CLEAR_SELECTION':
          return { clearSelectionSignal: state.clearSelectionSignal + 1 };
        case 'CLEAR_SELECTION_ERROR':
          // Handled by local selection error state; no-op in store until migration.
          return state;
        case 'CLEAR_PENDING_VOTE_RETRY':
          return { clearPendingVoteRetrySignal: state.clearPendingVoteRetrySignal + 1 };
        case 'CLEAR_PENDING_DRAW_RETRY':
          return { clearPendingDrawRetrySignal: state.clearPendingDrawRetrySignal + 1 };

        case 'CLEAR_STAGED_INCOMING_DRAW_TILE':
          return { stagedIncomingDrawTile: null };

        case 'RESET_PLAYING_STATE':
          return {
            isProcessing: false,
            stagedIncomingDrawTile: null,
            mostRecentDiscard: null,
            discardAnimationTile: null,
            resolutionOverlay: null,
          };

        // ── Mahjong / end-game ───────────────────────────────────────────
        case 'SET_MAHJONG_DECLARED':
          return { mahjongDeclaredPlayer: action.player };
        case 'SET_MAHJONG_VALIDATED':
          return {
            mahjongValidatedResult: {
              player: action.player,
              valid: action.valid,
              pattern: action.pattern,
            },
          };
        case 'SET_HAND_DECLARED_DEAD':
          return {
            deadHandPlayers: [
              ...state.deadHandPlayers,
              { player: action.player, reason: action.reason },
            ],
          };
        case 'SET_GAME_OVER':
          return { gameOver: { winner: action.winner, result: action.result } };
        case 'SET_HEAVENLY_HAND':
          return { heavenlyHand: { pattern: action.pattern, base_score: action.base_score } };
        case 'SET_AWAITING_MAHJONG_VALIDATION':
          return {
            awaitingMahjongValidation: {
              caller: action.caller,
              calledTile: action.calledTile,
              discardedBy: action.discardedBy,
            },
          };
        case 'SET_CALLED_FROM':
          return { calledFrom: action.discardedBy };
        case 'SET_PLAYER_SKIPPED':
          return {
            skippedPlayers: [
              ...state.skippedPlayers,
              { player: action.player, reason: action.reason },
            ],
          };
        case 'SET_PLAYER_FORFEITED':
          return {
            forfeitedPlayers: [
              ...state.forfeitedPlayers,
              { player: action.player, reason: action.reason },
            ],
          };
        case 'SET_WALL_EXHAUSTED':
          return { wallExhausted: { remaining_tiles: action.remaining_tiles } };
        case 'SET_GAME_ABANDONED':
          return { gameAbandoned: { reason: action.reason } };
        case 'SET_JOKER_EXCHANGED':
          return {
            jokerExchanged: {
              player: action.player,
              target_seat: action.target_seat,
              joker: action.joker,
              replacement: action.replacement,
            },
          };
        case 'SET_MELD_UPGRADED':
          return {
            meldUpgraded: {
              player: action.player,
              meld_index: action.meld_index,
              new_meld_type: action.new_meld_type,
            },
          };

        default:
          return state;
      }
    });
  },
}));
