# JokerExchangeIndicator Component

## Overview

**Purpose**: Visual feedback for joker exchange opportunities in exposed melds, highlighting exchangeable jokers with matching tile requirements.

**Category**: Presentational Component (Core Game Elements)

**Complexity**: Medium

The JokerExchangeIndicator component provides visual cues when a player can exchange a joker in an exposed meld. It highlights:

- **Exchangeable jokers**: Jokers that can be replaced with matching tiles
- **Required tile**: The natural tile needed to exchange the joker
- **Exchange action**: Visual prompt to initiate exchange
- **Meld context**: Which meld contains the exchangeable joker

This component is critical for the **finesse rule** in American Mahjong, where players can exchange jokers from opponents' (or their own) exposed melds by providing the matching natural tile. This is a strategic mechanic that can turn the game.

## User Stories

**Primary Stories**:

- **US-021**: As a player, I want to exchange jokers in exposed melds so I can complete my hand
- **US-022**: As a player, I want to see which jokers are exchangeable so I know my options
- **US-023**: As a player, I want to understand joker exchange rules (finesse rule)

**Related Stories**:

- **US-012**: As a player, I want to see my exposed melds
- **US-015**: As a player, I want to see other players' exposed melds
- **US-024**: As a player, I want visual hints for strategic opportunities

## Visual Design

### Joker Exchange Highlight (Single Joker)

```
┌─────────────────────────────────────────────┐
│ JOKER EXCHANGE AVAILABLE                    │
├─────────────────────────────────────────────┤
│                                              │
│  You can exchange this joker:                │
│                                              │
│  ┌────────────────────────────────┐         │
│  │ KONG - Called from South       │         │  ← Meld with exchangeable joker
│  ├────────────────────────────────┤         │
│  │  ┌──┐  ┌──┐  ┌──┐  ┌──┐       │         │
│  │  │5C│  │5C│  │JK│  │5C│       │         │
│  │  └──┘  └──┘  └★─┘  └──┘       │         │
│  │              ▲                 │         │
│  │         Exchangeable           │         │
│  └────────────────────────────────┘         │
│                                              │
│  Required tile to exchange:                  │
│                                              │
│  ┌──┐                                        │
│  │5C│  ← Click or drag to exchange          │
│  └──┘                                        │
│                                              │
│  ┌────────────────┐  ┌────────────────┐    │
│  │  EXCHANGE (E)  │  │   CANCEL (Esc) │    │
│  └────────────────┘  └────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
Size: 400px × 320px
```

### Multiple Exchangeable Jokers

```
┌─────────────────────────────────────────────┐
│ JOKER EXCHANGE - Select Joker               │
├─────────────────────────────────────────────┤
│                                              │
│  Multiple jokers can be exchanged:           │
│                                              │
│  ┌────────────────────────────────┐         │
│  │ SEXTET - Called from North     │         │
│  ├────────────────────────────────┤         │
│  │  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐ │         │
│  │  │JK│  │WH│  │WH│  │JK│  │WH│ │         │
│  │  └★─┘  └──┘  └──┘  └★─┘  └──┘ │         │
│  │   ▲                 ▲          │         │
│  │   1                 2          │         │  ← Numbered indicators
│  └────────────────────────────────┘         │
│                                              │
│  You have:  ┌──┐                            │
│            │WH│  to exchange                │
│            └──┘                              │
│                                              │
│  Click joker #1 or #2 to exchange           │
│                                              │
└─────────────────────────────────────────────┘
```

### Inline Meld Indicator (Compact)

```
┌─────────────────────────────────┐
│ KONG - South                    │
├─────────────────────────────────┤
│  ┌──┐  ┌──┐  ┌──┐  ┌──┐        │
│  │5C│  │5C│  │JK│  │5C│        │
│  └──┘  └──┘  └★─┘  └──┘        │
│              ▲                   │
│          ┌──────┐               │  ← Inline exchange button
│          │ ⇄ 5C │               │
│          └──────┘               │
└─────────────────────────────────┘
Appears directly in ExposedMelds component
```

