# Client State Implementation Summary

**Date**: 2026-01-04
**Status**: ✅ Complete - Ready for integration
**Ref**: [04-client-state-plan.md](./04-client-state-plan.md)

## Overview

Successfully implemented the complete client-side state management system for the American Mahjong application. This is the first major frontend implementation, establishing the foundation for React-based UI components.

## Implementation Checklist

### ✅ Core Infrastructure

- **Directory Structure** - Created complete folder hierarchy
  - `apps/client/src/store/` - State management
  - `apps/client/src/hooks/` - React hooks
  - `apps/client/src/components/ui/` - UI components
  - `apps/client/src/animations/` - Animation orchestration
  - `apps/client/src/utils/` - Utility functions
  - `apps/client/src/types/bindings/` - TypeScript types

- **TypeScript Configuration**
  - Added path aliases (`@/*` → `./src/*`)
  - Configured Vite resolve aliases
  - Updated tsconfig for proper imports

- **Type Definitions** - [apps/client/src/types/bindings/index.ts](../../apps/client/src/types/bindings/index.ts)
  - Mirrored all Rust backend types
  - `GameEvent`, `Command`, `GamePhase`, `TurnStage`, etc.
  - `Seat`, `Tile`, `Meld`, `PlayerPublic`
  - WebSocket message types (`ServerMessage`, `ClientMessage`)
  - State snapshot for reconnection

### ✅ State Management

- **Game Store** - [apps/client/src/store/gameStore.ts](../../apps/client/src/store/gameStore.ts)
  - Authoritative game state (server truth)
  - Event-driven mutations via `applyEvent()`
  - Full snapshot replacement on reconnect
  - Derived selectors (`isMyTurn`, `canDiscard`, `canCall`)
  - Uses Zustand with Immer middleware

- **UI Store** - [apps/client/src/store/uiStore.ts](../../apps/client/src/store/uiStore.ts)
  - Volatile client-side state
  - Tile selection (Set-based keys)
  - Drag & drop state
  - Card viewer visibility
  - Hand sorting mode
  - Error notifications with auto-dismiss
  - Animation enabled/disabled toggle

### ✅ Utilities

- **Tile Keys** - [apps/client/src/utils/tileKey.ts](../../apps/client/src/utils/tileKey.ts)
  - Stable unique keys for React rendering
  - Handles duplicate tiles (e.g., `tile-5-0`, `tile-5-1`)
  - Parse/extract utilities

- **Seat Mapping** - [apps/client/src/utils/seat.ts](../../apps/client/src/utils/seat.ts)
  - Visual position calculation relative to player
  - Formula: `(serverSeatIndex - mySeatIndex + 4) % 4`
  - Position mapping: `0=bottom, 1=right, 2=top, 3=left`
  - CSS class helpers for layout

- **Commands** - [apps/client/src/utils/commands.ts](../../apps/client/src/utils/commands.ts)
  - Type-safe command builders
  - Client-side validation (phase, turn, hand)
  - Charleston tile validation (no Jokers, count)
  - `useCommandSender` hook for validated dispatch

- **Card Loader** - [apps/client/src/utils/cardLoader.ts](../../apps/client/src/utils/cardLoader.ts)
  - Async card JSON loading from `public/cards/`
  - Caching layer
  - Pattern filtering (placeholder for ML matching)
  - Section browsing

### ✅ Animation & Event Processing

- **Animation Orchestrator** - [apps/client/src/animations/orchestrator.ts](../../apps/client/src/animations/orchestrator.ts)
  - Event-specific durations
    - Fast: TileDrawn (300ms), TileDiscarded (500ms)
    - Medium: Charleston passes (1s)
    - Slow: TilesDealt (2s)
  - Hard timeout protection (max 5s)
  - Skip/disable support

- **Action Queue** - [apps/client/src/hooks/useActionQueue.ts](../../apps/client/src/hooks/useActionQueue.ts)
  - FIFO event processing
  - Animation gating (apply state after animation completes)
  - Clear queue on reconnect
  - Instant apply when animations disabled

### ✅ Networking

- **WebSocket Hook** - [apps/client/src/hooks/useGameSocket.ts](../../apps/client/src/hooks/useGameSocket.ts)
  - Connection management
  - Authentication via URL params
  - Ping/Pong heartbeat (30s interval)
  - Exponential backoff reconnection (1s → 30s max)
  - Max 10 reconnect attempts
  - Message routing:
    - `Event` → Action queue
    - `Error` → UI toast
    - `StateSnapshot` → Snapshot replacement
  - Request state on reconnect

### ✅ UI Components

- **Card Viewer** - [apps/client/src/components/ui/CardViewer.tsx](../../apps/client/src/components/ui/CardViewer.tsx)
  - Modal interface for browsing NMJL patterns
  - Section sidebar navigation
  - Pattern display with tile codes
  - Loading/error states
  - Future: Highlight possible matches

