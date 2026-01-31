# CallIndicator Component

## Overview

**Purpose**: Display active call window with available actions (Mahjong/Pung/Kong/Quint/Pass), countdown timer, and visual urgency.

**Category**: Presentational Component (Core Game Elements)

**Complexity**: Medium

The CallIndicator component appears when another player discards a tile, creating a brief opportunity for the current player to claim it. The component shows:

- **Available call actions**: Mahjong (win), Pung, Kong, Quint, or Pass
- **Countdown timer**: Visual countdown showing remaining decision time
- **Discarded tile**: The tile being offered for claiming
- **Urgency indicators**: Color changes and pulsing as time runs out
- **Quick action buttons**: One-click to declare intent

This component is critical for game flow, as players have limited time (typically 10-15 seconds) to decide whether to call a discarded tile.

## User Stories

**Primary Stories**:

- **US-013**: As a player, I want to call tiles for melds so I can build winning hands
- **US-017**: As a player, I want to see available call actions so I know my options
- **US-019**: As a player, I want a countdown timer during call windows so I don't miss opportunities

**Related Stories**:

- **US-012**: As a player, I want to see my exposed melds after calling tiles
- **US-021**: As a player, I want to declare Mahjong when I have a winning hand
- **US-025**: As a player, I want to understand call priority (Mahjong > Meld > Pass)

## Visual Design

### Standard Call Window (Multiple Options)

```
┌─────────────────────────────────────────────────────┐
│ CALL WINDOW                                    ⏱ 12s │  ← Header with timer
├─────────────────────────────────────────────────────┤
│                                                      │
│  Tile Available:  ┌──┐                              │  ← Discarded tile
│                   │5C│                              │
│                   └──┘                              │
│                                                      │
│  Your Options:                                       │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐   │  ← Action buttons
│  │  MAHJONG   │  │    PUNG    │  │    PASS    │   │
│  │            │  │            │  │            │   │
│  │  ✓ WIN!    │  │  3 tiles   │  │  Skip      │   │
│  └────────────┘  └────────────┘  └────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │  ← Progress bar
│  │████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
Size: 480px × 300px
```

### Warning State (<5s remaining)

```
┌─────────────────────────────────────────────────────┐
│ ⚠ CALL WINDOW - HURRY!                        ⏱ 4s │  ← Urgent header
├─────────────────────────────────────────────────────┤
│                                                      │
│  Tile Available:  ┌──┐                              │
│                   │5C│  ← Pulsing glow             │
│                   └──┘                              │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │  MAHJONG   │  │    PUNG    │  │    PASS    │   │  ← Pulsing buttons
│  │            │  │            │  │            │   │
│  │  ✓ WIN!    │  │  3 tiles   │  │  Skip      │   │
│  └────────────┘  └────────────┘  └────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │  ← Red progress
│  │████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
Orange border, pulsing animation
```

### Mahjong Only (Winning Tile)

```
┌─────────────────────────────────────────────────────┐
│ 🎉 WINNING TILE!                               ⏱ 10s │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──┐                                               │
│  │5C│  ← Celebratory glow                          │
│  └──┘                                               │
│                                                      │
│  This tile completes your hand!                     │
│                                                      │
│  ┌──────────────────────┐  ┌──────────────────┐    │
│  │      MAHJONG         │  │       PASS       │    │
│  │                      │  │                  │    │
│  │   ✓ Declare Win!     │  │   Let it go      │    │
│  └──────────────────────┘  └──────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │██████████████████████████████████████████████│  │  ← Green progress
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
Green border, gold background tint
```

### Pass Only (Can't Call)

```
┌─────────────────────────────────────────────────────┐
│ Call Window                                    ⏱ 8s │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──┐                                               │
│  │5C│                                               │
│  └──┘                                               │
│                                                      │
│  No valid calls available                           │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │                  PASS                        │   │
│  │                                              │   │
│  │              Skip this tile                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │████████████████████████████░░░░░░░░░░░░░░░░░│  │  ← Gray progress
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
Gray border, muted colors
```

### Compact Mode (Mobile)

```
┌───────────────────────────┐
│ CALL            ⏱ 12s    │
├───────────────────────────┤
│  ┌──┐                     │
│  │5C│                     │
│  └──┘                     │
│                           │
│  ┌──────┐  ┌──────┐      │
│  │MAHJONG PUNG   │      │
│  └──────┘  └──────┘      │
│  ┌─────────────────┐     │
│  │      PASS       │     │
│  └─────────────────┘     │
│                           │
│  ████████████░░░░░░░     │
└───────────────────────────┘
Size: 240px × 220px
```