### Tooltip Indicator

```
   ┌──┐
   │JK│  ← Mouse hover
   └★─┘
     ▲
     │
   ┌─────────────────────┐
   │ Click to exchange   │  ← Tooltip
   │ Requires: 5C        │
   └─────────────────────┘
```

### Animation: Exchange Success

```
   ┌──┐              ┌──┐
   │JK│  ──────→     │5C│  ← Smooth morph animation
   └★─┘              └──┘

   With:
   - 300ms fade out joker
   - Simultaneous 300ms fade in natural tile
   - Green success flash
   - Optional confetti effect
```

## Props Interface

```typescript
import { Meld, Tile, Seat } from '@/types/bindings/generated';

export interface JokerExchangeIndicatorProps {
  /**
   * Meld containing exchangeable joker(s)
   */
  meld: Meld;

  /**
   * Index of joker in meld.tiles array
   */
  jokerIndex: number;

  /**
   * The natural tile required to exchange this joker
   */
  requiredTile: Tile;

  /**
   * Whether player has the required tile in hand
   * @default false
   */
  hasRequiredTile?: boolean;

  /**
   * Owner of the meld
   */
  meldOwner: Seat;

  /**
   * Current player's seat
   */
  currentPlayer: Seat;

  /**
   * Display mode
   * @default 'dialog'
   */
  mode?: 'dialog' | 'inline' | 'tooltip' | 'highlight';

  /**
   * Whether exchange is currently in progress
   * @default false
   */
  isExchanging?: boolean;

  /**
   * Callback when exchange is confirmed
   */
  onExchange?: (jokerIndex: number) => void;

  /**
   * Callback when exchange is cancelled
   */
  onCancel?: () => void;

  /**
   * Show keyboard shortcuts
   * @default true
   */
  showShortcuts?: boolean;

  /**
   * Enable drag-and-drop exchange
   * @default false
   */
  enableDragDrop?: boolean;

  /**
   * Animation duration (ms)
   * @default 300
   */
  animationDuration?: number;

  /**
   * Show success animation after exchange
   * @default true
   */
  showSuccessAnimation?: boolean;

  /**
   * Additional CSS class
   */
  className?: string;
}

export interface ExchangeState {
  /**
   * Whether exchange is available
   */
  available: boolean;

  /**
   * Reason why exchange is unavailable (if applicable)
   */
  unavailableReason?: string;

  /**
   * Number of exchangeable jokers in this meld
   */
  exchangeableCount: number;
}
```

## State Management

```typescript
import { useMemo, useCallback, useState } from 'react';

export const useJokerExchangeIndicator = (props: JokerExchangeIndicatorProps) => {
  const { meld, jokerIndex, requiredTile, hasRequiredTile, meldOwner, currentPlayer } = props;

  // Check if exchange is available
  const exchangeState = useMemo<ExchangeState>(() => {
    // Can't exchange if player doesn't have required tile
    if (!hasRequiredTile) {
      return {
        available: false,
        unavailableReason: "You don't have the required tile",
        exchangeableCount: 0,
      };
    }

    // Can't exchange joker in all-joker meld without called tile
    const hasNonJokerTiles = meld.tiles.some((tile) => tile.index !== 41);
    const hasCalledTile = meld.called_tile !== null;

    if (!hasNonJokerTiles && !hasCalledTile) {
      return {
        available: false,
        unavailableReason: 'Cannot exchange joker in all-joker meld',
        exchangeableCount: 0,
      };
    }

    // Count exchangeable jokers
    const exchangeableCount = meld.tiles.filter((tile) => tile.index === 41).length;

    return {
      available: true,
      exchangeableCount,
    };
  }, [meld, hasRequiredTile]);

  // Exchange state
  const [isConfirming, setIsConfirming] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Handle exchange confirmation
  const handleExchange = useCallback(() => {
    if (!exchangeState.available) return;

    setIsConfirming(true);

    // Call exchange callback
    if (props.onExchange) {
      props.onExchange(jokerIndex);
    }

    // Show success animation
    if (props.showSuccessAnimation) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, props.animationDuration || 300);
    }
  }, [exchangeState, jokerIndex, props]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setIsConfirming(false);
    if (props.onCancel) {
      props.onCancel();
    }
  }, [props]);

  return {
    exchangeState,
    isConfirming,
    showSuccess,
    handleExchange,
    handleCancel,
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

// Helper: Get seat label
const getSeatLabel = (seat: Seat): string => {
  return seat.toString(); // "East", "South", "West", "North"
};
```

