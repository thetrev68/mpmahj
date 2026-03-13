import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

export interface ActionBarProps {
  /** Current game phase from server */
  phase: GamePhase;
  /** Player's seat */
  mySeat: Seat;
  /** Currently selected tiles (tile values) */
  selectedTiles?: Tile[];
  /** External processing state (e.g., discard in-flight) */
  isProcessing?: boolean;
  /** Number of tiles to pass blindly (0-3, only for blind pass stages) */
  blindPassCount?: number;
  /** Phase-owned Charleston pass eligibility when another surface shares the same command */
  canCommitCharlestonPass?: boolean;
  /** Whether the player has already submitted their pass */
  hasSubmittedPass?: boolean;
  /** Whether the player has already submitted a Charleston continue/stop vote */
  hasSubmittedVote?: boolean;
  /** The local player's submitted Charleston vote */
  myVote?: CharlestonVote;
  /** Players who have submitted a Charleston vote */
  votedPlayers?: Seat[];
  /** Total players in the Charleston vote */
  totalPlayers?: number;
  /** Bot vote status message during Charleston voting */
  botVoteMessage?: string;
  /** Hide the built-in Charleston pass action when another surface owns it */
  suppressCharlestonPassAction?: boolean;
  /** Hide the built-in discard action when another surface owns it */
  suppressDiscardAction?: boolean;
  /** Number of tiles to pass for courtesy pass (US-007) */
  courtesyPassCount?: number;
  /** Phase-owned discard eligibility when staging and action bar share the same command */
  canCommitDiscard?: boolean;
  /** Call-window Proceed stays enabled even with invalid staged claim state */
  canProceedCallWindow?: boolean;
  /** Callback for selection-driven claim/skip flow */
  onProceedCallWindow?: () => void;
  /** Instructional detail for the current call window */
  callWindowInstruction?: string;
  /** Call-window claim candidate feedback shown in the action pane */
  claimCandidate?: {
    state: 'empty' | 'valid' | 'invalid';
    label: string;
    detail: string;
  } | null;
  /** Callback for courtesy pass tile submission (US-007) */
  onCourtesyPassSubmit?: () => void;
  /** Whether hint request is available in current state */
  canRequestHint?: boolean;
  /** Called when user opens hint request */
  onOpenHintRequest?: () => void;
  /** Hint request currently in-flight */
  isHintRequestPending?: boolean;
  /** Whether a Mahjong declaration is available this turn */
  canDeclareMahjong?: boolean;
  /** Called when the player clicks "Declare Mahjong" */
  onDeclareMahjong?: () => void;
  /** Whether a Joker exchange is available this turn (US-014/015) */
  canExchangeJoker?: boolean;
  /** Called when the player clicks "Exchange Joker" */
  onExchangeJoker?: () => void;
  /** Callback when command is issued */
  onCommand: (command: GameCommand) => void;
  /** Read-only mode for historical viewing */
  readOnly?: boolean;
  /** Message shown while in read-only mode */
  readOnlyMessage?: string;
  /** Whether to show solo immediate undo control */
  showSoloUndo?: boolean;
  /** Remaining solo undos */
  soloUndoRemaining?: number;
  /** Solo undo limit */
  soloUndoLimit?: number;
  /** Recent action labels for undo tooltip */
  undoRecentActions?: string[];
  /** Solo undo in-flight */
  undoPending?: boolean;
  /** Callback for solo undo request */
  onUndo?: () => void;
  /** Whether to show multiplayer undo vote request button */
  showUndoVoteRequest?: boolean;
  /** Remaining multiplayer undo requests */
  undoVoteRemaining?: number;
  /** Callback for requesting multiplayer undo vote */
  onRequestUndoVote?: () => void;
  /** Disable undo controls when game is ending */
  disableUndoControls?: boolean;
  /** Disable all rendered buttons without removing the bar from layout */
  disabled?: boolean;
}
