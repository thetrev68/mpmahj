import type { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  canSubmitCharlestonVote,
  canSubmitCourtesyPass,
  getCharlestonVoteChoice,
  getCharlestonVoteWaitingMessage,
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
  myVote,
  votedPlayers,
  totalPlayers,
  botVoteMessage,
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

  const instructionText = getInstructionText(phase, mySeat, callWindowInstruction);
  const instruction = (
    <div className="text-center text-gray-300 text-sm" data-testid="action-instruction">
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

  const renderMahjongButton = (buttonDisabled: boolean) => (
    <Button
      onClick={onDeclareMahjong}
      disabled={buttonDisabled}
      className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold motion-safe:animate-pulse"
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
    const mahjongButton = renderMahjongButton(disabled || isBusy || !canDeclareMahjong);

    if (phase.Charleston === 'CourtesyAcross') {
      const canPass =
        onCourtesyPassSubmit !== undefined &&
        canSubmitCourtesyPass({
          selectedTilesCount: selectedTiles.length,
          courtesyPassCount,
          isBusy,
        });
      const handleCourtesyProceed = onCourtesyPassSubmit ?? (() => {});
      const courtesyInstructionText = hasSubmittedPass
        ? 'Courtesy pass submitted. Waiting for your across partner...'
        : instructionText;
      return (
        <>
          <div className="text-center text-gray-300 text-sm" data-testid="action-instruction">
            {courtesyInstructionText}
          </div>
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
      const voteChoice = getCharlestonVoteChoice(selectedTiles.length);
      const canVote = canSubmitCharlestonVote(selectedTiles.length, hasSubmittedVote, isBusy);
      const waitingMessage = getCharlestonVoteWaitingMessage(votedPlayers, totalPlayers);

      return (
        <>
          {instruction}
          <div className="space-y-2 text-center" data-testid="vote-panel">
            {hasSubmittedVote && myVote ? (
              <p
                className="text-sm font-semibold text-emerald-300"
                data-testid="vote-status-message"
              >
                {`You voted to ${myVote.toUpperCase()}. Waiting for other players...`}
              </p>
            ) : (
              <p className="text-sm text-gray-300">
                {voteChoice === 'Continue'
                  ? 'Three staged tiles means Proceed will continue Charleston.'
                  : 'No staged tiles means Proceed will stop Charleston.'}
              </p>
            )}
            {votedPlayers.length > 0 && (
              <p className="text-xs text-gray-400" data-testid="vote-progress">
                {votedPlayers.length}/{totalPlayers} players voted
              </p>
            )}
            <div
              className="flex items-center justify-center gap-3 text-xs text-gray-300"
              data-testid="vote-indicators"
            >
              {(['East', 'South', 'West', 'North'] as const).map((seat) => {
                const hasVotedSeat = votedPlayers.includes(seat);
                return (
                  <span
                    key={seat}
                    className={hasVotedSeat ? 'text-emerald-300' : ''}
                    data-testid={`vote-indicator-${seat.toLowerCase()}`}
                  >
                    {seat} {hasVotedSeat ? '\u2713' : '\u2022'}
                  </span>
                );
              })}
            </div>
            {waitingMessage && (
              <p className="text-xs italic text-gray-400" data-testid="vote-waiting-message">
                {waitingMessage}
              </p>
            )}
            {botVoteMessage && (
              <p
                className="text-sm text-emerald-200"
                data-testid="bot-vote-message"
                aria-live="polite"
              >
                {botVoteMessage}
              </p>
            )}
          </div>
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
        {hasSubmittedPass && (
          <div className="text-center text-gray-300 text-sm italic" aria-live="polite">
            Waiting for other players...
          </div>
        )}
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
