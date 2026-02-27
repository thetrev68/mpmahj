import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Tile } from './Tile';
import { RACK_WOOD_STYLE } from './rackStyles';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile as TileValue } from '@/types/bindings/generated/Tile';

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

const SLOT_TILE_WIDTH = 63;
const SLOT_GAP = 6;

function buildSlotWidth(slotCount: number) {
  if (slotCount <= 0) return 0;
  return slotCount * SLOT_TILE_WIDTH + (slotCount - 1) * SLOT_GAP;
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
    const isHidden = tile?.hidden ?? false;
    const label = isHidden ? 'Flip staged incoming tile' : 'Absorb staged incoming tile';
    const seatLabel = incomingFromSeat ? ` from ${incomingFromSeat}` : '';

    return (
      <div
        key={tile?.id ?? `incoming-slot-${index}`}
        className="flex h-[90px] w-[63px] items-center justify-center rounded border border-dashed border-black/30 bg-black/10"
        data-testid={`staging-incoming-slot-${index}`}
      >
        {tile ? (
          <Tile
            tile={tile.tile}
            faceUp={!isHidden}
            size="medium"
            onClick={() => {
              if (isHidden) {
                onFlipIncoming(tile.id);
                return;
              }
              onAbsorbIncoming(tile.id);
            }}
            ariaLabel={`${label}${seatLabel}`}
            testId={`staging-incoming-tile-${tile.id}`}
          />
        ) : null}
      </div>
    );
  };

  const renderOutgoingSlot = (index: number) => {
    const tile = outgoingTiles[index];

    return (
      <div
        key={tile?.id ?? `outgoing-slot-${index}`}
        className="flex h-[90px] w-[63px] items-center justify-center rounded border border-dashed border-black/30 bg-black/10"
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
      className="fixed bottom-28 left-1/2 z-20 flex -translate-x-1/2 items-end gap-4 rounded-lg px-4 py-3 shadow-xl"
      style={RACK_WOOD_STYLE}
      data-testid="staging-strip"
      aria-label="Tile staging strip"
    >
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-100">
          Incoming
          {blindIncoming ? ' (Blind)' : ''}
        </div>
        <div
          className="flex gap-1.5 rounded-md bg-black/20 px-2 py-2"
          data-testid="staging-incoming-lane"
          style={{ minWidth: `${buildSlotWidth(incomingSlotCount)}px` }}
        >
          {Array.from({ length: incomingSlotCount }, (_, index) => renderIncomingSlot(index))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-100">
          Outgoing
        </div>
        <div
          className="flex gap-1.5 rounded-md bg-black/20 px-2 py-2"
          data-testid="staging-outgoing-lane"
          style={{ minWidth: `${buildSlotWidth(outgoingSlotCount)}px` }}
        >
          {Array.from({ length: outgoingSlotCount }, (_, index) => renderOutgoingSlot(index))}
        </div>
      </div>

      <div className="flex min-w-[180px] flex-col gap-2">
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
