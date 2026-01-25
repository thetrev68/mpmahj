import { useGameStore } from '@/store/gameStore';
import { tileToCode } from '@/utils/tileFormatter';
import type { DiscardInfo } from '@/types/bindings/generated/DiscardInfo';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import './DiscardPile.css';

/**
 * Group discards by seat, keeping last N per player.
 */
function groupDiscardsBySeat(
  discardPile: DiscardInfo[],
  maxPerSeat: number = 6
): Record<Seat, Tile[]> {
  const seats: Seat[] = ['East', 'South', 'West', 'North'];
  const grouped = {} as Record<Seat, Tile[]>;

  seats.forEach((seat) => {
    const seatDiscards = discardPile
      .filter((info) => info.discarded_by === seat)
      .map((info) => info.tile);

    // Take last N discards (most recent)
    grouped[seat] = seatDiscards.slice(-maxPerSeat);
  });

  return grouped;
}

export function DiscardPile() {
  const discardPile = useGameStore((state) => state.discardPile);
  const yourSeat = useGameStore((state) => state.yourSeat);

  const grouped = groupDiscardsBySeat(discardPile, 6);
  const seats: Seat[] = ['East', 'South', 'West', 'North'];

  return (
    <div className="discard-pile">
      <h2>Discard Piles</h2>
      <div className="discard-list">
        {seats.map((seat) => (
          <div key={seat} className="seat-discard-row">
            <span className={`seat-label seat-${seat.toLowerCase()}`}>
              {seat}:{seat === yourSeat && ' (You)'}
            </span>
            <div className="discard-tiles">
              {grouped[seat].length === 0 ? (
                <span className="no-discards">—</span>
              ) : (
                // TODO: Swap text tiles for SVG assets from apps/client/public/assets/tiles.
                grouped[seat].map((tile, index) => {
                  const isLatest = index === grouped[seat].length - 1;
                  return (
                    <span
                      key={`${seat}-${index}-${tile}`}
                      className={`discard-tile ${isLatest ? 'latest' : ''}`}
                      title={isLatest ? 'Most recent discard' : undefined}
                    >
                      {tileToCode(tile)}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