## Component Structure

```typescript
import React, { memo } from 'react';
import { Tile } from '@/components/presentational/Tile';
import { JokerExchangeIndicatorProps, useJokerExchangeIndicator } from './JokerExchangeIndicator.types';
import styles from './JokerExchangeIndicator.module.css';

export const JokerExchangeIndicator = memo<JokerExchangeIndicatorProps>(
  (props) => {
    const {
      meld,
      jokerIndex,
      requiredTile,
      hasRequiredTile = false,
      meldOwner,
      mode = 'dialog',
      showShortcuts = true,
      className,
    } = props;

    const { exchangeState, isConfirming, showSuccess, handleExchange, handleCancel } =
      useJokerExchangeIndicator(props);

    // Don't render if exchange not available
    if (!exchangeState.available && mode !== 'tooltip') {
      return null;
    }

    // Tooltip mode
    if (mode === 'tooltip') {
      return (
        <div className={`${styles.tooltip} ${className || ''}`} role="tooltip">
          <p className={styles.tooltipText}>
            {exchangeState.available ? 'Click to exchange' : exchangeState.unavailableReason}
          </p>
          {exchangeState.available && (
            <p className={styles.tooltipRequires}>
              Requires: <Tile tile={requiredTile} size="small" />
            </p>
          )}
        </div>
      );
    }

    // Highlight mode (minimal visual indicator)
    if (mode === 'highlight') {
      return (
        <div className={`${styles.highlight} ${className || ''}`}>
          <div className={styles.highlightGlow} aria-label="Joker can be exchanged" />
        </div>
      );
    }

    // Inline mode (compact, appears in meld)
    if (mode === 'inline') {
      return (
        <div className={`${styles.inline} ${className || ''}`}>
          <button
            className={styles.inlineButton}
            onClick={handleExchange}
            disabled={!exchangeState.available || isConfirming}
            aria-label={`Exchange joker for ${requiredTile.toString()}`}
          >
            <span className={styles.inlineIcon}>⇄</span>
            <Tile tile={requiredTile} size="small" />
          </button>
        </div>
      );
    }

    // Dialog mode (full interface)
    const containerClass = [
      styles.dialog,
      isConfirming && styles.confirming,
      showSuccess && styles.success,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        className={containerClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="joker-exchange-title"
        aria-describedby="joker-exchange-description"
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 id="joker-exchange-title" className={styles.title}>
            {exchangeState.exchangeableCount > 1
              ? 'JOKER EXCHANGE - Select Joker'
              : 'JOKER EXCHANGE AVAILABLE'}
          </h2>
        </div>

        {/* Meld display */}
        <div className={styles.meldDisplay}>
          <p className={styles.meldLabel}>
            {exchangeState.exchangeableCount > 1
              ? 'Multiple jokers can be exchanged:'
              : 'You can exchange this joker:'}
          </p>

          <div className={styles.meld}>
            <div className={styles.meldHeader}>
              <span className={styles.meldType}>{getMeldTypeLabel(meld.meld_type)}</span>
              {meld.called_from && (
                <span className={styles.calledFrom}>
                  from {getSeatLabel(meld.called_from)}
                </span>
              )}
            </div>

            <div className={styles.tiles}>
              {meld.tiles.map((tile, index) => {
                const isExchangeable = tile.index === 41 && index === jokerIndex;
                const isOtherJoker =
                  tile.index === 41 && index !== jokerIndex && exchangeState.exchangeableCount > 1;

                return (
                  <div
                    key={index}
                    className={[
                      styles.tileWrapper,
                      isExchangeable && styles.exchangeable,
                      isOtherJoker && styles.otherJoker,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <Tile tile={tile} size="medium" showJokerIndicator={tile.index === 41} />

                    {isExchangeable && (
                      <div className={styles.exchangeMarker} aria-label="Exchangeable">
                        ▲
                      </div>
                    )}

                    {isOtherJoker && (
                      <div className={styles.jokerNumber} aria-label={`Joker ${index + 1}`}>
                        {index + 1}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Required tile */}
        {exchangeState.available && (
          <div className={styles.requiredTile} id="joker-exchange-description">
            <p className={styles.requiredLabel}>
              {hasRequiredTile
                ? 'Required tile to exchange:'
                : "You don't have the required tile:"}
            </p>
            <div className={styles.tileWrapper}>
              <Tile tile={requiredTile} size="large" />
              {!hasRequiredTile && <div className={styles.missingOverlay}>✕</div>}
            </div>
            {hasRequiredTile && (
              <p className={styles.requiredHint}>Click or drag to exchange</p>
            )}
          </div>
        )}

        {/* Unavailable message */}
        {!exchangeState.available && (
          <div className={styles.unavailable}>
            <p className={styles.unavailableMessage}>{exchangeState.unavailableReason}</p>
          </div>
        )}

        {/* Actions */}
        {exchangeState.available && (
          <div className={styles.actions}>
            <button
              className={styles.exchangeButton}
              onClick={handleExchange}
              disabled={isConfirming}
              aria-label="Confirm joker exchange"
            >
              EXCHANGE{showShortcuts && ' (E)'}
            </button>
            <button
              className={styles.cancelButton}
              onClick={handleCancel}
              disabled={isConfirming}
              aria-label="Cancel joker exchange"
            >
              CANCEL{showShortcuts && ' (Esc)'}
            </button>
          </div>
        )}

        {/* Success animation */}
        {showSuccess && (
          <div className={styles.successOverlay} aria-live="polite">
            <div className={styles.successIcon}>✓</div>
            <p className={styles.successMessage}>Joker exchanged!</p>
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for performance
    return (
      prevProps.meld === nextProps.meld &&
      prevProps.jokerIndex === nextProps.jokerIndex &&
      prevProps.hasRequiredTile === nextProps.hasRequiredTile &&
      prevProps.isExchanging === nextProps.isExchanging
    );
  }
);

JokerExchangeIndicator.displayName = 'JokerExchangeIndicator';
```

