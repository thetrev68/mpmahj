/**
 * CallResolutionOverlay Component
 *
 * Displays the call priority resolution when multiple players call the same discard.
 * Shows the winner, reason (Mahjong priority or seat proximity), and all competing callers.
 *
 * Related: US-012 (Call Priority Resolution) - AC-1, AC-2, AC-3, AC-4
 */

import { useMemo, type FC } from 'react';
import { PriorityDiagram } from './PriorityDiagram';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CallResolution } from '@/types/bindings/generated/CallResolution';
import type { CallTieBreakReason } from '@/types/bindings/generated/CallTieBreakReason';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { Seat } from '@/types/bindings/generated/Seat';

interface CallResolutionOverlayProps {
  /** The final call resolution */
  resolution: CallResolution;
  /** Optional tie-break reason metadata */
  tieBreak: CallTieBreakReason | null;
  /** All players who declared call intent */
  allCallers: CallIntentSummary[];
  /** The player who discarded the tile */
  discardedBy: Seat;
  /** Callback when overlay is dismissed */
  onDismiss: () => void;
}

/**
 * Call resolution overlay component
 */
export const CallResolutionOverlay: FC<CallResolutionOverlayProps> = ({
  resolution,
  tieBreak,
  allCallers,
  discardedBy,
  onDismiss,
}) => {
  // Extract winner and type
  const { winner, resolutionType } = useMemo(() => {
    // NoCall has no winner
    if (resolution === 'NoCall') {
      return { winner: null, resolutionType: null };
    }
    if ('Mahjong' in resolution) {
      return { winner: resolution.Mahjong, resolutionType: 'Mahjong' as const };
    }
    if ('Meld' in resolution) {
      return { winner: resolution.Meld.seat, resolutionType: 'Meld' as const };
    }
    return { winner: null, resolutionType: null };
  }, [resolution]);

  // Generate resolution message
  const resolutionMessage = useMemo(() => {
    if (!winner) return '';

    const hasMultipleCallers = allCallers.length > 1;
    const hasTieBreak = tieBreak !== null;

    // AC-2: Mahjong beats Meld
    if (resolutionType === 'Mahjong' && hasMultipleCallers && !hasTieBreak) {
      const meldCallers = allCallers.filter((c) => c.kind !== 'Mahjong');
      if (meldCallers.length > 0) {
        const meldType =
          meldCallers[0].kind !== 'Mahjong' ? meldCallers[0].kind.Meld.meld_type : 'Pung';
        return `Mahjong beats ${meldType}`;
      }
    }

    // AC-4: Closest Player Wins (Mahjong Tie)
    if (resolutionType === 'Mahjong' && hasTieBreak && tieBreak && 'SeatOrder' in tieBreak) {
      const contenders = tieBreak.SeatOrder.contenders;
      if (contenders.length === 2) {
        return `Both Mahjong, ${winner} is closer`;
      }
      if (contenders.length > 2) {
        return `Multiple Mahjong calls, ${winner} is closer`;
      }
    }

    // AC-3: Closest Player Wins (Meld Tie)
    if (resolutionType === 'Meld' && hasTieBreak) {
      return 'Closest to discarder';
    }

    // Single caller (no competition)
    return resolutionType === 'Mahjong' ? 'Mahjong' : 'Meld';
  }, [winner, resolutionType, allCallers, tieBreak]);

  const contenders = useMemo(() => {
    if (tieBreak && 'SeatOrder' in tieBreak) {
      return tieBreak.SeatOrder.contenders;
    }
    return allCallers.map((caller) => caller.seat);
  }, [tieBreak, allCallers]);

  // Early return after all hooks (rules of hooks)
  if (resolution === 'NoCall' || !winner) {
    return null;
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent
        role="dialog"
        aria-label="Call resolution"
        className="mx-4 w-full max-w-md bg-white p-6 [&>button]:hidden"
      >
        <DialogHeader className="mb-4 text-center">
          <DialogTitle className="mb-2 text-2xl font-bold text-gray-800">Call Resolved</DialogTitle>
          <DialogDescription className="text-lg font-semibold text-green-700">
            {winner} wins: {resolutionMessage}
          </DialogDescription>
        </DialogHeader>

        {/* Priority Rules (AC-1) */}
        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4 text-sm">
          <div className="font-semibold text-blue-900 mb-2">Priority Rules:</div>
          <ul className="space-y-1 text-blue-800">
            <li>
              <strong>1.</strong> Mahjong beats Pung/Kong/Quint
            </li>
            <li>
              <strong>2.</strong> If tied, closest player to discarder wins (clockwise)
            </li>
          </ul>
        </div>

        <PriorityDiagram
          discardedBy={discardedBy}
          winner={winner}
          contenders={contenders.length > 0 ? contenders : undefined}
        />

        {/* All Callers */}
        {allCallers.length > 0 && (
          <div className="mb-4">
            <div className="font-semibold text-gray-700 mb-2">All Callers:</div>
            <ul className="space-y-1 text-sm text-gray-600">
              {allCallers.map((caller) => {
                const kindLabel =
                  caller.kind === 'Mahjong' ? 'Mahjong' : `${caller.kind.Meld.meld_type}`;
                return (
                  <li key={`caller-${caller.seat}`} className="flex items-center gap-2">
                    <span className={caller.seat === winner ? 'text-green-700 font-semibold' : ''}>
                      {caller.seat}: {kindLabel}
                      {caller.seat === winner && ' \u2713'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Tie-Break Details */}
        {tieBreak && 'SeatOrder' in tieBreak && (
          <div className="mb-4 text-sm text-gray-600">
            <div className="font-semibold mb-1">Tie-Break:</div>
            <div>Tied contenders: {tieBreak.SeatOrder.contenders.join(', ')}</div>
            <div className="text-xs text-gray-500 mt-1">
              Discarder: {discardedBy} \u2192 Winner: {winner} (closest clockwise)
            </div>
          </div>
        )}

        {/* Dismiss Button */}
        <Button
          onClick={onDismiss}
          className="h-auto w-full bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Continue
        </Button>

        <p className="mt-2 text-center text-xs text-gray-500">Press Escape to close</p>
      </DialogContent>
    </Dialog>
  );
};

CallResolutionOverlay.displayName = 'CallResolutionOverlay';
