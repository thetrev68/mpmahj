# TileRemainingCounter Component

## Overview

**Purpose**: Display count of specific tiles remaining in the wall, helping advanced players track tile availability for strategic decision-making.

**Category**: Presentational Component (Advanced Features)

**Complexity**: Medium

The TileRemainingCounter component shows how many tiles of each type remain unaccounted for (not in hand, not exposed, not discarded). This is a critical tool for advanced players who track tile probabilities to make optimal decisions about:

- **Draw probability**: Likelihood of drawing needed tiles
- **Safety**: Which tiles are safe to discard
- **Opponent threats**: Estimating opponents' potential hands
- **Pattern viability**: Whether patterns are still achievable

The component displays tile counts in various formats: individual tile counters, suit summaries, or full tile availability grids.

## User Stories

**Primary Stories**:

- **US-026**: As an advanced player, I want to see tile counts so I can calculate draw probabilities
- **US-027**: As a player, I want to track which tiles are still available so I can adjust my strategy
- **US-028**: As a player, I want to know if specific tiles are "dead" (all 4 used)

**Related Stories**:

- **US-024**: As a player, I want visual hints for strategic opportunities
- **US-029**: As a player, I want to understand tile distribution (4 of each, 8 jokers, 8 flowers)
- **US-030**: As a player, I want statistics on tile availability

## Visual Design

### Individual Tile Counter (Compact)

```
┌──────────────┐
│  ┌──┐        │
│  │5C│  2/4   │  ← Tile + count (2 remaining of 4 total)
│  └──┘        │
└──────────────┘
Size: 80px × 60px
```

### Dead Tile Indicator (0 remaining)

```
┌──────────────┐
│  ┌──┐        │
│  │5C│  0/4   │  ← Red color, strikethrough
│  └──┘  ✕     │  ← Dead indicator
└──────────────┘
```

### Suit Summary

```
┌─────────────────────────────────────┐
│ CRAKS                          16/36 │  ← Suit name + total remaining
├─────────────────────────────────────┤
│ 1C: 3/4  4C: 2/4  7C: 1/4  9C: 0/4  │  ← Key tiles
│ 2C: 4/4  5C: 2/4  8C: 3/4           │
│ 3C: 3/4  6C: 2/4                    │
└─────────────────────────────────────┘
Size: 300px × 120px
```

### Full Grid View

```
┌────────────────────────────────────────────────────────────┐
│ TILE AVAILABILITY                                          │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ BAMS (12/36)                                               │
│ ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐    │
│ │1B│  │2B│  │3B│  │4B│  │5B│  │6B│  │7B│  │8B│  │9B│    │
│ 2/4   4/4   3/4   1/4   2/4   3/4   2/4   1/4   0/4      │
│                                                             │
│ CRAKS (16/36)                                              │
│ ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐    │
│ │1C│  │2C│  │3C│  │4C│  │5C│  │6C│  │7C│  │8C│  │9C│    │
│ 3/4   4/4   3/4   2/4   2/4   2/4   1/4   3/4   0/4      │
│                                                             │
│ DOTS (14/36)                                               │
│ ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐    │
│ │1D│  │2D│  │3D│  │4D│  │5D│  │6D│  │7D│  │8D│  │9D│    │
│ 2/4   3/4   2/4   1/4   2/4   1/4   2/4   2/4   0/4      │
│                                                             │
│ WINDS (4/16)          DRAGONS (6/12)      FLOWERS (3/8)   │
│ ┌──┐  ┌──┐  ┌──┐  ┌──┐ ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──│
│ │EW│  │SW│  │WW│  │NW│ │RD│  │GD│  │WD│  │FL│  JOKER   │
│ 1/4   0/4   2/4   1/4  3/4   2/4   1/4   3/8    5/8     │
│                                                             │
└────────────────────────────────────────────────────────────┘
Size: 600px × 480px
```

### Probability View (with percentages)

```
┌─────────────────────────────────┐
│ DRAW PROBABILITY                │
├─────────────────────────────────┤
│                                  │
│ Target tiles you need:           │
│                                  │
│ ┌──┐  ┌──┐  ┌──┐                │
│ │5C│  │6C│  │7C│                │
│ 2/4   2/4   1/4                 │
│ 5.4%  5.4%  2.7%                │  ← Draw probability
│                                  │
│ Combined: 13.5%                  │  ← Any of these tiles
│                                  │
│ From 74 tiles remaining          │  ← Wall size
│                                  │
└─────────────────────────────────┘
Size: 280px × 200px
```

### Compact List (Mobile)

