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
  /** Optional timer details */
  timer?: { remainingSeconds: number; durationSeconds: number; mode: TimerMode } | null;
}

/** Map Charleston stage to display info */
function getStageInfo(stage: CharlestonStage): { label: string; arrow: string } {
  switch (stage) {
    case 'FirstRight':
    case 'SecondRight':
      return { label: 'Pass Right', arrow: '→' };
    case 'FirstAcross':
    case 'SecondAcross':
    case 'CourtesyAcross':
      return { label: 'Pass Across', arrow: '↔' };
    case 'FirstLeft':
    case 'SecondLeft':
      return { label: 'Pass Left', arrow: '←' };
    case 'VotingToContinue':
      return { label: 'Vote', arrow: '?' };
    case 'Complete':
      return { label: 'Complete', arrow: '✓' };
  }
}

export const CharlestonTracker: React.FC<CharlestonTrackerProps> = ({
  stage,
  readyPlayers,
  waitingMessage,
  timer,
}) => {
  const { label, arrow } = getStageInfo(stage);

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
        </span>
        <span className="text-xl font-bold" data-testid="charleston-arrow">
          {arrow}
        </span>
      </div>

      {/* Ready count */}
      <div className="text-sm text-gray-300" data-testid="ready-count">
        {readyPlayers.length}/4 ready
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
    </div>
  );
};

CharlestonTracker.displayName = 'CharlestonTracker';
