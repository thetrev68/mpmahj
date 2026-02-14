/**
 * @module WinnerCelebration
 *
 * Animated celebration overlay displayed when a player wins with valid Mahjong.
 * Shows confetti, winning player info, pattern, and optional hand value.
 * Respects system prefers-reduced-motion preference.
 *
 * Shown immediately after Mahjong validation completes. Followed by {@link ScoringScreen}
 * after user clicks "Continue".
 *
 * @see {@link src/components/game/ScoringScreen.tsx} for post-celebration scoring display
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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

export const WinnerCelebration: React.FC<WinnerCelebrationProps> = ({
  isOpen,
  winnerName,
  winnerSeat,
  patternName,
  handValue,
  onContinue,
}) => {
  const { isEnabled } = useAnimationSettings();
  const celebrateWithMotion = isEnabled('win_celebration');

  if (!isOpen) return null;

  return (
    <Dialog open>
      <DialogContent
        className="max-w-[480px] rounded-2xl border-2 border-yellow-400 bg-gray-900 px-10 py-8 shadow-2xl [&>button]:hidden"
        data-testid="winner-celebration"
        role="dialog"
        aria-modal="true"
        aria-label={`Mahjong! ${winnerName} wins`}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        {/* Animated confetti backdrop respects prefers-reduced-motion */}
        <div
          className={cn('pointer-events-none absolute inset-0 overflow-hidden', {
            'motion-safe:animate-pulse': celebrateWithMotion,
          })}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-orange-400/20 to-red-400/20" />
        </div>

        <div className="relative z-10 flex min-w-[320px] flex-col items-center gap-4">
          <h1
            className={cn('text-5xl font-bold text-yellow-400', {
              'motion-safe:animate-bounce': celebrateWithMotion,
            })}
          >
            Mahjong!
          </h1>

          <div className="text-center">
            <p className="text-2xl font-semibold text-white">
              {winnerName} <span className="text-gray-300 text-lg">({winnerSeat})</span>
            </p>
            <p className="text-gray-400 text-sm mt-1">wins!</p>
          </div>

          <div className="text-center bg-gray-800 rounded-lg px-6 py-3 w-full">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Pattern</p>
            <p className="text-xl font-semibold text-green-300 mt-1">{patternName}</p>
            {handValue !== undefined && (
              <p className="text-yellow-300 font-medium mt-1" data-testid="hand-value">
                {handValue} points
              </p>
            )}
          </div>

          <Button
            onClick={onContinue}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg mt-2"
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