```
┌──────────────────┐
│ TILE COUNTS      │
├──────────────────┤
│ 5C: 2/4  ▬▬░░   │  ← Mini progress bar
│ 6C: 2/4  ▬▬░░   │
│ 7C: 1/4  ▬░░░   │
│ 8C: 0/4  ░░░░ ✕ │  ← Dead tile
│ 9C: 3/4  ▬▬▬░   │
└──────────────────┘
Size: 160px × 140px
```

## Props Interface

```typescript
import { Tile } from '@/types/bindings/generated';

export interface TileRemainingCounterProps {
  /**
   * Tiles to track (if empty, shows all tiles)
   */
  trackedTiles?: Tile[];

  /**
   * Tile counts: map of tile index to remaining count
   */
  remainingCounts: Map<number, number>;

  /**
   * Total tiles in wall initially
   * @default 152 (144 tiles + 8 flowers/jokers for NMJL)
   */
  totalTiles?: number;

  /**
   * Tiles still in wall (undrawn)
   */
  wallRemaining: number;

  /**
   * Display mode
   * @default 'grid'
   */
  mode?: 'grid' | 'list' | 'compact' | 'suits' | 'probability';

  /**
   * Show only tracked tiles or all tiles
   * @default false (show all when trackedTiles empty)
   */
  onlyTracked?: boolean;

  /**
   * Highlight tiles with specific counts
   */
  highlightCounts?: {
    zero?: boolean; // Dead tiles
    one?: boolean; // Last tile
    full?: boolean; // All 4 available
  };

  /**
   * Show percentages (draw probability)
   * @default false
   */
  showProbability?: boolean;

  /**
   * Show progress bars
   * @default true
   */
  showProgressBars?: boolean;

  /**
   * Group by suit
   * @default true
   */
  groupBySuit?: boolean;

  /**
   * Show suit totals
   * @default true
   */
  showSuitTotals?: boolean;

  /**
   * Sort order
   * @default 'suit'
   */
  sortBy?: 'suit' | 'count' | 'probability';

  /**
   * Callback when tile is clicked (for details)
   */
  onTileClick?: (tile: Tile) => void;

  /**
   * Enable tooltips with details
   * @default true
   */
  showTooltips?: boolean;

  /**
   * Tile size variant
   * @default 'small'
   */
  tileSize?: 'tiny' | 'small' | 'medium';

  /**
   * Additional CSS class
   */
  className?: string;
}

export interface TileCountInfo {
  tile: Tile;
  remaining: number;
  total: number;
  percentage: number; // remaining/total
  probability: number; // remaining/wallRemaining
  isDead: boolean; // remaining === 0
  isLast: boolean; // remaining === 1
  isFull: boolean; // remaining === total
}

export interface SuitGroup {
  suitName: string;
  tiles: TileCountInfo[];
  totalRemaining: number;
  totalPossible: number;
}
```

## State Management

