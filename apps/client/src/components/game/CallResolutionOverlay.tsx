/**
 * CallResolutionOverlay Component
 *
 * Displays the call priority resolution when multiple players call the same discard.
 * Shows the winner, reason (Mahjong priority or seat proximity), and all competing callers.
 *
 * Related: US-012 (Call Priority Resolution) - AC-1, AC-2, AC-3, AC-4
 */

import React, { useEffect, useMemo } from 'react';
import type { CallResolution } from '@/types/bindings/generated/CallResolution';
import type { CallTieBreakReason } from '@/types/bindings/generated/CallTieBreakReason';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { Seat } from '@/types/bindings/generated/Seat';

export interface CallResolutionOverlayProps {
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
export const CallResolutionOverlay: React.FC<CallResolutionOverlayProps> = ({
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

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  // Early return after all hooks (rules of hooks)
  if (resolution === 'NoCall' || !winner) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="Call resolution"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Call Resolved</h2>
          <div className="text-lg text-green-700 font-semibold">
            {winner} wins: {resolutionMessage}
          </div>
        </div>

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
                      {caller.seat === winner && ' ✓'}
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
              Discarder: {discardedBy} → Winner: {winner} (closest clockwise)
            </div>
          </div>
        )}

        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Continue
        </button>

        <p className="text-center text-xs text-gray-500 mt-2">Press Escape to close</p>
      </div>
    </div>
  );
};

CallResolutionOverlay.displayName = 'CallResolutionOverlay';
