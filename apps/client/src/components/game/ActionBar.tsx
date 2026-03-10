/**
 * ActionBar Component
 *
 * Bottom action panel that displays context-aware buttons for game actions.
 * Changes based on server-driven phase and turn state.
 *
 * Related: US-001 (Roll Dice), US-002 (Charleston), US-009 (Discard), US-011 (Call Window)
 */

import { type FC, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ActionBarPhaseActions } from './ActionBarPhaseActions';
import { ActionBarUndoControls } from './ActionBarUndoControls';
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
  canCommitCharlestonPass = false,
  hasSubmittedPass = false,
  hasSubmittedVote = false,
  myVote,
  votedPlayers = [],
  totalPlayers = 4,
  botVoteMessage,
  suppressCharlestonPassAction = false,
  suppressDiscardAction = false,
  courtesyPassCount,
  canCommitDiscard = false,
  onCourtesyPassSubmit,
  canRequestHint = false,
  onOpenHintRequest,
  isHintRequestPending = false,
  canDeclareMahjong = false,
  onDeclareMahjong,
  canExchangeJoker = false,
  onExchangeJoker,
  onCommand,
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
  const { handleCommand, isBusy } = useActionBarHandlers({
    isProcessing,
    disabled,
    onCommand,
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

  const handleVoteCharleston = useCallback(() => {
    const vote =
      selectedTiles.length === 0 ? 'Stop' : selectedTiles.length === 3 ? 'Continue' : null;
    if (vote === null) return;

    handleCommand({
      VoteCharleston: {
        player: mySeat,
        vote,
      },
    });
  }, [handleCommand, mySeat, selectedTiles.length]);

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
          canCommitCharlestonPass={canCommitCharlestonPass}
          hasSubmittedPass={hasSubmittedPass}
          hasSubmittedVote={hasSubmittedVote}
          myVote={myVote}
          votedPlayers={votedPlayers}
          totalPlayers={totalPlayers}
          botVoteMessage={botVoteMessage}
          suppressCharlestonPassAction={suppressCharlestonPassAction}
          suppressDiscardAction={suppressDiscardAction}
          courtesyPassCount={courtesyPassCount}
          canCommitDiscard={canCommitDiscard}
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
          onVoteCharleston={handleVoteCharleston}
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
      </div>
    </div>
  );
};

ActionBar.displayName = 'ActionBar';
