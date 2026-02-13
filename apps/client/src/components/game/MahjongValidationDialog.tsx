/**
 * MahjongValidationDialog Component
 *
 * Dialog shown when a player has won via a called discard and must
 * submit their full 14-tile hand to the server for validation.
 *
 * Unlike MahjongConfirmationDialog (self-draw), there is no cancel button
 * because the player has already committed by declaring intent.
 * The winning_tile is set to the called tile (not null).
 *
 * Related: US-019 (AC-4)
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

export interface MahjongValidationDialogProps {
  isOpen: boolean;
  /** The 13 concealed tiles (not including the called tile) */
  concealedHand: TileType[];
  /** The tile called from the discard pile (the 14th tile / winning tile) */
  calledTile: TileType;
  /** The seat that discarded the called tile */
  discardedBy: Seat;
  /** The declaring player's seat */
  mySeat: Seat;
  /** True while waiting for server validation response */
  isLoading: boolean;
  /** Called with the DeclareMahjong command to send */
  onSubmit: (command: GameCommand) => void;
}

/** Build a minimal Hand object from a flat tile array for DeclareMahjong.
 *
 * Hand.counts is always length 42 (indices 0–41, matching HISTOGRAM_SIZE).
 * Flower variants (34–41) all normalize to index 34 per the histogram spec.
 * Jokers (42) and Blanks (43) are outside the histogram range and are skipped.
 */
function buildHand(tiles: TileType[]): Hand {
  const counts = new Array<number>(42).fill(0);
  for (const tile of tiles) {
    if (tile >= 34 && tile <= 41) {
      counts[34] += 1;
    } else if (tile < 34) {
      counts[tile] += 1;
    }
    // Jokers (42) and Blanks (43) are outside histogram range — skip
  }
  return { concealed: tiles, counts, exposed: [], joker_assignments: null };
}

export const MahjongValidationDialog: React.FC<MahjongValidationDialogProps> = ({
  isOpen,
  concealedHand,
  calledTile,
  discardedBy,
  mySeat,
  isLoading,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const handleSubmit = () => {
    const allTiles = [...concealedHand, calledTile];
    onSubmit({
      DeclareMahjong: {
        player: mySeat,
        hand: buildHand(allTiles),
        winning_tile: calledTile,
      },
    });
  };

  return (
    <Dialog open>
      <DialogContent
        className="flex max-w-[560px] flex-col items-center gap-5 rounded-xl border border-yellow-500 bg-gray-900 px-8 py-6 shadow-2xl [&>button]:hidden"
        data-testid="mahjong-validation-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Declare Mahjong validation"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <h2 className="text-2xl font-bold text-yellow-400">Mahjong!</h2>
        <p className="text-gray-300 text-sm text-center">
          Your hand will be validated. Submit to claim your win.
        </p>

        {/* Concealed hand (13 tiles) */}
        <div className="flex flex-col items-center gap-2 w-full">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Your hand</p>
          <div className="flex flex-wrap justify-center gap-1.5" aria-label="Your concealed hand">
            {concealedHand.map((tile, i) => (
              <Tile key={i} tile={tile} state="disabled" testId={`concealed-tile-${i}`} />
            ))}
          </div>
        </div>

        {/* Called tile (highlighted) */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-yellow-300 text-xs uppercase tracking-wider font-semibold">
            Called Tile
          </p>
          <p className="text-gray-400 text-xs">
            from <span className="text-gray-200 font-medium">{discardedBy}</span>
          </p>
          <div
            className="border-2 border-yellow-400 rounded-lg p-1 shadow-[0_0_12px_rgba(250,204,21,0.5)]"
            data-testid="called-tile"
          >
            <Tile tile={calledTile} state="disabled" testId="called-tile-inner" />
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
          aria-label={isLoading ? 'Validating...' : 'Submit for Validation'}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validating...
            </span>
          ) : (
            'Submit for Validation'
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

MahjongValidationDialog.displayName = 'MahjongValidationDialog';
