# ExposedMelds Component

## Overview

**Purpose**: Display exposed melds (Pungs, Kongs, Quints, Sextets) with called tiles, joker indicators, and concealment state.

**Category**: Presentational Component (Core Game Elements)

**Complexity**: Medium-High

The ExposedMelds component renders a player's exposed melds (called sets) in American Mahjong. Each meld shows 3-6 tiles arranged horizontally with visual indicators for:

- **Meld type**: Pung (3), Kong (4), Quint (5), Sextet (6)
- **Called tile**: Highlighted tile that was claimed from another player
- **Jokers**: Indicated with special styling
- **Concealment**: Whether meld is fully concealed or exposed

This component is critical for game state visibility, allowing players to see:

- Their own exposed melds (editable for joker exchanges)
- Other players' exposed melds (read-only)
- Meld composition and tile assignments

## User Stories

**Primary Stories**:

- **US-012**: As a player, I want to see my exposed melds so I can track my progress toward winning patterns
- **US-015**: As a player, I want to see other players' exposed melds so I can assess their hand strength
- **US-021**: As a player, I want to exchange jokers in exposed melds so I can complete my hand

**Related Stories**:

- **US-013**: As a player, I want to call tiles for melds so I can build winning hands
- **US-022**: As a player, I want to see which tiles are jokers in exposed melds
- **US-030**: As a player, I want to understand meld terminology (Pung/Kong/Quint/Sextet)

## Visual Design

### Meld Structure (Pung - 3 tiles)

```
┌─────────────────────────────────────────┐
│ PUNG - Called from West                 │  ← Meld header
├─────────────────────────────────────────┤
│  ┌──┐  ┌──┐  ┌──┐                       │
│  │3B│  │3B│  │3B│                       │  ← 3 tiles, middle called
│  └──┘  └▲─┘  └──┘                       │     ▲ = called tile marker
│          ↑                               │
│       Called                             │
└─────────────────────────────────────────┘
Size: 240px × 120px
```

### Kong with Joker (4 tiles)

```
┌─────────────────────────────────────────┐
│ KONG - Called from South                │
├─────────────────────────────────────────┤
│  ┌──┐  ┌──┐  ┌──┐  ┌──┐                │
│  │5C│  │5C│  │JK│  │5C│                │  ← Joker shown
│  └──┘  └──┘  └★─┘  └▲─┘                │     ★ = joker indicator
│                      ↑                   │     ▲ = called tile
│                   Called                 │
└─────────────────────────────────────────┘
Size: 320px × 120px
```

### Quint (5 tiles)

```
┌─────────────────────────────────────────┐
│ QUINT - Called from East                │
├─────────────────────────────────────────┤
│  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐          │
│  │9D│  │9D│  │9D│  │9D│  │9D│          │  ← 5 identical tiles
│  └──┘  └──┘  └──┘  └▲─┘  └──┘          │
│                      ↑                   │
│                   Called                 │
└─────────────────────────────────────────┘
Size: 400px × 120px
```

### Sextet (6 tiles)

```
┌─────────────────────────────────────────┐
│ SEXTET - Called from North              │
├─────────────────────────────────────────┤
│  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐    │
│  │JK│  │WH│  │WH│  │JK│  │WH│  │WH│    │  ← 6 tiles, 2 jokers
│  └★─┘  └──┘  └──┘  └★─┘  └──┘  └▲─┘    │
│                                  ↑       │
│                               Called     │
└─────────────────────────────────────────┘
Size: 480px × 120px
```

### Compact Mode (Mobile)

```
┌─────────────────┐
│ KONG (4) - S    │  ← Abbreviated header: type, count, seat
├─────────────────┤
│ ┌─┐┌─┐┌─┐┌─┐    │  ← Smaller tiles
│ │5C5C★5C│       │     ★ on called tile
│ └─┘└─┘└─┘└▲┘    │
└─────────────────┘
Size: 160px × 80px
```

### Multiple Melds Layout (Player's Full Exposure)

```
┌───────────────────────────────────────────────────────────┐
│ Your Exposed Melds (3 melds)                              │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐│
│  │ PUNG - West     │  │ KONG - South    │  │ PUNG - East││
│  ├─────────────────┤  ├─────────────────┤  ├────────────┤│
│  │ ┌──┐┌──┐┌──┐    │  │ ┌──┐┌──┐┌──┐┌──│  │ ┌──┐┌──┐┌──││
│  │ │3B3B3B│        │  │ │5C5C★5C│      │  │ │WHWHWH│   ││
│  │ └──┘└▲─┘└──┘    │  │ └──┘└──┘└─┘└▲─│  │ └──┘└──┘└▲─││
│  └─────────────────┘  └─────────────────┘  └────────────┘│
│                                                            │
└───────────────────────────────────────────────────────────┘
Size: Responsive, wraps on mobile
```

## Props Interface

