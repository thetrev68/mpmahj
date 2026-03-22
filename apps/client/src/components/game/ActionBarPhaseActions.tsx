import type { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  canSubmitCharlestonVote,
  canSubmitCourtesyPass,
  getInstructionText,
} from './ActionBarDerivations';
import type { ActionBarProps } from './ActionBar.types';

interface ActionBarPhaseActionsProps {
  phase: ActionBarProps['phase'];
  mySeat: ActionBarProps['mySeat'];
  readOnly: boolean;
  readOnlyMessage: string;
  selectedTiles: NonNullable<ActionBarProps['selectedTiles']>;
  canCommitCharlestonPass: boolean;
  hasSubmittedPass: boolean;
  hasSubmittedVote: boolean;
  myVote?: ActionBarProps['myVote'];
  votedPlayers: NonNullable<ActionBarProps['votedPlayers']>;
  totalPlayers: number;
  botVoteMessage?: string;
  suppressCharlestonPassAction: boolean;
  suppressDiscardAction: boolean;
  courtesyPassCount?: number;
  canCommitDiscard: boolean;
  canProceedCallWindow: boolean;
  onProceedCallWindow?: () => void;
  callWindowInstruction?: string;
  onCourtesyPassSubmit?: () => void;
  canDeclareMahjong: boolean;
  onDeclareMahjong?: () => void;
  disabled: boolean;
  isBusy: boolean;
  onRollDice: () => void;
  onCommitCharlestonPass: () => void;
  onVoteCharleston: () => void;
  onDiscardTile: () => void;
}

