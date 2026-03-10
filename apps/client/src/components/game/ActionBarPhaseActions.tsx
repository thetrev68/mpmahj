import type { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  onCourtesyPassSubmit?: () => void;
  canRequestHint: boolean;
  onOpenHintRequest?: () => void;
  isHintRequestPending: boolean;
  canDeclareMahjong: boolean;
  onDeclareMahjong?: () => void;
  canExchangeJoker: boolean;
  onExchangeJoker?: () => void;
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
  onCourtesyPassSubmit,
  canRequestHint,
  onOpenHintRequest,
  isHintRequestPending,
  canDeclareMahjong,
  onDeclareMahjong,
  canExchangeJoker,
  onExchangeJoker,
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

  const instructionText = getInstructionText(
    phase,
    mySeat,
    selectedTiles.length,
    courtesyPassCount
  );
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
    if (phase.Charleston === 'CourtesyAcross') {
      const canPass =
        courtesyPassCount !== undefined &&
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
            disabled || !canPass,
            handleCourtesyProceed,
            'courtesy-pass-tiles-button',
            'Proceed with courtesy pass'
          )}
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
          {!suppressCharlestonPassAction &&
            renderProceedButton(
              disabled || !canVote,
              onVoteCharleston,
              'proceed-button',
              'Proceed with Charleston vote'
            )}
        </>
      );
    }

    const canPass = canCommitCharlestonPass;
    const passButtonDisabled = disabled || suppressCharlestonPassAction || !canPass;

    return (
      <>
        {instruction}
        {!suppressCharlestonPassAction &&
          renderProceedButton(
            passButtonDisabled,
            onCommitCharlestonPass,
            'pass-tiles-button',
            'Proceed with Charleston pass'
          )}
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

    if (typeof stage === 'object' && stage !== null) {
      if ('Drawing' in stage) {
        const isMe = stage.Drawing.player === mySeat;
        return (
          <>
            {instruction}
            <div
              className="text-center text-sm text-emerald-200 italic"
              data-testid="playing-status"
            >
              {isMe ? 'Your turn - Drawing tile...' : `${stage.Drawing.player}'s turn - Drawing`}
            </div>
            {renderProceedButton(true, onDiscardTile, 'discard-button', 'Proceed with discard')}
          </>
        );
      }

      if ('Discarding' in stage) {
        const isMe = stage.Discarding.player === mySeat;
        const canDiscard = canCommitDiscard;
        const discardButtonDisabled = disabled || suppressDiscardAction || !isMe || !canDiscard;
        if (isMe) {
          return (
            <>
              {instruction}
              <div
                className="text-center text-sm text-emerald-200 italic"
                data-testid="playing-status"
              >
                Your turn - Select a tile to discard
              </div>
              {!suppressDiscardAction &&
                renderProceedButton(
                  discardButtonDisabled,
                  onDiscardTile,
                  'discard-button',
                  'Proceed with discard'
                )}
              {onOpenHintRequest && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={onOpenHintRequest}
                        disabled={disabled || isBusy || isHintRequestPending || !canRequestHint}
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
              <Button
                onClick={onDeclareMahjong}
                disabled={disabled || isBusy || !canDeclareMahjong}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold motion-safe:animate-pulse"
                data-testid="declare-mahjong-button"
                aria-label="Mahjong"
              >
                Mahjong
              </Button>
              <Button
                onClick={onExchangeJoker}
                disabled={disabled || isBusy || !canExchangeJoker}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                data-testid="exchange-joker-button"
                aria-label="Exchange Joker"
              >
                Exchange Joker
              </Button>
            </>
          );
        }

        return (
          <>
            {instruction}
            <div
              className="text-center text-sm text-emerald-200 italic"
              data-testid="playing-status"
            >
              {stage.Discarding.player}'s turn - Discarding
            </div>
            {!suppressDiscardAction &&
              renderProceedButton(
                discardButtonDisabled,
                onDiscardTile,
                'discard-button',
                'Proceed with discard'
              )}
          </>
        );
      }
    }

    return (
      <>
        {instruction}
        {renderProceedButton(true, onDiscardTile, 'discard-button', 'Proceed with discard')}
      </>
    );
  }

  return instruction;
};

ActionBarPhaseActions.displayName = 'ActionBarPhaseActions';