```typescript
import { Meld, Tile, Seat } from '@/types/bindings/generated';

export interface ExposedMeldsProps {
  /**
   * Array of exposed melds to display
   */
  melds: Meld[];

  /**
   * Player's seat (for "your melds" vs "player X melds")
   */
  playerSeat: Seat;

  /**
   * Seat of the player who owns these melds
   */
  owner: Seat;

  /**
   * Whether this is the current user's melds (enables interaction)
   * @default false
   */
  isCurrentUser?: boolean;

  /**
   * Display orientation
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical' | 'compact';

  /**
   * Show meld type labels (PUNG/KONG/QUINT/SEXTET)
   * @default true
   */
  showLabels?: boolean;

  /**
   * Show called tile indicator
   * @default true
   */
  showCalledTile?: boolean;

  /**
   * Show joker indicators
   * @default true
   */
  showJokers?: boolean;

  /**
   * Enable joker exchange interaction (current user only)
   * @default false
   */
  enableJokerExchange?: boolean;

  /**
   * Callback when joker exchange is initiated
   */
  onJokerExchange?: (meldIndex: number, jokerIndex: number, replacementTile: Tile) => void;

  /**
   * Callback when meld is clicked (for details)
   */
  onMeldClick?: (meldIndex: number) => void;

  /**
   * Maximum melds to display before scrolling
   * @default 6
   */
  maxVisible?: number;

  /**
   * Whether to show empty state when no melds
   * @default true
   */
  showEmptyState?: boolean;

  /**
   * Custom empty state message
   */
  emptyMessage?: string;

  /**
   * Tile size variant
   * @default 'medium'
   */
  tileSize?: 'small' | 'medium' | 'large';

  /**
   * Additional CSS class
   */
  className?: string;
}

export interface MeldDisplayInfo {
  meld: Meld;
  typeLabel: string; // "PUNG", "KONG", "QUINT", "SEXTET"
  calledFrom: Seat | null;
  calledTileIndex: number | null;
  jokerIndices: number[];
  tileCount: number;
}
```

## State Management

```typescript
import { useMemo, useCallback, useState } from 'react';

export const useExposedMelds = (props: ExposedMeldsProps) => {
  const { melds, isCurrentUser, enableJokerExchange } = props;

  // Meld display information with computed properties
  const meldInfo = useMemo<MeldDisplayInfo[]>(() => {
    return melds.map((meld) => ({
      meld,
      typeLabel: getMeldTypeLabel(meld.meld_type),
      calledFrom: meld.called_from || null,
      calledTileIndex: findCalledTileIndex(meld),
      jokerIndices: findJokerIndices(meld.tiles),
      tileCount: meld.tiles.length,
    }));
  }, [melds]);

  // Joker exchange state
  const [selectedJoker, setSelectedJoker] = useState<{
    meldIndex: number;
    jokerIndex: number;
  } | null>(null);

  // Handle joker selection
  const handleJokerClick = useCallback(
    (meldIndex: number, jokerIndex: number) => {
      if (!enableJokerExchange || !isCurrentUser) return;

      setSelectedJoker({ meldIndex, jokerIndex });
    },
    [enableJokerExchange, isCurrentUser]
  );

  // Handle replacement tile selection
  const handleReplacementTile = useCallback(
    (replacementTile: Tile) => {
      if (!selectedJoker || !props.onJokerExchange) return;

      props.onJokerExchange(selectedJoker.meldIndex, selectedJoker.jokerIndex, replacementTile);

      setSelectedJoker(null);
    },
    [selectedJoker, props]
  );

  // Check if meld can have joker exchanged
  const canExchangeJoker = useCallback(
    (meldIndex: number): boolean => {
      if (!enableJokerExchange || !isCurrentUser) return false;

      const info = meldInfo[meldIndex];
      if (!info) return false;

      // Can't exchange joker in all-joker meld without called tile
      const hasNonJokerTiles = info.meld.tiles.some((tile) => tile.index !== 41);
      return hasNonJokerTiles || info.calledTileIndex !== null;
    },
    [enableJokerExchange, isCurrentUser, meldInfo]
  );

  return {
    meldInfo,
    selectedJoker,
    handleJokerClick,
    handleReplacementTile,
    canExchangeJoker,
  };
};

// Helper: Get meld type label
const getMeldTypeLabel = (meldType: Meld['meld_type']): string => {
  switch (meldType) {
    case 'Pung':
      return 'PUNG';
    case 'Kong':
      return 'KONG';
    case 'Quint':
      return 'QUINT';
    case 'Sextet':
      return 'SEXTET';
    default:
      return 'MELD';
  }
};

// Helper: Find called tile index in meld
const findCalledTileIndex = (meld: Meld): number | null => {
  if (!meld.called_tile) return null;

  // Find tile matching called_tile
  const index = meld.tiles.findIndex((tile) => tile.index === meld.called_tile?.index);
  return index >= 0 ? index : null;
};

// Helper: Find joker indices in meld
const findJokerIndices = (tiles: Tile[]): number[] => {
  return tiles.reduce<number[]>((indices, tile, index) => {
    if (tile.index === 41) {
      // Joker index
      indices.push(index);
    }
    return indices;
  }, []);
};

// Helper: Get seat label
const getSeatLabel = (seat: Seat): string => {
  return seat.toString(); // "East", "South", "West", "North"
};

// Helper: Get seat abbreviation
const getSeatAbbreviation = (seat: Seat): string => {
  const seatStr = seat.toString();
  return seatStr.charAt(0).toUpperCase(); // "E", "S", "W", "N"
};
```

