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
        {claimCandidate ? (
          <div
            className={cn(
              'rounded-xl border px-3 py-2 text-sm',
              claimCandidate.state === 'valid' && 'border-emerald-400/70 bg-emerald-950/40',
              claimCandidate.state === 'invalid' && 'border-rose-400/70 bg-rose-950/40',
              claimCandidate.state === 'empty' && 'border-white/20 bg-white/5'
            )}
            data-testid="action-bar-claim-candidate"
          >
            <div
              className="font-semibold text-white"
              data-testid="action-bar-claim-candidate-label"
            >
              {claimCandidate.label}
            </div>
            <div className="text-slate-200" data-testid="action-bar-claim-candidate-detail">
              {claimCandidate.detail}
            </div>
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
          myVote={myVote}
          votedPlayers={votedPlayers}
          totalPlayers={totalPlayers}
          botVoteMessage={botVoteMessage}
          suppressCharlestonPassAction={suppressCharlestonPassAction}
          suppressDiscardAction={suppressDiscardAction}
          courtesyPassCount={courtesyPassCount}
          canCommitDiscard={canCommitDiscard}
          canProceedCallWindow={canProceedCallWindow}
          onProceedCallWindow={onProceedCallWindow}
          callWindowInstruction={callWindowInstruction}
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
