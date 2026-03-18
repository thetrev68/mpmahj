import { useEffect, useRef, useState, type CSSProperties, type FC } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tile } from './Tile';
import { cn } from '@/lib/utils';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile as TileValue } from '@/types/bindings/generated/Tile';
import { SEAT_ENTRY_CLASS } from './seatAnimations';

export interface StagedTile {
  id: string;
  tile: TileValue;
  hidden?: boolean;
}

export interface StagingStripProps {
  incomingTiles: StagedTile[];
  outgoingTiles: StagedTile[];
  slotCount: number;
  blindIncoming: boolean;
  canRevealBlind: boolean;
  incomingFromSeat: Seat | null;
  onAbsorbIncoming: (tileId: string) => void;
  onRemoveOutgoing: (tileId: string) => void;
  onCommitPass: () => void;
  onCommitCall: () => void;
  onCommitDiscard: () => void;
  canCommitPass: boolean;
  canCommitCall: boolean;
  canCommitDiscard: boolean;
  isProcessing: boolean;
  showActionButtons?: boolean;
}

const STAGING_SLOT_WIDTH_PX = 63;
const STAGING_SLOT_HEIGHT_PX = 90;
const STAGING_SLOT_GAP_PX = 8;
const STAGING_STRIP_PADDING_PX = 16;