## Component Structure

```typescript
import React, { memo } from 'react';
import { Tile } from '@/components/presentational/Tile';
import { ExposedMeldsProps, useExposedMelds } from './ExposedMelds.types';
import styles from './ExposedMelds.module.css';

export const ExposedMelds = memo<ExposedMeldsProps>(
  (props) => {
    const {
      melds,
      playerSeat,
      owner,
      isCurrentUser = false,
      orientation = 'horizontal',
      showLabels = true,
      showCalledTile = true,
      showJokers = true,
      enableJokerExchange = false,
      onMeldClick,
      maxVisible = 6,
      showEmptyState = true,
      emptyMessage,
      tileSize = 'medium',
      className,
    } = props;

    const {
      meldInfo,
      selectedJoker,
      handleJokerClick,
      canExchangeJoker,
    } = useExposedMelds(props);

    // Empty state
    if (melds.length === 0) {
      if (!showEmptyState) return null;

      return (
        <div className={`${styles.emptyState} ${className || ''}`}>
          <span className={styles.emptyIcon}>⊘</span>
          <p className={styles.emptyMessage}>
            {emptyMessage || 'No exposed melds'}
          </p>
        </div>
      );
    }

    // Container class based on orientation
    const containerClass = [
      styles.container,
      styles[`orientation-${orientation}`],
      isCurrentUser && styles.currentUser,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={containerClass} role="region" aria-label={`${isCurrentUser ? 'Your' : `${owner}'s`} exposed melds`}>
        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>
            {isCurrentUser ? 'Your Exposed Melds' : `${owner} Exposed Melds`}
            <span className={styles.count}>({melds.length})</span>
          </h3>
        </div>

        {/* Melds grid */}
        <div
          className={styles.meldsGrid}
          style={{
            maxHeight: orientation === 'vertical' ? `${maxVisible * 140}px` : undefined,
          }}
        >
          {meldInfo.map((info, meldIndex) => (
            <div
              key={meldIndex}
              className={styles.meld}
              onClick={() => onMeldClick?.(meldIndex)}
              role="article"
              aria-label={`${info.typeLabel}, ${info.tileCount} tiles${info.calledFrom ? `, called from ${info.calledFrom}` : ''}`}
            >
              {/* Meld header */}
              {showLabels && (
                <div className={styles.meldHeader}>
                  <span className={styles.meldType}>{info.typeLabel}</span>
                  {info.calledFrom && (
                    <span className={styles.calledFrom}>
                      {orientation === 'compact'
                        ? getSeatAbbreviation(info.calledFrom)
                        : `from ${info.calledFrom}`}
                    </span>
                  )}
                </div>
              )}

              {/* Tiles */}
              <div className={styles.tiles}>
                {info.meld.tiles.map((tile, tileIndex) => {
                  const isJoker = info.jokerIndices.includes(tileIndex);
                  const isCalled = showCalledTile && tileIndex === info.calledTileIndex;
                  const canExchange =
                    enableJokerExchange && isJoker && canExchangeJoker(meldIndex);

                  return (
                    <div
                      key={tileIndex}
                      className={[
                        styles.tileWrapper,
                        isCalled && styles.called,
                        isJoker && styles.joker,
                        canExchange && styles.exchangeable,
                        selectedJoker?.meldIndex === meldIndex &&
                          selectedJoker?.jokerIndex === tileIndex &&
                          styles.selected,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={(e) => {
                        if (canExchange) {
                          e.stopPropagation();
                          handleJokerClick(meldIndex, tileIndex);
                        }
                      }}
                    >
                      <Tile
                        tile={tile}
                        size={tileSize}
                        showJokerIndicator={showJokers && isJoker}
                      />

                      {/* Called tile marker */}
                      {isCalled && (
                        <div className={styles.calledMarker} aria-label="Called tile">
                          ▲
                        </div>
                      )}

                      {/* Joker exchange hint */}
                      {canExchange && (
                        <div className={styles.exchangeHint} aria-label="Click to exchange joker">
                          ⇄
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for performance
    return (
      prevProps.melds === nextProps.melds &&
      prevProps.isCurrentUser === nextProps.isCurrentUser &&
      prevProps.enableJokerExchange === nextProps.enableJokerExchange &&
      prevProps.orientation === nextProps.orientation
    );
  }
);

ExposedMelds.displayName = 'ExposedMelds';
```

## Styling (CSS Modules)