export const ActionBarPhaseActions: FC<ActionBarPhaseActionsProps> = ({
  phase,
  mySeat,
  readOnly,
  readOnlyMessage,
  selectedTiles,
  canCommitCharlestonPass,
  hasSubmittedPass,
  hasSubmittedVote,
  suppressCharlestonPassAction,
  suppressDiscardAction,
  courtesyPassCount,
  canCommitDiscard,
  canProceedCallWindow,
  onProceedCallWindow,
  callWindowInstruction,
  onCourtesyPassSubmit,
  canDeclareMahjong,
  onDeclareMahjong,
  disabled,
  isBusy,
  onRollDice,
  onCommitCharlestonPass,
  onVoteCharleston,
  onDiscardTile,
}) => {
  if (readOnly) {
    return (
      <div className="text-center text-gray-300 text-sm" data-testid="action-bar-read-only">
        {readOnlyMessage}
      </div>
    );
  }

  const isCharleston = typeof phase === 'object' && phase !== null && 'Charleston' in phase;

  const instructionText = getInstructionText(
    phase,
    mySeat,
    callWindowInstruction,
    hasSubmittedPass
  );
  const instruction = (
    <div
      className={cn(
        'text-sm',
        isCharleston ? 'text-left text-muted-foreground font-medium' : 'text-center text-gray-300'
      )}
      data-testid="action-instruction"
    >
      {instructionText}
    </div>
  );

  const renderProceedButton = (
    buttonDisabled: boolean,
    onClick: () => void,
    testId: string,
    ariaLabel: string
  ) => (
    <Button
      onClick={onClick}
      disabled={buttonDisabled}
      className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {isBusy ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Proceeding...
        </span>
      ) : (
        'Proceed'
      )}
    </Button>
  );

  const renderMahjongButton = (buttonDisabled: boolean, demoted = false) => (
    <Button
      onClick={onDeclareMahjong}
      disabled={buttonDisabled}
      variant={demoted ? 'outline' : undefined}
      className={cn(
        'w-full',
        demoted
          ? 'border-muted-foreground/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground'
          : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold motion-safe:animate-pulse'
      )}
      data-testid="declare-mahjong-button"
      aria-label="Mahjong"
    >
      Mahjong
    </Button>
  );

  if (typeof phase === 'object' && phase !== null && 'Setup' in phase) {
    const setupStage = phase.Setup;
    if (setupStage === 'RollingDice') {
      return (
        <>
          {instruction}
          <Button
            onClick={onRollDice}
            disabled={disabled || isBusy || mySeat !== 'East'}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            data-testid="roll-dice-button"
            aria-label="Roll dice to start game"
          >
            Roll Dice
          </Button>
        </>
      );
    }

    return instruction;
  }

  if (typeof phase === 'object' && phase !== null && 'Charleston' in phase) {
    const charlestonDemoted = !canDeclareMahjong;
    const mahjongButton = renderMahjongButton(
      disabled || isBusy || !canDeclareMahjong,
      charlestonDemoted
    );

    if (phase.Charleston === 'CourtesyAcross') {
      const canPass =
        onCourtesyPassSubmit !== undefined &&
        canSubmitCourtesyPass({
          selectedTilesCount: selectedTiles.length,
          courtesyPassCount,
          isBusy,
        });
      const handleCourtesyProceed = onCourtesyPassSubmit ?? (() => {});
      return (
        <>
          {instruction}
          {renderProceedButton(
            disabled || hasSubmittedPass || !canPass,
            handleCourtesyProceed,
            'proceed-button',
            'Proceed with courtesy pass'
          )}
          {mahjongButton}
        </>
      );
    }

    if (phase.Charleston === 'VotingToContinue') {
      const canVote = canSubmitCharlestonVote(selectedTiles.length, hasSubmittedVote, isBusy);

      return (
        <>
          {instruction}
          {renderProceedButton(
            disabled || suppressCharlestonPassAction || !canVote,
            onVoteCharleston,
            'proceed-button',
            'Proceed with Charleston vote'
          )}
          {mahjongButton}
        </>
      );
    }

    const canPass = canCommitCharlestonPass;
    const passButtonDisabled = disabled || suppressCharlestonPassAction || !canPass;

    return (
      <>
        {instruction}
        {renderProceedButton(
          passButtonDisabled,
          onCommitCharlestonPass,
          'proceed-button',
          'Proceed with Charleston pass'
        )}
        {mahjongButton}
      </>
    );
  }

  if (typeof phase === 'object' && phase !== null && 'Playing' in phase) {
    const stage = phase.Playing;
    const mahjongButton = renderMahjongButton(disabled || isBusy || !canDeclareMahjong);

    if (typeof stage === 'object' && stage !== null) {
      if ('Drawing' in stage) {
        return (
          <>
            {instruction}
            {renderProceedButton(true, onDiscardTile, 'proceed-button', 'Proceed with discard')}
            {mahjongButton}
          </>
        );
      }

      if ('Discarding' in stage) {
        const isMe = stage.Discarding.player === mySeat;
        const proceedEnabled = isMe && canCommitDiscard && !suppressDiscardAction;

        return (
          <>
            {instruction}
            {renderProceedButton(
              disabled || isBusy || !proceedEnabled,
              onDiscardTile,
              'proceed-button',
              'Proceed with discard'
            )}
            {mahjongButton}
          </>
        );
      }

      if ('CallWindow' in stage) {
        const canAct = stage.CallWindow.can_act.includes(mySeat);
        const proceedDisabled = disabled || isBusy || !canAct || !canProceedCallWindow;
        const mahjongDisabled = disabled || isBusy || !canAct || !canDeclareMahjong;

        if (!canAct) {
          return null;
        }

        return (
          <>
            {instruction}
            {renderProceedButton(
              proceedDisabled,
              onProceedCallWindow ?? onDiscardTile,
              'proceed-button',
              'Proceed with call window action'
            )}
            {renderMahjongButton(mahjongDisabled)}
          </>
        );
      }
    }

    return (
      <>
        {instruction}
        {renderProceedButton(true, onDiscardTile, 'proceed-button', 'Proceed with discard')}
        {mahjongButton}
      </>
    );
  }

  return instruction;
};

ActionBarPhaseActions.displayName = 'ActionBarPhaseActions';
