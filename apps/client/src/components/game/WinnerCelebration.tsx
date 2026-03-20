/**
 * @module WinnerCelebration
 *
 * Animated celebration overlay displayed when a player wins with valid Mahjong.
 * Shows celebratory title/backdrop motion, winning player info, pattern, and optional hand value.
 * Respects system prefers-reduced-motion preference.
 *
 * Shown immediately after Mahjong validation completes. Followed by {@link ScoringScreen}
 * after user clicks "Continue".
 *
 * @see `src/components/game/ScoringScreen.tsx` for post-celebration scoring display
 */

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { cn } from '@/lib/utils';
import type { Seat } from '@/types/bindings/generated/Seat';

interface WinnerCelebrationProps {
  isOpen: boolean;
  winnerName: string;
  winnerSeat: Seat;
  patternName: string;
  /** Optional point value for the winning hand */
  handValue?: number;
  onContinue: () => void;
}

export const WinnerCelebration: FC<WinnerCelebrationProps> = ({
  isOpen,
  winnerName,
  winnerSeat,
  patternName,
  handValue,
  onContinue,
}) => {
  const { isEnabled } = useAnimationSettings();
  const celebrateWithMotion = isEnabled();

  if (!isOpen) return null;

  return (
    <Dialog open>
      <DialogContent
        className="max-w-[480px] rounded-2xl border-2 border-yellow-400 bg-gray-900 px-10 py-8 shadow-2xl [&>button]:hidden"
        data-testid="winner-celebration"
        role="dialog"
        aria-modal="true"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        {/* Animated backdrop respects prefers-reduced-motion */}
        <div
          className={cn('pointer-events-none absolute inset-0 overflow-hidden', {
            'animate-pulse': celebrateWithMotion,
          })}
          data-testid="winner-celebration-backdrop"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-orange-400/20 to-red-400/20" />
        </div>

        <div className="relative z-10 flex min-w-[320px] flex-col items-center gap-4">
          <DialogTitle
            className={cn('text-5xl font-bold text-yellow-400', {
              'animate-bounce': celebrateWithMotion,
            })}
            data-testid="winner-celebration-title"
          >
            Mahjong!
          </DialogTitle>

          <DialogDescription asChild>
            <div className="text-center">
              <p className="text-2xl font-semibold text-white">
                {winnerName} <span className="text-lg text-gray-300">({winnerSeat})</span>
              </p>
              <p className="mt-1 text-sm text-gray-400">wins!</p>
            </div>
          </DialogDescription>

          <div className="w-full rounded-lg bg-gray-800 px-6 py-3 text-center">
            <p className="text-xs uppercase tracking-wider text-gray-400">Pattern</p>
            <p className="mt-1 text-xl font-semibold text-green-300">{patternName}</p>
            {handValue !== undefined && (
              <p className="mt-1 font-medium text-yellow-300" data-testid="hand-value">
                {handValue} points
              </p>
            )}
          </div>

          <Button
            onClick={onContinue}
            className="mt-2 w-full bg-yellow-500 text-lg font-bold text-black hover:bg-yellow-400"
            data-testid="winner-celebration-continue"
            aria-label="Continue to scoring"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

WinnerCelebration.displayName = 'WinnerCelebration';
