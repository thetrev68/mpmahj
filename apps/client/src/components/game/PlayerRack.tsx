/**
 * @module PlayerRack
 *
 * Displays current player's concealed tiles in a horizontal rack with multi-mode support:
 * - **charleston**: Select 1–3 tiles to pass (with blind pass override)
 * - **discard**: Select 1 tile to discard (highlights best discard from AI hint)
 * - **view-only**: Display-only, no interaction
 *
 * Features animations (entry, highlight, leaving) and per-tile state (disabled, selected, highlighted).
 * Integrates with `src/hooks/useTileSelection.ts` for selection logic.
 *
 * @see `src/hooks/useTileSelection.ts` for selection state management
 * @see `src/components/game/Tile.tsx` for individual tile display
 */

import type { FC } from 'react';
import { ExposedMeldsArea } from './ExposedMeldsArea';
import { Tile } from './Tile';
import { isJoker } from '@/lib/utils/tileUtils';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { TileInstance } from './types';
import { RACK_WOOD_STYLE } from './rackStyles';

interface PlayerRackProps {
  /** Player's current hand tiles */
  tiles: TileInstance[];
  /** Interaction mode */
  mode: 'charleston' | 'discard' | 'view-only';
  /** Currently selected tile values */
  selectedTileIds?: string[];
  /** Called when a tile is clicked */
  onTileSelect: (tileId: string) => void;
  /** Maximum tiles that can be selected (default: 3 for charleston, 1 for discard) */
  maxSelection?: number;
  /** Disable all interaction */
  disabled?: boolean;
  /** Tile ids that are disabled (e.g., Jokers in Charleston) */
  disabledTileIds?: string[];
  /** Optional selection error to display as tooltip */
  selectionError?: { tileId: string; message: string } | null;
  /** Tile ids to highlight (e.g., newly received tiles) */
  highlightedTileIds?: string[];
  /** Seat tiles were received from (for entry animation) */
  incomingFromSeat?: Seat | null;
  /** Tile ids currently leaving the hand (pass animation) */
  leavingTileIds?: string[];
  /** Exposed melds displayed in the top row of the rack */
  melds?: Array<Meld & { called_from?: Seat }>;
  /** Seat owning the rack, forwarded to exposed meld rendering */
  yourSeat?: Seat;
  /** Indices of melds eligible for upgrade */
  upgradeableMeldIndices?: number[];
  /** Called when an upgradeable meld is clicked */
  onMeldClick?: (meldIndex: number) => void;
  /** Number of blind pass tiles (for mixed counter display) */
  blindPassCount?: number;
}

const PLAYER_TILE_WIDTH_PX = 63;
const TILE_GAP_PX = 2;
const PLAYER_RACK_SPAN_PX = PLAYER_TILE_WIDTH_PX * 19 + TILE_GAP_PX * 18;