## Props Interface

```typescript
import { Tile, CallIntentKind } from '@/types/bindings/generated';

export interface CallIndicatorProps {
  /**
   * The discarded tile available for calling
   */
  discardedTile: Tile;

  /**
   * Available call actions for current player
   */
  availableActions: CallIntentKind[];

  /**
   * Total duration of call window (seconds)
   */
  duration: number;

  /**
   * Remaining time in call window (seconds)
   */
  remaining: number;

  /**
   * Whether this is a winning tile (Mahjong available)
   * @default false
   */
  isWinningTile?: boolean;

  /**
   * Callback when action is selected
   */
  onAction: (action: CallIntentKind | 'Pass') => void;

  /**
   * Warning threshold (seconds, turns orange)
   * @default 5
   */
  warningThreshold?: number;

  /**
   * Critical threshold (seconds, turns red)
   * @default 2
   */
  criticalThreshold?: number;

  /**
   * Display size
   * @default 'standard'
   */
  size?: 'standard' | 'compact';

  /**
   * Show progress bar
   * @default true
   */
  showProgress?: boolean;

  /**
   * Show tile preview
   * @default true
   */
  showTile?: boolean;

  /**
   * Enable sound alerts
   * @default true
   */
  soundEnabled?: boolean;

  /**
   * Callback when timer expires (auto-pass)
   */
  onExpire?: () => void;

  /**
   * Additional CSS class
   */
  className?: string;
}

export interface CallActionInfo {
  kind: CallIntentKind | 'Pass';
  label: string;
  description: string;
  icon: string;
  variant: 'primary' | 'secondary' | 'neutral';
  disabled?: boolean;
}

export type CallWindowState = 'active' | 'warning' | 'critical';
```

## State Management

```typescript
import { useMemo, useCallback, useEffect, useState } from 'react';

export const useCallIndicator = (props: CallIndicatorProps) => {
  const {
    availableActions,
    remaining,
    duration,
    warningThreshold = 5,
    criticalThreshold = 2,
    soundEnabled = true,
    onExpire,
  } = props;

  // Determine window state based on remaining time
  const windowState = useMemo<CallWindowState>(() => {
    if (remaining <= criticalThreshold) return 'critical';
    if (remaining <= warningThreshold) return 'warning';
    return 'active';
  }, [remaining, warningThreshold, criticalThreshold]);

  // Calculate progress percentage
  const progress = useMemo(() => {
    return Math.max(0, Math.min(100, (remaining / duration) * 100));
  }, [remaining, duration]);

  // Generate action info
  const actions = useMemo<CallActionInfo[]>(() => {
    const actionList: CallActionInfo[] = [];

    // Add available call actions
    availableActions.forEach((action) => {
      switch (action) {
        case 'Mahjong':
          actionList.push({
            kind: 'Mahjong',
            label: 'MAHJONG',
            description: '✓ Win!',
            icon: '🎉',
            variant: 'primary',
          });
          break;
        case 'Pung':
          actionList.push({
            kind: 'Pung',
            label: 'PUNG',
            description: '3 tiles',
            icon: '▣',
            variant: 'secondary',
          });
          break;
        case 'Kong':
          actionList.push({
            kind: 'Kong',
            label: 'KONG',
            description: '4 tiles',
            icon: '▣▣',
            variant: 'secondary',
          });
          break;
        case 'Quint':
          actionList.push({
            kind: 'Quint',
            label: 'QUINT',
            description: '5 tiles',
            icon: '▣▣▣',
            variant: 'secondary',
          });
          break;
      }
    });

    // Always add Pass option
    actionList.push({
      kind: 'Pass',
      label: 'PASS',
      description: availableActions.length > 0 ? 'Skip' : 'Skip this tile',
      icon: '⊘',
      variant: 'neutral',
    });

    return actionList;
  }, [availableActions]);

  // Sound alerts at thresholds
  const [lastAlertState, setLastAlertState] = useState<CallWindowState>('active');

  useEffect(() => {
    if (!soundEnabled) return;

    if (windowState === 'warning' && lastAlertState !== 'warning') {
      playAlertSound('warning');
      setLastAlertState('warning');
    } else if (windowState === 'critical' && lastAlertState !== 'critical') {
      playAlertSound('critical');
      setLastAlertState('critical');
    }
  }, [windowState, lastAlertState, soundEnabled]);

  // Handle timer expiration
  useEffect(() => {
    if (remaining <= 0 && onExpire) {
      onExpire();
    }
  }, [remaining, onExpire]);

  return {
    windowState,
    progress,
    actions,
  };
};

// Helper: Play alert sound
const playAlertSound = (type: 'warning' | 'critical') => {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  // Warning: 600Hz, Critical: 900Hz
  oscillator.frequency.value = type === 'warning' ? 600 : 900;
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.2, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);

  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.15);
};

// Helper: Format time MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
```