## Styling (CSS Modules)

```css
/* JokerExchangeIndicator.module.css */

/* Dialog mode */
.dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: #ffffff;
  border: 2px solid #f59e0b;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  position: relative;
  animation: slideIn 200ms ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dialog.confirming {
  pointer-events: none;
  opacity: 0.6;
}

.dialog.success {
  border-color: #10b981;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid #fed7aa;
}

.title {
  font-size: 14px;
  font-weight: 700;
  color: #d97706;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Meld display */
.meldDisplay {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meldLabel {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.meld {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 6px;
}

.meldHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.meldType {
  color: #92400e;
}

.calledFrom {
  color: #a16207;
  font-weight: 500;
}

.tiles {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.tileWrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tileWrapper.exchangeable {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.6));
  }
  50% {
    transform: scale(1.05);
    filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.9));
  }
}

.exchangeMarker {
  position: absolute;
  bottom: -10px;
  font-size: 12px;
  color: #f59e0b;
  font-weight: 700;
}

.tileWrapper.otherJoker {
  opacity: 0.7;
}

.jokerNumber {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  background: #f59e0b;
  color: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

/* Required tile */
.requiredTile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
}

.requiredLabel {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.requiredTile .tileWrapper {
  position: relative;
}

.missingOverlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(239, 68, 68, 0.8);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  border-radius: 4px;
}

.requiredHint {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
}

/* Unavailable */
.unavailable {
  padding: 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  text-align: center;
}

.unavailableMessage {
  font-size: 13px;
  font-weight: 600;
  color: #dc2626;
  margin: 0;
}

/* Actions */
.actions {
  display: flex;
  gap: 12px;
}

.exchangeButton,
.cancelButton {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 150ms ease;
  font-family: inherit;
}

.exchangeButton {
  background: #f59e0b;
  border-color: #f59e0b;
  color: #ffffff;
}

.exchangeButton:hover:not(:disabled) {
  background: #d97706;
  border-color: #d97706;
  transform: translateY(-2px);
  box-shadow: 0 2px 12px rgba(245, 158, 11, 0.4);
}

.exchangeButton:active:not(:disabled) {
  transform: translateY(0);
}

.exchangeButton:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cancelButton {
  background: #f3f4f6;
  border-color: #9ca3af;
  color: #6b7280;
}

.cancelButton:hover:not(:disabled) {
  background: #e5e7eb;
  border-color: #6b7280;
  transform: translateY(-2px);
}

.cancelButton:active:not(:disabled) {
  transform: translateY(0);
}

/* Success overlay */
.successOverlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(16, 185, 129, 0.95);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  animation: fadeIn 300ms ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.successIcon {
  font-size: 64px;
  color: #ffffff;
  animation: scaleIn 300ms ease-out;
}

@keyframes scaleIn {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

.successMessage {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

/* Inline mode */
.inline {
  display: inline-flex;
  margin-top: 4px;
}

.inlineButton {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 4px;
  cursor: pointer;
  transition: all 150ms ease;
  font-family: inherit;
}

.inlineButton:hover:not(:disabled) {
  background: #fde68a;
  border-color: #fbbf24;
  transform: translateY(-1px);
}

.inlineButton:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.inlineIcon {
  font-size: 12px;
  color: #f59e0b;
  font-weight: 700;
}

/* Tooltip mode */
.tooltip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: #1f2937;
  color: #ffffff;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  font-size: 12px;
  max-width: 200px;
}

.tooltipText {
  margin: 0;
  font-weight: 600;
}

.tooltipRequires {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #d1d5db;
}

/* Highlight mode */
.highlight {
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  pointer-events: none;
}

.highlightGlow {
  width: 100%;
  height: 100%;
  border: 2px solid #f59e0b;
  border-radius: 6px;
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.6);
  animation: glow 1.5s ease-in-out infinite;
}

@keyframes glow {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.6);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 20px rgba(245, 158, 11, 0.9);
  }
}

/* Responsive */
@media (max-width: 640px) {
  .dialog {
    padding: 16px;
    gap: 12px;
  }

  .title {
    font-size: 13px;
  }

  .meldLabel {
    font-size: 12px;
  }

  .requiredLabel {
    font-size: 12px;
  }

  .exchangeButton,
  .cancelButton {
    padding: 10px 14px;
    font-size: 12px;
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .dialog {
    background: #1f2937;
    border-color: #f59e0b;
  }

  .header {
    border-color: #78350f;
  }

  .meldLabel,
  .requiredLabel {
    color: #d1d5db;
  }

  .meld {
    background: #374151;
    border-color: #78350f;
  }

  .requiredTile {
    background: #111827;
    border-color: #4b5563;
  }

  .requiredHint {
    color: #9ca3af;
  }

  .cancelButton {
    background: #1f2937;
    border-color: #6b7280;
    color: #9ca3af;
  }

  .cancelButton:hover:not(:disabled) {
    background: #374151;
  }
}
```

