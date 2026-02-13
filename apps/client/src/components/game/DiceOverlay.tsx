/**
 * DiceOverlay Component
 *
 * Animated dice roll overlay for round start and wall break determination.
 * Temporarily blocks interaction and highlights the rolled values.
 *
 * Related: US-001 (Roll Dice & Break Wall)
 */

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface DiceOverlayProps {
  /** Whether the overlay is visible */
  isOpen: boolean;
  /** Dice roll total (2-12) from PublicEvent::DiceRolled */
  rollTotal: number;
  /** Animation duration in milliseconds */
  durationMs?: number;
  /** Whether to show the total below the dice */
  showTotal?: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
}

/**
 * DiceOverlay displays an animated dice roll result
 */
export const DiceOverlay: React.FC<DiceOverlayProps> = ({
  isOpen,
  rollTotal,
  durationMs = 500,
  showTotal = true,
  onComplete,
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isOpen) {
      setIsVisible(true);
      setIsRolling(true);
      /* eslint-enable react-hooks/set-state-in-effect */

      // After animation duration, show settled state
      const rollTimer = setTimeout(() => {
        setIsRolling(false);
      }, durationMs);

      // Call onComplete callback after animation
      const completeTimer = setTimeout(() => {
        onComplete?.();
      }, durationMs + 200); // Small delay after settling

      return () => {
        clearTimeout(rollTimer);
        clearTimeout(completeTimer);
      };
    } else {
      setIsVisible(false);
      setIsRolling(false);
    }
  }, [isOpen, durationMs, onComplete]);

  if (!isVisible) return null;

  // Derive individual dice values from total (simple distribution)
  // Since backend only sends sum, we distribute it visually
  const getDiceValues = (total: number): [number, number] => {
    // Try to make it look natural
    if (total <= 7) {
      const die1 = Math.min(total - 1, 6);
      const die2 = total - die1;
      return [die1, die2];
    } else {
      const die1 = Math.ceil(total / 2);
      const die2 = total - die1;
      return [die1, die2];
    }
  };

  const [die1, die2] = getDiceValues(rollTotal);

  return (
    <Dialog open>
      <DialogContent
        className="max-w-fit border-none bg-transparent p-0 shadow-none [&>button]:hidden"
        data-testid="dice-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Dice roll result"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <Card className="bg-white p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-6">
            {/* Dice Display */}
            <div className="flex gap-8 items-center">
              <div
                className={cn(
                  'w-24 h-24 rounded-lg bg-gradient-to-br from-white to-gray-100',
                  'border-2 border-gray-300 shadow-lg',
                  'flex items-center justify-center',
                  'text-5xl font-bold text-gray-800',
                  'transition-all duration-200',
                  {
                    'animate-bounce': isRolling,
                  }
                )}
                data-testid="dice-1"
                aria-label={`Die 1: ${die1}`}
              >
                {isRolling ? '?' : die1}
              </div>
              <div
                className={cn(
                  'w-24 h-24 rounded-lg bg-gradient-to-br from-white to-gray-100',
                  'border-2 border-gray-300 shadow-lg',
                  'flex items-center justify-center',
                  'text-5xl font-bold text-gray-800',
                  'transition-all duration-200',
                  {
                    'animate-bounce': isRolling,
                  }
                )}
                data-testid="dice-2"
                aria-label={`Die 2: ${die2}`}
              >
                {isRolling ? '?' : die2}
              </div>
            </div>

            {/* Total Display */}
            {showTotal && !isRolling && (
              <div
                className="text-3xl font-bold text-gray-900"
                data-testid="dice-total"
                aria-label={`East rolled ${rollTotal}`}
              >
                East rolled {rollTotal}
              </div>
            )}

            {/* Rolling State Text */}
            {isRolling && (
              <div className="text-xl font-semibold text-gray-600 animate-pulse" aria-live="polite">
                Rolling...
              </div>
            )}
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

DiceOverlay.displayName = 'DiceOverlay';