## Component Structure

```typescript
import React, { memo } from 'react';
import { Tile } from '@/components/presentational/Tile';
import { CallIndicatorProps, useCallIndicator } from './CallIndicator.types';
import styles from './CallIndicator.module.css';

export const CallIndicator = memo<CallIndicatorProps>(
  (props) => {
    const {
      discardedTile,
      remaining,
      isWinningTile = false,
      onAction,
      size = 'standard',
      showProgress = true,
      showTile = true,
      className,
    } = props;

    const { windowState, progress, actions } = useCallIndicator(props);

    // Container class based on state
    const containerClass = [
      styles.container,
      styles[`state-${windowState}`],
      styles[`size-${size}`],
      isWinningTile && styles.winning,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    // Header text based on state
    const headerText = useMemo(() => {
      if (isWinningTile) return '🎉 WINNING TILE!';
      if (windowState === 'critical') return '⚠ CALL WINDOW - HURRY!';
      if (windowState === 'warning') return '⚠ CALL WINDOW';
      return 'CALL WINDOW';
    }, [isWinningTile, windowState]);

    return (
      <div
        className={containerClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-window-title"
        aria-describedby="call-window-description"
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 id="call-window-title" className={styles.title}>
            {headerText}
          </h2>
          <div className={styles.timer} aria-live="polite" aria-atomic="true">
            <span className={styles.timerIcon}>⏱</span>
            <span className={styles.timerValue}>{Math.ceil(remaining)}s</span>
          </div>
        </div>

        {/* Tile display */}
        {showTile && (
          <div className={styles.tileDisplay}>
            <p className={styles.tileLabel}>
              {isWinningTile ? 'Winning Tile:' : 'Tile Available:'}
            </p>
            <div className={styles.tileWrapper}>
              <Tile tile={discardedTile} size="large" />
            </div>
          </div>
        )}

        {/* Winning message */}
        {isWinningTile && size === 'standard' && (
          <p className={styles.winningMessage} id="call-window-description">
            This tile completes your hand!
          </p>
        )}

        {/* No actions message */}
        {actions.length === 1 && actions[0].kind === 'Pass' && !isWinningTile && (
          <p className={styles.noActionsMessage} id="call-window-description">
            No valid calls available
          </p>
        )}

        {/* Action label for multi-action */}
        {actions.length > 1 && size === 'standard' && (
          <p className={styles.actionsLabel}>Your Options:</p>
        )}

        {/* Action buttons */}
        <div className={styles.actions}>
          {actions.map((action) => (
            <button
              key={action.kind}
              className={[
                styles.actionButton,
                styles[`variant-${action.variant}`],
                action.disabled && styles.disabled,
                action.kind === 'Mahjong' && styles.mahjongButton,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => !action.disabled && onAction(action.kind)}
              disabled={action.disabled}
              aria-label={`${action.label}: ${action.description}`}
            >
              <span className={styles.actionLabel}>{action.label}</span>
              {size === 'standard' && (
                <span className={styles.actionDescription}>{action.description}</span>
              )}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        {showProgress && (
          <div className={styles.progressContainer} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={styles.progressBar}
              style={{ width: `${progress}%` }}
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for performance
    return (
      prevProps.remaining === nextProps.remaining &&
      prevProps.availableActions === nextProps.availableActions &&
      prevProps.isWinningTile === nextProps.isWinningTile
    );
  }
);

CallIndicator.displayName = 'CallIndicator';
```

## Styling (CSS Modules)

