import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import {
  tileToCode,
  tileToString,
  compareBySuit,
  compareByRank,
  formatMeld,
} from '@/utils/tileFormatter';
import { tileKey, parseTileKey } from '@/utils/tileKey';
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
            const displayCode = tileToCode(tile);

            return (
              <button
                key={key}
                className={`tile-button ${selected ? 'selected' : ''}`}
                onClick={() => handleTileClick(key)}
                title={tileToString(tile)}
              >
                <span className="tile-code">{displayCode}</span>
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
          <h3>Exposed Melds</h3>
          <div className="melds-list">
            {exposedMelds.map((meld, index) => {
              const meldDisplay = formatMeld(meld);
              const calledFrom = yourSeat ? (meldSources[yourSeat]?.[index] ?? null) : null;
              const calledInfo = meld.called_tile
                ? calledFrom
                  ? ` (called from ${calledFrom})`
                  : ' (called)'
                : '';

              return (
                <div key={index} className="meld-item">
                  {meldDisplay}
                  {calledInfo}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