export const PlayerRack: FC<PlayerRackProps> = ({
  tiles,
  mode,
  selectedTileIds = [],
  onTileSelect,
  maxSelection = mode === 'charleston' ? 3 : 1,
  disabled = false,
  disabledTileIds = [],
  selectionError = null,
  highlightedTileIds = [],
  incomingFromSeat = null,
  leavingTileIds = [],
  melds = [],
  yourSeat,
  upgradeableMeldIndices = [],
  onMeldClick,
  blindPassCount,
}) => {
  const sortedTiles = [...tiles].sort((a, b) => a.tile - b.tile);
  const isInteractive = mode !== 'view-only' && !disabled;

  const seatEntryClass: Record<Seat, string> = {
    East: 'tile-enter-from-east',
    South: 'tile-enter-from-south',
    West: 'tile-enter-from-west',
    North: 'tile-enter-from-north',
  };

  const getTileState = (
    tile: TileInstance
  ): 'default' | 'selected' | 'disabled' | 'highlighted' => {
    if (selectedTileIds.includes(tile.id)) return 'selected';
    if (highlightedTileIds.includes(tile.id)) return 'highlighted';
    if (disabledTileIds.includes(tile.id)) return 'disabled';
    if (mode === 'charleston' && isJoker(tile.tile)) return 'disabled';
    return 'default';
  };

  const handleTileClick = (tileId: string) => {
    if (!isInteractive) return;
    onTileSelect(tileId);
  };

  return (
    <div
      className="flex flex-col items-center gap-2"
      data-testid="player-rack"
      data-mode={mode}
      aria-label={`Your rack: ${tiles.length} tiles`}
    >
      {/* Selection counter (only in interactive modes) */}
      {mode !== 'view-only' && (
        <div
          className="text-white text-sm font-medium"
          data-testid="selection-counter"
          aria-live="polite"
        >
          {blindPassCount != null && blindPassCount > 0 ? (
            <div className="flex flex-col items-center gap-1">
              <span>{`${selectedTileIds.length}/${maxSelection} selected`}</span>
              <span className="text-xs text-emerald-200">
                {`${selectedTileIds.length} hand + ${blindPassCount} blind = ${selectedTileIds.length + blindPassCount} total`}
              </span>
            </div>
          ) : (
            `${selectedTileIds.length}/${maxSelection} selected`
          )}
        </div>
      )}

      {/* Tile rack — wooden holder */}
      <div
        className="relative rounded-md px-1.5 pt-1 pb-2"
        style={{
          ...RACK_WOOD_STYLE,
          width: `${PLAYER_RACK_SPAN_PX}px`,
        }}
        data-testid="player-rack-shell"
      >
        <div
          className="mb-1.5 w-full rounded-sm"
          data-testid="player-rack-meld-row"
          style={{ minHeight: '90px', background: 'rgba(0,0,0,0.12)' }}
        >
          {melds.length > 0 ? (
            <ExposedMeldsArea
              melds={melds}
              compact={false}
              ownerSeat={yourSeat}
              upgradeableMeldIndices={upgradeableMeldIndices}
              onMeldClick={onMeldClick}
            />
          ) : null}
        </div>

        <div className="relative" data-testid="player-rack-concealed-row">
          {/* Felt groove where concealed tiles rest */}
          <div
            className="absolute bottom-1.5 left-0 right-0 h-1.5 rounded-sm"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            aria-hidden="true"
          />
          <div className="relative flex w-full gap-0.5">
            {sortedTiles.map((tile, index) => {
              const state = getTileState(tile);
              const isJokerDisabled = mode === 'charleston' && isJoker(tile.tile);
              const isLeaving = leavingTileIds.includes(tile.id);
              const errorMessage =
                selectionError?.tileId === tile.id ? selectionError.message : null;
              const isIncoming = highlightedTileIds.includes(tile.id) && incomingFromSeat !== null;
              const incomingClass =
                isIncoming && incomingFromSeat ? seatEntryClass[incomingFromSeat] : undefined;
              const showDiscardIcon = mode === 'discard' && selectedTileIds.includes(tile.id);
              return (
                <TooltipProvider key={`${tile.id}-${index}`} delayDuration={150}>
                  <Tooltip open={!!errorMessage}>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <Tile
                          tile={tile.tile}
                          state={state}
                          size="medium"
                          onClick={isInteractive ? () => handleTileClick(tile.id) : undefined}
                          allowDisabledClick={isInteractive && isJokerDisabled}
                          testId={`tile-${tile.tile}-${tile.id}`}
                          newlyDrawn={highlightedTileIds.includes(tile.id)}
                          className={cn(
                            isJokerDisabled && 'tile-joker-disabled',
                            isLeaving && 'tile-leaving',
                            incomingClass
                          )}
                        />
                        {showDiscardIcon && (
                          <span
                            className="absolute -top-2 right-1 text-yellow-200 text-xs"
                            aria-hidden="true"
                          >
                            v
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    {errorMessage && (
                      <TooltipContent side="top" align="center">
                        {errorMessage}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

PlayerRack.displayName = 'PlayerRack';