```css
/* CallIndicator.module.css */

.container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: #ffffff;
  border: 2px solid #2563eb;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  position: relative;
  animation: slideIn 200ms ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* States */
.container.state-warning {
  border-color: #f59e0b;
  animation: pulseWarning 2s ease-in-out infinite;
}

@keyframes pulseWarning {
  0%,
  100% {
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  }
  50% {
    box-shadow: 0 4px 20px rgba(245, 158, 11, 0.6);
  }
}

.container.state-critical {
  border-color: #ef4444;
  animation: pulseCritical 0.8s ease-in-out infinite;
}

@keyframes pulseCritical {
  0%,
  100% {
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 4px 24px rgba(239, 68, 68, 0.8);
  }
}

.container.winning {
  border-color: #10b981;
  background: linear-gradient(135deg, #ffffff 0%, #fef3c7 100%);
  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
}

/* Sizes */
.container.size-compact {
  padding: 12px;
  gap: 10px;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.title {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.state-warning .title {
  color: #d97706;
}

.state-critical .title {
  color: #dc2626;
}

.winning .title {
  color: #059669;
}

.timer {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  color: #2563eb;
}

.state-warning .timer {
  color: #f59e0b;
}

.state-critical .timer {
  color: #ef4444;
  animation: timerBlink 0.5s infinite;
}

@keyframes timerBlink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.timerIcon {
  font-size: 16px;
}

.timerValue {
  min-width: 32px;
  text-align: right;
}

/* Tile display */
.tileDisplay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
}

.tileLabel {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  margin: 0;
}

.tileWrapper {
  position: relative;
}

.winning .tileWrapper {
  animation: tileGlow 1.5s ease-in-out infinite;
}

@keyframes tileGlow {
  0%,
  100% {
    filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.6));
  }
  50% {
    filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.9));
  }
}

.state-critical .tileWrapper {
  animation: tilePulse 0.8s ease-in-out infinite;
}

@keyframes tilePulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* Messages */
.winningMessage,
.noActionsMessage {
  font-size: 14px;
  text-align: center;
  margin: 0;
  padding: 8px;
  border-radius: 6px;
}

.winningMessage {
  color: #059669;
  background: #d1fae5;
  font-weight: 600;
}

.noActionsMessage {
  color: #6b7280;
  background: #f3f4f6;
}

.actionsLabel {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

/* Actions */
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.size-compact .actions {
  gap: 8px;
}

.actionButton {
  flex: 1;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  background: #f9fafb;
  border: 2px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
  font-family: inherit;
}

.size-compact .actionButton {
  min-width: 80px;
  padding: 8px 12px;
  gap: 2px;
}

.actionButton:hover:not(.disabled) {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.actionButton:active:not(.disabled) {
  transform: translateY(0);
}

.actionButton:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

/* Action variants */
.actionButton.variant-primary {
  background: #2563eb;
  border-color: #2563eb;
}

.actionButton.variant-primary .actionLabel,
.actionButton.variant-primary .actionDescription {
  color: #ffffff;
}

.actionButton.variant-primary:hover:not(.disabled) {
  background: #1d4ed8;
  border-color: #1d4ed8;
  box-shadow: 0 2px 12px rgba(37, 99, 235, 0.4);
}

.actionButton.variant-secondary {
  background: #10b981;
  border-color: #10b981;
}

.actionButton.variant-secondary .actionLabel,
.actionButton.variant-secondary .actionDescription {
  color: #ffffff;
}

.actionButton.variant-secondary:hover:not(.disabled) {
  background: #059669;
  border-color: #059669;
  box-shadow: 0 2px 12px rgba(16, 185, 129, 0.4);
}

.actionButton.variant-neutral {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.actionButton.variant-neutral .actionLabel {
  color: #6b7280;
}

.actionButton.variant-neutral .actionDescription {
  color: #9ca3af;
}

.actionButton.variant-neutral:hover:not(.disabled) {
  background: #e5e7eb;
  border-color: #6b7280;
}

/* Mahjong button (winning) */
.actionButton.mahjongButton {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-color: #059669;
  box-shadow: 0 2px 12px rgba(16, 185, 129, 0.3);
}

.actionButton.mahjongButton:hover:not(.disabled) {
  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.5);
  transform: translateY(-3px);
}

/* Disabled */
.actionButton.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.actionLabel {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #111827;
}

.size-compact .actionLabel {
  font-size: 11px;
}

.actionDescription {
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
}

/* Progress bar */
.progressContainer {
  width: 100%;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.progressBar {
  height: 100%;
  background: #2563eb;
  border-radius: 3px;
  transition:
    width 1s linear,
    background-color 300ms ease;
}

.state-warning .progressBar {
  background: #f59e0b;
}

.state-critical .progressBar {
  background: #ef4444;
}

.winning .progressBar {
  background: #10b981;
}

/* Responsive */
@media (max-width: 640px) {
  .container {
    padding: 16px;
    gap: 12px;
  }

  .header {
    padding-bottom: 10px;
  }

  .title {
    font-size: 14px;
  }

  .timer {
    font-size: 13px;
  }

  .actionButton {
    min-width: 100px;
    padding: 10px 14px;
  }

  .actionLabel {
    font-size: 11px;
  }

  .actionDescription {
    font-size: 10px;
  }

  /* Force compact layout on mobile */
  .container:not(.size-compact) {
    max-width: 100%;
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .container {
    background: #1f2937;
    border-color: #3b82f6;
  }

  .container.winning {
    background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
  }

  .header {
    border-color: #374151;
  }

  .title {
    color: #f9fafb;
  }

  .tileLabel {
    color: #9ca3af;
  }

  .winningMessage {
    color: #10b981;
    background: #064e3b;
  }

  .noActionsMessage {
    color: #9ca3af;
    background: #111827;
  }

  .actionsLabel {
    color: #d1d5db;
  }

  .actionButton {
    background: #111827;
    border-color: #4b5563;
  }

  .actionButton.variant-neutral {
    background: #1f2937;
  }

  .actionLabel {
    color: #f9fafb;
  }

  .actionDescription {
    color: #9ca3af;
  }

  .progressContainer {
    background: #374151;
  }
}
```

