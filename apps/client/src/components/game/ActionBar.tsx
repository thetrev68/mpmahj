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
  selectionSummary,
  canCommitCharlestonPass = false,
  hasSubmittedPass = false,
  hasSubmittedVote = false,
  suppressCharlestonPassAction = false,
  suppressDiscardAction = false,
  courtesyPassCount,
  canCommitDiscard = false,
  canProceedCallWindow = false,
  onProceedCallWindow,
  callWindowInstruction,
  claimCandidate,
  onCourtesyPassSubmit,
  canDeclareMahjong = false,
  onDeclareMahjong,
  onCommand,
  readOnly = false,
  readOnlyMessage = 'Historical View - No actions available',
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

  const effectiveCallWindowInstruction = (() => {
    if (claimCandidate?.state === 'valid') {
      const label = claimCandidate.label.endsWith(' ready')
        ? claimCandidate.label.slice(0, -' ready'.length)
        : claimCandidate.label;
      return `${label} ready — Press Proceed to call ${label}.`;
    }

    if (claimCandidate?.state === 'invalid') {
      return claimCandidate.detail || 'This staged claim cannot be called.';
    }

    return callWindowInstruction;
  })();

  return (
    <div
      className={cn(
        'relative flex h-full w-full',
        'bg-black/85 rounded-lg shadow-lg',
        'px-4 py-3',
        'min-w-[180px]'
      )}
      data-testid="action-bar"
      data-board-region="action-region-panel"
      role="toolbar"
      aria-label="Game actions"
    >
      <div className="flex min-h-full flex-1 flex-col gap-2.5">
        {selectionSummary ? (
          <div
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white"
            data-testid="selection-counter"
            aria-live="polite"
          >
            {selectionSummary.blindPassCount != null && selectionSummary.blindPassCount > 0 ? (
              <div className="flex flex-col gap-1">
                <span>{`${selectionSummary.selectedCount}/${selectionSummary.maxSelection} selected`}</span>
                <span className="text-xs text-emerald-200">
                  {`${selectionSummary.selectedCount} hand + ${selectionSummary.blindPassCount} blind = ${selectionSummary.selectedCount + selectionSummary.blindPassCount} total`}
                </span>
              </div>
            ) : (
              `${selectionSummary.selectedCount}/${selectionSummary.maxSelection} selected`
            )}
          </div>
        ) : null}
        <ActionBarPhaseActions
          phase={phase}
          mySeat={mySeat}
          readOnly={readOnly}
          readOnlyMessage={readOnlyMessage}
          selectedTiles={selectedTiles}
          canCommitCharlestonPass={canCommitCharlestonPass}
          hasSubmittedPass={hasSubmittedPass}
          hasSubmittedVote={hasSubmittedVote}
          suppressCharlestonPassAction={suppressCharlestonPassAction}
          suppressDiscardAction={suppressDiscardAction}
          courtesyPassCount={courtesyPassCount}
          canCommitDiscard={canCommitDiscard}
          canProceedCallWindow={canProceedCallWindow}
          onProceedCallWindow={onProceedCallWindow}
          callWindowInstruction={effectiveCallWindowInstruction}
          onCourtesyPassSubmit={onCourtesyPassSubmit}
          canDeclareMahjong={canDeclareMahjong}
          onDeclareMahjong={onDeclareMahjong}
          disabled={disabled}
          isBusy={isBusy}
          onRollDice={handleRollDice}
          onCommitCharlestonPass={handleCommitCharlestonPass}
          onVoteCharleston={handleVoteCharleston}
          onDiscardTile={handleDiscardTile}
        />
      </div>
    </div>
  );
};

ActionBar.displayName = 'ActionBar';