## Accessibility

### ARIA Attributes

```typescript
// Dialog mode
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="joker-exchange-title"
  aria-describedby="joker-exchange-description"
>

// Exchangeable marker
<div aria-label="Exchangeable">▲</div>

// Joker number
<div aria-label={`Joker ${index + 1}`}>{index + 1}</div>

// Buttons
<button aria-label="Confirm joker exchange">EXCHANGE</button>
<button aria-label="Cancel joker exchange">CANCEL</button>

// Success overlay
<div aria-live="polite">
  <p>Joker exchanged!</p>
</div>

// Tooltip
<div role="tooltip">
  <p>Click to exchange</p>
</div>

// Highlight
<div aria-label="Joker can be exchanged" />
```

### Keyboard Navigation

- **Tab**: Navigate between exchange/cancel buttons
- **Enter/Space**: Confirm selected action
- **E**: Quick-exchange (when dialog open)
- **Escape**: Cancel exchange

### Screen Reader Announcements

```typescript
// Announce when exchange opportunity appears
useEffect(() => {
  if (exchangeState.available) {
    announceToScreenReader(
      `Joker exchange available. You can exchange the joker in ${getMeldTypeLabel(meld.meld_type)} for ${requiredTile.toString()}`,
      'polite'
    );
  }
}, [exchangeState.available]);

// Announce success
useEffect(() => {
  if (showSuccess) {
    announceToScreenReader('Joker successfully exchanged!', 'assertive');
  }
}, [showSuccess]);

// Announce unavailable reason
useEffect(() => {
  if (!exchangeState.available && exchangeState.unavailableReason) {
    announceToScreenReader(exchangeState.unavailableReason, 'polite');
  }
}, [exchangeState]);
```

