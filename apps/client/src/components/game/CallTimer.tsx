/**
 * CallTimer Component
 *
 * Displays a countdown timer for the call window with visual progress bar.
 *
 * Related: US-011 (Call Window & Intent Buffering) - AC-1
 */

import type { FC } from 'react';

interface CallTimerProps {
  /** Seconds remaining in the call window */
  remainingSeconds: number;
  /** Total duration of the timer in seconds */
  durationSeconds: number;
}

/**
 * Timer component for call window countdown
 */
export const CallTimer: FC<CallTimerProps> = ({ remainingSeconds, durationSeconds }) => {
  const percentage = durationSeconds > 0 ? (remainingSeconds / durationSeconds) * 100 : 0;
  const isWarning = remainingSeconds <= 2;

  return (
    <div
      className="flex flex-col gap-1"
      role="timer"
      aria-label={`${remainingSeconds} seconds remaining`}
    >
      {/* Timer Text */}
      <div
        className={`text-center font-bold text-lg ${isWarning ? 'text-red-500' : 'text-gray-700'}`}
      >
        {remainingSeconds}s
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          data-testid="timer-progress"
          className={`h-full transition-all duration-300 ${isWarning ? 'bg-red-500' : 'bg-blue-500'
            }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

CallTimer.displayName = 'CallTimer';
