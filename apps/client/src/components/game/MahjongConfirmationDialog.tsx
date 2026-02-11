/**
 * MahjongConfirmationDialog Component
 *
 * Confirmation dialog shown before a player declares Mahjong.
 * Displays all 14 hand tiles and requests confirmation.
 * Sends DeclareMahjong command with winning_tile: null (self-draw).
 *
 * Related: US-018 (AC-2, AC-3, EC-3)
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tile } from './Tile';
import type { Tile as TileType } from '@/types/bindings/generated/Tile';
import type { Hand } from '@/types/bindings/generated/Hand';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

export interface MahjongConfirmationDialogProps {
  isOpen: boolean;
  /** All concealed tiles in hand for display and command construction */
  hand: TileType[];
  /** The declaring player's seat */
  mySeat: Seat;
  /** True while waiting for server validation response */
  isLoading: boolean;
  /** Called with the DeclareMahjong command to send */
  onConfirm: (command: GameCommand) => void;
  onCancel: () => void;
}

/** Build a minimal Hand object from a flat tile array for DeclareMahjong. */
function buildHand(tiles: TileType[]): Hand {
  const counts = new Array<number>(42).fill(0);
  for (const tile of tiles) {
    const idx = tile < 42 ? tile : 41;
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  return { concealed: tiles, counts, exposed: [], joker_assignments: null };
}

export const MahjongConfirmationDialog: React.FC<MahjongConfirmationDialogProps> = ({
  isOpen,
  hand,
  mySeat,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({
      DeclareMahjong: {
        player: mySeat,
        hand: buildHand(hand),
        winning_tile: null, // self-draw: no called tile
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      data-testid="mahjong-confirmation-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Declare Mahjong confirmation"
    >
      <div className="bg-gray-900 border border-yellow-500 rounded-xl shadow-2xl px-8 py-6 flex flex-col items-center gap-5 min-w-[340px] max-w-[520px]">
        <h2 className="text-2xl font-bold text-yellow-400">Declare Mahjong?</h2>

        <p className="text-gray-300 text-sm text-center">
          Your hand will be revealed and validated. A false Mahjong claim results in a dead hand.
        </p>

        {/* Hand display — all 14 tiles */}
        <div className="flex flex-wrap justify-center gap-1.5" aria-label="Your hand">
          {hand.map((tile, i) => (
            <Tile key={i} tile={tile} state="disabled" testId={`tile-pos-${i}`} />
          ))}
        </div>

        <div className="flex gap-3 w-full">
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={isLoading}
            className="flex-1"
            aria-label="Cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
            aria-label="Confirm Mahjong"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating...
              </span>
            ) : (
              'Confirm Mahjong'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

MahjongConfirmationDialog.displayName = 'MahjongConfirmationDialog';
