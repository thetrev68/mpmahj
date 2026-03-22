/**
 * @module PlayerRack
 *
 * Displays current player's concealed tiles in a horizontal rack with multi-mode support:
 * - **charleston**: Select 1–3 tiles to pass (with blind pass override)
 * - **claim**: Select 0–5 tiles to stage a discard claim
 * - **discard**: Select 1 tile to discard (highlights best discard from AI hint)
 * - **view-only**: Display-only, no interaction
 *
 * Features animations (entry, highlight, leaving) and per-tile state (disabled, selected, highlighted).
 * Integrates with `src/hooks/useTileSelection.ts` for selection logic.
 *
 * @see `src/hooks/useTileSelection.ts` for selection state management
 * @see `src/components/game/Tile.tsx` for individual tile display
 */

import { useEffect, useState, type FC } from 'react';
import { ExposedMeldsArea } from './ExposedMeldsArea';
import { Tile } from './Tile';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { isJoker, getTileGroup, canonicalTileComparator } from '@/lib/utils/tileUtils';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ToggleSelectionResult } from '@/hooks/useTileSelection';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { TileInstance } from './types';
import { RACK_WOOD_STYLE } from './rackStyles';
import { SEAT_ENTRY_CLASS } from './seatAnimations';

interface PlayerRackProps {
  /** Player's current hand tiles */
  tiles: TileInstance[];
  /** Interaction mode */
  mode: 'charleston' | 'claim' | 'discard' | 'view-only';
  /** Currently selected tile values */
  selectedTileIds?: string[];
  /** Called when a tile is clicked */
  onTileSelect: (tileId: string) => ToggleSelectionResult | void;
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
  /** Tile ids that should get the longer-lived newly received treatment */
  newlyReceivedTileIds?: string[];
  /** Called after newly received tile ids have been consumed into rack-local UI state */
  onNewlyReceivedTilesAcknowledged?: () => void;
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
  /** Per-meld lookup of exchangeable Joker positions */
  exchangeableJokersByMeld?: Record<number, number[]>;
  /** Called when an exchangeable Joker tile is clicked */
  onJokerTileClick?: (meldIndex: number, tilePosition: number) => void;
  /** Number of blind pass tiles (for mixed counter display) */
  blindPassCount?: number;
  /** Whether this rack currently owns the active turn */
  isActive?: boolean;
}

const PLAYER_TILE_WIDTH_PX = 63;
const TILE_GAP_PX = 2;
const PLAYER_RACK_SPAN_PX = PLAYER_TILE_WIDTH_PX * 16 + TILE_GAP_PX * 15;

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
  newlyReceivedTileIds = [],
  onNewlyReceivedTilesAcknowledged,
  incomingFromSeat = null,
  leavingTileIds = [],
  melds = [],
  yourSeat,
  upgradeableMeldIndices = [],
  onMeldClick,
  exchangeableJokersByMeld = {},
  onJokerTileClick,
  blindPassCount,
  isActive = false,
}) => {
  const { playSound } = useSoundEffects();
  const sortedTiles = [...tiles].sort((a, b) => canonicalTileComparator(a.tile, b.tile));
  const isInteractive = mode !== 'view-only' && !disabled;
  const [activeNewlyReceivedTileIds, setActiveNewlyReceivedTileIds] = useState<string[]>([]);

  useEffect(() => {
    if (newlyReceivedTileIds.length === 0) {
      return;
    }

    setActiveNewlyReceivedTileIds(newlyReceivedTileIds);
    onNewlyReceivedTilesAcknowledged?.();

    const timeoutId = window.setTimeout(() => {
      setActiveNewlyReceivedTileIds([]);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [newlyReceivedTileIds, onNewlyReceivedTilesAcknowledged]);

  const combinedHighlightedTileIds = Array.from(
    new Set([...highlightedTileIds, ...activeNewlyReceivedTileIds])
  );

  const getTileState = (
    tile: TileInstance
  ): 'default' | 'selected' | 'disabled' | 'highlighted' => {
    if (selectedTileIds.includes(tile.id)) return 'selected';
    if (combinedHighlightedTileIds.includes(tile.id)) return 'highlighted';
    if (disabledTileIds.includes(tile.id)) return 'disabled';
    if (mode === 'charleston' && isJoker(tile.tile)) return 'disabled';
    return 'default';
  };

  const handleTileClick = (tileId: string): boolean => {
    if (!isInteractive) return false;
    const result = onTileSelect(tileId);
    return result?.status === 'selected';
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-md',
        isActive && 'ring-2 ring-green-400'
      )}
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
      <div className="relative" style={{ width: `${PLAYER_RACK_SPAN_PX}px` }}>
        <div
          className="relative rounded-md px-1.5 pt-1 pb-2"
          style={RACK_WOOD_STYLE}
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
                exchangeableJokersByMeld={exchangeableJokersByMeld}
                onJokerTileClick={onJokerTileClick}
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
            <div className="relative flex w-full justify-center gap-0.5">
              {sortedTiles.map((tile, index) => {
                const prevTile = index > 0 ? sortedTiles[index - 1] : null;
                const isGroupBoundary =
                  prevTile !== null && getTileGroup(tile.tile) !== getTileGroup(prevTile.tile);
                const isGhost =
                  (mode === 'charleston' || mode === 'claim') && selectedTileIds.includes(tile.id);
                if (isGhost) {
                  return (
                    <div
                      key={`${tile.id}-${index}`}
                      data-testid={`ghost-${tile.id}`}
                      className={cn(
                        'relative opacity-25 cursor-pointer',
                        isGroupBoundary && 'ml-0.5'
                      )}
                      data-group-boundary={isGroupBoundary ? 'true' : undefined}
                      aria-hidden="true"
                      onClick={() => handleTileClick(tile.id)}
                    >
                      <Tile
                        tile={tile.tile}
                        state="default"
                        size="medium"
                        testId={`tile-${tile.tile}-${tile.id}`}
                        ariaLabel="Staged tile placeholder"
                        onClick={() => handleTileClick(tile.id)}
                        onPlaySelectSound={() => playSound('tile-select')}
                      />
                    </div>
                  );
                }

                const state = getTileState(tile);
                const isJokerDisabled = mode === 'charleston' && isJoker(tile.tile);
                const isLeaving = leavingTileIds.includes(tile.id);
                const errorMessage =
                  selectionError?.tileId === tile.id ? selectionError.message : null;
                const isIncoming =
                  highlightedTileIds.includes(tile.id) && incomingFromSeat !== null;
                const incomingClass =
                  isIncoming && incomingFromSeat ? SEAT_ENTRY_CLASS[incomingFromSeat] : undefined;
                const showDiscardIcon = mode === 'discard' && selectedTileIds.includes(tile.id);
                return (
                  <TooltipProvider key={`${tile.id}-${index}`} delayDuration={150}>
                    <Tooltip open={!!errorMessage}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn('relative', isGroupBoundary && 'ml-0.5')}
                          data-group-boundary={isGroupBoundary ? 'true' : undefined}
                        >
                          <Tile
                            tile={tile.tile}
                            state={state}
                            size="medium"
                            onClick={isInteractive ? () => handleTileClick(tile.id) : undefined}
                            onPlaySelectSound={() => playSound('tile-select')}
                            allowDisabledClick={isInteractive && isJokerDisabled}
                            testId={`tile-${tile.tile}-${tile.id}`}
                            newlyDrawn={combinedHighlightedTileIds.includes(tile.id)}
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
    </div>
  );
};

PlayerRack.displayName = 'PlayerRack';