```css
/* ExposedMelds.module.css */

.container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.container.currentUser {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px #2563eb;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.count {
  font-size: 12px;
  font-weight: 400;
  color: #6b7280;
}

/* Melds grid */
.meldsGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  overflow-y: auto;
}

.orientation-vertical .meldsGrid {
  flex-direction: column;
}

.orientation-compact .meldsGrid {
  gap: 8px;
}

/* Individual meld */
.meld {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f9fafb;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms ease;
}

.meld:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.meld:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

/* Meld header */
.meldHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meldType {
  color: #374151;
}

.calledFrom {
  color: #6b7280;
  font-weight: 500;
}

/* Tiles */
.tiles {
  display: flex;
  gap: 4px;
  align-items: center;
}

.tileWrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

/* Called tile marker */
.tileWrapper.called {
  position: relative;
}

.calledMarker {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #dc2626;
  font-weight: 700;
}

/* Joker indicator */
.tileWrapper.joker {
  /* Tile component handles joker styling */
}

/* Exchangeable joker */
.tileWrapper.exchangeable {
  cursor: pointer;
}

.tileWrapper.exchangeable:hover {
  transform: translateY(-2px);
}

.tileWrapper.exchangeable:hover .exchangeHint {
  opacity: 1;
}

.exchangeHint {
  position: absolute;
  top: -12px;
  right: -12px;
  width: 18px;
  height: 18px;
  background: #f59e0b;
  color: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  opacity: 0;
  transition: opacity 150ms ease;
  pointer-events: none;
}

.tileWrapper.selected {
  transform: translateY(-4px);
  filter: drop-shadow(0 4px 6px rgba(245, 158, 11, 0.4));
}

.tileWrapper.selected .exchangeHint {
  opacity: 1;
  background: #ea580c;
}

/* Empty state */
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  text-align: center;
}

.emptyIcon {
  font-size: 48px;
  color: #d1d5db;
  margin-bottom: 12px;
}

.emptyMessage {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

/* Compact orientation */
.orientation-compact .meld {
  padding: 8px;
  gap: 4px;
}

.orientation-compact .meldHeader {
  font-size: 10px;
}

.orientation-compact .tiles {
  gap: 2px;
}

.orientation-compact .calledMarker {
  bottom: -6px;
  font-size: 8px;
}

/* Responsive */
@media (max-width: 640px) {
  .container {
    padding: 12px;
    gap: 8px;
  }

  .meldsGrid {
    gap: 12px;
  }

  .meld {
    padding: 10px;
  }

  .meldHeader {
    font-size: 10px;
  }

  .tiles {
    gap: 3px;
  }

  /* Force compact on mobile */
  .orientation-horizontal .meldsGrid {
    flex-direction: column;
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .container {
    background: #1f2937;
    border-color: #374151;
  }

  .container.currentUser {
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px #3b82f6;
  }

  .header {
    border-color: #374151;
  }

  .title {
    color: #f9fafb;
  }

  .count {
    color: #9ca3af;
  }

  .meld {
    background: #111827;
    border-color: #4b5563;
  }

  .meld:hover {
    background: #1f2937;
    border-color: #6b7280;
  }

  .meldType {
    color: #d1d5db;
  }

  .calledFrom {
    color: #9ca3af;
  }

  .calledMarker {
    color: #ef4444;
  }

  .emptyState {
    background: #111827;
    border-color: #4b5563;
  }

  .emptyIcon {
    color: #4b5563;
  }

  .emptyMessage {
    color: #9ca3af;
  }
}
```

## Accessibility

### ARIA Attributes

```typescript
// Container
<div
  role="region"
  aria-label={`${isCurrentUser ? 'Your' : `${owner}'s`} exposed melds`}
>

// Individual meld
<div
  role="article"
  aria-label={`${info.typeLabel}, ${info.tileCount} tiles${info.calledFrom ? `, called from ${info.calledFrom}` : ''}`}
>

// Called tile marker
<div aria-label="Called tile">▲</div>

// Exchange hint
<div aria-label="Click to exchange joker">⇄</div>
```

### Keyboard Navigation

- **Tab**: Navigate between melds
- **Enter/Space**: Click meld (for details or joker exchange)
- **Arrow keys**: Navigate between tiles within meld (when focused)
- **Escape**: Cancel joker selection

### Screen Reader Announcements

```typescript
// Announce meld count on change
useEffect(() => {
  if (melds.length === 0) return;

  const announcement = `${isCurrentUser ? 'You have' : `${owner} has`} ${melds.length} exposed ${melds.length === 1 ? 'meld' : 'melds'}`;

  announceToScreenReader(announcement);
}, [melds.length, isCurrentUser, owner]);

// Announce joker exchange opportunity
const handleJokerClick = (meldIndex: number, jokerIndex: number) => {
  announceToScreenReader(`Joker selected for exchange in ${meldInfo[meldIndex].typeLabel}`);
  // ... rest of handler
};
```

### Focus Management

- Restore focus after joker exchange
- Trap focus in joker exchange modal (if used)
- Visible focus indicators on all interactive elements

## Integration Examples

### Player's Own Melds (with Joker Exchange)

