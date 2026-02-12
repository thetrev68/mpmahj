/**
 * CharlestonTracker Component
 *
 * Compact phase indicator for the Charleston sequence.
 * Shows current pass direction, stage label, and ready player count.
 *
 * Related: US-002 (Charleston First Right), US-005 (Charleston Voting)
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { TimerMode } from '@/types/bindings/generated/TimerMode';
import { CharlestonTimer } from './CharlestonTimer';

export interface CharlestonTrackerProps {
  /** Current Charleston stage from server */
  stage: CharlestonStage;
  /** Players who have submitted their pass */
  readyPlayers: Seat[];
  /** Optional waiting message */
  waitingMessage?: string;
  /** Optional status message (e.g., bot pass updates) */
  statusMessage?: string;
  /** Optional timer details */
  timer?: { remainingSeconds: number; durationSeconds: number; mode: TimerMode } | null;
}

/** Map Charleston stage to display info */
function getStageInfo(stage: CharlestonStage): {
  label: string;
  arrow: string;
  blindPass: boolean;
} {
  switch (stage) {
    case 'FirstRight':
      return { label: 'Pass Right', arrow: '→', blindPass: false };
    case 'SecondRight':
      return { label: 'Pass Right', arrow: '→', blindPass: true };
    case 'FirstAcross':
    case 'SecondAcross':
    case 'CourtesyAcross':
      return { label: 'Pass Across', arrow: '↔', blindPass: false };
    case 'FirstLeft':
    case 'SecondLeft':
      return { label: 'Pass Left', arrow: '←', blindPass: true };
    case 'VotingToContinue':
      return { label: 'Vote: Stop or Continue?', arrow: '?', blindPass: false };
    case 'Complete':
      return { label: 'Complete', arrow: '✓', blindPass: false };
  }
}

/** Return progress text for numbered Charleston passes, or null for non-pass stages */
function getProgressText(stage: CharlestonStage): string | null {
  switch (stage) {
    case 'FirstRight':
      return '1st Charleston – Pass 1 of 3';
    case 'FirstAcross':
      return '1st Charleston – Pass 2 of 3';
    case 'FirstLeft':
      return '1st Charleston – Pass 3 of 3';
    case 'SecondLeft':
      return '2nd Charleston – Pass 1 of 3';
    case 'SecondAcross':
      return '2nd Charleston – Pass 2 of 3';
    case 'SecondRight':
      return '2nd Charleston – Pass 3 of 3';
    default:
      return null;
  }
}

export const CharlestonTracker: React.FC<CharlestonTrackerProps> = ({
  stage,
  readyPlayers,
  waitingMessage,
  statusMessage,
  timer,
}) => {
  const { label, arrow, blindPass } = getStageInfo(stage);
  const progressText = getProgressText(stage);
  const readySet = new Set(readyPlayers);
  const seatOrder: Seat[] = ['East', 'South', 'West', 'North'];

  return (
    <div
      className={cn(
        'fixed top-[105px] left-1/2 -translate-x-1/2',
        'bg-black/85 text-white rounded-lg',
        'px-6 py-3',
        'flex items-center gap-4'
      )}
      data-testid="charleston-tracker"
      role="status"
      aria-label={`Charleston: ${label}`}
    >
      {/* Direction label */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" data-testid="charleston-direction">
          {label}
          {blindPass && <span className="text-emerald-300"> (Blind Pass Available)</span>}
        </span>
        <span className="text-xl font-bold" data-testid="charleston-arrow">
          {arrow}
        </span>
      </div>

      {/* Progress indicator: "1st/2nd Charleston – Pass X of 3" */}
      {progressText && (
        <div
          className="text-xs font-semibold text-yellow-300 bg-yellow-900/40 rounded px-2 py-0.5"
          data-testid="charleston-progress"
        >
          {progressText}
        </div>
      )}

      {/* Ready count */}
      <div className="text-sm text-gray-300" data-testid="ready-count">
        {readyPlayers.length}/4 ready
      </div>

      {/* Ready indicators */}
      <div className="flex items-center gap-2 text-xs text-gray-300" data-testid="ready-indicators">
        {seatOrder.map((seat) => {
          const isReady = readySet.has(seat);
          return (
            <span
              key={seat}
              className={cn('flex items-center gap-1', isReady && 'text-emerald-300')}
              data-testid={`ready-indicator-${seat.toLowerCase()}`}
              aria-label={`${seat} ${isReady ? 'ready' : 'waiting'}`}
            >
              <span>{seat}</span>
              <span>{isReady ? '✓' : '•'}</span>
            </span>
          );
        })}
      </div>

      {/* Timer */}
      {timer && (
        <CharlestonTimer
          remainingSeconds={timer.remainingSeconds}
          durationSeconds={timer.durationSeconds}
          mode={timer.mode}
        />
      )}

      {/* Waiting message */}
      {waitingMessage && (
        <div className="text-sm text-gray-400 italic" aria-live="polite">
          {waitingMessage}
        </div>
      )}

      {statusMessage && (
        <div
          className="text-sm text-emerald-200"
          data-testid="charleston-status-message"
          aria-live="polite"
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
};

CharlestonTracker.displayName = 'CharlestonTracker';