### Focus Management

- Auto-focus on exchange button when dialog opens
- Trap focus within dialog
- Restore focus after dialog closes

## Integration Examples

### With ExposedMelds Component

```typescript
import { JokerExchangeIndicator } from '@/components/presentational/JokerExchangeIndicator';
import { ExposedMelds } from '@/components/presentational/ExposedMelds';

export const PlayerMeldsPanel = () => {
  const { gameState, sendCommand } = useGameState();
  const [selectedJoker, setSelectedJoker] = useState<{
    meldIndex: number;
    jokerIndex: number;
  } | null>(null);

  const currentPlayer = gameState.players.find(
    (p) => p.seat === gameState.currentUserSeat
  );

  const handleJokerExchange = (meldIndex: number, jokerIndex: number) => {
    setSelectedJoker({ meldIndex, jokerIndex });
  };

  const confirmExchange = (jokerIndex: number) => {
    if (!selectedJoker) return;

    sendCommand({
      type: 'ExchangeJoker',
      player: gameState.currentUserSeat,
      meld_index: selectedJoker.meldIndex,
      joker_index: jokerIndex,
      // replacement_tile determined from hand
    });

    setSelectedJoker(null);
  };

  return (
    <>
      <ExposedMelds
        melds={currentPlayer?.melds || []}
        playerSeat={gameState.currentUserSeat}
        owner={gameState.currentUserSeat}
        isCurrentUser
        enableJokerExchange
        onJokerExchange={handleJokerExchange}
      />

      {selectedJoker && (
        <JokerExchangeIndicator
          meld={currentPlayer!.melds[selectedJoker.meldIndex]}
          jokerIndex={selectedJoker.jokerIndex}
          requiredTile={/* calculate required tile */}
          hasRequiredTile={/* check hand */}
          meldOwner={gameState.currentUserSeat}
          currentPlayer={gameState.currentUserSeat}
          mode="dialog"
          onExchange={confirmExchange}
          onCancel={() => setSelectedJoker(null)}
        />
      )}
    </>
  );
};
```

### Inline Mode (in Meld Display)

```typescript
export const MeldWithExchangeIndicator = ({ meld, jokerIndex }: Props) => {
  const { gameState } = useGameState();
  const requiredTile = calculateRequiredTile(meld, jokerIndex);
  const hasRequiredTile = playerHasTile(gameState.currentPlayer, requiredTile);

  return (
    <div className={styles.meld}>
      {/* Meld tiles */}
      <div className={styles.tiles}>
        {meld.tiles.map((tile, index) => (
          <Tile key={index} tile={tile} />
        ))}
      </div>

      {/* Inline exchange indicator */}
      {index === jokerIndex && (
        <JokerExchangeIndicator
          meld={meld}
          jokerIndex={jokerIndex}
          requiredTile={requiredTile}
          hasRequiredTile={hasRequiredTile}
          meldOwner={meld.owner}
          currentPlayer={gameState.currentUserSeat}
          mode="inline"
          onExchange={(idx) => handleExchange(idx)}
        />
      )}
    </div>
  );
};
```