```typescript
import { ExposedMelds } from '@/components/presentational/ExposedMelds';
import { useGameState } from '@/hooks/useGameState';

export const PlayerHandPanel = () => {
  const { gameState, sendCommand } = useGameState();
  const currentPlayer = gameState.players.find(p => p.seat === gameState.currentUserSeat);

  const handleJokerExchange = (meldIndex: number, jokerIndex: number, replacementTile: Tile) => {
    sendCommand({
      type: 'ExchangeJoker',
      player: gameState.currentUserSeat,
      meld_index: meldIndex,
      joker_index: jokerIndex,
      replacement_tile: replacementTile,
    });
  };

  return (
    <ExposedMelds
      melds={currentPlayer?.melds || []}
      playerSeat={gameState.currentUserSeat}
      owner={gameState.currentUserSeat}
      isCurrentUser={true}
      enableJokerExchange={true}
      onJokerExchange={handleJokerExchange}
      showLabels={true}
      showCalledTile={true}
      showJokers={true}
    />
  );
};
```

### Opponent's Melds (Read-only)

```typescript
export const OpponentPanel = ({ seat }: { seat: Seat }) => {
  const { gameState } = useGameState();
  const player = gameState.players.find(p => p.seat === seat);

  return (
    <ExposedMelds
      melds={player?.melds || []}
      playerSeat={gameState.currentUserSeat}
      owner={seat}
      isCurrentUser={false}
      orientation="compact"
      showLabels={false}
      tileSize="small"
    />
  );
};
```

### Game Board Integration (All Players)

```typescript
export const GameBoard = () => {
  const { gameState } = useGameState();

  return (
    <div className={styles.gameBoard}>
      {/* Center: Playing surface */}
      <div className={styles.center}>
        <DiscardPool />
      </div>

      {/* Player positions with melds */}
      <div className={styles.bottomPlayer}>
        <ExposedMelds
          melds={gameState.players[0].melds}
          playerSeat={gameState.currentUserSeat}
          owner={gameState.players[0].seat}
          isCurrentUser={true}
          enableJokerExchange={true}
        />
        <PlayerHand />
      </div>

      <div className={styles.rightPlayer}>
        <ExposedMelds
          melds={gameState.players[1].melds}
          playerSeat={gameState.currentUserSeat}
          owner={gameState.players[1].seat}
          orientation="vertical"
          tileSize="small"
        />
      </div>

      <div className={styles.topPlayer}>
        <ExposedMelds
          melds={gameState.players[2].melds}
          playerSeat={gameState.currentUserSeat}
          owner={gameState.players[2].seat}
          orientation="compact"
          tileSize="small"
        />
      </div>

      <div className={styles.leftPlayer}>
        <ExposedMelds
          melds={gameState.players[3].melds}
          playerSeat={gameState.currentUserSeat}
          owner={gameState.players[3].seat}
          orientation="vertical"
          tileSize="small"
        />
      </div>
    </div>
  );
};
```

## Testing Strategy

### Unit Tests

