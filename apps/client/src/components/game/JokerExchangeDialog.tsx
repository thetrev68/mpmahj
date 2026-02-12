/**
 * JokerExchangeDialog Component
 *
 * Modal dialog that lists available Joker exchange opportunities for the current player.
 * Each opportunity shows the seat, represented tile, and a confirm button.
 *
 * Related: US-014 (Exchanging Joker - Single), US-015 (Exchanging Joker - Multiple)
 */

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getTileName } from '@/lib/utils/tileUtils';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

/**
 * A single Joker exchange opportunity derived from an opponent's exposed meld.
 */
export interface ExchangeOpportunity {
  /** Whose meld contains the Joker */
  targetSeat: Seat;
  /** Index of the meld in that player's exposed_melds array */
  meldIndex: number;
  /** Position within the meld tiles array (from joker_assignments) */
  tilePosition: number;
  /** The tile that the Joker is currently substituting */
  representedTile: Tile;
}

export interface JokerExchangeDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Available exchange opportunities */
  opportunities: ExchangeOpportunity[];
  /** Whether a command is in flight */
  isLoading?: boolean;
  /** Called when the user confirms an exchange */
  onExchange: (opportunity: ExchangeOpportunity) => void;
  /** Called when the user cancels */
  onClose: () => void;
}

export const JokerExchangeDialog: React.FC<JokerExchangeDialogProps> = ({
  isOpen,
  opportunities,
  isLoading = false,
  onExchange,
  onClose,
}) => {
  // Issue #5: Keyboard shortcuts (Enter to confirm, Escape to close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Enter to confirm first opportunity (if only one and not loading)
      if (e.key === 'Enter' && opportunities.length === 1 && !isLoading) {
        e.preventDefault();
        onExchange(opportunities[0]);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, opportunities, isLoading, onClose, onExchange]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      data-testid="joker-exchange-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Exchange Joker"
    >
      <div className="bg-gray-900 border border-yellow-500/50 rounded-2xl shadow-2xl px-8 py-6 flex flex-col gap-4 min-w-[340px] max-w-[480px]">
        <h2
          className="text-xl font-bold text-yellow-300 text-center"
          data-testid="joker-exchange-dialog-title"
        >
          Exchange Joker
        </h2>

        {opportunities.length === 0 ? (
          <p className="text-gray-400 text-center text-sm">No exchange opportunities available.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-gray-300 text-sm text-center">
              Select a Joker to exchange for a tile from your hand:
            </p>

            {opportunities.map((opp, idx) => (
              <div
                key={`opp-${opp.targetSeat}-${opp.meldIndex}-${opp.tilePosition}`}
                className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3"
                data-testid={`exchange-opportunity-${idx}`}
              >
                <div className="flex flex-col">
                  <span className="text-white font-medium text-sm">
                    {getTileName(opp.representedTile)} ↔ Joker
                  </span>
                  <span className="text-gray-400 text-xs">From {opp.targetSeat}&apos;s meld</span>
                </div>

                <Button
                  onClick={() => onExchange(opp)}
                  disabled={isLoading}
                  size="sm"
                  className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold"
                  data-testid={`exchange-confirm-button-${idx}`}
                  aria-label={`Exchange your ${getTileName(opp.representedTile)} for Joker from ${opp.targetSeat}'s meld`}
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Exchanging...
                    </span>
                  ) : (
                    'Exchange'
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={onClose}
          variant="outline"
          disabled={isLoading}
          className="w-full mt-2"
          data-testid="joker-exchange-cancel-button"
          aria-label="Cancel exchange"
        >
          Cancel
        </Button>

        {/* Screen reader live region for exchange feedback */}
        <p className="sr-only" aria-live="polite">
          {opportunities.length > 0
            ? `${opportunities.length} Joker exchange${opportunities.length === 1 ? '' : 's'} available.`
            : 'No Joker exchanges available.'}
        </p>
      </div>
    </div>
  );
};

JokerExchangeDialog.displayName = 'JokerExchangeDialog';
