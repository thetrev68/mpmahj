/**
 * CharlestonTracker Component
 *
 * Compact phase indicator for the Charleston sequence.
 * Shows current pass direction, stage label, and ready player count.
 *
 * Related: US-002 (Charleston First Right), US-005 (Charleston Voting)
 */

import type { FC } from 'react';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { TimerMode } from '@/types/bindings/generated/TimerMode';
import { CharlestonTimer } from './CharlestonTimer';
import { cn } from '@/lib/utils';

interface CharlestonTrackerProps {
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
      return { label: 'Pass Right', arrow: '\u2192', blindPass: false };
    case 'SecondRight':
      return { label: 'Pass Right', arrow: '\u2192', blindPass: true };
    case 'FirstAcross':
    case 'SecondAcross':
      return { label: 'Pass Across', arrow: '\u2194', blindPass: false };
    case 'CourtesyAcross':
      return { label: 'Courtesy Pass Negotiation', arrow: '\u25c7', blindPass: false };
    case 'FirstLeft':
      return { label: 'Pass Left', arrow: '\u2190', blindPass: true };
    case 'SecondLeft':
      return { label: 'Pass Left', arrow: '\u2190', blindPass: false };
    case 'VotingToContinue':
      return { label: 'Vote: Stop or Continue?', arrow: '?', blindPass: false };
    case 'Complete':
      return { label: 'Complete', arrow: '\u2713', blindPass: false };
  }
}

/** Return progress text for numbered Charleston passes, or null for non-pass stages */
function getProgressText(stage: CharlestonStage): string | null {
  switch (stage) {
    case 'FirstRight':
      return '1st Charleston \u2013 Pass 1 of 3';
    case 'FirstAcross':
      return '1st Charleston \u2013 Pass 2 of 3';
    case 'FirstLeft':
      return '1st Charleston \u2013 Pass 3 of 3';
    case 'SecondLeft':
      return '2nd Charleston \u2013 Pass 1 of 3';
    case 'SecondAcross':
      return '2nd Charleston \u2013 Pass 2 of 3';
    case 'SecondRight':
      return '2nd Charleston \u2013 Pass 3 of 3';
    default:
      return null;
  }
}

export const CharlestonTracker: FC<CharlestonTrackerProps> = ({
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
      className="rounded-2xl border border-emerald-500/25 px-4 py-2 text-white shadow-md"
      style={{
        background: 'linear-gradient(to right, rgba(12,35,18,0.97), rgba(18,52,28,0.97))',
        borderColor: 'rgba(80,160,100,0.3)',
      }}
      data-testid="charleston-tracker"
      data-chrome-layer="z-20"
      role="status"
      aria-label={`Charleston: ${label}`}
    >
      <div className="flex items-center gap-4">
        {/* Primary: Direction + progress */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold" data-testid="charleston-arrow">
            {arrow}
          </span>
          <span
            className="text-base font-semibold tracking-wide"
            data-testid="charleston-direction"
          >
            {label}
            {blindPass && <span className="text-emerald-300 text-sm font-normal"> (Blind)</span>}
          </span>
          {progressText && (
            <span
              className="text-xs font-semibold text-yellow-300 bg-yellow-900/40 rounded px-2 py-0.5"
              data-testid="charleston-progress"
            >
              {progressText}
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Secondary: Timer */}
        {timer && (
          <CharlestonTimer
            remainingSeconds={timer.remainingSeconds}
            durationSeconds={timer.durationSeconds}
            mode={timer.mode}
          />
        )}

        {/* Tertiary: Per-seat readiness */}
        <div
          className="flex items-center gap-1.5 text-[11px] text-gray-400"
          data-testid="ready-indicators"
        >
          {seatOrder.map((seat) => {
            const isReady = readySet.has(seat);
            return (
              <span
                key={seat}
                className={cn('flex items-center gap-0.5', isReady && 'text-emerald-400')}
                data-testid={`ready-indicator-${seat.toLowerCase()}`}
                aria-label={`${seat} ${isReady ? 'ready' : 'waiting'}`}
              >
                <span>{seat[0]}</span>
                <span>{isReady ? '\u2713' : '\u2022'}</span>
              </span>
            );
          })}
        </div>

        {/* Waiting message */}
        {waitingMessage && (
          <div className="text-sm text-emerald-200 italic" aria-live="polite">
            {waitingMessage}
          </div>
        )}

        {statusMessage && (
          <div
            className="text-sm text-emerald-200 italic"
            data-testid="charleston-status-message"
            aria-live="polite"
          >
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
};

CharlestonTracker.displayName = 'CharlestonTracker';