export const StagingStrip: FC<StagingStripProps> = ({
  incomingTiles,
  outgoingTiles,
  slotCount,
  blindIncoming,
  canRevealBlind,
  incomingFromSeat,
  onAbsorbIncoming,
  onRemoveOutgoing,
  onCommitPass,
  onCommitCall,
  onCommitDiscard,
  canCommitPass,
  canCommitCall,
  canCommitDiscard,
  isProcessing,
  showActionButtons = true,
}) => {
  const slotViewportRef = useRef<HTMLDivElement | null>(null);
  const [slotRowScale, setSlotRowScale] = useState(1);

  // Track the tile ID committed to each slot so we can detect the empty→filled transition.
  // Entry animation only fires on initial slot fill (AC-3), not on later re-renders where
  // incomingFromSeat fires again while the same tile is already sitting in the slot.
  // Uses React's "storing information from previous renders" pattern: setState called directly
  // in render (not in an effect) so React discards the current render and restarts with new
  // state. This satisfies react-hooks/refs (no ref.current during render) and
  // react-hooks/set-state-in-effect (not inside an effect body).
  const [prevSnapshot, setPrevSnapshot] = useState<{
    prevTileIds: (string | undefined)[];
    lastSeenTiles: StagedTile[];
  }>(() => ({ prevTileIds: [], lastSeenTiles: incomingTiles }));

  if (prevSnapshot.lastSeenTiles !== incomingTiles) {
    setPrevSnapshot({
      prevTileIds: Array.from({ length: slotCount }, (_, i) => prevSnapshot.lastSeenTiles[i]?.id),
      lastSeenTiles: incomingTiles,
    });
  }

  const prevTileIds = prevSnapshot.prevTileIds;
  const slotContentWidth = `calc(${slotCount} * var(--staging-slot-width) + (${slotCount} - 1) * var(--staging-slot-gap))`;
  const stripWidth = `calc(${slotContentWidth} + 2 * var(--staging-strip-padding))`;

  useEffect(() => {
    const viewport = slotViewportRef.current;
    if (viewport === null) {
      return;
    }

    const baseWidth =
      slotCount * STAGING_SLOT_WIDTH_PX + Math.max(0, slotCount - 1) * STAGING_SLOT_GAP_PX;

    const updateScale = () => {
      const availableWidth = viewport.clientWidth;
      if (availableWidth <= 0) {
        setSlotRowScale(1);
        return;
      }

      setSlotRowScale(Math.min(1, availableWidth / baseWidth));
    };

    updateScale();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }

    const observer = new ResizeObserver(() => updateScale());
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [slotCount]);

  type SlotDescriptor =
    | {
        kind: 'incoming';
        tile: StagedTile;
        incomingIndex: number;
      }
    | {
        kind: 'outgoing';
        tile: StagedTile;
      }
    | {
        kind: 'empty';
      };

  const renderIncomingSlot = (tile: StagedTile, index: number, slotIndex: number) => {
    const isBlindTile = blindIncoming && tile !== undefined;
    const isHidden = isBlindTile && (tile?.hidden ?? false);
    const label = isHidden
      ? canRevealBlind
        ? 'Reveal blind staged incoming tile'
        : 'Blind staged incoming tile unavailable until you stage a rack tile'
      : 'Absorb staged incoming tile';
    const seatLabel = incomingFromSeat ? ` from ${incomingFromSeat}` : '';
    const badgeLabel = isBlindTile ? 'BLIND' : null;
    const wasEmpty = prevTileIds[index] === undefined;
    const entryClass =
      wasEmpty && tile !== undefined && incomingFromSeat
        ? SEAT_ENTRY_CLASS[incomingFromSeat]
        : undefined;

    return (
      <div
        key={tile.id}
        className="flex h-[90px] w-[63px] items-center justify-center rounded-lg border-2 border-dashed border-white/30"
        data-slot-kind="incoming"
        data-testid={`staging-slot-${slotIndex}`}
      >
        <div className="relative" data-testid={`staging-tile-scale-${slotIndex}`}>
          <div
            className={cn('relative', entryClass)}
            data-testid={`staging-incoming-tile-wrapper-${tile.id}`}
          >
            <Tile
              tile={tile.tile}
              faceUp={!isHidden}
              size="medium"
              onClick={() => {
                if (isBlindTile && isHidden && !canRevealBlind) {
                  return;
                }
                if (isBlindTile && isHidden && canRevealBlind) {
                  onAbsorbIncoming(tile.id);
                  return;
                }
                onAbsorbIncoming(tile.id);
              }}
              ariaLabel={`${label}${seatLabel}`}
              testId={`staging-incoming-tile-${tile.id}`}
            />
            {badgeLabel ? (
              <Badge
                className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 bg-amber-500/95 text-[10px] font-bold tracking-[0.16em] text-black"
                data-testid={`staging-incoming-badge-${tile.id}`}
              >
                {badgeLabel}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderOutgoingSlot = (tile: StagedTile, slotIndex: number) => {
    return (
      <div
        key={tile.id}
        className="flex h-[90px] w-[63px] items-center justify-center rounded-lg border-2 border-dashed border-white/30"
        data-slot-kind="outgoing"
        data-testid={`staging-slot-${slotIndex}`}
      >
        <Tile
          tile={tile.tile}
          size="medium"
          state="default"
          onClick={() => onRemoveOutgoing(tile.id)}
          ariaLabel="Remove staged outgoing tile"
          testId={`staging-outgoing-tile-${tile.id}`}
        />
      </div>
    );
  };

  const renderEmptySlot = (slotIndex: number) => {
    return (
      <div
        key={`empty-slot-${slotIndex}`}
        className="flex h-[90px] w-[63px] items-center justify-center rounded-lg border-2 border-dashed border-white/30"
        data-slot-kind="empty"
        data-testid={`staging-slot-${slotIndex}`}
      />
    );
  };

  const orderedDescriptors: SlotDescriptor[] = [
    ...(incomingTiles.length === 0
      ? outgoingTiles.map<SlotDescriptor>((tile) => ({ kind: 'outgoing', tile }))
      : incomingTiles.map<SlotDescriptor>((tile, incomingIndex) => ({
          kind: 'incoming',
          tile,
          incomingIndex,
        }))),
    ...(incomingTiles.length === 0
      ? incomingTiles.map<SlotDescriptor>((tile, incomingIndex) => ({
          kind: 'incoming',
          tile,
          incomingIndex,
        }))
      : outgoingTiles.map<SlotDescriptor>((tile) => ({ kind: 'outgoing', tile }))),
  ].slice(0, slotCount);

  const slotDescriptors: SlotDescriptor[] = [
    ...orderedDescriptors,
    ...Array.from({ length: Math.max(0, slotCount - orderedDescriptors.length) }, () => ({
      kind: 'empty' as const,
    })),
  ];

  const stripStyles = {
    '--staging-slot-width': `${STAGING_SLOT_WIDTH_PX}px`,
    '--staging-slot-height': `${STAGING_SLOT_HEIGHT_PX}px`,
    '--staging-slot-gap': `${STAGING_SLOT_GAP_PX}px`,
    '--staging-strip-padding': `${STAGING_STRIP_PADDING_PX}px`,
    '--staging-slot-count': String(slotCount),
    '--staging-slot-row-scale': String(slotRowScale),
  } as CSSProperties;

  const slotViewportHeight = STAGING_SLOT_HEIGHT_PX * slotRowScale;

  const slotElements = slotDescriptors.map((descriptor, slotIndex) => {
    if (descriptor.kind === 'incoming') {
      return renderIncomingSlot(descriptor.tile, descriptor.incomingIndex, slotIndex);
    }

    if (descriptor.kind === 'outgoing') {
      return renderOutgoingSlot(descriptor.tile, slotIndex);
    }

    return renderEmptySlot(slotIndex);
  });

  const actionButtons = showActionButtons ? (
    <div className="grid grid-cols-3 gap-2" data-testid="staging-action-buttons">
      <Button
        onClick={onCommitPass}
        disabled={!canCommitPass || isProcessing}
        data-testid="staging-pass-button"
      >
        PASS
      </Button>
      <Button
        onClick={onCommitCall}
        disabled={!canCommitCall || isProcessing}
        variant="outline"
        data-testid="staging-call-button"
      >
        CALL
      </Button>
      <Button
        onClick={onCommitDiscard}
        disabled={!canCommitDiscard || isProcessing}
        variant="secondary"
        data-testid="staging-discard-button"
      >
        DISCARD
      </Button>
    </div>
  ) : null;

  return (
    <section
      className="relative z-20 flex w-full flex-col gap-4 overflow-visible rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm"
      data-testid="staging-strip"
      aria-label="Tile staging strip"
      style={{
        ...stripStyles,
        maxWidth: stripWidth,
      }}
    >
      <div
        className="w-full overflow-visible"
        data-testid="staging-slot-viewport"
        ref={slotViewportRef}
      >
        <div
          className="mx-auto origin-top"
          data-testid="staging-slot-row"
          style={{
            display: 'grid',
            gap: 'var(--staging-slot-gap)',
            gridTemplateColumns: `repeat(${slotCount}, minmax(0, var(--staging-slot-width)))`,
            height: `${slotViewportHeight}px`,
            transform: `scale(${slotRowScale})`,
            transformOrigin: 'top center',
            width: slotContentWidth,
          }}
        >
          {slotElements}
        </div>
      </div>
      {actionButtons}
    </section>
  );
};

StagingStrip.displayName = 'StagingStrip';
