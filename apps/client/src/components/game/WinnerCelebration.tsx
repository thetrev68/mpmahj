/**
 * WinnerCelebration Component
 *
 * Celebration overlay shown when a player wins with a valid Mahjong hand.
 * Respects prefers-reduced-motion for animations.
 *
 * Related: US-018 (AC-4), US-019
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import type { Seat } from '@/types/bindings/generated/Seat';

export interface WinnerCelebrationProps {
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
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      data-testid="winner-celebration"
      role="dialog"
      aria-modal="true"
      aria-label={`Mahjong! ${winnerName} wins`}
    >
      {/* Animated confetti backdrop respects prefers-reduced-motion */}
      <div className="motion-safe:animate-pulse absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-orange-400/20 to-red-400/20" />
      </div>

      <div className="relative z-10 bg-gray-900 border-2 border-yellow-400 rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 min-w-[320px] max-w-[480px]">
        <h1 className="text-5xl font-bold text-yellow-400 motion-safe:animate-bounce">Mahjong!</h1>

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
    </div>
  );
};

WinnerCelebration.displayName = 'WinnerCelebration';
