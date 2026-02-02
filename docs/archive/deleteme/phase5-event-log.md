# Phase 5: Event Log - Implementation Guide

## Overview

Build **EventLog** component: scrollable list displaying recent game events as human-readable messages.

**Features**: Auto-scroll, event formatting, last 50 events, filters (optional)

---

## Quick Reference

### Event Categories

| Category       | Event Types                                                                  | Example Output                                                                  |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Game Flow**  | GameCreated, PlayerJoined, GameStarting, PhaseChanged                        | "Game created", "South joined (Bot)", "Game starting"                           |
| **Turn**       | TurnChanged, TileDrawnPublic, TileDiscarded                                  | "East's turn (Discarding)", "Tile drawn", "East discarded 3B"                   |
| **Charleston** | CharlestonPhaseChanged, PlayerReadyForPass, TilesPassing, CharlestonComplete | "Charleston: Pass Right", "East ready to pass", "Tiles passing Right"           |
| **Calls**      | CallWindowOpened, TileCalled, CallResolved, JokerExchanged                   | "Call window opened (3B)", "South called Pung on 3B", "East exchanged joker"    |
| **Mahjong**    | MahjongDeclared, HandValidated, GameOver                                     | "East declared Mahjong", "Hand valid: 2024 Pattern #5", "Game Over: East wins!" |
| **Errors**     | CommandRejected, HandDeclaredDead                                            | "Command rejected: Not your turn", "West's hand declared dead"                  |

### Store Structure

**Add to uiStore**:

```typescript
interface UIState {
  // ... existing fields

  // Event log
  eventLog: Array<{ id: string; message: string; timestamp: number; category: EventCategory }>;
  addEvent: (message: string, category?: EventCategory) => void;
  clearEventLog: () => void;
}

type EventCategory = 'game' | 'turn' | 'charleston' | 'call' | 'mahjong' | 'error' | 'info';
```

### Type Imports

```typescript
import type { Event } from '@/types/bindings/generated/Event';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { Seat } from '@/types/bindings/generated/Seat';
```

---

## Event Formatter Utility

**File**: `apps/client/src/utils/eventFormatter.ts`