## Accessibility

### ARIA Attributes

```typescript
// Dialog container
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="call-window-title"
  aria-describedby="call-window-description"
>

// Timer (live region)
<div aria-live="polite" aria-atomic="true">
  <span>{Math.ceil(remaining)}s</span>
</div>

// Critical timer (assertive)
<div aria-live="assertive" aria-atomic="true">
  <span>{Math.ceil(remaining)}s</span>
</div>

// Action button
<button aria-label={`${action.label}: ${action.description}`}>
  {action.label}
</button>

// Progress bar
<div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} />
```

### Keyboard Navigation

- **Tab**: Navigate between action buttons
- **Enter/Space**: Select action
- **Escape**: Auto-pass (if enabled)
- **M**: Quick-select Mahjong (if available)
- **P**: Quick-select Pass

### Screen Reader Announcements

```typescript
// Announce when call window opens
useEffect(() => {
  const announcement = isWinningTile
    ? 'Winning tile available! Press M to declare Mahjong or P to pass.'
    : `Call window opened. ${availableActions.length} ${availableActions.length === 1 ? 'action' : 'actions'} available. ${Math.ceil(remaining)} seconds remaining.`;

  announceToScreenReader(announcement, 'assertive');
}, []);

// Announce time warnings
useEffect(() => {
  if (windowState === 'warning') {
    announceToScreenReader(`Warning: ${Math.ceil(remaining)} seconds remaining`, 'polite');
  } else if (windowState === 'critical') {
    announceToScreenReader(`Critical: ${Math.ceil(remaining)} seconds remaining`, 'assertive');
  }
}, [windowState]);

// Announce expiration
useEffect(() => {
  if (remaining <= 0) {
    announceToScreenReader('Call window expired. Automatically passing.', 'assertive');
  }
}, [remaining]);
```

### Focus Management

- Auto-focus on Mahjong button if winning tile
- Auto-focus on first available action otherwise
- Trap focus within dialog
- Restore focus after dialog closes

## Integration Examples

### Standard Call Window

```typescript
import { CallIndicator } from '@/components/presentational/CallIndicator';
import { useGameState } from '@/hooks/useGameState';

export const GamePlayArea = () => {
  const { gameState, sendCommand } = useGameState();
  const callWindow = gameState.turnStage?.CallWindow;

  const handleCallAction = (action: CallIntentKind | 'Pass') => {
    if (action === 'Pass') {
      sendCommand({
        type: 'Pass',
        player: gameState.currentUserSeat,
      });
    } else {
      sendCommand({
        type: 'DeclareCallIntent',
        player: gameState.currentUserSeat,
        intent: action,
      });
    }
  };

  if (!callWindow) return null;

  return (
    <CallIndicator
      discardedTile={callWindow.discarded_tile}
      availableActions={callWindow.available_actions}
      duration={callWindow.duration}
      remaining={callWindow.remaining}
      isWinningTile={callWindow.available_actions.includes('Mahjong')}
      onAction={handleCallAction}
      warningThreshold={5}
      criticalThreshold={2}
      soundEnabled={true}
    />
  );
};
```

### Modal Overlay Integration