### Tooltip Mode (on Hover)

```typescript
export const JokerTileWithTooltip = ({ tile, meld, index }: Props) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (tile.index !== 41) return <Tile tile={tile} />;

  return (
    <div
      className={styles.jokerWrapper}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Tile tile={tile} showJokerIndicator />

      {showTooltip && (
        <JokerExchangeIndicator
          meld={meld}
          jokerIndex={index}
          requiredTile={calculateRequiredTile(meld, index)}
          hasRequiredTile={playerHasTile(...)}
          meldOwner={meld.owner}
          currentPlayer={gameState.currentUserSeat}
          mode="tooltip"
        />
      )}
    </div>
  );
};
```

## Testing Strategy

### Unit Tests

```typescript
describe('JokerExchangeIndicator', () => {
  describe('Rendering', () => {
    it('renders dialog mode', () => {
      const { getByText } = render(
        <JokerExchangeIndicator
          meld={createMeldWithJoker()}
          jokerIndex={2}
          requiredTile={createTile('5C')}
          hasRequiredTile
          meldOwner="East"
          currentPlayer="East"
          mode="dialog"
          onExchange={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(getByText('JOKER EXCHANGE AVAILABLE')).toBeInTheDocument();
    });

    it('renders inline mode', () => {
      const { container } = render(
        <JokerExchangeIndicator
          meld={createMeldWithJoker()}
          jokerIndex={2}
          requiredTile={createTile('5C')}
          hasRequiredTile
          meldOwner="East"
          currentPlayer="East"
          mode="inline"
          onExchange={vi.fn()}
        />
      );
      expect(container.querySelector('.inlineButton')).toBeInTheDocument();
    });

    it('renders tooltip mode', () => {
      const { getByText } = render(
        <JokerExchangeIndicator
          meld={createMeldWithJoker()}
          jokerIndex={2}
          requiredTile={createTile('5C')}
          hasRequiredTile
          meldOwner="East"
          currentPlayer="East"
          mode="tooltip"
        />
      );
      expect(getByText('Click to exchange')).toBeInTheDocument();
    });

    it('shows unavailable message when no required tile', () => {
      const { getByText } = render(
        <JokerExchangeIndicator
          meld={createMeldWithJoker()}
          jokerIndex={2}
          requiredTile={createTile('5C')}
          hasRequiredTile={false}
          meldOwner="East"
          currentPlayer="East"
          mode="dialog"
          onExchange={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(getByText("You don't have the required tile")).toBeInTheDocument();
    });

    it('highlights exchangeable joker', () => {
      const { container } = render(
        <JokerExchangeIndicator
          meld={createMeldWithJoker()}
          jokerIndex={2}
          requiredTile={createTile('5C')}
          hasRequiredTile
          meldOwner="East"
          currentPlayer="East"
          mode="dialog"
          onExchange={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(container.querySelector('.exchangeable')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('calls onExchange when exchange button clicked', () => {
      const onExchange = vi.fn();
      const { getByText } = render(
        <JokerExchangeIndicator
          meld={createMeldWithJoker()}
          jokerIndex={2}
          requiredTile={createTile('5C')}
          hasRequiredTile
          meldOwner="East"
          currentPlayer="East"
          mode="dialog"
          onExchange={onExchange}
          onCancel={vi.fn()}
        />
      );

      fireEvent.click(getByText(/EXCHANGE/));
      expect(onExchange).toHaveBeenCalledWith(2);
    });

    it('calls onCancel when cancel button clicked', () => {
      const onCancel = vi.fn();
      const { getByText } = render(
        <JokerExchangeIndicator
          meld={createMeldWithJoker()}
          jokerIndex={2}
          requiredTile={createTile('5C')}
          hasRequiredTile
          meldOwner="East"
          currentPlayer="East"
          mode="dialog"
          onExchange={vi.fn()}
          onCancel={onCancel}
        />
      );

      fireEvent.click(getByText(/CANCEL/));
      expect(onCancel).toHaveBeenCalled();
    });

    it('shows success animation after exchange', async () => {
      const { getByText, container } = render(
        <JokerExchangeIndicator
          meld={createMeldWithJoker()}
          jokerIndex={2}
          requiredTile={createTile('5C')}
          hasRequiredTile
          meldOwner="East"
          currentPlayer="East"
          mode="dialog"
          onExchange={vi.fn()}
          showSuccessAnimation
        />
      );

      fireEvent.click(getByText(/EXCHANGE/));

      await waitFor(() => {
        expect(container.querySelector('.successOverlay')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has correct dialog role', () => {
      const { container } = render(
        <JokerExchangeIndicator
          meld={createMeldWithJoker()}
          jokerIndex={2}
          requiredTile={createTile('5C')}
          hasRequiredTile
          meldOwner="East"
          currentPlayer="East"
          mode="dialog"
          onExchange={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(container.querySelector('[role="dialog"]')).toBeInTheDocument();
    });

    it('passes axe accessibility tests', async () => {
      const { container } = render(
        <JokerExchangeIndicator
          meld={createMeldWithJoker()}
          jokerIndex={2}
          requiredTile={createTile('5C')}
          hasRequiredTile
          meldOwner="East"
          currentPlayer="East"
          mode="dialog"
          onExchange={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
```