```typescript
import { useMemo, useCallback } from 'react';

export const useTileRemainingCounter = (props: TileRemainingCounterProps) => {
  const {
    trackedTiles,
    remainingCounts,
    wallRemaining,
    totalTiles = 152,
    onlyTracked = false,
    groupBySuit = true,
    sortBy = 'suit',
  } = props;

  // Generate tile count info
  const tileCountInfo = useMemo<TileCountInfo[]>(() => {
    const tiles = onlyTracked && trackedTiles ? trackedTiles : getAllTiles();

    return tiles
      .map((tile) => {
        const remaining = remainingCounts.get(tile.index) ?? 0;
        const total = getTileTotal(tile.index);
        const percentage = total > 0 ? (remaining / total) * 100 : 0;
        const probability = wallRemaining > 0 ? (remaining / wallRemaining) * 100 : 0;

        return {
          tile,
          remaining,
          total,
          percentage,
          probability,
          isDead: remaining === 0,
          isLast: remaining === 1,
          isFull: remaining === total,
        };
      })
      .filter((info) => !onlyTracked || trackedTiles?.some((t) => t.index === info.tile.index));
  }, [trackedTiles, remainingCounts, wallRemaining, totalTiles, onlyTracked]);

  // Group by suit
  const suitGroups = useMemo<SuitGroup[]>(() => {
    if (!groupBySuit) return [];

    const groups = new Map<string, TileCountInfo[]>();

    tileCountInfo.forEach((info) => {
      const suit = getTileSuit(info.tile.index);
      if (!groups.has(suit)) {
        groups.set(suit, []);
      }
      groups.get(suit)!.push(info);
    });

    return Array.from(groups.entries()).map(([suitName, tiles]) => ({
      suitName,
      tiles,
      totalRemaining: tiles.reduce((sum, t) => sum + t.remaining, 0),
      totalPossible: tiles.reduce((sum, t) => sum + t.total, 0),
    }));
  }, [tileCountInfo, groupBySuit]);

  // Sort tiles
  const sortedTileInfo = useMemo(() => {
    const sorted = [...tileCountInfo];

    switch (sortBy) {
      case 'count':
        sorted.sort((a, b) => b.remaining - a.remaining);
        break;
      case 'probability':
        sorted.sort((a, b) => b.probability - a.probability);
        break;
      case 'suit':
      default:
        sorted.sort((a, b) => a.tile.index - b.tile.index);
        break;
    }

    return sorted;
  }, [tileCountInfo, sortBy]);

  return {
    tileCountInfo: sortedTileInfo,
    suitGroups,
  };
};

// Helper: Get all tiles in game
const getAllTiles = (): Tile[] => {
  const tiles: Tile[] = [];

  // 0-8: Bams, 9-17: Craks, 18-26: Dots
  for (let i = 0; i <= 26; i++) {
    tiles.push({ index: i });
  }

  // 27-30: Winds (East, South, West, North)
  for (let i = 27; i <= 30; i++) {
    tiles.push({ index: i });
  }

  // 31-33: Dragons (Red, Green, White)
  for (let i = 31; i <= 33; i++) {
    tiles.push({ index: i });
  }

  // 34-41: Flowers (34-37) + Jokers (38-41, but only 41 is used in code)
  tiles.push({ index: 34 }); // Flowers (8 total)
  tiles.push({ index: 41 }); // Jokers (8 total)

  return tiles;
};

// Helper: Get tile total count
const getTileTotal = (index: number): number => {
  // Most tiles: 4 copies
  if (index >= 0 && index <= 33) return 4;

  // Flowers: 8 total
  if (index === 34) return 8;

  // Jokers: 8 total
  if (index === 41) return 8;

  return 4; // Default
};

// Helper: Get tile suit name
const getTileSuit = (index: number): string => {
  if (index >= 0 && index <= 8) return 'BAMS';
  if (index >= 9 && index <= 17) return 'CRAKS';
  if (index >= 18 && index <= 26) return 'DOTS';
  if (index >= 27 && index <= 30) return 'WINDS';
  if (index >= 31 && index <= 33) return 'DRAGONS';
  if (index === 34) return 'FLOWERS';
  if (index === 41) return 'JOKERS';
  return 'OTHER';
};

// Helper: Format tile name
const formatTileName = (tile: Tile): string => {
  const index = tile.index;

  // Bams 1-9
  if (index >= 0 && index <= 8) return `${index + 1}B`;

  // Craks 1-9
  if (index >= 9 && index <= 17) return `${index - 8}C`;

  // Dots 1-9
  if (index >= 18 && index <= 26) return `${index - 17}D`;

  // Winds
  if (index === 27) return 'EW'; // East
  if (index === 28) return 'SW'; // South
  if (index === 29) return 'WW'; // West
  if (index === 30) return 'NW'; // North

  // Dragons
  if (index === 31) return 'RD'; // Red
  if (index === 32) return 'GD'; // Green
  if (index === 33) return 'WD'; // White

  // Specials
  if (index === 34) return 'FL'; // Flower
  if (index === 41) return 'JK'; // Joker

  return '??';
};
```

## Component Structure