```typescript
export const CallWindowModal = () => {
  const { gameState, sendCommand } = useGameState();
  const callWindow = gameState.turnStage?.CallWindow;

  if (!callWindow) return null;

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        sendCommand({ type: 'Pass', player: gameState.currentUserSeat });
      }}
      overlay="dark"
      position="center"
    >
      <CallIndicator
        discardedTile={callWindow.discarded_tile}
        availableActions={callWindow.available_actions}
        duration={callWindow.duration}
        remaining={callWindow.remaining}
        isWinningTile={callWindow.available_actions.includes('Mahjong')}
        onAction={(action) => {
          if (action === 'Pass') {
            sendCommand({ type: 'Pass', player: gameState.currentUserSeat });
          } else {
            sendCommand({
              type: 'DeclareCallIntent',
              player: gameState.currentUserSeat,
              intent: action,
            });
          }
        }}
        onExpire={() => {
          // Auto-pass on expiration
          sendCommand({ type: 'Pass', player: gameState.currentUserSeat });
        }}
      />
    </Modal>
  );
};
```

### Compact Mode (Mobile)

```typescript
export const MobileCallWindow = () => {
  const { gameState, sendCommand } = useGameState();
  const callWindow = gameState.turnStage?.CallWindow;
  const isMobile = useMediaQuery('(max-width: 640px)');

  if (!callWindow) return null;

  return (
    <div className={styles.mobileOverlay}>
      <CallIndicator
        discardedTile={callWindow.discarded_tile}
        availableActions={callWindow.available_actions}
        duration={callWindow.duration}
        remaining={callWindow.remaining}
        isWinningTile={callWindow.available_actions.includes('Mahjong')}
        onAction={(action) => {
          /* ... */
        }}
        size={isMobile ? 'compact' : 'standard'}
        showProgress={!isMobile}
      />
    </div>
  );
};
```

## Testing Strategy

### Unit Tests

```typescript
describe('CallIndicator', () => {
  describe('Rendering', () => {
    it('renders with discarded tile', () => {
      const { getByText } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={10}
          onAction={vi.fn()}
        />
      );
      expect(getByText('Tile Available:')).toBeInTheDocument();
    });

    it('shows available actions', () => {
      const { getByText } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Mahjong', 'Pung']}
          duration={10}
          remaining={10}
          onAction={vi.fn()}
        />
      );
      expect(getByText('MAHJONG')).toBeInTheDocument();
      expect(getByText('PUNG')).toBeInTheDocument();
      expect(getByText('PASS')).toBeInTheDocument();
    });

    it('shows winning tile message', () => {
      const { getByText } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Mahjong']}
          duration={10}
          remaining={10}
          isWinningTile
          onAction={vi.fn()}
        />
      );
      expect(getByText('🎉 WINNING TILE!')).toBeInTheDocument();
      expect(getByText('This tile completes your hand!')).toBeInTheDocument();
    });

    it('shows no actions message when only pass available', () => {
      const { getByText } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={[]}
          duration={10}
          remaining={10}
          onAction={vi.fn()}
        />
      );
      expect(getByText('No valid calls available')).toBeInTheDocument();
    });

    it('displays timer', () => {
      const { getByText } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={7}
          onAction={vi.fn()}
        />
      );
      expect(getByText('7s')).toBeInTheDocument();
    });

    it('shows progress bar', () => {
      const { container } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={5}
          onAction={vi.fn()}
          showProgress
        />
      );
      const progressBar = container.querySelector('.progressBar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: '50%' });
    });
  });

  describe('States', () => {
    it('applies active state class', () => {
      const { container } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={8}
          onAction={vi.fn()}
        />
      );
      expect(container.querySelector('.state-active')).toBeInTheDocument();
    });

    it('applies warning state class when below threshold', () => {
      const { container } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={4}
          warningThreshold={5}
          onAction={vi.fn()}
        />
      );
      expect(container.querySelector('.state-warning')).toBeInTheDocument();
    });

    it('applies critical state class when below threshold', () => {
      const { container } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={1}
          criticalThreshold={2}
          onAction={vi.fn()}
        />
      );
      expect(container.querySelector('.state-critical')).toBeInTheDocument();
    });

    it('applies winning class when winning tile', () => {
      const { container } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Mahjong']}
          duration={10}
          remaining={10}
          isWinningTile
          onAction={vi.fn()}
        />
      );
      expect(container.querySelector('.winning')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('calls onAction when button clicked', () => {
      const onAction = vi.fn();
      const { getByText } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={10}
          onAction={onAction}
        />
      );

      fireEvent.click(getByText('PUNG'));
      expect(onAction).toHaveBeenCalledWith('Pung');
    });

    it('calls onAction with Pass when pass clicked', () => {
      const onAction = vi.fn();
      const { getByText } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={10}
          onAction={onAction}
        />
      );

      fireEvent.click(getByText('PASS'));
      expect(onAction).toHaveBeenCalledWith('Pass');
    });

    it('calls onExpire when timer reaches 0', () => {
      const onExpire = vi.fn();
      const { rerender } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={1}
          onAction={vi.fn()}
          onExpire={onExpire}
        />
      );

      rerender(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={0}
          onAction={vi.fn()}
          onExpire={onExpire}
        />
      );

      expect(onExpire).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has correct dialog role', () => {
      const { container } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={10}
          onAction={vi.fn()}
        />
      );
      expect(container.querySelector('[role="dialog"]')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      const { container } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={10}
          onAction={vi.fn()}
        />
      );
      expect(container.querySelector('[aria-modal="true"]')).toBeInTheDocument();
    });

    it('passes axe accessibility tests', async () => {
      const { container } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Mahjong', 'Pung']}
          duration={10}
          remaining={10}
          onAction={vi.fn()}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Sizes', () => {
    it('applies standard size class', () => {
      const { container } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={10}
          size="standard"
          onAction={vi.fn()}
        />
      );
      expect(container.querySelector('.size-standard')).toBeInTheDocument();
    });

    it('applies compact size class', () => {
      const { container } = render(
        <CallIndicator
          discardedTile={createTile('5C')}
          availableActions={['Pung']}
          duration={10}
          remaining={10}
          size="compact"
          onAction={vi.fn()}
        />
      );
      expect(container.querySelector('.size-compact')).toBeInTheDocument();
    });
  });
});
```