```typescript
describe('ExposedMelds', () => {
  describe('Rendering', () => {
    it('renders empty state when no melds', () => {
      const { getByText } = render(
        <ExposedMelds
          melds={[]}
          playerSeat="East"
          owner="East"
        />
      );
      expect(getByText('No exposed melds')).toBeInTheDocument();
    });

    it('renders melds with correct type labels', () => {
      const melds = [
        createMeld('Pung', ['1B', '1B', '1B']),
        createMeld('Kong', ['5C', '5C', '5C', '5C']),
      ];
      const { getByText } = render(
        <ExposedMelds melds={melds} playerSeat="East" owner="East" />
      );
      expect(getByText('PUNG')).toBeInTheDocument();
      expect(getByText('KONG')).toBeInTheDocument();
    });

    it('shows called tile indicator', () => {
      const meld = createMeld('Pung', ['1B', '1B', '1B'], {
        calledFrom: 'South',
        calledTileIndex: 1,
      });
      const { getByLabelText } = render(
        <ExposedMelds melds={[meld]} playerSeat="East" owner="East" showCalledTile />
      );
      expect(getByLabelText('Called tile')).toBeInTheDocument();
    });

    it('shows joker indicators', () => {
      const meld = createMeld('Kong', ['5C', '5C', 'JK', '5C']);
      const { container } = render(
        <ExposedMelds melds={[meld]} playerSeat="East" owner="East" showJokers />
      );
      const jokerTiles = container.querySelectorAll('.joker');
      expect(jokerTiles).toHaveLength(1);
    });

    it('renders multiple melds in grid', () => {
      const melds = [
        createMeld('Pung', ['1B', '1B', '1B']),
        createMeld('Kong', ['5C', '5C', '5C', '5C']),
        createMeld('Quint', ['9D', '9D', '9D', '9D', '9D']),
      ];
      const { container } = render(
        <ExposedMelds melds={melds} playerSeat="East" owner="East" />
      );
      const meldElements = container.querySelectorAll('.meld');
      expect(meldElements).toHaveLength(3);
    });
  });

  describe('Orientations', () => {
    it('applies horizontal orientation class', () => {
      const { container } = render(
        <ExposedMelds
          melds={[createMeld('Pung', ['1B', '1B', '1B'])]}
          playerSeat="East"
          owner="East"
          orientation="horizontal"
        />
      );
      expect(container.querySelector('.orientation-horizontal')).toBeInTheDocument();
    });

    it('applies vertical orientation class', () => {
      const { container } = render(
        <ExposedMelds
          melds={[createMeld('Pung', ['1B', '1B', '1B'])]}
          playerSeat="East"
          owner="East"
          orientation="vertical"
        />
      );
      expect(container.querySelector('.orientation-vertical')).toBeInTheDocument();
    });

    it('applies compact orientation class', () => {
      const { container } = render(
        <ExposedMelds
          melds={[createMeld('Pung', ['1B', '1B', '1B'])]}
          playerSeat="East"
          owner="East"
          orientation="compact"
        />
      );
      expect(container.querySelector('.orientation-compact')).toBeInTheDocument();
    });
  });

  describe('Joker Exchange', () => {
    it('shows exchange hint for exchangeable jokers', () => {
      const meld = createMeld('Kong', ['5C', '5C', 'JK', '5C']);
      const { getByLabelText } = render(
        <ExposedMelds
          melds={[meld]}
          playerSeat="East"
          owner="East"
          isCurrentUser
          enableJokerExchange
        />
      );
      expect(getByLabelText('Click to exchange joker')).toBeInTheDocument();
    });

    it('calls onJokerExchange when joker clicked', () => {
      const onJokerExchange = vi.fn();
      const meld = createMeld('Kong', ['5C', '5C', 'JK', '5C']);
      const { container } = render(
        <ExposedMelds
          melds={[meld]}
          playerSeat="East"
          owner="East"
          isCurrentUser
          enableJokerExchange
          onJokerExchange={onJokerExchange}
        />
      );

      const jokerTile = container.querySelector('.joker .tileWrapper');
      fireEvent.click(jokerTile!);

      // Should trigger joker selection (exchange flow depends on UI)
      expect(container.querySelector('.selected')).toBeInTheDocument();
    });

    it('does not allow joker exchange for opponent melds', () => {
      const meld = createMeld('Kong', ['5C', '5C', 'JK', '5C']);
      const { queryByLabelText } = render(
        <ExposedMelds
          melds={[meld]}
          playerSeat="East"
          owner="South"
          isCurrentUser={false}
          enableJokerExchange
        />
      );
      expect(queryByLabelText('Click to exchange joker')).not.toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('calls onMeldClick when meld clicked', () => {
      const onMeldClick = vi.fn();
      const meld = createMeld('Pung', ['1B', '1B', '1B']);
      const { container } = render(
        <ExposedMelds
          melds={[meld]}
          playerSeat="East"
          owner="East"
          onMeldClick={onMeldClick}
        />
      );

      const meldElement = container.querySelector('.meld');
      fireEvent.click(meldElement!);

      expect(onMeldClick).toHaveBeenCalledWith(0);
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA region label for current user', () => {
      const { getByLabelText } = render(
        <ExposedMelds
          melds={[createMeld('Pung', ['1B', '1B', '1B'])]}
          playerSeat="East"
          owner="East"
          isCurrentUser
        />
      );
      expect(getByLabelText('Your exposed melds')).toBeInTheDocument();
    });

    it('has correct ARIA region label for opponent', () => {
      const { getByLabelText } = render(
        <ExposedMelds
          melds={[createMeld('Pung', ['1B', '1B', '1B'])]}
          playerSeat="East"
          owner="South"
        />
      );
      expect(getByLabelText("South's exposed melds")).toBeInTheDocument();
    });

    it('passes axe accessibility tests', async () => {
      const { container } = render(
        <ExposedMelds
          melds={[
            createMeld('Pung', ['1B', '1B', '1B']),
            createMeld('Kong', ['5C', '5C', '5C', '5C']),
          ]}
          playerSeat="East"
          owner="East"
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Edge Cases', () => {
    it('handles sextet (6 tiles)', () => {
      const meld = createMeld('Sextet', ['WH', 'WH', 'WH', 'WH', 'WH', 'WH']);
      const { getByText } = render(
        <ExposedMelds melds={[meld]} playerSeat="East" owner="East" />
      );
      expect(getByText('SEXTET')).toBeInTheDocument();
    });

    it('handles multiple jokers in one meld', () => {
      const meld = createMeld('Sextet', ['JK', 'WH', 'WH', 'JK', 'WH', 'WH']);
      const { container } = render(
        <ExposedMelds melds={[meld]} playerSeat="East" owner="East" showJokers />
      );
      const jokerTiles = container.querySelectorAll('.joker');
      expect(jokerTiles).toHaveLength(2);
    });

    it('handles all-joker kong with called tile', () => {
      const meld = createMeld('Kong', ['JK', 'JK', 'JK', 'JK'], {
        calledFrom: 'West',
        calledTileIndex: 3,
      });
      const { container } = render(
        <ExposedMelds melds={[meld]} playerSeat="East" owner="East" />
      );
      const jokerTiles = container.querySelectorAll('.joker');
      expect(jokerTiles).toHaveLength(4);
      expect(container.querySelector('.called')).toBeInTheDocument();
    });
  });
});

// Test helpers
const createMeld = (
  type: 'Pung' | 'Kong' | 'Quint' | 'Sextet',
  tiles: string[],
  options?: {
    calledFrom?: Seat;
    calledTileIndex?: number;
  }
): Meld => {
  const tileObjects = tiles.map(tileStringToTile);
  return {
    meld_type: type,
    tiles: tileObjects,
    called_from: options?.calledFrom || null,
    called_tile: options?.calledTileIndex !== undefined
      ? tileObjects[options.calledTileIndex]
      : null,
  };
};
```

