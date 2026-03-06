/**
 * ActionBar Component
 *
 * Bottom action panel that displays context-aware buttons for game actions.
 * Changes based on server-driven phase and turn state.
 *
 * Related: US-001 (Roll Dice), US-002 (Charleston), US-009 (Discard), US-011 (Call Window)
 */

import { type FC, useCallback } from 'react';
import { Flag, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FORFEIT_PENALTY_POINTS } from '@/lib/constants';
import { getActionBarPhaseMeta } from './ActionBarDerivations';
import { ActionBarPhaseActions } from './ActionBarPhaseActions';
import { ActionBarUndoControls } from './ActionBarUndoControls';
import { ForfeitConfirmationDialog } from './ForfeitConfirmationDialog';
import { LeaveConfirmationDialog } from './LeaveConfirmationDialog';
import type { ActionBarProps } from './ActionBar.types';
import { useActionBarHandlers } from './useActionBarHandlers';

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
  suppressCharlestonPassAction = false,
  suppressDiscardAction = false,
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
  disabled = false,
}) => {
  const { canForfeit, isCriticalPhase } = getActionBarPhaseMeta(phase, mySeat);

  const {
    forfeitReason,
    handleCancelForfeit,
    handleCancelLeave,
    handleCommand,
    handleConfirmForfeit,
    handleConfirmLeave,
    handleOpenForfeitDialog,
    handleOpenLeaveDialog,
    isBusy,
    isForfeiting,
    isLeaving,
    setForfeitReason,
    showForfeitDialog,
    showLeaveDialog,
  } = useActionBarHandlers({
    mySeat,
    isProcessing,
    disabled,
    canForfeit,
    onCommand,
    onLeaveConfirmed,
  });

  const handleRollDice = useCallback(() => {
    handleCommand({ RollDice: { player: mySeat } });
  }, [handleCommand, mySeat]);

  const handleCommitCharlestonPass = useCallback(() => {
    handleCommand({
      CommitCharlestonPass: {
        player: mySeat,
        from_hand: selectedTiles,
        forward_incoming_count: blindPassCount ?? 0,
      },
    });
  }, [blindPassCount, handleCommand, mySeat, selectedTiles]);

  const handleDiscardTile = useCallback(() => {
    if (selectedTiles.length === 0) return;
    handleCommand({
      DiscardTile: {
        player: mySeat,
        tile: selectedTiles[0],
      },
    });
  }, [handleCommand, mySeat, selectedTiles]);

  return (
    <div
      className={cn(
        'relative flex h-full w-full',
        'bg-black/85 rounded-lg shadow-lg',
        'px-4 py-3',
        'min-w-[180px]'
      )}
      data-testid="action-bar"
      role="toolbar"
      aria-label="Game actions"
    >
      <div className="flex min-h-full flex-1 flex-col gap-2.5">
        <ActionBarPhaseActions
          phase={phase}
          mySeat={mySeat}
          readOnly={readOnly}
          readOnlyMessage={readOnlyMessage}
          selectedTiles={selectedTiles}
          blindPassCount={blindPassCount}
          hasSubmittedPass={hasSubmittedPass}
          suppressCharlestonPassAction={suppressCharlestonPassAction}
          suppressDiscardAction={suppressDiscardAction}
          courtesyPassCount={courtesyPassCount}
          onCourtesyPassSubmit={onCourtesyPassSubmit}
          canRequestHint={canRequestHint}
          onOpenHintRequest={onOpenHintRequest}
          isHintRequestPending={isHintRequestPending}
          canDeclareMahjong={canDeclareMahjong}
          onDeclareMahjong={onDeclareMahjong}
          canExchangeJoker={canExchangeJoker}
          onExchangeJoker={onExchangeJoker}
          disabled={disabled}
          isBusy={isBusy}
          onRollDice={handleRollDice}
          onCommitCharlestonPass={handleCommitCharlestonPass}
          onDiscardTile={handleDiscardTile}
        />

        <ActionBarUndoControls
          readOnly={readOnly}
          disabled={disabled}
          disableUndoControls={disableUndoControls}
          showSoloUndo={showSoloUndo}
          soloUndoRemaining={soloUndoRemaining}
          soloUndoLimit={soloUndoLimit}
          undoRecentActions={undoRecentActions}
          undoPending={undoPending}
          onUndo={onUndo}
          showUndoVoteRequest={showUndoVoteRequest}
          undoVoteRemaining={undoVoteRemaining}
          onRequestUndoVote={onRequestUndoVote}
        />

        {onSort && !readOnly && (
          <Button
            onClick={onSort}
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="sort-button"
            aria-label="Sort hand"
            disabled={disabled}
          >
            Sort Hand
          </Button>
        )}

        <div className="mt-auto flex flex-col gap-2.5" data-testid="action-bar-bottom-controls">
          <Button
            onClick={handleOpenLeaveDialog}
            variant="outline"
            className="w-full border-red-500/70 text-red-200 hover:bg-red-900/60"
            data-testid="leave-game-button"
            aria-label="Leave game (marks you disconnected)"
            disabled={disabled || isLeaving || readOnly}
          >
            <LogOut className="h-4 w-4" />
            Leave Game
          </Button>

          <Button
            onClick={handleOpenForfeitDialog}
            variant="outline"
            className="w-full border-amber-500/70 text-amber-200 hover:bg-amber-900/50"
            data-testid="forfeit-game-button"
            aria-label="Forfeit game (lose with -100 point penalty)"
            disabled={disabled || !canForfeit || isForfeiting || readOnly}
          >
            <Flag className="h-4 w-4" />
            Forfeit
          </Button>
        </div>
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
        penaltyPoints={FORFEIT_PENALTY_POINTS}
        reason={forfeitReason}
        onReasonChange={setForfeitReason}
        onConfirm={handleConfirmForfeit}
        onCancel={handleCancelForfeit}
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
