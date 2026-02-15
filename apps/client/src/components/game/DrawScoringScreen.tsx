/**
 * DrawScoringScreen Component (US-021)
 *
 * Displays final scores for a draw game (wall exhausted or all dead hands).
 * No score changes - all players keep their current scores.
 *
 * Related: US-021 (AC-3)
 */

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { Seat } from '@/types/bindings/generated/Seat';

const ALL_SEATS: Seat[] = ['East', 'South', 'West', 'North'];

interface DrawScoringScreenProps {
  isOpen: boolean;
  /** Why the game ended in a draw (e.g. "Wall exhausted" or "All players dead hands") */
  reason: string;
  /** Current scores per seat (unchanged) */
  currentScores: Partial<Record<Seat, number>>;
  onContinue: () => void;
}

/**
 * DrawScoringScreen
 *
 * Shows "Draw - No Winner" with each player's final score (+/-0).
 * Does not show payments or a winning pattern.
 *
 * @example
 * ```tsx
 * <DrawScoringScreen
 *   isOpen={showDrawScoringScreen}
 *   reason="Wall exhausted"
 *   currentScores={{ East: 500, South: 485, West: 510, North: 505 }}
 *   onContinue={() => setShowGameOverPanel(true)}
 * />
 * ```
 */
export const DrawScoringScreen: FC<DrawScoringScreenProps> = ({
  isOpen,
  reason,
  currentScores,
  onContinue,
}) => {
  if (!isOpen) return null;

  return (
    <Dialog open>
      <DialogContent
        className="flex w-full max-w-[520px] flex-col gap-5 rounded-2xl border border-blue-500 bg-gray-900 px-8 py-6 shadow-2xl [&>button]:hidden"
        data-testid="draw-scoring-screen"
        role="dialog"
        aria-modal="true"
        aria-label="Draw scoring screen"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        {/* Header */}
        <div className="text-center">
          <h2 className="text-4xl font-bold text-blue-300" data-testid="draw-scoring-title">
            GAME DRAW
          </h2>
          <p className="text-xl font-semibold text-gray-200 mt-1">
            Result:{' '}
            <span className="text-blue-300" data-testid="draw-scoring-result">
              No Winner
            </span>
          </p>
          <p className="text-sm text-gray-400 mt-1" data-testid="draw-scoring-reason">
            Reason: {reason}
          </p>
        </div>

        {/* Final Scores (unchanged) */}
        <div className="bg-gray-800 rounded-lg px-5 py-3">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
            Final Scores (Unchanged)
          </p>
          {ALL_SEATS.map((seat) => {
            const score = currentScores[seat];
            return (
              <div
                key={seat}
                className="flex justify-between items-center py-0.5"
                data-testid={`draw-final-score-${seat}`}
              >
                <span className="text-gray-300 text-sm">{seat}</span>
                <span className="text-gray-300 text-sm font-medium">
                  {score !== undefined ? score : '-'}
                  <span className="text-gray-500 text-xs ml-1">(+/-0)</span>
                </span>
              </div>
            );
          })}
        </div>

        <Button
          onClick={onContinue}
          className="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold"
          aria-label="Continue"
          data-testid="draw-scoring-continue"
        >
          Continue
        </Button>
      </DialogContent>
    </Dialog>
  );
};

DrawScoringScreen.displayName = 'DrawScoringScreen';
