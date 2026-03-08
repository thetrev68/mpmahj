import type { GameCommand } from '@/types/bindings/generated/GameCommand';
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
  /** Whether the player has already submitted their pass */
  hasSubmittedPass?: boolean;
  /** Hide the built-in Charleston pass action when another surface owns it */
  suppressCharlestonPassAction?: boolean;
  /** Hide the built-in discard action when another surface owns it */
  suppressDiscardAction?: boolean;
  /** Number of tiles to pass for courtesy pass (US-007) */
  courtesyPassCount?: number;
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
  /** Optional sort handler (UI-only) */
  onSort?: () => void;
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