## Performance Considerations

- **React.memo**: Memoize component with custom comparison
- **useMemo**: Memoize exchange state calculations
- **useCallback**: Stable callback refs for handlers
- **GPU Animations**: Use transform/opacity for smooth animations
- **Conditional Rendering**: Only render when exchange available

## Constants

```typescript
// JokerExchangeConstants.ts
export const JOKER_EXCHANGE_CONSTANTS = {
  JOKER_TILE_INDEX: 41,
  ANIMATION_DURATION: 300, // ms
  SUCCESS_DISPLAY_DURATION: 1500, // ms

  EXCHANGE_MARKER: '▲',
  EXCHANGE_ICON: '⇄',
  SUCCESS_ICON: '✓',

  MODES: {
    DIALOG: 'dialog',
    INLINE: 'inline',
    TOOLTIP: 'tooltip',
    HIGHLIGHT: 'highlight',
  } as const,
} as const;
```

## Future Enhancements

1. **Drag-and-Drop Exchange**: Drag tile from hand onto joker
2. **Auto-Detect Opportunities**: Highlight all exchangeable jokers automatically
3. **Exchange History**: Track joker exchanges made during game
4. **Animation Themes**: Different success animations (confetti, sparkles, etc.)
5. **Exchange Tutorial**: Interactive guide for first-time users
6. **Exchange Statistics**: Track exchange frequency and success
7. **Multi-Joker Batch Exchange**: Exchange multiple jokers at once
8. **Exchange Undo**: Allow undoing exchange within time window
9. **Exchange Sound Effects**: Audio feedback for exchange
10. **Exchange Achievements**: Unlock achievements for clever exchanges

## Notes

- **Finesse Rule**: Players can exchange jokers before declaring Mahjong
- **All-Joker Melds**: Can't exchange jokers in all-joker meld without called tile
- **Strategic Importance**: Joker exchange can be game-changing
- **Server Validation**: All exchanges validated server-side
- **Animation**: Success animation optional, can be disabled for performance
- **Multiple Modes**: Different modes for different UI contexts
- **Accessibility**: Full keyboard navigation and screen reader support

---

**Related Components**:

- [ExposedMelds](./ExposedMelds.md): Displays melds with jokers
- [Tile](./Tile.md): Individual tile rendering with joker indicator
- [PlayerHand](./PlayerHand.md): Player's tiles for exchange source

**Backend Integration**:

- `ExchangeJoker` command from Rust bindings
- `JokerExchanged` event when exchange succeeds
- Validation for exchangeable jokers
- Finesse rule implementation
