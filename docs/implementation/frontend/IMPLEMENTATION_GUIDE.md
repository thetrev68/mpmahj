# Frontend Implementation Guide

**Purpose**: This guide ensures implementations align with the backend. Follow it strictly to avoid hallucinating event shapes or command structures.

---

## Golden Rule

**The TypeScript bindings are the source of truth.**

Before implementing ANY feature, read the auto-generated TypeScript bindings at:

```
apps/client/src/types/bindings/generated/
```

These files are generated directly from Rust using `ts-rs` and are 100% accurate.

---

## Implementation Checklist

### Before Writing Any Code

1. **Read the user story** in `docs/implementation/frontend/user-stories/US-XXX-*.md`
2. **Read the relevant bindings**:
   - `GameCommand.ts` - Commands you can send to the server
   - `PublicEvent.ts` - Events broadcast to all players
   - `PrivateEvent.ts` - Events sent only to specific players
   - `AnalysisEvent.ts` - AI hints and hand analysis
3. **Verify event shapes** in the user story's "Technical Details" section match the bindings
4. **If they don't match, trust the bindings** - the documentation may be outdated

### When Writing Tests

1. **Copy event shapes from bindings**, not from documentation
2. **Test scenarios should reference bindings** in their Prerequisites section
3. **Use the mock WebSocket helpers** that match actual backend message structure

### When Implementing Components

1. **Import types from `@/types/bindings`**, not custom interfaces
2. **Don't invent fields** - if a field isn't in the bindings, it doesn't exist
3. **Handle all event variants** shown in the bindings

---

## Quick Reference: Common Commands

### Setup Phase

```typescript
// Only East can roll dice
{
  RollDice: {
    player: 'East';
  }
} // Seat type
```

### Charleston Phase

```typescript
// Pass 3 tiles (standard pass)
{
  PassTiles: {
    player: "East",          // Your seat
    tiles: [0, 15, 33],      // Array of Tile (number 0-36)
    blind_pass_count: null   // null for standard, 1-3 for blind pass
  }
}

// Vote to continue/stop Charleston
{
  VoteCharleston: {
    player: "East",
    vote: "Continue"  // or "Stop"
  }
}
```

### Main Game Phase

```typescript
// Draw a tile
{ DrawTile: { player: "East" } }

// Discard a tile
{ DiscardTile: { player: "East", tile: 15 } }

// Declare intent to call during call window
{
  DeclareCallIntent: {
    player: "South",
    intent: "Meld"  // or "Mahjong"
  }
}

// Pass on calling
{ Pass: { player: "South" } }
```

---

## Quick Reference: Common Events

### Setup Events (Public)

```typescript
{
  DiceRolled: {
    roll: 7;
  }
} // Just the sum (2-12)
{
  WallBroken: {
    position: 42;
  }
} // Index where wall breaks
```

### Setup Events (Private)

```typescript
{ TilesDealt: { your_tiles: [0, 1, 5, 9, ...] } }  // Your initial hand
```

### Charleston Events (Public)

```typescript
{
  CharlestonPhaseChanged: {
    stage: 'FirstRight';
  }
}
{
  CharlestonTimerStarted: {
    (stage, duration, started_at_ms, timer_mode);
  }
}
{
  PlayerReadyForPass: {
    player: 'East';
  }
}
{
  TilesPassing: {
    direction: 'Right';
  }
}
```

### Charleston Events (Private)

```typescript
{ TilesPassed: { player: "East", tiles: [0, 15, 33] } }
{ TilesReceived: { player: "East", tiles: [5, 22, 28], from: "West" } }
```

### Main Game Events (Public)

```typescript
{ TurnChanged: { player: "East", stage: "Drawing" } }
{ TileDrawnPublic: { remaining_tiles: 85 } }  // Tile hidden
{ TileDiscarded: { player: "East", tile: 15 } }
{ CallWindowOpened: { tile, discarded_by, can_call, timer, started_at_ms, timer_mode } }
{ CallWindowClosed }
```