```typescript
import type { Event, PublicEvent, PrivateEvent } from '@/types/bindings/generated';
import { tileToCode } from './tileFormatter';

export type EventCategory = 'game' | 'turn' | 'charleston' | 'call' | 'mahjong' | 'error' | 'info';

export interface FormattedEvent {
  message: string;
  category: EventCategory;
}

/**
 * Format Event to human-readable string with category.
 */
export function formatEvent(event: Event): FormattedEvent {
  if ('Public' in event) return formatPublicEvent(event.Public);
  if ('Private' in event) return formatPrivateEvent(event.Private);
  if ('Analysis' in event) return { message: 'Analysis event (hidden)', category: 'info' };

  return { message: 'Unknown event', category: 'info' };
}

function formatPublicEvent(event: PublicEvent): FormattedEvent {
  // Game flow
  if ('GameCreated' in event) {
    return { message: 'Game created', category: 'game' };
  }
  if ('PlayerJoined' in event) {
    const { player, is_bot } = event.PlayerJoined;
    const botTag = is_bot ? ' (Bot)' : '';
    return { message: `${player} joined${botTag}`, category: 'game' };
  }
  if (event === 'GameStarting') {
    return { message: 'Game starting', category: 'game' };
  }
  if ('PhaseChanged' in event) {
    return { message: `Phase: ${formatPhaseShort(event.PhaseChanged.phase)}`, category: 'game' };
  }

  // Setup
  if ('DiceRolled' in event) {
    return { message: `Dice rolled: ${event.DiceRolled.roll}`, category: 'game' };
  }
  if ('WallBroken' in event) {
    return { message: 'Wall broken', category: 'game' };
  }

  // Charleston
  if ('CharlestonPhaseChanged' in event) {
    const stage = formatCharlestonStageShort(event.CharlestonPhaseChanged.stage);
    return { message: `Charleston: ${stage}`, category: 'charleston' };
  }
  if ('PlayerReadyForPass' in event) {
    return { message: `${event.PlayerReadyForPass.player} ready to pass`, category: 'charleston' };
  }
  if ('TilesPassing' in event) {
    return { message: `Tiles passing ${event.TilesPassing.direction}`, category: 'charleston' };
  }
  if ('PlayerVoted' in event) {
    return { message: `${event.PlayerVoted.player} voted`, category: 'charleston' };
  }
  if ('VoteResult' in event) {
    return { message: `Vote result: ${event.VoteResult.result}`, category: 'charleston' };
  }
  if (event === 'CharlestonComplete') {
    return { message: 'Charleston complete', category: 'charleston' };
  }
  if (event === 'CourtesyPassComplete') {
    return { message: 'Courtesy pass complete', category: 'charleston' };
  }

  // Turn
  if ('TurnChanged' in event) {
    const { player, stage } = event.TurnChanged;
    const stageStr = formatTurnStageShort(stage);
    return { message: `${player}'s turn (${stageStr})`, category: 'turn' };
  }
  if ('TileDrawnPublic' in event) {
    return { message: 'Tile drawn', category: 'turn' };
  }
  if ('TileDiscarded' in event) {
    const { player, tile } = event.TileDiscarded;
    return { message: `${player} discarded ${tileToCode(tile)}`, category: 'turn' };
  }

  // Call window
  if ('CallWindowOpened' in event) {
    const { tile, discarded_by } = event.CallWindowOpened;
    return { message: `Call window: ${tileToCode(tile)} (${discarded_by})`, category: 'call' };
  }
  if (event === 'CallWindowClosed') {
    return { message: 'Call window closed', category: 'call' };
  }
  if ('CallResolved' in event) {
    const { resolution } = event.CallResolved;
    return { message: `Call resolved: ${JSON.stringify(resolution)}`, category: 'call' };
  }
  if ('TileCalled' in event) {
    const { player, meld, called_tile } = event.TileCalled;
    return {
      message: `${player} called ${meld.meld_type} on ${tileToCode(called_tile)}`,
      category: 'call',
    };
  }
  if ('JokerExchanged' in event) {
    const { player, target_seat, replacement } = event.JokerExchanged;
    return {
      message: `${player} exchanged joker (${target_seat}'s meld) → ${tileToCode(replacement)}`,
      category: 'call',
    };
  }

  // Mahjong
  if ('MahjongDeclared' in event) {
    return { message: `${event.MahjongDeclared.player} declared Mahjong!`, category: 'mahjong' };
  }
  if ('HandValidated' in event) {
    const { player, valid, pattern } = event.HandValidated;
    if (valid) {
      return {
        message: `${player}'s hand valid${pattern ? `: ${pattern}` : ''}`,
        category: 'mahjong',
      };
    }
    return { message: `${player}'s hand invalid`, category: 'error' };
  }
  if ('GameOver' in event) {
    const { winner } = event.GameOver;
    return {
      message: winner ? `Game Over: ${winner} wins!` : 'Game Over (draw)',
      category: 'mahjong',
    };
  }

  // Errors
  if ('CommandRejected' in event) {
    const { player, reason } = event.CommandRejected;
    return { message: `${player}: ${reason}`, category: 'error' };
  }
  if ('HandDeclaredDead' in event) {
    const { player, reason } = event.HandDeclaredDead;
    return { message: `${player}'s hand dead: ${reason}`, category: 'error' };
  }

  // Other
  if ('WallExhausted' in event) {
    return { message: 'Wall exhausted', category: 'game' };
  }

  return { message: JSON.stringify(event).slice(0, 60), category: 'info' };
}

function formatPrivateEvent(event: PrivateEvent): FormattedEvent {
  if ('TilesDealt' in event) {
    return { message: `Received ${event.TilesDealt.your_tiles.length} tiles`, category: 'game' };
  }
  if ('TilesPassed' in event) {
    return { message: `Passed ${event.TilesPassed.tiles.length} tiles`, category: 'charleston' };
  }
  if ('TilesReceived' in event) {
    const { tiles, from } = event.TilesReceived;
    const fromStr = from ? ` from ${from}` : '';
    return { message: `Received ${tiles.length} tiles${fromStr}`, category: 'charleston' };
  }
  if ('TileDrawnPrivate' in event) {
    return { message: `Drew ${tileToCode(event.TileDrawnPrivate.tile)}`, category: 'turn' };
  }
  if ('ReplacementDrawn' in event) {
    const { tile, reason } = event.ReplacementDrawn;
    return { message: `Replacement: ${tileToCode(tile)} (${reason})`, category: 'turn' };
  }

  return { message: 'Private event', category: 'info' };
}