### Integration Tests

```typescript
describe('CallIndicator Integration', () => {
  it('updates timer in real-time', async () => {
    vi.useFakeTimers();

    const { getByText, rerender } = render(
      <CallIndicator
        discardedTile={createTile('5C')}
        availableActions={['Pung']}
        duration={10}
        remaining={10}
        onAction={vi.fn()}
      />
    );

    expect(getByText('10s')).toBeInTheDocument();

    // Simulate 1 second passing
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    rerender(
      <CallIndicator
        discardedTile={createTile('5C')}
        availableActions={['Pung']}
        duration={10}
        remaining={9}
        onAction={vi.fn()}
      />
    );

    expect(getByText('9s')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('syncs with game state', () => {
    const { rerender } = render(
      <GameStateProvider>
        <GamePlayArea />
      </GameStateProvider>
    );

    // Initially no call window
    expect(screen.queryByText('CALL WINDOW')).not.toBeInTheDocument();

    // Simulate call window opening
    act(() => {
      updateGameState({
        turnStage: {
          CallWindow: {
            discarded_tile: createTile('5C'),
            available_actions: ['Pung'],
            duration: 10,
            remaining: 10,
          },
        },
      });
    });

    rerender(
      <GameStateProvider>
        <GamePlayArea />
      </GameStateProvider>
    );

    expect(screen.getByText('CALL WINDOW')).toBeInTheDocument();
  });
});
```

### Visual Regression Tests

```typescript
describe('CallIndicator Visual Regression', () => {
  it('matches snapshot for active state', () => {
    const { container } = render(
      <CallIndicator
        discardedTile={createTile('5C')}
        availableActions={['Mahjong', 'Pung']}
        duration={10}
        remaining={10}
        onAction={vi.fn()}
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for warning state', () => {
    const { container } = render(
      <CallIndicator
        discardedTile={createTile('5C')}
        availableActions={['Pung']}
        duration={10}
        remaining={4}
        warningThreshold={5}
        onAction={vi.fn()}
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for critical state', () => {
    const { container } = render(
      <CallIndicator
        discardedTile={createTile('5C')}
        availableActions={['Pung']}
        duration={10}
        remaining={1}
        criticalThreshold={2}
        onAction={vi.fn()}
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for winning tile', () => {
    const { container } = render(
      <CallIndicator
        discardedTile={createTile('5C')}
        availableActions={['Mahjong']}
        duration={10}
        remaining={10}
        isWinningTile
        onAction={vi.fn()}
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for compact size', () => {
    const { container } = render(
      <CallIndicator
        discardedTile={createTile('5C')}
        availableActions={['Pung']}
        duration={10}
        remaining={10}
        size="compact"
        onAction={vi.fn()}
      />
    );
    expect(container).toMatchSnapshot();
  });
});
```

## Performance Considerations

