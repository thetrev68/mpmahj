import type { FC } from 'react';
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
}) => {
  const renderIncomingSlot = (index: number) => {
    const tile = incomingTiles[index];
    const isBlindTile = blindIncoming && tile !== undefined;
    const isHidden = isBlindTile && (tile?.hidden ?? false);
    const label = isHidden ? 'Flip staged incoming tile' : 'Absorb staged incoming tile';
    const seatLabel = incomingFromSeat ? ` from ${incomingFromSeat}` : '';
    const badgeLabel = isBlindTile ? (isHidden ? 'BLIND' : 'PEEK') : null;
    const entryClass = tile && incomingFromSeat ? SEAT_ENTRY_CLASS[incomingFromSeat] : undefined;

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
              onClick={
                isBlindTile
                  ? () => {
                      if (isHidden) {
                        onFlipIncoming(tile.id);
                        return;
                      }
                      onAbsorbIncoming(tile.id);
                    }
                  : undefined
              }
              ariaLabel={isBlindTile ? `${label}${seatLabel}` : undefined}
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
            state="selected"
            onClick={() => onRemoveOutgoing(tile.id)}
            ariaLabel="Remove staged outgoing tile"
            testId={`staging-outgoing-tile-${tile.id}`}
          />
        ) : null}
      </div>
    );
  };

  return (
    <section
      className="fixed bottom-[260px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-6"
      data-testid="staging-strip"
      aria-label="Tile staging strip"
    >
      <div className="flex gap-2">
        {Array.from({ length: incomingSlotCount }, (_, index) => renderIncomingSlot(index))}
        {Array.from({ length: outgoingSlotCount }, (_, index) => renderOutgoingSlot(index))}
      </div>

      <div className="flex min-w-[160px] flex-col gap-2">
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
    </section>
  );
};

StagingStrip.displayName = 'StagingStrip';
