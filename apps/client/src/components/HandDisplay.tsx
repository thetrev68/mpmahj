import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { useRecommendedDiscard, useTilesNeeded } from '@/store/analysisStore';
import {
  tileToCode,
  tileToString,
  tileToSvgPath,
  compareBySuit,
  compareByRank,
  formatMeld,
} from '@/utils/tileFormatter';
import { tileKey, parseTileKey } from '@/utils/tileKey';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Meld } from '@/types/bindings/generated/Meld';
import './HandDisplay.css';

export function HandDisplay() {
  // Game state
  const yourHand = useGameStore((state) => state.yourHand);
  const yourSeat = useGameStore((state) => state.yourSeat);
  const players = useGameStore((state) => state.players);
  const meldSources = useGameStore((state) => state.meldSources);

  // UI state
  const sortingMode = useUIStore((state) => state.sortingMode);
  const selectedTiles = useUIStore((state) => state.selectedTiles);
  const toggleTileSelection = useUIStore((state) => state.toggleTileSelection);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const isSelected = useUIStore((state) => state.isSelected);
  const setSortingMode = useUIStore((state) => state.setSortingMode);

  // Analysis state
  const recommendedDiscard = useRecommendedDiscard();
  const tilesNeeded = useTilesNeeded();

  // No hand to display
  if (yourHand.length === 0) {
    return (
      <div className="hand-display">
        <div className="hand-header">
          <h2>Your Hand</h2>
        </div>
        <div className="hand-empty">
          <p>Waiting for tiles to be dealt...</p>
        </div>
      </div>
    );
  }

  const tilesWithKeys = yourHand.map((tile, index) => ({
    tile,
    index,
    key: tileKey(tile, index),
  }));

  const sortedTiles = [...tilesWithKeys].sort((a, b) =>
    sortingMode === 'suit' ? compareBySuit(a.tile, b.tile) : compareByRank(a.tile, b.tile)
  );

  // Handle tile click
  const handleTileClick = (key: string) => {
    toggleTileSelection(key);
  };

  // Get exposed melds
  const yourInfo = yourSeat ? players[yourSeat] : null;
  const exposedMelds = yourInfo?.exposed_melds || [];

  // Parse selected tiles for display
  const selectedInfo = Array.from(selectedTiles)
    .map((key) => {
      const parsed = parseTileKey(key);
      if (!parsed) return null;
      return { index: parsed.index, tile: parsed.tile, name: tileToString(parsed.tile) };
    })
    .filter((entry): entry is { index: number; tile: number; name: string } => entry !== null)
    .sort((a, b) => a.index - b.index);

  return (
    <div className="hand-display">
      {/* Header with sort controls */}
      <div className="hand-header">
        <h2>Your Hand</h2>
        <div className="sort-controls">
          <span className="sort-label">Sort:</span>
          <button
            className={`sort-button ${sortingMode === 'suit' ? 'active' : ''}`}
            onClick={() => setSortingMode('suit')}
          >
            By Suit
          </button>
          <button
            className={`sort-button ${sortingMode === 'rank' ? 'active' : ''}`}
            onClick={() => setSortingMode('rank')}
          >
            By Rank
          </button>
        </div>
      </div>

      {/* Concealed tiles */}
      <div className="concealed-hand">
        <div className="tiles-grid">
          {sortedTiles.map(({ tile, index, key }) => {
            const selected = isSelected(key);
            const isRecommendedDiscard = recommendedDiscard === tile;
            const isTileNeeded = tilesNeeded.includes(tile);
            const svgPath = tileToSvgPath(tile);
            const tileName = tileToString(tile);

            const classNames = [
              'tile-button',
              selected && 'selected',
              isRecommendedDiscard && 'recommended-discard',
              isTileNeeded && 'tile-needed',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={key}
                className={classNames}
                onClick={() => handleTileClick(key)}
                title={tileName}
              >
                {svgPath ? (
                  <img src={svgPath} alt={tileName} className="tile-image" />
                ) : (
                  <span className="tile-code">{tileToCode(tile)}</span>
                )}
                <span className="tile-index">{index}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selection display */}
      {selectedInfo.length > 0 && (
        <div className="selection-display">
          <span className="selection-label">Selected:</span>
          <span className="selection-list">
            {selectedInfo.map(({ index, name }) => `${name} (${index})`).join(', ')}
          </span>
          <button className="clear-button" onClick={clearSelection}>
            Clear
          </button>
        </div>
      )}

      {/* Exposed melds */}
      {exposedMelds.length > 0 && (
        <div className="exposed-melds">
          <h3>Your Exposed Melds</h3>
          <div className="melds-list">
            {exposedMelds.map((meld, index) => (
              <ExposedMeldItem
                key={index}
                meld={meld}
                meldIndex={index}
                yourSeat={yourSeat}
                meldSources={meldSources}
                isYourMeld={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other players' exposed melds */}
      <OtherPlayersMelds />
    </div>
  );
}

function ExposedMeldItem({
  meld,
  meldIndex,
  yourSeat,
  meldSources,
  isYourMeld,
  ownerSeat,
}: {
  meld: Meld;
  meldIndex: number;
  yourSeat: Seat | null;
  meldSources: Record<Seat, Array<Seat | null>>;
  isYourMeld: boolean;
  ownerSeat?: Seat;
}) {
  const yourHand = useGameStore((state) => state.yourHand);
  const phase = useGameStore((state) => state.phase);
  const setMeldUpgradeDialog = useUIStore((state) => state.setMeldUpgradeDialog);
  const setJokerExchangeDialog = useUIStore((state) => state.setJokerExchangeDialog);

  const meldDisplay = formatMeld(meld);
  const owner = isYourMeld ? yourSeat : ownerSeat;
  const calledFrom = owner ? (meldSources[owner]?.[meldIndex] ?? null) : null;
  const calledInfo = meld.called_tile
    ? calledFrom
      ? ` (called from ${calledFrom})`
      : ' (called)'
    : '';

  // Check if player can upgrade this meld (only their own melds during Discarding phase)
  const canUpgrade =
    isYourMeld &&
    yourSeat &&
    typeof phase === 'object' &&
    'Playing' in phase &&
    typeof phase.Playing === 'object' &&
    'Discarding' in phase.Playing &&
    phase.Playing.Discarding.player === yourSeat &&
    meld.meld_type !== 'Sextet'; // Can't upgrade Sextet

  // Find what tile is needed for upgrade
  let upgradeTile: number | null = null;
  if (canUpgrade) {
    for (const tile of meld.tiles) {
      if (tile !== 35) {
        upgradeTile = tile;
        break;
      }
    }
    if (upgradeTile === null && meld.called_tile !== null) {
      upgradeTile = meld.called_tile;
    }
  }

  const hasUpgradeTile =
    canUpgrade && upgradeTile !== null && (yourHand.includes(upgradeTile) || yourHand.includes(35));

  // Check if meld has jokers and player can exchange (only other players' melds during Discarding phase)
  const hasJokers = meld.tiles.some((t) => t === 35);
  const canExchange =
    !isYourMeld &&
    hasJokers &&
    ownerSeat &&
    yourSeat &&
    typeof phase === 'object' &&
    'Playing' in phase &&
    typeof phase.Playing === 'object' &&
    'Discarding' in phase.Playing &&
    phase.Playing.Discarding.player === yourSeat;

  const handleUpgradeClick = () => {
    setMeldUpgradeDialog(true, meldIndex);
  };

  const handleJokerExchangeClick = () => {
    if (ownerSeat) {
      setJokerExchangeDialog(true, { seat: ownerSeat, meldIndex });
    }
  };

  return (
    <div className="meld-item">
      <span>
        {meldDisplay}
        {calledInfo}
      </span>
      {hasUpgradeTile && (
        <button onClick={handleUpgradeClick} className="btn-upgrade">
          Upgrade
        </button>
      )}
      {canExchange && (
        <button onClick={handleJokerExchangeClick} className="btn-exchange">
          Exchange Joker
        </button>
      )}
    </div>
  );
}

function OtherPlayersMelds() {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const players = useGameStore((state) => state.players);
  const meldSources = useGameStore((state) => state.meldSources);

  const seats: Seat[] = ['East', 'South', 'West', 'North'];
  const otherSeats = seats.filter((seat) => seat !== yourSeat && players[seat]);

  if (otherSeats.length === 0) {
    return null;
  }

  return (
    <div className="other-players-melds">
      <h3>Other Players' Melds</h3>
      {otherSeats.map((seat) => {
        const player = players[seat];
        if (!player || player.exposed_melds.length === 0) {
          return null;
        }

        return (
          <div key={seat} className="player-melds-section">
            <h4>{seat}</h4>
            <div className="melds-list">
              {player.exposed_melds.map((meld, index) => (
                <ExposedMeldItem
                  key={index}
                  meld={meld}
                  meldIndex={index}
                  yourSeat={yourSeat}
                  meldSources={meldSources}
                  isYourMeld={false}
                  ownerSeat={seat}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
