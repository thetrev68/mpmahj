import type { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { canSubmitCourtesyPass, getInstructionText } from './ActionBarDerivations';
import type { ActionBarProps } from './ActionBar.types';

interface ActionBarPhaseActionsProps {
  phase: ActionBarProps['phase'];
  mySeat: ActionBarProps['mySeat'];
  readOnly: boolean;
  readOnlyMessage: string;
  selectedTiles: NonNullable<ActionBarProps['selectedTiles']>;
  canCommitCharlestonPass: boolean;
  hasSubmittedPass: boolean;
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

  const renderDiscardButton = (buttonDisabled: boolean) => (
    <Button
      onClick={onDiscardTile}
      disabled={buttonDisabled}
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
      return (
        <>
          {instruction}
          <Button
            onClick={onCourtesyPassSubmit}
            disabled={disabled || !canPass}
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

    const canPass = canCommitCharlestonPass;
    const passButtonDisabled = disabled || suppressCharlestonPassAction || !canPass;

    return (
      <>
        {instruction}
        <Button
          onClick={onCommitCharlestonPass}
          disabled={passButtonDisabled}
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
            {renderDiscardButton(true)}
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
              {renderDiscardButton(discardButtonDisabled)}
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
                aria-label="Declare Mahjong"
              >
                Declare Mahjong
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
            {renderDiscardButton(discardButtonDisabled)}
          </>
        );
      }
    }

    return (
      <>
        {instruction}
        {renderDiscardButton(true)}
      </>
    );
  }

  return instruction;
};

ActionBarPhaseActions.displayName = 'ActionBarPhaseActions';