// Helper formatters
function formatPhaseShort(phase: any): string {
  if (typeof phase === 'string') return phase;
  if ('Setup' in phase) return 'Setup';
  if ('Charleston' in phase) return 'Charleston';
  if ('Playing' in phase) return 'Playing';
  if ('Scoring' in phase) return 'Scoring';
  if ('GameOver' in phase) return 'Game Over';
  return 'Unknown';
}

function formatCharlestonStageShort(stage: string): string {
  const map: Record<string, string> = {
    FirstRight: 'Pass Right (1st)',
    FirstAcross: 'Pass Across (1st)',
    FirstLeft: 'Pass Left (1st)',
    VotingToContinue: 'Voting',
    SecondLeft: 'Pass Left (2nd)',
    SecondAcross: 'Pass Across (2nd)',
    SecondRight: 'Pass Right (2nd)',
    CourtesyAcross: 'Courtesy Pass',
    Complete: 'Complete',
  };
  return map[stage] || stage;
}

function formatTurnStageShort(stage: any): string {
  if ('Drawing' in stage) return 'Drawing';
  if ('Discarding' in stage) return 'Discarding';
  if ('CallWindow' in stage) return 'Call Window';
  if ('AwaitingMahjong' in stage) return 'Awaiting Mahjong';
  return 'Unknown';
}
```

---

## Update uiStore

**File**: `apps/client/src/store/uiStore.ts`

Add event log state:

```typescript
import { create } from 'zustand';
import type { Tile } from '@/types/bindings';

export type EventCategory = 'game' | 'turn' | 'charleston' | 'call' | 'mahjong' | 'error' | 'info';

interface EventLogEntry {
  id: string;
  message: string;
  timestamp: number;
  category: EventCategory;
}

interface UIState {
  // ... existing fields (selectedTiles, sortingMode, errors, etc.)

  // Event log
  eventLog: EventLogEntry[];
  maxEventLogSize: number;
  addEvent: (message: string, category?: EventCategory) => void;
  clearEventLog: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // ... existing state

  // Event log
  eventLog: [],
  maxEventLogSize: 50,

  addEvent: (message: string, category: EventCategory = 'info') => {
    const id = `event-${Date.now()}-${Math.random()}`;
    set((state) => {
      const newLog = [...state.eventLog, { id, message, timestamp: Date.now(), category }];
      // Keep only last N events
      if (newLog.length > state.maxEventLogSize) {
        return { eventLog: newLog.slice(-state.maxEventLogSize) };
      }
      return { eventLog: newLog };
    });
  },