### Main Game Events (Private)

```typescript
{ TileDrawnPrivate: { tile: 22, remaining_tiles: 85 } }  // Your drawn tile
```

---

## Common Mistakes to Avoid

### 1. Inventing Event Fields

**Wrong** (hallucinated):

```typescript
{ DiceRolled: { roller: "East", dice: [3, 4], total: 7 } }
```

**Correct** (from bindings):

```typescript
{
  DiceRolled: {
    roll: 7;
  }
}
```

### 2. Adding Stage to Commands

**Wrong** (hallucinated):

```typescript
{ PassTiles: { stage: "FirstRight", tiles: [...] } }
```

**Correct** (from bindings):

```typescript
{ PassTiles: { player: "East", tiles: [...], blind_pass_count: null } }
```

### 3. Inventing Events

**Wrong** (doesn't exist):

```typescript
{ HandsDealt: { dealer: "East", tiles_per_player: 13 } }
```

**Correct** (actual private event):

```typescript
{ TilesDealt: { your_tiles: [...] } }
```

### 4. Wrong Tile Type

**Wrong** (using strings):

```typescript
tiles: ['Bam1', 'Crak5', 'Dot9'];
```

**Correct** (Tile is number 0-36):

```typescript
tiles: [0, 13, 26]; // 1 Bam, 5 Crack, 9 Dot
```

---

## Tile Index Reference

The `Tile` type is a number from 0-36:

| Range | Tiles                          |
| ----- | ------------------------------ |
| 0-8   | Bams 1-9                       |
| 9-17  | Cracks 1-9                     |
| 18-26 | Dots 1-9                       |
| 27-30 | East, South, West, North Winds |
| 31-33 | Green, Red, White Dragons      |
| 34    | Flower                         |
| 35    | Joker                          |
| 36    | Blank                          |

Use `@/lib/utils/tileUtils.ts` for conversions:

```typescript
import { getTileName, isJoker, isFlower, TILE_INDICES } from '@/lib/utils/tileUtils';

getTileName(0); // "1 Bam"
getTileName(35); // "Joker"
isJoker(35); // true
TILE_INDICES.JOKER; // 35
```

---

## Testing Pattern

### Step 1: Setup with correct initial state

```typescript
const mockWs = createMockWebSocket();
const { result } = renderHook(() => useGameSocket());

// Simulate being in the right phase
mockWs.simulatePublicEvent({ CharlestonPhaseChanged: { stage: 'FirstRight' } });
```

### Step 2: Perform user action

```typescript
act(() => {
  result.current.sendCommand({
    PassTiles: { player: 'East', tiles: [0, 5, 10], blind_pass_count: null },
  });
});
```

### Step 3: Verify command sent

```typescript
expect(mockWs.lastSentCommand).toEqual({
  PassTiles: { player: 'East', tiles: [0, 5, 10], blind_pass_count: null },
});
```

### Step 4: Simulate server response

```typescript
mockWs.simulatePrivateEvent({ TilesPassed: { player: 'East', tiles: [0, 5, 10] } });
```

### Step 5: Assert UI state updated

```typescript
expect(screen.getByText(/Waiting for other players/)).toBeInTheDocument();
```

---

## Regenerating Bindings

If you suspect bindings are outdated, regenerate them:

```bash
cd crates/mahjong_core
cargo test export_bindings
```

This runs all `export_bindings_*` tests which write fresh TypeScript files.

---

## When Documentation Conflicts with Bindings

1. **Trust the bindings** - they're auto-generated from Rust
2. **Update the documentation** to match the bindings
3. **Never hallucinate fields** to make documentation work

---

## Getting Help

- **Backend types**: Run `cargo doc --open --no-deps` from repo root
- **Binding source**: Look at `#[derive(TS)]` types in `crates/mahjong_core/src/`
- **Architecture**: Read `docs/architecture/06-command-event-system-api-contract.md`

---

**Last Updated**: 2026-02-05