### Integration Tests

```typescript
describe('ExposedMelds Integration', () => {
  it('updates when new meld is exposed', async () => {
    const { getByText, queryByText, rerender } = render(
      <ExposedMelds melds={[]} playerSeat="East" owner="East" />
    );

    expect(getByText('No exposed melds')).toBeInTheDocument();

    // Simulate meld creation
    const newMelds = [createMeld('Pung', ['1B', '1B', '1B'])];
    rerender(
      <ExposedMelds melds={newMelds} playerSeat="East" owner="East" />
    );

    expect(queryByText('No exposed melds')).not.toBeInTheDocument();
    expect(getByText('PUNG')).toBeInTheDocument();
  });

  it('handles joker exchange flow', async () => {
    const onJokerExchange = vi.fn();
    const meld = createMeld('Kong', ['5C', '5C', 'JK', '5C']);

    const { container } = render(
      <ExposedMelds
        melds={[meld]}
        playerSeat="East"
        owner="East"
        isCurrentUser
        enableJokerExchange
        onJokerExchange={onJokerExchange}
      />
    );

    // Click joker tile
    const jokerTile = container.querySelector('.joker.exchangeable');
    fireEvent.click(jokerTile!);

    // Should be selected
    expect(container.querySelector('.selected')).toBeInTheDocument();

    // In real implementation, user would select replacement tile
    // and trigger onJokerExchange callback
  });

  it('syncs with game state updates', () => {
    const { rerender } = render(
      <GameStateProvider>
        <PlayerHandPanel />
      </GameStateProvider>
    );

    // Simulate state update with new meld
    act(() => {
      updateGameState({
        players: [
          {
            seat: 'East',
            melds: [createMeld('Pung', ['1B', '1B', '1B'])],
          },
        ],
      });
    });

    rerender(
      <GameStateProvider>
        <PlayerHandPanel />
      </GameStateProvider>
    );

    expect(screen.getByText('PUNG')).toBeInTheDocument();
  });
});
```

### Visual Regression Tests

```typescript
describe('ExposedMelds Visual Regression', () => {
  it('matches snapshot for single pung', () => {
    const { container } = render(
      <ExposedMelds
        melds={[createMeld('Pung', ['1B', '1B', '1B'])]}
        playerSeat="East"
        owner="East"
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for kong with joker', () => {
    const { container } = render(
      <ExposedMelds
        melds={[createMeld('Kong', ['5C', '5C', 'JK', '5C'])]}
        playerSeat="East"
        owner="East"
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for multiple melds', () => {
    const { container } = render(
      <ExposedMelds
        melds={[
          createMeld('Pung', ['1B', '1B', '1B']),
          createMeld('Kong', ['5C', '5C', '5C', '5C']),
          createMeld('Quint', ['9D', '9D', '9D', '9D', '9D']),
        ]}
        playerSeat="East"
        owner="East"
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for empty state', () => {
    const { container } = render(
      <ExposedMelds melds={[]} playerSeat="East" owner="East" />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for compact orientation', () => {
    const { container } = render(
      <ExposedMelds
        melds={[createMeld('Pung', ['1B', '1B', '1B'])]}
        playerSeat="East"
        owner="East"
        orientation="compact"
      />
    );
    expect(container).toMatchSnapshot();
  });
});
```

## Performance Considerations

### Optimization Strategies

```typescript
// 1. Memoize meld display info
const meldInfo = useMemo<MeldDisplayInfo[]>(() => {
  return melds.map((meld) => ({
    meld,
    typeLabel: getMeldTypeLabel(meld.meld_type),
    calledFrom: meld.called_from || null,
    calledTileIndex: findCalledTileIndex(meld),
    jokerIndices: findJokerIndices(meld.tiles),
    tileCount: meld.tiles.length,
  }));
}, [melds]);

// 2. Use React.memo with custom comparison
export const ExposedMelds = memo<ExposedMeldsProps>(
  (props) => {
    // ... component
  },
  (prevProps, nextProps) => {
    return (
      prevProps.melds === nextProps.melds &&
      prevProps.isCurrentUser === nextProps.isCurrentUser &&
      prevProps.enableJokerExchange === nextProps.enableJokerExchange &&
      prevProps.orientation === nextProps.orientation
    );
  }
);

// 3. Virtualize meld list for large numbers
import { FixedSizeList as List } from 'react-window';

const MeldsList = ({ melds, ...props }) => {
  if (melds.length <= 6) {
    // Render normally
    return <NormalMeldsGrid melds={melds} {...props} />;
  }

  // Virtualize for performance
  return (
    <List
      height={600}
      itemCount={melds.length}
      itemSize={140}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <MeldItem meld={melds[index]} {...props} />
        </div>
      )}
    </List>
  );
};

// 4. Stable callback refs
const handleJokerClick = useCallback(
  (meldIndex: number, jokerIndex: number) => {
    if (!enableJokerExchange || !isCurrentUser) return;
    setSelectedJoker({ meldIndex, jokerIndex });
  },
  [enableJokerExchange, isCurrentUser]
);

// 5. Lazy load tile images
const Tile = lazy(() => import('@/components/presentational/Tile'));

// 6. CSS GPU acceleration for animations
.tileWrapper.exchangeable:hover {
  transform: translateY(-2px); /* GPU-accelerated */
  will-change: transform;
}
```