```typescript
import React, { memo } from 'react';
import { Tile } from '@/components/presentational/Tile';
import { TileRemainingCounterProps, useTileRemainingCounter } from './TileRemainingCounter.types';
import styles from './TileRemainingCounter.module.css';

export const TileRemainingCounter = memo<TileRemainingCounterProps>(
  (props) => {
    const {
      mode = 'grid',
      highlightCounts = { zero: true, one: true, full: false },
      showProbability = false,
      showProgressBars = true,
      showSuitTotals = true,
      onTileClick,
      showTooltips = true,
      tileSize = 'small',
      className,
    } = props;

    const { tileCountInfo, suitGroups } = useTileRemainingCounter(props);

    // Render individual tile counter
    const renderTileCounter = (info: TileCountInfo) => {
      const shouldHighlight =
        (highlightCounts.zero && info.isDead) ||
        (highlightCounts.one && info.isLast) ||
        (highlightCounts.full && info.isFull);

      return (
        <div
          key={info.tile.index}
          className={[
            styles.tileCounter,
            info.isDead && styles.dead,
            info.isLast && styles.last,
            info.isFull && styles.full,
            shouldHighlight && styles.highlighted,
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onTileClick?.(info.tile)}
          role="button"
          tabIndex={0}
          aria-label={`${formatTileName(info.tile)}: ${info.remaining} of ${info.total} remaining${showProbability ? `, ${info.probability.toFixed(1)}% chance` : ''}`}
        >
          {/* Tile */}
          <div className={styles.tileWrapper}>
            <Tile tile={info.tile} size={tileSize} />
            {info.isDead && <div className={styles.deadOverlay}>✕</div>}
          </div>

          {/* Count */}
          <div className={styles.count}>
            <span className={styles.remaining}>{info.remaining}</span>
            <span className={styles.separator}>/</span>
            <span className={styles.total}>{info.total}</span>
          </div>

          {/* Probability */}
          {showProbability && (
            <div className={styles.probability}>{info.probability.toFixed(1)}%</div>
          )}

          {/* Progress bar */}
          {showProgressBars && (
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${info.percentage}%` }}
                aria-hidden="true"
              />
            </div>
          )}

          {/* Tooltip */}
          {showTooltips && (
            <div className={styles.tooltip} role="tooltip">
              <p className={styles.tooltipTitle}>{formatTileName(info.tile)}</p>
              <p className={styles.tooltipCount}>
                {info.remaining} of {info.total} remaining
              </p>
              {showProbability && (
                <p className={styles.tooltipProb}>
                  {info.probability.toFixed(2)}% draw chance
                </p>
              )}
            </div>
          )}
        </div>
      );
    };

    // Grid mode
    if (mode === 'grid') {
      return (
        <div className={`${styles.container} ${styles.gridMode} ${className || ''}`}>
          <div className={styles.header}>
            <h3 className={styles.title}>TILE AVAILABILITY</h3>
          </div>

          <div className={styles.gridContent}>
            {suitGroups.map((group) => (
              <div key={group.suitName} className={styles.suitGroup}>
                {/* Suit header */}
                {showSuitTotals && (
                  <div className={styles.suitHeader}>
                    <span className={styles.suitName}>{group.suitName}</span>
                    <span className={styles.suitTotal}>
                      ({group.totalRemaining}/{group.totalPossible})
                    </span>
                  </div>
                )}

                {/* Tiles */}
                <div className={styles.suitTiles}>
                  {group.tiles.map((info) => renderTileCounter(info))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // List mode
    if (mode === 'list' || mode === 'compact') {
      return (
        <div
          className={`${styles.container} ${mode === 'compact' ? styles.compactMode : styles.listMode} ${className || ''}`}
        >
          <div className={styles.header}>
            <h3 className={styles.title}>
              {mode === 'compact' ? 'TILE COUNTS' : 'TILE AVAILABILITY'}
            </h3>
          </div>

          <div className={styles.listContent}>
            {tileCountInfo.map((info) => (
              <div
                key={info.tile.index}
                className={[
                  styles.listItem,
                  info.isDead && styles.dead,
                  info.isLast && styles.last,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onTileClick?.(info.tile)}
              >
                <span className={styles.tileName}>{formatTileName(info.tile)}:</span>
                <span className={styles.count}>
                  {info.remaining}/{info.total}
                </span>

                {showProgressBars && (
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${info.percentage}%` }}
                    />
                  </div>
                )}

                {info.isDead && <span className={styles.deadMarker}>✕</span>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Suits mode (summary by suit)
    if (mode === 'suits') {
      return (
        <div className={`${styles.container} ${styles.suitsMode} ${className || ''}`}>
          <div className={styles.header}>
            <h3 className={styles.title}>TILE AVAILABILITY BY SUIT</h3>
          </div>

          <div className={styles.suitsContent}>
            {suitGroups.map((group) => (
              <div key={group.suitName} className={styles.suitSummary}>
                <div className={styles.suitHeader}>
                  <span className={styles.suitName}>{group.suitName}</span>
                  <span className={styles.suitTotal}>
                    {group.totalRemaining}/{group.totalPossible}
                  </span>
                </div>

                <div className={styles.suitDetails}>
                  {group.tiles.map((info) => (
                    <span
                      key={info.tile.index}
                      className={[styles.tileCount, info.isDead && styles.dead]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {formatTileName(info.tile)}: {info.remaining}/{info.total}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Probability mode
    if (mode === 'probability') {
      const combinedProbability = tileCountInfo.reduce(
        (sum, info) => sum + info.probability,
        0
      );

      return (
        <div className={`${styles.container} ${styles.probabilityMode} ${className || ''}`}>
          <div className={styles.header}>
            <h3 className={styles.title}>DRAW PROBABILITY</h3>
          </div>

          <div className={styles.probabilityContent}>
            <p className={styles.targetLabel}>Target tiles you need:</p>

            <div className={styles.targetTiles}>
              {tileCountInfo.map((info) => renderTileCounter(info))}
            </div>

            <div className={styles.combinedProbability}>
              <p className={styles.combinedLabel}>Combined:</p>
              <p className={styles.combinedValue}>
                {Math.min(100, combinedProbability).toFixed(1)}%
              </p>
            </div>

            <p className={styles.wallInfo}>From {props.wallRemaining} tiles remaining</p>
          </div>
        </div>
      );
    }

    return null;
  },
  (prevProps, nextProps) => {
    // Custom comparison for performance
    return (
      prevProps.remainingCounts === nextProps.remainingCounts &&
      prevProps.wallRemaining === nextProps.wallRemaining &&
      prevProps.trackedTiles === nextProps.trackedTiles &&
      prevProps.mode === nextProps.mode
    );
  }
);

TileRemainingCounter.displayName = 'TileRemainingCounter';
```

## Styling (CSS Modules)

```css
/* TileRemainingCounter.module.css */

.container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

/* Header */
.header {
  padding-bottom: 10px;
  border-bottom: 1px solid #e5e7eb;
}

.title {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Grid mode */
.gridMode {
  max-width: 600px;
}

.gridContent {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.suitGroup {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suitHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  background: #f9fafb;
  border-radius: 4px;
}

.suitName {
  color: #374151;
}

.suitTotal {
  color: #6b7280;
  font-weight: 500;
}

.suitTiles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Tile counter */
.tileCounter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms ease;
  position: relative;
  min-width: 64px;
}

.tileCounter:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tileCounter:hover .tooltip {
  opacity: 1;
  visibility: visible;
}

.tileCounter:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

/* Tile states */
.tileCounter.dead {
  background: #fef2f2;
  border-color: #fecaca;
  opacity: 0.7;
}

.tileCounter.last {
  border-color: #fbbf24;
  box-shadow: 0 0 0 1px #fbbf24;
}

.tileCounter.full {
  border-color: #10b981;
}

.tileCounter.highlighted {
  animation: highlight 1.5s ease-in-out infinite;
}

@keyframes highlight {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
  }
}

.tileWrapper {
  position: relative;
}

.deadOverlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(239, 68, 68, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #dc2626;
  font-weight: 700;
  border-radius: 4px;
}

/* Count */
.count {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-size: 13px;
  font-weight: 600;
}

.remaining {
  color: #111827;
}

.separator {
  color: #9ca3af;
  font-weight: 400;
}

.total {
  color: #6b7280;
  font-weight: 500;
}

.tileCounter.dead .remaining {
  color: #dc2626;
  text-decoration: line-through;
}

/* Probability */
.probability {
  font-size: 11px;
  font-weight: 600;
  color: #2563eb;
}

/* Progress bar */
.progressBar {
  width: 100%;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: #10b981;
  border-radius: 2px;
  transition: width 300ms ease;
}

.tileCounter.dead .progressFill {
  background: #ef4444;
}

.tileCounter.last .progressFill {
  background: #f59e0b;
}

/* Tooltip */
.tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  padding: 8px 12px;
  background: #1f2937;
  color: #ffffff;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 150ms ease,
    visibility 150ms ease;
  pointer-events: none;
  z-index: 10;
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #1f2937;
}

.tooltipTitle {
  margin: 0 0 4px;
  font-weight: 700;
}

.tooltipCount,
.tooltipProb {
  margin: 0;
  color: #d1d5db;
}

/* List mode */
.listMode,
.compactMode {
  max-width: 300px;
}

.listContent {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 400px;
  overflow-y: auto;
}

.listItem {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 13px;
}

.listItem:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.listItem.dead {
  background: #fef2f2;
  border-color: #fecaca;
  opacity: 0.7;
}

.listItem.last {
  border-color: #fbbf24;
}

.tileName {
  font-weight: 600;
  color: #374151;
  min-width: 36px;
}

.listItem .count {
  font-weight: 600;
  min-width: 42px;
}

.listItem .progressBar {
  flex: 1;
  height: 6px;
}

.deadMarker {
  color: #dc2626;
  font-weight: 700;
  font-size: 14px;
}

/* Suits mode */
.suitsMode {
  max-width: 400px;
}

.suitsContent {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.suitSummary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.suitDetails {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
}

.tileCount {
  color: #374151;
}

.tileCount.dead {
  color: #dc2626;
  text-decoration: line-through;
}

/* Probability mode */
.probabilityMode {
  max-width: 320px;
}

.probabilityContent {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.targetLabel {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.targetTiles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
}

.combinedProbability {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
}

.combinedLabel {
  font-size: 13px;
  font-weight: 600;
  color: #1e40af;
  margin: 0;
}

.combinedValue {
  font-size: 20px;
  font-weight: 700;
  color: #2563eb;
  margin: 0;
}

.wallInfo {
  font-size: 12px;
  color: #6b7280;
  text-align: center;
  margin: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .container {
    padding: 12px;
    gap: 10px;
  }

  .title {
    font-size: 12px;
  }

  .tileCounter {
    min-width: 56px;
    padding: 6px;
    gap: 3px;
  }

  .count {
    font-size: 12px;
  }

  .probability {
    font-size: 10px;
  }

  .suitTiles {
    gap: 6px;
  }

  /* Force compact mode on mobile */
  .gridMode {
    max-width: 100%;
  }

  .gridMode .suitTiles {
    justify-content: center;
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .container {
    background: #1f2937;
    border-color: #374151;
  }

  .header {
    border-color: #374151;
  }

  .title {
    color: #f9fafb;
  }

  .suitHeader {
    background: #111827;
  }

  .suitName {
    color: #d1d5db;
  }

  .suitTotal {
    color: #9ca3af;
  }

  .tileCounter {
    background: #111827;
    border-color: #4b5563;
  }

  .tileCounter:hover {
    background: #1f2937;
    border-color: #6b7280;
  }

  .tileCounter.dead {
    background: #450a0a;
    border-color: #7f1d1d;
  }

  .remaining {
    color: #f9fafb;
  }

  .separator {
    color: #6b7280;
  }

  .total {
    color: #9ca3af;
  }

  .progressBar {
    background: #374151;
  }

  .listItem {
    background: #111827;
    border-color: #4b5563;
  }

  .listItem:hover {
    background: #1f2937;
  }

  .tileName {
    color: #d1d5db;
  }

  .suitSummary {
    background: #111827;
    border-color: #4b5563;
  }

  .tileCount {
    color: #d1d5db;
  }

  .targetLabel {
    color: #d1d5db;
  }

  .targetTiles {
    background: #111827;
    border-color: #4b5563;
  }

  .combinedProbability {
    background: #1e3a8a;
    border-color: #3b82f6;
  }

  .combinedLabel {
    color: #93c5fd;
  }

  .combinedValue {
    color: #60a5fa;
  }

  .wallInfo {
    color: #9ca3af;
  }
}
```

## Accessibility

### ARIA Attributes

```typescript
// Tile counter
<div
  role="button"
  tabIndex={0}
  aria-label={`${formatTileName(info.tile)}: ${info.remaining} of ${info.total} remaining${showProbability ? `, ${info.probability.toFixed(1)}% chance` : ''}`}
>

// Tooltip
<div role="tooltip">
  <p>{formatTileName(tile)}</p>
  <p>{remaining} of {total} remaining</p>
</div>

// Progress bar
<div role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} />
```

### Keyboard Navigation

- **Tab**: Navigate between tile counters
- **Enter/Space**: Click tile for details
- **Arrow keys**: Navigate grid (when focused)

### Screen Reader Announcements

```typescript
// Announce when tile becomes dead
useEffect(() => {
  const deadTiles = tileCountInfo.filter((info) => info.isDead);
  if (deadTiles.length > 0) {
    const names = deadTiles.map((info) => formatTileName(info.tile)).join(', ');
    announceToScreenReader(`Tiles now unavailable: ${names}`, 'polite');
  }
}, [tileCountInfo]);

// Announce when tile is last
useEffect(() => {
  const lastTiles = tileCountInfo.filter((info) => info.isLast);
  if (lastTiles.length > 0) {
    const names = lastTiles.map((info) => formatTileName(info.tile)).join(', ');
    announceToScreenReader(`Last tile remaining: ${names}`, 'polite');
  }
}, [tileCountInfo]);
```

## Integration Examples

### Basic Tile Tracking

```typescript
import { TileRemainingCounter } from '@/components/presentational/TileRemainingCounter';
import { useGameState } from '@/hooks/useGameState';

export const TileTrackerPanel = () => {
  const { gameState } = useGameState();

  // Calculate remaining counts from game state
  const remainingCounts = useMemo(() => {
    const counts = new Map<number, number>();

    // Start with full deck
    for (let i = 0; i <= 41; i++) {
      counts.set(i, getTileTotal(i));
    }

    // Subtract visible tiles (hand, exposed, discarded)
    gameState.players.forEach((player) => {
      // Subtract exposed melds
      player.melds.forEach((meld) => {
        meld.tiles.forEach((tile) => {
          counts.set(tile.index, (counts.get(tile.index) || 0) - 1);
        });
      });
    });

    // Subtract discarded tiles
    gameState.discardPool.forEach((discarded) => {
      counts.set(discarded.tile.index, (counts.get(discarded.tile.index) || 0) - 1);
    });

    // Subtract current player's hand
    const currentPlayer = gameState.players.find(
      (p) => p.seat === gameState.currentUserSeat
    );
    currentPlayer?.hand.tiles.forEach((tile) => {
      counts.set(tile.index, (counts.get(tile.index) || 0) - 1);
    });

    return counts;
  }, [gameState]);

  return (
    <TileRemainingCounter
      remainingCounts={remainingCounts}
      wallRemaining={gameState.wall.remaining}
      mode="grid"
      showProbability={false}
      highlightCounts={{ zero: true, one: true }}
    />
  );
};
```

### Probability Tracker for Specific Tiles

```typescript
export const DrawProbabilityPanel = () => {
  const { gameState } = useGameState();
  const [trackedTiles, setTrackedTiles] = useState<Tile[]>([]);

  // Track tiles needed for current patterns
  useEffect(() => {
    const needed = calculateNeededTiles(
      gameState.currentPlayer.hand,
      gameState.viablePatterns
    );
    setTrackedTiles(needed);
  }, [gameState]);

  return (
    <TileRemainingCounter
      trackedTiles={trackedTiles}
      remainingCounts={calculateRemainingCounts(gameState)}
      wallRemaining={gameState.wall.remaining}
      mode="probability"
      showProbability
      onlyTracked
    />
  );
};
```

### Compact List (Sidebar)

```typescript
export const TileCountSidebar = () => {
  const { gameState } = useGameState();

  return (
    <div className={styles.sidebar}>
      <TileRemainingCounter
        remainingCounts={calculateRemainingCounts(gameState)}
        wallRemaining={gameState.wall.remaining}
        mode="compact"
        showProgressBars
        highlightCounts={{ zero: true }}
        tileSize="tiny"
      />
    </div>
  );
};
```

## Testing Strategy

### Unit Tests

```typescript
describe('TileRemainingCounter', () => {
  describe('Rendering', () => {
    it('renders grid mode with all tiles', () => {
      const { getByText } = render(
        <TileRemainingCounter
          remainingCounts={createFullCounts()}
          wallRemaining={152}
          mode="grid"
        />
      );
      expect(getByText('TILE AVAILABILITY')).toBeInTheDocument();
      expect(getByText('BAMS')).toBeInTheDocument();
    });

    it('renders dead tile indicator', () => {
      const counts = new Map([[13, 0]]); // 5C all used
      const { container } = render(
        <TileRemainingCounter
          remainingCounts={counts}
          wallRemaining={148}
          trackedTiles={[{ index: 13 }]}
          highlightCounts={{ zero: true }}
        />
      );
      expect(container.querySelector('.dead')).toBeInTheDocument();
    });

    it('shows probability percentages', () => {
      const counts = new Map([[13, 2]]); // 2 of 5C remaining
      const { getByText } = render(
        <TileRemainingCounter
          remainingCounts={counts}
          wallRemaining={100}
          trackedTiles={[{ index: 13 }]}
          showProbability
        />
      );
      expect(getByText('2.0%')).toBeInTheDocument(); // 2/100 = 2%
    });

    it('groups tiles by suit', () => {
      const { getByText } = render(
        <TileRemainingCounter
          remainingCounts={createFullCounts()}
          wallRemaining={152}
          mode="grid"
          groupBySuit
          showSuitTotals
        />
      );
      expect(getByText('BAMS')).toBeInTheDocument();
      expect(getByText('CRAKS')).toBeInTheDocument();
      expect(getByText('DOTS')).toBeInTheDocument();
    });

    it('shows progress bars', () => {
      const counts = new Map([[13, 2]]); // 2/4 = 50%
      const { container } = render(
        <TileRemainingCounter
          remainingCounts={counts}
          wallRemaining={100}
          trackedTiles={[{ index: 13 }]}
          showProgressBars
        />
      );
      const progressFill = container.querySelector('.progressFill');
      expect(progressFill).toHaveStyle({ width: '50%' });
    });
  });

  describe('Modes', () => {
    it('renders list mode', () => {
      const { container } = render(
        <TileRemainingCounter
          remainingCounts={createFullCounts()}
          wallRemaining={152}
          mode="list"
        />
      );
      expect(container.querySelector('.listMode')).toBeInTheDocument();
    });

    it('renders compact mode', () => {
      const { container, getByText } = render(
        <TileRemainingCounter
          remainingCounts={createFullCounts()}
          wallRemaining={152}
          mode="compact"
        />
      );
      expect(getByText('TILE COUNTS')).toBeInTheDocument();
    });

    it('renders probability mode', () => {
      const { getByText } = render(
        <TileRemainingCounter
          remainingCounts={createFullCounts()}
          wallRemaining={100}
          mode="probability"
          trackedTiles={[{ index: 13 }, { index: 14 }]}
        />
      );
      expect(getByText('DRAW PROBABILITY')).toBeInTheDocument();
      expect(getByText(/Combined:/)).toBeInTheDocument();
    });

    it('renders suits mode', () => {
      const { getByText } = render(
        <TileRemainingCounter
          remainingCounts={createFullCounts()}
          wallRemaining={152}
          mode="suits"
        />
      );
      expect(getByText('TILE AVAILABILITY BY SUIT')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('calls onTileClick when tile clicked', () => {
      const onTileClick = vi.fn();
      const { container } = render(
        <TileRemainingCounter
          remainingCounts={new Map([[13, 2]])}
          wallRemaining={100}
          trackedTiles={[{ index: 13 }]}
          onTileClick={onTileClick}
        />
      );

      const tileCounter = container.querySelector('.tileCounter');
      fireEvent.click(tileCounter!);

      expect(onTileClick).toHaveBeenCalledWith({ index: 13 });
    });

    it('shows tooltip on hover', async () => {
      const { container } = render(
        <TileRemainingCounter
          remainingCounts={new Map([[13, 2]])}
          wallRemaining={100}
          trackedTiles={[{ index: 13 }]}
          showTooltips
        />
      );

      const tileCounter = container.querySelector('.tileCounter');
      fireEvent.mouseEnter(tileCounter!);

      await waitFor(() => {
        const tooltip = container.querySelector('.tooltip');
        expect(tooltip).toBeVisible();
      });
    });
  });

  describe('Highlights', () => {
    it('highlights dead tiles', () => {
      const { container } = render(
        <TileRemainingCounter
          remainingCounts={new Map([[13, 0]])}
          wallRemaining={148}
          trackedTiles={[{ index: 13 }]}
          highlightCounts={{ zero: true }}
        />
      );
      expect(container.querySelector('.highlighted')).toBeInTheDocument();
    });

    it('highlights last tile', () => {
      const { container } = render(
        <TileRemainingCounter
          remainingCounts={new Map([[13, 1]])}
          wallRemaining={149}
          trackedTiles={[{ index: 13 }]}
          highlightCounts={{ one: true }}
        />
      );
      const tileCounter = container.querySelector('.tileCounter');
      expect(tileCounter).toHaveClass('last');
    });
  });

  describe('Accessibility', () => {
    it('has correct aria-label', () => {
      const { container } = render(
        <TileRemainingCounter
          remainingCounts={new Map([[13, 2]])}
          wallRemaining={100}
          trackedTiles={[{ index: 13 }]}
        />
      );
      const tileCounter = container.querySelector('[aria-label*="5C"]');
      expect(tileCounter).toBeInTheDocument();
    });

    it('passes axe accessibility tests', async () => {
      const { container } = render(
        <TileRemainingCounter
          remainingCounts={createFullCounts()}
          wallRemaining={152}
          mode="grid"
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
```

## Performance Considerations

- **Memoization**: useMemo for tile count calculations
- **React.memo**: Prevent unnecessary re-renders
- **Virtual scrolling**: For large tile lists (grid mode)
- **Debounced updates**: Throttle count updates during rapid changes

## Constants

```typescript
// TileRemainingConstants.ts
export const TILE_REMAINING_CONSTANTS = {
  TOTAL_TILES: 152, // NMJL: 144 tiles + 8 flowers + 8 jokers
  STANDARD_TILE_COUNT: 4,
  FLOWER_COUNT: 8,
  JOKER_COUNT: 8,

  SUIT_NAMES: {
    BAMS: 'BAMS',
    CRAKS: 'CRAKS',
    DOTS: 'DOTS',
    WINDS: 'WINDS',
    DRAGONS: 'DRAGONS',
    FLOWERS: 'FLOWERS',
    JOKERS: 'JOKERS',
  } as const,

  DEAD_MARKER: '✕',
} as const;
```

## Future Enhancements

1. **Heatmap Visualization**: Color-coded grid showing availability
2. **Historical Tracking**: Chart showing tile counts over time
3. **Smart Alerts**: Notify when critical tiles become available
4. **Export Data**: CSV/JSON export of tile counts
5. **Comparison Mode**: Compare current vs. previous game states
6. **Prediction**: AI-predicted tile draws based on patterns
7. **Voice Announcements**: Audio alerts for dead/last tiles
8. **Custom Groupings**: Group tiles by player preference
9. **Statistics Dashboard**: Aggregate tile usage statistics
10. **Tutorial Mode**: Interactive guide for tile counting

## Notes

- **Server Authoritative**: Tile counts derived from visible game state
- **Accuracy**: Only tracks visible tiles (hand, exposed, discarded)
- **Hidden Information**: Unknown tiles in wall remain uncertain
- **Strategic Tool**: Advanced feature for experienced players
- **Performance**: Optimized for real-time updates during gameplay
- **Accessibility**: Full keyboard navigation and screen reader support

---

**Related Components**:

- [Tile](./Tile.md): Individual tile rendering
- [DiscardPool](./DiscardPool.md): Discarded tile tracking
- [ExposedMelds](./ExposedMelds.md): Exposed meld tiles
- [PlayerHand](./PlayerHand.md): Player's hand tiles

**Backend Integration**:

- Calculate counts from `GameStateSnapshot`
- Track exposed melds, discards, and player hands
- Wall remaining count from `Wall` state
- No direct backend API (derived client-side)