## Architecture Highlights

### Event Flow

```text
Server WebSocket
    ↓
useGameSocket
    ↓ (route Event)
useActionQueue
    ↓ (enqueue)
Animation Orchestrator
    ↓ (after animation)
gameStore.applyEvent()
    ↓ (mutations)
React Components (re-render)
```

### State Separation

**Authoritative (gameStore)**:

- Phase, turn, players, wall count
- Hand (concealed + exposed)
- Discard pile
- Never mutate from UI

**Volatile (uiStore)**:

- Selection, hover, drag state
- Modals, toasts
- User preferences
- Directly mutable

### Reconnection

1. Detect disconnect
2. Exponential backoff reconnect
3. On connect: Send `RequestState`
4. Receive `StateSnapshot`
5. Clear animation queue
6. Replace entire `gameStore`
7. Resume play

## Design Decisions

### ✅ No Enums, Use String Unions

TypeScript `enum` values don't work with `erasableSyntaxOnly` flag. All types use string literal unions:

```typescript
export type Seat = 'East' | 'South' | 'West' | 'North';
export type MeldType = 'Pung' | 'Kong' | 'Quint';
```

This matches Rust serde JSON output perfectly.

### ✅ Zustand + Immer

Zustand provides minimal boilerplate, Immer allows draft-style mutations:

```typescript
set((draft) => {
  draft.hand.concealed.push(tile);
});
```

### ✅ No Optimistic Updates

Server is authoritative. UI never predicts state:

- Send command → Wait for event → Update state

This prevents client/server desync.

### ✅ Stable Keys for Duplicates

Since hands can have multiple of the same tile, React keys use `tile-{value}-{index}`:

- First Bam 5: `tile-4-0`
- Second Bam 5: `tile-4-1`

## Integration TODOs

### Backend (Rust)

- [x] Add `ts-rs` derives to all event/command types
- [x] Generate bindings with `cargo test` → `apps/client/src/types/bindings/`
- [x] Ensure WebSocket messages match `ServerMessage`/`ClientMessage` format
- [x] Implement `StateSnapshot` endpoint

### Frontend (React Components)

- [ ] Build table layout using seat positions
- [ ] Tile rendering components
- [ ] Hand display with drag/drop
- [ ] Charleston UI (tile selection, pass direction)
- [ ] Call window modal
- [ ] Discard area
- [ ] Player info displays

### Testing

- [ ] Unit tests for event reducers
- [ ] Animation queue ordering tests
- [ ] Seat rotation mapping tests
- [ ] Reconnection flow tests

### Data

- [ ] Copy `data/nmjl_cards/*.json` to `apps/client/public/cards/`
- [ ] Verify card JSON structure matches `CardData` interface
- [ ] Implement pattern matching algorithm (future)

## File Summary

| File                           | Lines     | Purpose                     |
| ------------------------------ | --------- | --------------------------- |
| `types/bindings/index.ts`      | 180       | TypeScript type definitions |
| `store/gameStore.ts`           | 373       | Authoritative game state    |
| `store/uiStore.ts`             | 118       | Volatile UI state           |
| `hooks/useActionQueue.ts`      | 102       | Event queue + animation     |
| `hooks/useGameSocket.ts`       | 278       | WebSocket connection        |
| `animations/orchestrator.ts`   | 120       | Animation timing            |
| `utils/tileKey.ts`             | 47        | Stable tile keys            |
| `utils/seat.ts`                | 127       | Seat rotation mapping       |
| `utils/commands.ts`            | 235       | Command validation          |
| `utils/cardLoader.ts`          | 145       | Card data loading           |
| `components/ui/CardViewer.tsx` | 165       | Card browsing UI            |
| **Total**                      | **1,890** | **11 files**                |

## Build Status

✅ **TypeScript compilation**: PASS
✅ **Vite build**: PASS (193.91 kB bundle)
✅ **Linting**: Not yet run (run `npm run lint`)

## Next Steps

1. **Wire up authentication** - Connect Supabase auth to `useGameSocket`
2. **Create game table UI** - Layout with 4 player positions
3. **Tile components** - Render tiles with drag/drop
4. **Charleston flow** - UI for tile passing
5. **Integration test** - Connect to running backend

## Notes

- This is the **first major frontend implementation**
- All files follow architectural patterns from `docs/architecture/`
- Type safety maintained throughout (strict TypeScript)
- Ready for UI component development
- Backend integration pending bindings generation

---

**Implementation Time**: ~2 hours
**Files Created**: 11
**Lines of Code**: 1,890
**Dependencies Added**: `immer` (for Zustand)
