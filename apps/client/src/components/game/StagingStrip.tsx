import { useState, type FC } from 'react';
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
  incomingSlotCount: number;
  outgoingSlotCount: number;
  blindIncoming: boolean;
  incomingFromSeat: Seat | null;
  onFlipIncoming: (tileId: string) => void;
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
  claimCandidateState?: 'empty' | 'valid' | 'invalid' | null;
  claimCandidateLabel?: string | null;
  claimCandidateDetail?: string | null;
}

export const StagingStrip: FC<StagingStripProps> = ({
  incomingTiles,
  outgoingTiles,
  incomingSlotCount,
  outgoingSlotCount,
  blindIncoming,
  incomingFromSeat,
  onFlipIncoming,
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
  claimCandidateState = null,
  claimCandidateLabel = null,
  claimCandidateDetail = null,
}) => {
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
      prevTileIds: Array.from(
        { length: incomingSlotCount },
        (_, i) => prevSnapshot.lastSeenTiles[i]?.id
      ),
      lastSeenTiles: incomingTiles,
    });
  }

  const prevTileIds = prevSnapshot.prevTileIds;

  const renderIncomingSlot = (index: number) => {
    const tile = incomingTiles[index];
    const isBlindTile = blindIncoming && tile !== undefined;
    const isHidden = isBlindTile && (tile?.hidden ?? false);
    const label = isHidden ? 'Flip staged incoming tile' : 'Absorb staged incoming tile';
    const seatLabel = incomingFromSeat ? ` from ${incomingFromSeat}` : '';
    const badgeLabel = isBlindTile ? (isHidden ? 'BLIND' : 'PEEK') : null;
    const wasEmpty = prevTileIds[index] === undefined;
    const entryClass =
      wasEmpty && tile !== undefined && incomingFromSeat
        ? SEAT_ENTRY_CLASS[incomingFromSeat]
        : undefined;

    return (
      <div
        key={tile?.id ?? `incoming-slot-${index}`}
        className="flex h-[90px] w-[63px] items-center justify-center rounded-lg border-2 border-dashed border-white/30"
        data-testid={`staging-incoming-slot-${index}`}
      >
        {tile ? (
          <div
            className={cn('relative', entryClass)}
            data-testid={`staging-incoming-tile-wrapper-${tile.id}`}
          >
            <Tile
              tile={tile.tile}
              faceUp={!isHidden}
              size="medium"
              onClick={() => {
                if (isBlindTile && isHidden) {
                  onFlipIncoming(tile.id);
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
        ) : null}
      </div>
    );
  };

  const renderOutgoingSlot = (index: number) => {
    const tile = outgoingTiles[index];

    return (
      <div
        key={tile?.id ?? `outgoing-slot-${index}`}
        className="flex h-[90px] w-[63px] items-center justify-center rounded-lg border-2 border-dashed border-white/30"
        data-testid={`staging-outgoing-slot-${index}`}
      >
        {tile ? (
          <Tile
            tile={tile.tile}
            size="medium"
            state="default"
            onClick={() => onRemoveOutgoing(tile.id)}
            ariaLabel="Remove staged outgoing tile"
            testId={`staging-outgoing-tile-${tile.id}`}
          />
        ) : null}
      </div>
    );
  };

  const slotElements =
    incomingTiles.length === 0
      ? [
          ...Array.from({ length: outgoingSlotCount }, (_, index) => renderOutgoingSlot(index)),
          ...Array.from({ length: incomingSlotCount }, (_, index) => renderIncomingSlot(index)),
        ]
      : [
          ...Array.from({ length: incomingSlotCount }, (_, index) => renderIncomingSlot(index)),
          ...Array.from({ length: outgoingSlotCount }, (_, index) => renderOutgoingSlot(index)),
        ];

  return (
    <section
      className="relative z-20 flex w-full flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
      data-testid="staging-strip"
      aria-label="Tile staging strip"
    >
      <div className="flex flex-nowrap justify-center gap-2 overflow-x-auto pb-1">
        {slotElements}
      </div>

      {claimCandidateState && (
        <div
          className={cn(
            'rounded-xl border px-3 py-2 text-sm',
            claimCandidateState === 'valid' && 'border-emerald-400/70 bg-emerald-950/40',
            claimCandidateState === 'invalid' && 'border-rose-400/70 bg-rose-950/40',
            claimCandidateState === 'empty' && 'border-white/20 bg-white/5'
          )}
          data-testid="staging-claim-candidate"
        >
          {claimCandidateLabel ? (
            <div className="font-semibold text-white" data-testid="staging-claim-candidate-label">
              {claimCandidateLabel}
            </div>
          ) : null}
          {claimCandidateDetail ? (
            <div className="text-slate-200" data-testid="staging-claim-candidate-detail">
              {claimCandidateDetail}
            </div>
          ) : null}
        </div>
      )}

      {showActionButtons && (
        <div className="flex min-w-[160px] flex-row justify-center gap-2 sm:flex-col">
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
      )}
    </section>
  );
};

StagingStrip.displayName = 'StagingStrip';
