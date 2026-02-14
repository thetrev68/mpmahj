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
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tile } from './Tile';
import type { Tile as TileType } from '@/types/bindings/generated/Tile';
import type { Hand } from '@/types/bindings/generated/Hand';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

interface MahjongConfirmationDialogProps {
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

/** Build a minimal Hand object from a flat tile array for DeclareMahjong.
 *
 * Hand.counts is always length 42 (indices 0-41, matching HISTOGRAM_SIZE).
 * Flower variants (34-41) all normalize to index 34 per the histogram spec.
 * Jokers (42) and Blanks (43) are outside the histogram range and are skipped.
 */
function buildHand(tiles: TileType[]): Hand {
  const counts = new Array<number>(42).fill(0);
  for (const tile of tiles) {
    if (tile >= 34 && tile <= 41) {
      // All flower variants normalize to index 34 in the histogram
      counts[34] += 1;
    } else if (tile < 34) {
      counts[tile] += 1;
    }
    // Jokers (42) and Blanks (43) are outside histogram range - skip
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
    <Dialog open>
      <DialogContent
        className="flex max-w-[520px] flex-col items-center gap-5 rounded-xl border border-yellow-500 bg-gray-900 px-8 py-6 shadow-2xl [&>button]:hidden"
        data-testid="mahjong-confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Declare Mahjong confirmation"
      >
        <h2 className="text-2xl font-bold text-yellow-400">Declare Mahjong?</h2>

        {/* TODO AC-2: Show winning pattern name and score here (e.g. "Odds Only - 35 points").
         * Requires client-side NMJL pattern pre-validation (EC-2, optional UX enhancement).
         * The server doesn't provide the pattern until after DeclareMahjong is sent, so
         * we need to bundle the card data and run validateHand() client-side to display it. */}
        <p className="text-gray-300 text-sm text-center">
          Your hand will be revealed and validated. A false Mahjong claim results in a dead hand.
        </p>

        {/* Hand display - all 14 tiles */}
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
      </DialogContent>
    </Dialog>
  );
};

MahjongConfirmationDialog.displayName = 'MahjongConfirmationDialog';