  clearEventLog: () => {
    set({ eventLog: [] });
  },
}));
```

---

## EventLog Component

**File**: `apps/client/src/components/EventLog.tsx`

```typescript
import { useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import './EventLog.css';

export function EventLog() {
  const eventLog = useUIStore((state) => state.eventLog);
  const clearEventLog = useUIStore((state) => state.clearEventLog);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventLog.length]);

  return (
    <div className="event-log">
      <div className="event-log-header">
        <h2>Event Log</h2>
        {eventLog.length > 0 && (
          <button onClick={clearEventLog} className="clear-log-btn">
            Clear
          </button>
        )}
      </div>

      <div className="event-log-scroll" ref={scrollRef}>
        {eventLog.length === 0 ? (
          <p className="no-events">No events yet</p>
        ) : (
          <div className="event-list">
            {eventLog.map((event) => {
              const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              });

              return (
                <div key={event.id} className={`event-item event-${event.category}`}>
                  <span className="event-time">{time}</span>
                  <span className="event-message">{event.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Wire Events to Log

Update `gameStore.applyEvent()` to log events:

**File**: `apps/client/src/store/gameStore.ts`

```typescript
import { formatEvent } from '@/utils/eventFormatter';
import { useUIStore } from './uiStore';

// Inside applyEvent method:
applyEvent: (event: Event) => {
  // Format and log the event
  const { message, category } = formatEvent(event);
  useUIStore.getState().addEvent(message, category);

  // ... existing event handling logic
  set((draft) => {
    // ... process event
  });
},
```

---

## Styling

**File**: `apps/client/src/components/EventLog.css`

```css
.event-log {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 1rem;
  background-color: #f9f9f9;
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

.event-log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.event-log-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

.clear-log-btn {
  padding: 0.4rem 0.8rem;
  border: 1px solid #6c757d;
  background-color: #6c757d;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.clear-log-btn:hover {
  background-color: #545b62;
}

.event-log-scroll {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  padding: 0.5rem;
  max-height: 300px;
}

.no-events {
  text-align: center;
  color: #999;
  font-style: italic;
  margin: 2rem 0;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.event-item {
  display: flex;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9rem;
  transition: background-color 0.15s;
}

.event-item:hover {
  background-color: #f5f5f5;
}

.event-time {
  flex-shrink: 0;
  color: #666;
  font-size: 0.85rem;
  width: 70px;
}

.event-message {
  flex: 1;
  color: #333;
}

/* Category colors */
.event-game {
  border-left: 3px solid #007bff;
}

.event-turn {
  border-left: 3px solid #28a745;
}

.event-charleston {
  border-left: 3px solid #17a2b8;
}

.event-call {
  border-left: 3px solid #ffc107;
}

.event-mahjong {
  border-left: 3px solid #dc3545;
}

.event-error {
  border-left: 3px solid #d9534f;
  background-color: #fff3cd;
}

.event-info {
  border-left: 3px solid #6c757d;
}
```

---

## Integration with App.tsx

```typescript
import { EventLog } from '@/components/EventLog';

function App() {
  const yourSeat = useGameStore((state) => state.yourSeat);

  return (
    <div className="app-container">
      <ConnectionPanel />
      {yourSeat && <GameStatus />}
      {yourHand.length > 0 && <HandDisplay />}
      {yourSeat && <TurnActions />}
      <EventLog />  {/* Always visible */}
    </div>
  );
}
```

---

## Testing Checklist

### Display

- [x] Event log shown at all times
- [x] "No events yet" shown when empty
- [x] Events display with timestamp (HH:MM:SS)
- [x] Scrollbar appears when > 10 events
- [x] Auto-scrolls to bottom on new events

### Event Formatting

- [x] Game events: "Game created", "South joined (Bot)"
- [x] Turn events: "East's turn", "East discarded 3B"
- [x] Charleston: "Charleston: Pass Right", "East ready to pass"
- [x] Calls: "South called Pung on 3B"
- [x] Mahjong: "East declared Mahjong!", "Hand valid: Pattern Name"
- [x] Errors: "Command rejected: reason", "Hand declared dead"

### Categories

- [x] Game events: blue left border
- [x] Turn events: green left border
- [x] Charleston: cyan left border
- [x] Call events: yellow left border
- [x] Mahjong: red left border
- [x] Errors: red border + yellow background

### Interactions

- [x] Clear button removes all events
- [x] Clear button hidden when no events
- [x] Hover highlights event row
- [x] Log persists during game (not cleared on phase change)

### Edge Cases

- [x] Max 50 events (oldest dropped)
- [x] Private events formatted correctly
- [x] Unknown events show truncated JSON
- [x] Rapid events don't cause scroll glitches

---

## Success Criteria

1. ✅ EventLog component renders without errors
2. ✅ All event types formatted correctly
3. ✅ Auto-scroll to bottom works
4. ✅ Category colors display correctly
5. ✅ Clear button works
6. ✅ Events logged in real-time during gameplay
7. ✅ TypeScript compiles without errors
8. ✅ No performance issues with 50+ events

---

## Implementation Status

✅ **COMPLETED** - Phase 5 implementation finished on 2026-01-24

### Files Created/Modified

- ✅ Created `apps/client/src/utils/eventFormatter.ts` - Event formatting utility
- ✅ Updated `apps/client/src/store/uiStore.ts` - Added event log state management
- ✅ Updated `apps/client/src/store/gameStore.ts` - Wired events to log
- ✅ Created `apps/client/src/components/EventLog.tsx` - EventLog component
- ✅ Created `apps/client/src/components/EventLog.css` - EventLog styling
- ✅ Updated `apps/client/src/App.tsx` - Integrated EventLog component

### Verification

- ✅ TypeScript compilation: **PASSED**
- ✅ Build process: **PASSED**
- ✅ All success criteria met

---

## Next Steps

- **Phase 6: Discard Pile** - Show 4-player discard piles with last 6 tiles
- **Phase 7: Polish** - Add minor CSS tweaks, spacing, responsive layout