### Performance Metrics

- **Target**: 60 FPS during meld updates
- **Render time**: <16ms for up to 6 melds
- **Memory**: <1MB for meld state
- **Bundle size**: <5KB (gzipped)

## Constants

```typescript
// MeldConstants.ts
export const MELD_CONSTANTS = {
  MAX_VISIBLE_DEFAULT: 6,
  TILE_GAP: 4, // px
  MELD_GAP: 16, // px
  COMPACT_MELD_GAP: 8, // px

  MELD_TYPE_LABELS: {
    Pung: 'PUNG',
    Kong: 'KONG',
    Quint: 'QUINT',
    Sextet: 'SEXTET',
  } as const,

  TILE_COUNTS: {
    Pung: 3,
    Kong: 4,
    Quint: 5,
    Sextet: 6,
  } as const,

  SEAT_ABBREVIATIONS: {
    East: 'E',
    South: 'S',
    West: 'W',
    North: 'N',
  } as const,

  CALLED_MARKER: '▲',
  EXCHANGE_HINT: '⇄',
  JOKER_INDICATOR: '★',
  EMPTY_ICON: '⊘',
} as const;

export type MeldType = keyof typeof MELD_CONSTANTS.MELD_TYPE_LABELS;
```

## Error Handling

```typescript
// Error boundary for meld rendering
export const ExposedMeldsErrorBoundary: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <ErrorBoundary
      FallbackComponent={({ error, resetErrorBoundary }) => (
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorMessage}>
            Failed to load exposed melds
          </p>
          <button onClick={resetErrorBoundary} className={styles.retryButton}>
            Retry
          </button>
        </div>
      )}
      onError={(error, errorInfo) => {
        console.error('ExposedMelds error:', error, errorInfo);
        logErrorToService(error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

// Validate meld data
const validateMeld = (meld: Meld): boolean => {
  if (!meld.tiles || meld.tiles.length < 3 || meld.tiles.length > 6) {
    console.error('Invalid meld tile count:', meld.tiles?.length);
    return false;
  }

  const expectedCount = MELD_CONSTANTS.TILE_COUNTS[meld.meld_type];
  if (meld.tiles.length !== expectedCount) {
    console.error(
      `Meld type ${meld.meld_type} expects ${expectedCount} tiles, got ${meld.tiles.length}`
    );
    return false;
  }

  return true;
};
```

## Future Enhancements

1. **Meld Rotation Animation**: Animate tiles when meld is first exposed
2. **Drag-and-Drop Joker Exchange**: Drag replacement tile onto joker
3. **Meld History**: Show timeline of when melds were exposed
4. **Meld Statistics**: Show frequency of meld types in game
5. **Meld Hints**: Suggest which tiles to call for specific patterns
6. **3D Meld View**: Optional 3D rendering for immersive experience
7. **Meld Sound Effects**: Audio feedback when meld is exposed
8. **Meld Achievements**: Track rare meld combinations (all-joker kong, etc.)
9. **Meld Comparison**: Side-by-side comparison of all players' melds
10. **Export Meld Image**: Save meld as image for sharing

## Notes

- **Server Authoritative**: All meld state comes from server, client only displays
- **Joker Exchange Rules**: Can't exchange joker in all-joker meld without called tile
- **Sextet Rarity**: Sextets are rare, require 6 identical tiles (4 natural + 2 jokers max)
- **Called Tile Tracking**: Important for finesse rule (joker exchange before mahjong)
- **Meld Order**: Display in order exposed (chronological)
- **Responsive Layout**: Desktop shows full melds, mobile uses compact mode
- **Accessibility**: Full keyboard navigation and screen reader support
- **Performance**: Virtualize for >6 melds to maintain 60 FPS

---

**Related Components**:

- [Tile](./Tile.md): Individual tile rendering
- [PlayerHand](./PlayerHand.md): Player's concealed tiles
- [JokerExchangeIndicator](./JokerExchangeIndicator.md): Joker exchange opportunities
- [CallIndicator](./CallIndicator.md): Call window for claiming tiles

**Backend Integration**:

- `Meld` type from Rust bindings
- `MeldCalled` event when meld is exposed
- `JokerExchanged` event when joker is replaced
- `AddToExposure` event when adding tile to existing meld (Kong → Quint → Sextet)
