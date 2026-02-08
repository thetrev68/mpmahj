/**
 * CallWindowPanel Component
 *
 * Displays the call window when a tile is discarded, allowing players to
 * declare intent (Pung/Kong/Mahjong) or pass.
 *
 * Related: US-011 (Call Window & Intent Buffering) - AC-1, AC-2, AC-3, AC-4
 */

import React, { useMemo } from 'react';
import { CallTimer } from './CallTimer';
import { getTileName } from '@/lib/utils/tileUtils';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { Seat } from '@/types/bindings/generated/Seat';

export interface CallWindowPanelProps {
  /** The tile that was discarded and is available for calling */
  callableTile: Tile;
  /** The player who discarded the tile */
  discardedBy: Seat;
  /** Whether the player can call for Pung (has 2 matching tiles) */
  canCallForPung: boolean;
  /** Whether the player can call for Kong (has 3 matching tiles) */
  canCallForKong: boolean;
  /** Whether the player can call for Mahjong (always true in call window) */
  canCallForMahjong: boolean;
  /** Callback when player declares call intent */
  onCallIntent: (intent: 'Mahjong' | 'Pung' | 'Kong') => void;
  /** Callback when player passes on the call */
  onPass: () => void;
  /** Seconds remaining in the call window */
  timerRemaining: number;
  /** Total duration of the timer in seconds */
  timerDuration: number;
  /** Whether all buttons should be disabled (after user responds) */
  disabled: boolean;
  /** Optional response message after declaring intent */
  responseMessage?: string;
  /** Seats that have responded (called or passed) */
  respondedSeats?: Seat[];
  /** Public summaries of declared intents */
  intentSummaries?: CallIntentSummary[];
}

/**
 * Call window panel component
 */
export const CallWindowPanel: React.FC<CallWindowPanelProps> = ({
  callableTile,
  discardedBy,
  canCallForPung,
  canCallForKong,
  canCallForMahjong,
  onCallIntent,
  onPass,
  timerRemaining,
  timerDuration,
  disabled,
  responseMessage,
  respondedSeats,
  intentSummaries,
}) => {
  const tileName = getTileName(callableTile);
  const intentMap = useMemo(() => {
    const map = new Map<Seat, CallIntentSummary['kind']>();
    if (!intentSummaries) return map;
    for (const intent of intentSummaries) {
      map.set(intent.seat, intent.kind);
    }
    return map;
  }, [intentSummaries]);

  const responded = respondedSeats || [];
  const hasResponses = responded.length > 0;

  return (
    <div
      role="dialog"
      aria-label="Call window"
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl p-6 z-50 min-w-[400px]"
    >
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Call Window</h2>
        <p className="text-sm text-gray-600 mt-1">
          {discardedBy} discarded <span className="font-semibold">{tileName}</span>
        </p>
      </div>

      {/* Timer */}
      <div className="mb-4">
        <CallTimer remainingSeconds={timerRemaining} durationSeconds={timerDuration} />
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onCallIntent('Pung')}
            disabled={disabled || !canCallForPung}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Call for Pung
          </button>

          <button
            onClick={() => onCallIntent('Kong')}
            disabled={disabled || !canCallForKong}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Call for Kong
          </button>
        </div>

        <button
          onClick={() => onCallIntent('Mahjong')}
          disabled={disabled || !canCallForMahjong}
          className="px-4 py-3 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg"
        >
          Call for Mahjong
        </button>

        <button
          onClick={onPass}
          disabled={disabled}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          Pass
        </button>
      </div>

      {/* Waiting Message */}
      {disabled && (
        <p className="text-center text-sm text-gray-600 mt-4">
          {responseMessage || 'Waiting for others...'}
        </p>
      )}

      {hasResponses && (
        <div className="mt-4 text-sm text-gray-700">
          <div className="font-semibold mb-1">Responses</div>
          <ul className="space-y-1">
            {responded.map((seat) => {
              const kind = intentMap.get(seat);
              const label = (() => {
                if (!kind) return 'Pass';
                if (kind === 'Mahjong') return 'Call (Mahjong)';
                if ('Meld' in kind) return `Call (${kind.Meld.meld_type})`;
                return 'Call';
              })();

              return (
                <li key={`call-response-${seat}`} className="flex items-center gap-2">
                  <span className="text-green-700">[x]</span>
                  <span>
                    {seat}: {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

CallWindowPanel.displayName = 'CallWindowPanel';