### Optimization Strategies

```typescript
// 1. Memoize computed values
const windowState = useMemo<CallWindowState>(() => {
  if (remaining <= criticalThreshold) return 'critical';
  if (remaining <= warningThreshold) return 'warning';
  return 'active';
}, [remaining, warningThreshold, criticalThreshold]);

// 2. Use React.memo with custom comparison
export const CallIndicator = memo<CallIndicatorProps>(
  (props) => {
    // ... component
  },
  (prevProps, nextProps) => {
    return (
      prevProps.remaining === nextProps.remaining &&
      prevProps.availableActions === nextProps.availableActions
    );
  }
);

// 3. Throttle timer updates (only update on second changes)
const displaySeconds = Math.ceil(remaining);

// 4. Debounce sound alerts
const debouncedPlaySound = useMemo(
  () => debounce(playAlertSound, 500),
  []
);

// 5. GPU-accelerated animations
.container.state-critical {
  animation: pulseCritical 0.8s ease-in-out infinite;
  will-change: box-shadow;
}
```

### Performance Metrics

- **Target**: 60 FPS during animations
- **Render time**: <8ms per update
- **Memory**: <500KB
- **Sound latency**: <50ms

## Constants

```typescript
// CallIndicatorConstants.ts
export const CALL_INDICATOR_CONSTANTS = {
  DEFAULT_WARNING_THRESHOLD: 5, // seconds
  DEFAULT_CRITICAL_THRESHOLD: 2, // seconds

  ACTION_LABELS: {
    Mahjong: 'MAHJONG',
    Pung: 'PUNG',
    Kong: 'KONG',
    Quint: 'QUINT',
    Pass: 'PASS',
  } as const,

  ACTION_DESCRIPTIONS: {
    Mahjong: '✓ Win!',
    Pung: '3 tiles',
    Kong: '4 tiles',
    Quint: '5 tiles',
    Pass: 'Skip',
  } as const,

  ACTION_ICONS: {
    Mahjong: '🎉',
    Pung: '▣',
    Kong: '▣▣',
    Quint: '▣▣▣',
    Pass: '⊘',
  } as const,

  SOUND_FREQUENCIES: {
    warning: 600, // Hz
    critical: 900, // Hz
  } as const,

  SOUND_DURATION: 150, // ms
  SOUND_GAIN: 0.2, // 20% volume
} as const;
```

## Error Handling

```typescript
// Error boundary for call indicator
export const CallIndicatorErrorBoundary: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <ErrorBoundary
      FallbackComponent={({ error, resetErrorBoundary }) => (
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorMessage}>Call window error</p>
          <button onClick={resetErrorBoundary} className={styles.retryButton}>
            Pass
          </button>
        </div>
      )}
      onError={(error, errorInfo) => {
        console.error('CallIndicator error:', error, errorInfo);
        logErrorToService(error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```

## Future Enhancements

1. **Hotkey Configuration**: Customizable keyboard shortcuts
2. **Auto-Call Options**: Auto-pass or auto-mahjong based on preferences
3. **Call History**: Show recent calls made
4. **Call Probability**: Show estimated win probability for Mahjong calls
5. **Tile Preview**: Show how meld would look with called tile
6. **Animation Effects**: Tile fly-in animation when called
7. **Sound Themes**: Different sound effects (classic, modern, silent)
8. **Accessibility Modes**: High contrast, large text options
9. **Call Analytics**: Track call success rates
10. **Tutorial Mode**: Explain each call option interactively

## Notes

- **Server Authoritative**: All call validation happens server-side
- **Call Priority**: Mahjong > Meld (seat order) > Pass
- **Timer Sync**: Server manages timer, client receives updates
- **Auto-Pass**: Automatically passes when timer expires
- **Sound Alerts**: Optional, can be disabled in settings
- **Mobile**: Compact mode recommended for small screens
- **Accessibility**: Full ARIA support, keyboard navigation
- **Performance**: Animations GPU-accelerated for 60 FPS

---

**Related Components**:

- [Tile](./Tile.md): Discarded tile rendering
- [ExposedMelds](./ExposedMelds.md): Display melds after call
- [ActionBar](./ActionBar.md): Alternative action selection
- [CharlestonTimer](./CharlestonTimer.md): Similar timer component

**Backend Integration**:

- `CallWindow` turn stage from Rust bindings
- `DeclareCallIntent` command when action selected
- `Pass` command when passing
- `CallWindowOpened` event when window starts
- `CallWindowClosed` event when window ends
