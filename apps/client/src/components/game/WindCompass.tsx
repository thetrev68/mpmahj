/**
 * WindCompass Component
 *
 * Persistent seat-orientation HUD showing all four seats on a compass rose.
 * Replaces the scattered active-seat badge approach with a single, always-visible
 * mini-map so players always know who sits where relative to absolute wind directions.
 *
 * - Your seat: blue highlight
 * - Active turn seat: green (if you) or yellow (opponent), with pulse
 * - Dead hand seat: red (US-020)
 *
 * Related: US-009 (Drawing a Tile), US-010 (Discarding a Tile), US-020 (Dead Hand)
 */

import type { FC } from 'react';
import { cn } from '@/lib/utils';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

const WIND_LETTER: Record<Seat, string> = {
  East: 'E',
  South: 'S',
  West: 'W',
  North: 'N',
};

/**
 * CSS classes to position each seat node within the compass circle (w-28 h-28 = 112px).
 * Each node is ~28px; nudged inward by 4px (top-1/right-1/bottom-1/left-1) so the
 * circles sit inside the background ring rather than straddling it.
 */
const NODE_STYLE: Record<Seat, string> = {
  North: 'top-1 left-1/2 -translate-x-1/2',
  East: 'right-1 top-1/2 -translate-y-1/2',
  South: 'bottom-1 left-1/2 -translate-x-1/2',
  West: 'left-1 top-1/2 -translate-y-1/2',
};

function getStageName(stage: TurnStage | null | undefined): string {
  if (!stage || typeof stage !== 'object') return '';
  if ('Drawing' in stage) return 'Drawing';
  if ('Discarding' in stage) return 'Discarding';
  if ('CallWindow' in stage) return 'Call Window';
  if ('AwaitingMahjong' in stage) return 'Awaiting Mahjong';
  return '';
}

interface WindCompassProps {
  /** The local player's seat — shown in blue to aid orientation */
  yourSeat: Seat;
  /** Seat whose turn it currently is */
  activeSeat: Seat;
  /** Current turn stage — included in accessible label for the active node */
  stage?: TurnStage | null;
  /** Seats whose hands have been declared dead (US-020) */
  deadHandSeats?: Seat[];
}

/**
 * WindCompass renders a compact compass-rose HUD (fixed, bottom-right corner).
 * All four seats are always visible so players can orient themselves at a glance.
 */
export const WindCompass: FC<WindCompassProps> = ({
  yourSeat,
  activeSeat,
  stage,
  deadHandSeats = [],
}) => {
  const stageName = getStageName(stage);

  return (
    <div
      className="fixed bottom-4 right-4 z-20 w-28 h-28"
      data-testid="wind-compass"
      role="region"
      aria-label="Seat orientation compass"
    >
      {/* Circular background */}
      <div className="absolute inset-0 rounded-full bg-gray-900/80 border border-gray-600/60 backdrop-blur-sm" />

      {/* Cross lines */}
      <div className="absolute top-1/2 left-6 right-6 h-px bg-gray-600/40 -translate-y-1/2" />
      <div className="absolute left-1/2 top-6 bottom-6 w-px bg-gray-600/40 -translate-x-1/2" />

      {/* Center dot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gray-500" />

      {/* Seat nodes */}
      {(['East', 'South', 'West', 'North'] as Seat[]).map((seat) => {
        const isActive = seat === activeSeat;
        const isYou = seat === yourSeat;
        const isDead = deadHandSeats.some((s) => s === seat);
        const label = isActive
          ? `${seat}'s turn${stageName ? ` - ${stageName}` : ''}`
          : `${seat}${isYou ? ' (You)' : ''}${isDead ? ' - Dead Hand' : ''}`;

        return (
          <div
            key={seat}
            className={cn('absolute flex items-center justify-center', NODE_STYLE[seat])}
            data-testid={`compass-seat-${seat.toLowerCase()}`}
          >
            <span
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                // "You" ring — applied on top of the background colour ring
                isYou && 'ring-2 ring-white/70 ring-offset-1 ring-offset-gray-900',
                isDead
                  ? 'bg-red-800 border-2 border-red-600 text-red-100'
                  : isActive
                    ? isYou
                      ? 'bg-green-600 border-2 border-green-400 text-white animate-pulse'
                      : 'bg-yellow-500 border-2 border-yellow-300 text-gray-900 animate-pulse'
                    : isYou
                      ? 'bg-blue-700 border-2 border-blue-400 text-white'
                      : 'bg-gray-700 border-2 border-gray-500 text-gray-300'
              )}
              role={isActive ? 'status' : undefined}
              aria-live={isActive ? 'polite' : undefined}
              aria-label={label}
              data-testid={isDead ? `dead-hand-badge-${seat.toLowerCase()}` : undefined}
            >
              {WIND_LETTER[seat]}
              {/* Screen-reader text for dead hand — also satisfies legacy toHaveTextContent checks */}
              {isDead && <span className="sr-only">DEAD HAND</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
};

WindCompass.displayName = 'WindCompass';
