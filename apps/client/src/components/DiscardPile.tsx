import { useGameStore } from '@/store/gameStore';
import { tileToCode, tileToSvgPath, tileToString, compareBySuit } from '@/utils/tileFormatter';
import type { DiscardInfo } from '@/types/bindings/generated/DiscardInfo';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import './DiscardPile.css';

/**
 * Group discards by seat, keeping all discards per player.
 */
function groupDiscardsBySeat(
  discardPile: DiscardInfo[]
): Record<Seat, Tile[]> {
  const seats: Seat[] = ['East', 'South', 'West', 'North'];
  const grouped = {} as Record<Seat, Tile[]>;

  seats.forEach((seat) => {
    grouped[seat] = discardPile
      .filter((info) => info.discarded_by === seat)
      .map((info) => info.tile);
  });

  return grouped;
}

export function DiscardPile() {
  const discardPile = useGameStore((state) => state.discardPile);
  const yourSeat = useGameStore((state) => state.yourSeat);

  const grouped = groupDiscardsBySeat(discardPile);
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
                [...grouped[seat]]
                  .sort(compareBySuit)
                  .map((tile, index) => {
                    const isLatest = grouped[seat][grouped[seat].length - 1] === tile && index === grouped[seat].filter((t) => t === tile).length - 1;
                    const svgPath = tileToSvgPath(tile);
                    const tileName = tileToString(tile);

                    return (
                      <div
                        key={`${seat}-${index}-${tile}`}
                        className={`discard-tile ${isLatest ? 'latest' : ''}`}
                        title={isLatest ? `${tileName} (most recent discard)` : tileName}
                      >
                        {svgPath ? (
                          <img src={svgPath} alt={tileName} className="discard-tile-image" />
                        ) : (
                          <span className="discard-tile-code">{tileToCode(tile)}</span>
                        )}
                      </div>
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
