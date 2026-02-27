/**
 * ActionBar Component
 *
 * Bottom action panel that displays context-aware buttons for game actions.
 * Changes based on server-driven phase and turn state.
 *
 * Related: US-001 (Roll Dice), US-002 (Charleston), US-009 (Discard), US-011 (Call Window)
 */

import { useState, type FC } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, LogOut, Flag } from 'lucide-react';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { cn } from '@/lib/utils';
import { LeaveConfirmationDialog } from './LeaveConfirmationDialog';
import { ForfeitConfirmationDialog } from './ForfeitConfirmationDialog';
import { UndoButton } from './UndoButton';

interface ActionBarProps {
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
  /** Called after leave command is sent */
  onLeaveConfirmed?: () => void;
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
}

/**
 * ActionBar displays context-aware action buttons based on game phase
 */
export const ActionBar: FC<ActionBarProps> = ({
  phase,
  mySeat,
  selectedTiles = [],
  isProcessing = false,
  blindPassCount,
  hasSubmittedPass = false,
  courtesyPassCount,
  onCourtesyPassSubmit,
  canRequestHint = false,
  onOpenHintRequest,
  isHintRequestPending = false,
  canDeclareMahjong = false,
  onDeclareMahjong,
  canExchangeJoker = false,
  onExchangeJoker,
  onCommand,
  onLeaveConfirmed,
  onSort,
  readOnly = false,
  readOnlyMessage = 'Historical View - No actions available',
  showSoloUndo = false,
  soloUndoRemaining = 0,
  soloUndoLimit = 10,
  undoRecentActions = [],
  undoPending = false,
  onUndo,
  showUndoVoteRequest = false,
  undoVoteRemaining = 0,
  onRequestUndoVote,
  disableUndoControls = false,
}) => {
  const [localProcessing, setLocalProcessing] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showForfeitDialog, setShowForfeitDialog] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isForfeiting, setIsForfeiting] = useState(false);
  const [forfeitReason, setForfeitReason] = useState<string | null>(null);
  const [leaveButtonLocked, setLeaveButtonLocked] = useState(false);
  const isBusy = localProcessing || isProcessing;
  const isPlayingPhase = typeof phase === 'object' && 'Playing' in phase;
  const isCallWindow =
    isPlayingPhase &&
    typeof phase.Playing === 'object' &&
    phase.Playing !== null &&
    'CallWindow' in phase.Playing;
  const canForfeit = isPlayingPhase && !isCallWindow;
  const isCriticalPhase =
    (isPlayingPhase &&
      typeof phase.Playing === 'object' &&
      phase.Playing !== null &&
      (('Drawing' in phase.Playing && phase.Playing.Drawing.player === mySeat) ||
        ('Discarding' in phase.Playing && phase.Playing.Discarding.player === mySeat) ||
        ('CallWindow' in phase.Playing && phase.Playing.CallWindow.can_act.includes(mySeat)))) ||
    (typeof phase === 'object' && 'Charleston' in phase);

  // Handle button click with debouncing
  const handleCommand = (command: GameCommand) => {
    if (isBusy) return;

    setLocalProcessing(true);
    onCommand(command);

    // Re-enable after short delay to prevent double-clicks
    setTimeout(() => setLocalProcessing(false), 500);
  };

  const handleOpenLeaveDialog = () => {
    if (leaveButtonLocked || isLeaving) return;
    setLeaveButtonLocked(true);
    setShowLeaveDialog(true);
  };

  const handleCancelLeave = () => {
    setShowLeaveDialog(false);
    setLeaveButtonLocked(false);
  };

  const handleConfirmLeave = () => {
    if (isLeaving) return;
    setShowLeaveDialog(false);
    setIsLeaving(true);
    onCommand({ LeaveGame: { player: mySeat } });
    // Delay navigation so the "Leaving game..." overlay is briefly visible (AC-3)
    setTimeout(() => {
      setIsLeaving(false);
      setLeaveButtonLocked(false);
      onLeaveConfirmed?.();
    }, 1500);
  };

  const handleConfirmForfeit = () => {
    if (isForfeiting || !canForfeit) return;
    setShowForfeitDialog(false);
    setIsForfeiting(true);
    onCommand({
      ForfeitGame: {
        player: mySeat,
        reason: forfeitReason,
      },
    });
    setTimeout(() => setIsForfeiting(false), 1500);
  };

  // Determine which buttons to show based on phase
  const renderUndoControls = () => {
    if (readOnly || disableUndoControls) return null;

    if (showSoloUndo && onUndo) {
      return (
        <>
          <UndoButton
            available={soloUndoRemaining > 0}
            remaining={soloUndoRemaining}
            max={soloUndoLimit}
            isLoading={undoPending}
            recentActions={undoRecentActions}
            onUndo={onUndo}
          />
          <div className="text-center text-xs text-slate-300" aria-live="polite">
            Press Ctrl+Z to undo last action
          </div>
        </>
      );
    }

    if (showUndoVoteRequest && onRequestUndoVote) {
      return (
        <Button
          onClick={onRequestUndoVote}
          disabled={undoPending || undoVoteRemaining <= 0}
          variant="outline"
          className="w-full border-blue-500/70 text-blue-100 hover:bg-blue-900/40"
          data-testid="request-undo-vote-button"
          aria-label={`Request undo vote (${undoVoteRemaining} remaining)`}
        >
          {undoPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Requesting...
            </span>
          ) : (
            `Request Undo Vote (${undoVoteRemaining} remaining)`
          )}
        </Button>
      );
    }

    return null;
  };

  const renderActions = () => {
    if (readOnly) {
      return (
        <div className="text-center text-gray-300 text-sm" data-testid="action-bar-read-only">
          {readOnlyMessage}
        </div>
      );
    }

    // Setup Phase - RollingDice
    if (typeof phase === 'object' && 'Setup' in phase) {
      const setupStage = phase.Setup;

      if (setupStage === 'RollingDice') {
        // Only East can roll dice
        if (mySeat === 'East') {
          return (
            <Button
              onClick={() => handleCommand({ RollDice: { player: mySeat } })}
              disabled={isBusy}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              data-testid="roll-dice-button"
              aria-label="Roll dice to start game"
            >
              Roll Dice
            </Button>
          );
        } else {
          return (
            <div
              className="text-center text-gray-300 text-sm italic"
              data-testid="waiting-message"
              aria-live="polite"
            >
              Waiting for East to roll dice...
            </div>
          );
        }
      }

      // Other setup stages - show waiting message
      return <div className="text-center text-gray-300 text-sm italic">Setting up game...</div>;
    }

    // Charleston Phase
    if (typeof phase === 'object' && 'Charleston' in phase) {
      // CourtesyAcross tile selection (US-007)
      if (
        phase.Charleston === 'CourtesyAcross' &&
        courtesyPassCount !== undefined &&
        onCourtesyPassSubmit
      ) {
        const canPass = selectedTiles.length === courtesyPassCount && !isBusy;

        return (
          <>
            <div className="text-center text-gray-300 text-sm mb-2">
              Select {courtesyPassCount} {courtesyPassCount === 1 ? 'tile' : 'tiles'} for courtesy
              pass
            </div>
            <Button
              onClick={onCourtesyPassSubmit}
              disabled={!canPass}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
              data-testid="courtesy-pass-tiles-button"
              aria-label="Pass courtesy tiles"
            >
              {isBusy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Passing...
                </span>
              ) : (
                'Pass Tiles'
              )}
            </Button>
          </>
        );
      }

      // CourtesyAcross negotiation handled by CharlestonPhase
      if (phase.Charleston === 'CourtesyAcross') return null;

      const blind = blindPassCount ?? 0;
      const totalSelected = selectedTiles.length + blind;
      const canPass = totalSelected === 3 && !isBusy && !hasSubmittedPass;

      return (
        <>
          <Button
            onClick={() =>
              handleCommand({
                CommitCharlestonPass: {
                  player: mySeat,
                  from_hand: selectedTiles,
                  forward_incoming_count: blind,
                },
              })
            }
            disabled={!canPass}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            data-testid="pass-tiles-button"
            aria-label="Pass selected tiles"
          >
            {isBusy || hasSubmittedPass ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {hasSubmittedPass ? 'Tiles Passed' : 'Passing...'}
              </span>
            ) : (
              'Pass Tiles'
            )}
          </Button>

          {hasSubmittedPass && (
            <div className="text-center text-gray-300 text-sm italic" aria-live="polite">
              Waiting for other players...
            </div>
          )}
        </>
      );
    }

    // Playing Phase
    if (typeof phase === 'object' && 'Playing' in phase) {
      const stage = phase.Playing;

      if (typeof stage === 'object') {
        if ('Drawing' in stage) {
          const isMe = stage.Drawing.player === mySeat;
          return (
            <div className="text-center text-gray-300 text-sm" data-testid="playing-status">
              {isMe ? 'Your turn - Drawing tile...' : `${stage.Drawing.player}'s turn - Drawing`}
            </div>
          );
        }

        if ('Discarding' in stage) {
          const isMe = stage.Discarding.player === mySeat;

          if (isMe) {
            // Show Discard button when it's my turn
            const canDiscard = selectedTiles.length === 1 && !isBusy;

            return (
              <>
                <div className="text-center text-gray-300 text-sm" data-testid="playing-status">
                  Your turn - Select a tile to discard
                </div>
                <Button
                  onClick={() =>
                    handleCommand({
                      DiscardTile: {
                        player: mySeat,
                        tile: selectedTiles[0],
                      },
                    })
                  }
                  disabled={!canDiscard}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                  data-testid="discard-button"
                  aria-label="Discard selected tile"
                >
                  {isBusy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Discarding...
                    </span>
                  ) : (
                    'Discard'
                  )}
                </Button>
                {canRequestHint && onOpenHintRequest && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={onOpenHintRequest}
                          disabled={isBusy || isHintRequestPending}
                          className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700"
                          data-testid="get-hint-button"
                          aria-label="Get hint. AI-powered analysis available."
                        >
                          {isHintRequestPending ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Analyzing...
                            </span>
                          ) : (
                            'Get Hint'
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>AI analysis powered by MCTS engine</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {canDeclareMahjong && (
                  <Button
                    onClick={onDeclareMahjong}
                    disabled={isBusy}
                    className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold motion-safe:animate-pulse"
                    data-testid="declare-mahjong-button"
                    aria-label="Declare Mahjong"
                  >
                    Declare Mahjong
                  </Button>
                )}
                {canExchangeJoker && (
                  <Button
                    onClick={onExchangeJoker}
                    disabled={isBusy}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                    data-testid="exchange-joker-button"
                    aria-label="Exchange Joker"
                  >
                    Exchange Joker
                  </Button>
                )}
              </>
            );
          }

          return (
            <div className="text-center text-gray-300 text-sm" data-testid="playing-status">
              {stage.Discarding.player}'s turn - Discarding
            </div>
          );
        }
      }

      return <div className="text-center text-gray-300 text-sm">Playing Phase</div>;
    }

    // Default: no actions
    return <div className="text-center text-gray-400 text-sm">No actions available</div>;
  };

  return (
    <div
      className={cn(
        'fixed right-[16%] top-1/2 -translate-y-1/2',
        'bg-black/85 rounded-lg shadow-lg',
        'px-4 py-3',
        'min-w-[180px]'
      )}
      data-testid="action-bar"
      role="toolbar"
      aria-label="Game actions"
    >
      <div className="flex flex-col gap-2.5">
        {renderActions()}
        {renderUndoControls()}

        {/* Sort button (if provided) */}
        {onSort && !readOnly && (
          <Button
            onClick={onSort}
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="sort-button"
            aria-label="Sort hand"
          >
            Sort Hand
          </Button>
        )}

        <Button
          onClick={handleOpenLeaveDialog}
          variant="outline"
          className="w-full border-red-500/70 text-red-200 hover:bg-red-900/60"
          data-testid="leave-game-button"
          aria-label="Leave game (marks you disconnected)"
          disabled={isLeaving || readOnly}
        >
          <LogOut className="h-4 w-4" />
          Leave Game
        </Button>

        <Button
          onClick={() => setShowForfeitDialog(true)}
          variant="outline"
          className="w-full border-amber-500/70 text-amber-200 hover:bg-amber-900/50"
          data-testid="forfeit-game-button"
          aria-label="Forfeit game (lose with -100 point penalty)"
          disabled={!canForfeit || isForfeiting || readOnly}
        >
          <Flag className="h-4 w-4" />
          Forfeit
        </Button>
      </div>

      <LeaveConfirmationDialog
        isOpen={showLeaveDialog}
        isLoading={isLeaving}
        isCriticalPhase={isCriticalPhase}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />

      <ForfeitConfirmationDialog
        isOpen={showForfeitDialog}
        isLoading={isForfeiting}
        penaltyPoints={100}
        reason={forfeitReason}
        onReasonChange={setForfeitReason}
        onConfirm={handleConfirmForfeit}
        onCancel={() => setShowForfeitDialog(false)}
      />

      {isLeaving && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-white text-lg"
          data-testid="leave-loading-overlay"
          role="status"
          aria-live="polite"
        >
          Leaving game...
        </div>
      )}
      {isForfeiting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-white text-lg"
          data-testid="forfeit-loading-overlay"
          role="status"
          aria-live="polite"
        >
          Forfeiting game...
        </div>
      )}
    </div>
  );
};

ActionBar.displayName = 'ActionBar';
