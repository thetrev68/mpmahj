/**
 * @module CharlestonTimer
 *
 * Displays the countdown timer during the Charleston phase, showing remaining time
 * and warning when time is running low (≤10 seconds). Respects the server-provided
 * {@link TimerMode} and hides entirely when mode is 'Hidden'.
 *
 * Pairs with `CallTimer` for the main game's call window timer.
 *
 * @see `src/components/game/CallTimer.tsx` for call window timer UI
 */

import type { FC } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TimerMode } from '@/types/bindings/generated/TimerMode';
import { CHARLESTON_TIMER_WARNING_SECONDS } from '@/lib/constants';

/**
 * Props for the CharlestonTimer component.
 *
 * @interface CharlestonTimerProps
 * @property {number} remainingSeconds - Seconds left until phase timeout. Must be ≥ 0.
 * @property {number} durationSeconds - Total phase duration in seconds (used for display reference).
 * @property {TimerMode} mode - Timer visibility mode from server. When 'Hidden', component returns null.
 *   @see `src/types/bindings/generated/TimerMode.ts` for valid modes
 */
interface CharlestonTimerProps {
  remainingSeconds: number;
  durationSeconds: number;
  mode: TimerMode;
}

export const CharlestonTimer: FC<CharlestonTimerProps> = ({
  remainingSeconds,
  durationSeconds,
  mode,
}) => {
  if (mode === 'Hidden') return null;

  const isLow = remainingSeconds <= CHARLESTON_TIMER_WARNING_SECONDS;

  return (
    <div
      className={cn('flex items-center gap-2', isLow && 'text-red-300')}
      data-testid="charleston-timer"
      aria-live="polite"
    >
      <Badge variant={isLow ? 'destructive' : 'secondary'}>Timer</Badge>
      <span className="text-sm">
        {remainingSeconds}s / {durationSeconds}s
      </span>
    </div>
  );
};

CharlestonTimer.displayName = 'CharlestonTimer';
