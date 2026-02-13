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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getTileName } from '@/lib/utils/tileUtils';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { Seat } from '@/types/bindings/generated/Seat';

interface CallWindowPanelProps {
  /** The tile that was discarded and is available for calling */
  callableTile: Tile;
  /** The player who discarded the tile */
  discardedBy: Seat;
  /** Whether the player can call for Pung (has 2 matching tiles) */
  canCallForPung: boolean;
  /** Whether the player can call for Kong (has 3 matching tiles) */
  canCallForKong: boolean;
  /** Whether the player can call for Quint (has 4 matching tiles) */
  canCallForQuint: boolean;
  /** Whether the player can call for Sextet (has 5 matching tiles) */
  canCallForSextet: boolean;
  /** Whether the player can call for Mahjong (always true in call window) */
  canCallForMahjong: boolean;
  /** Callback when player declares call intent */
  onCallIntent: (intent: 'Mahjong' | 'Pung' | 'Kong' | 'Quint' | 'Sextet') => void;
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
  canCallForQuint,
  canCallForSextet,
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
    <Dialog open>
      <DialogContent
        role="dialog"
        aria-label="Call window"
        className="min-w-[400px] bg-white p-6 [&>button]:hidden"
      >
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold text-gray-800">Call Window</DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {discardedBy} discarded <span className="font-semibold">{tileName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <CallTimer remainingSeconds={timerRemaining} durationSeconds={timerDuration} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onCallIntent('Pung')}
              disabled={disabled || !canCallForPung}
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              Call for Pung
            </Button>

            <Button
              onClick={() => onCallIntent('Kong')}
              disabled={disabled || !canCallForKong}
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              Call for Kong
            </Button>

            <Button
              onClick={() => onCallIntent('Quint')}
              disabled={disabled || !canCallForQuint}
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              Call for Quint
            </Button>

            <Button
              onClick={() => onCallIntent('Sextet')}
              disabled={disabled || !canCallForSextet}
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              Call for Sextet
            </Button>
          </div>

          <Button
            onClick={() => onCallIntent('Mahjong')}
            disabled={disabled || !canCallForMahjong}
            className="h-auto bg-red-500 py-3 text-lg font-bold text-white hover:bg-red-600"
          >
            Call for Mahjong
          </Button>

          <Button
            onClick={onPass}
            disabled={disabled}
            className="bg-gray-400 text-white hover:bg-gray-500"
          >
            Pass
          </Button>
        </div>

        {disabled && (
          <p className="mt-4 text-center text-sm text-gray-600">
            {responseMessage || 'Waiting for others...'}
          </p>
        )}

        {hasResponses && (
          <div className="mt-4 text-sm text-gray-700">
            <div className="mb-1 font-semibold">Responses</div>
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
      </DialogContent>
    </Dialog>
  );
};

CallWindowPanel.displayName = 'CallWindowPanel';
