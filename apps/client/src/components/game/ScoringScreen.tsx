/**
 * @module ScoringScreen
 *
 * Displays full scoring breakdown after a valid Mahjong declaration,
 * showing winner, pattern name, base score, payment matrix, and final scores.
 * Modal blocks all interaction until player clicks "Continue".
 *
 * Shown after {@link src/components/game/WinnerCelebration.tsx} animation completes.
 *
 * @see {@link src/components/game/WinnerCelebration.tsx} for celebration overlay
 * @see {@link src/components/game/DrawScoringScreen.tsx} for draw/forfeit scoring
 */

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { GameResult } from '@/types/bindings/generated/GameResult';
import type { Seat } from '@/types/bindings/generated/Seat';

const ALL_SEATS: Seat[] = ['East', 'South', 'West', 'North'];

/**
 * Props for the ScoringScreen component.
 *
 * @interface ScoringScreenProps
 * @property {boolean} isOpen - Whether the dialog is visible.
 * @property {GameResult} result - Game result including score breakdown and final scores.
 *   @see {@link src/types/bindings/generated/GameResult.ts}
 * @property {string} winnerName - Display name of winning player (for header).
 * @property {boolean} isSelfDraw - True if winner drew the winning tile themselves.
 *   Affects payment display (all players pay vs. discarder pays).
 * @property {Seat} [calledFrom] - Discarder's seat (shown when isSelfDraw is false).
 * @property {() => void} onContinue - Callback fired when user clicks "Continue".
 */
interface ScoringScreenProps {
  isOpen: boolean;
  result: GameResult;
  /** Display name of the winning player */
  winnerName: string;
  /** True when winner drew the tile themselves */
  isSelfDraw: boolean;
  /** The seat that discarded the winning tile (set when isSelfDraw is false) */
  calledFrom?: Seat;
  onContinue: () => void;
}

export const ScoringScreen: FC<ScoringScreenProps> = ({
  isOpen,
  result,
  winnerName,
  isSelfDraw,
  calledFrom,
  onContinue,
}) => {
  if (!isOpen) return null;

  const { winner, winning_pattern, score_breakdown, final_scores } = result;
  const baseScore = score_breakdown?.base_score;
  const payments = score_breakdown?.payments ?? {};

  // Seats that pay the winner (negative payment = paying out)
  const payers = ALL_SEATS.filter((s) => s !== winner && payments[s] !== undefined);

  return (
    <Dialog open>
      <DialogContent
        className="flex w-full max-w-[520px] flex-col gap-5 rounded-2xl border border-green-500 bg-gray-900 px-8 py-6 shadow-2xl [&>button]:hidden"
        data-testid="scoring-screen"
        role="dialog"
        aria-modal="true"
        aria-label="Scoring screen"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        {/* Header */}
        <div className="text-center">
          <h2 className="text-4xl font-bold text-yellow-400">MAHJONG!</h2>
          <p className="text-xl font-semibold text-white mt-1">
            {winnerName} <span className="text-gray-400 text-base">({winner})</span> wins!
          </p>
        </div>

        {/* Pattern & Score */}
        <div className="bg-gray-800 rounded-lg px-5 py-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Pattern</span>
            <span className="text-green-300 font-semibold">{winning_pattern}</span>
          </div>
          {baseScore !== undefined && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-gray-400 text-sm">Base Score</span>
              <span className="text-white font-semibold" data-testid="base-score">
                {baseScore} pts
              </span>
            </div>
          )}
          {isSelfDraw && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-gray-400 text-sm">Self-Draw</span>
              <span className="text-yellow-300 text-sm font-medium">{'\u2713'}</span>
            </div>
          )}
          {!isSelfDraw && calledFrom && (
            <div className="flex justify-between items-center mt-1" data-testid="called-from-row">
              <span className="text-gray-400 text-sm">Called From</span>
              <span className="text-yellow-300 text-sm font-medium">{calledFrom}</span>
            </div>
          )}
        </div>

        {/* Payments */}
        {payers.length > 0 && (
          <div className="bg-gray-800 rounded-lg px-5 py-3">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Payments</p>
            {payers.map((seat) => {
              const amount = Math.abs(payments[seat] ?? 0);
              return (
                <div
                  key={seat}
                  className="flex justify-between items-center py-0.5"
                  data-testid={`payment-${seat}`}
                >
                  <span className="text-gray-300 text-sm">{seat}</span>
                  <span className="text-red-400 text-sm font-medium">-{amount} pts</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Final Scores */}
        <div className="bg-gray-800 rounded-lg px-5 py-3">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Final Scores</p>
          {ALL_SEATS.map((seat) => {
            const score = final_scores[seat];
            const isWinner = seat === winner;
            return (
              <div
                key={seat}
                className="flex justify-between items-center py-0.5"
                data-testid={`final-score-${seat}`}
              >
                <span
                  className={`text-sm ${isWinner ? 'text-yellow-300 font-semibold' : 'text-gray-300'}`}
                >
                  {seat}
                </span>
                <span
                  className={`text-sm font-medium ${score === undefined
                      ? 'text-gray-500'
                      : score >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                >
                  {score !== undefined ? (score >= 0 ? `+${score}` : `${score}`) : '-'}
                </span>
              </div>
            );
          })}
        </div>

        <Button
          onClick={onContinue}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-bold"
          aria-label="Continue"
        >
          Continue
        </Button>
      </DialogContent>
    </Dialog>
  );
};

ScoringScreen.displayName = 'ScoringScreen';
