/**
 * DeadHandOverlay Component
 *
 * Penalty announcement overlay shown when a player's Mahjong declaration is invalid.
 * Displays the reason, consequences, and the revealed hand.
 * The player must acknowledge before the overlay closes.
 *
 * Related: US-020 (Invalid Mahjong → Dead Hand)
 */

import React from 'react';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import { getTileName } from '@/lib/utils/tileUtils';

export interface DeadHandOverlayProps {
  /** Whether the overlay is visible */
  show: boolean;
  /** Seat whose hand was declared dead */
  player: Seat;
  /** Reason for the dead hand penalty */
  reason: string;
  /** The player's revealed hand tiles (shown to all) */
  revealedHand?: Tile[];
  /** Called when the player clicks Acknowledge */
  onAcknowledge: () => void;
}

/**
 * DeadHandOverlay displays the dead-hand penalty announcement.
 * Shown to the penalized player immediately after HandDeclaredDead fires.
 */
export const DeadHandOverlay: React.FC<DeadHandOverlayProps> = ({
  show,
  player,
  reason,
  revealedHand,
  onAcknowledge,
}) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      data-testid="dead-hand-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Dead Hand Penalty"
    >
      <div className="bg-gray-900 border-2 border-red-600 rounded-2xl shadow-2xl px-8 py-7 flex flex-col items-center gap-5 min-w-[340px] max-w-[480px]">
        {/* Header */}
        <div className="flex flex-col items-center gap-1">
          <h2
            className="text-3xl font-bold text-red-500 tracking-wide"
            data-testid="dead-hand-title"
          >
            DEAD HAND PENALTY
          </h2>
          <div
            className="bg-red-700 text-white text-xs font-bold px-3 py-1 rounded-full tracking-widest"
            data-testid="dead-hand-badge"
          >
            DEAD HAND
          </div>
        </div>

        {/* Player and reason */}
        <div className="bg-gray-800 rounded-lg px-5 py-3 w-full text-center space-y-1">
          <p className="text-gray-300 text-sm">
            Player: <span className="text-white font-semibold">{player}</span>
          </p>
          <p className="text-gray-300 text-sm">
            Reason: <span className="text-red-300 font-semibold">{reason}</span>
          </p>
        </div>

        {/* Consequences */}
        <div className="bg-gray-800 rounded-lg px-5 py-3 w-full">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
            Consequences
          </p>
          <ul className="space-y-1 text-sm text-gray-300">
            <li>• Your hand is revealed to all players</li>
            <li>• You cannot declare Mahjong</li>
            <li>• You cannot call discards</li>
            <li>• You must continue playing (draw &amp; discard)</li>
          </ul>
        </div>

        {/* Revealed hand */}
        {revealedHand && revealedHand.length > 0 && (
          <div className="bg-gray-800 rounded-lg px-5 py-3 w-full" data-testid="revealed-hand">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
              Your Revealed Hand
            </p>
            <p className="text-gray-300 text-sm leading-relaxed">
              {revealedHand.map((tile) => getTileName(tile)).join(', ')}
            </p>
          </div>
        )}

        {/* Acknowledge button */}
        <button
          className="bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-bold px-8 py-3 rounded-xl transition-colors w-full"
          onClick={onAcknowledge}
          data-testid="dead-hand-acknowledge"
          aria-label="Acknowledge dead hand penalty"
        >
          Acknowledge
        </button>

        {/* Screen reader description */}
        <p className="sr-only">
          Dead hand penalty applied. Invalid Mahjong claim. Your hand is revealed to all players.
          You cannot win this game but must continue playing.
        </p>
      </div>
    </div>
  );
};

DeadHandOverlay.displayName = 'DeadHandOverlay';
