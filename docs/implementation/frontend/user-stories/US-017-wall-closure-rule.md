# US-017: Wall Closure Rule

## Story

**As a** player
**I want** the system to prevent calling when the wall has 14 or fewer tiles (dead wall)
**So that** the game follows NMJL wall closure rules

## Acceptance Criteria

### AC-1: Wall Closure Threshold

**Given** the wall has more than 14 tiles remaining
**When** a tile is discarded
**Then** the call window opens normally (if callable)
**And** players can call for Pung/Kong/Mahjong

### AC-2: Wall Closed (14 or Fewer Tiles)

**Given** the wall has exactly 14 tiles remaining
**When** a tile is discarded
**Then** NO call window opens (even if tile is callable)
**And** a message appears: "Wall closed - cannot call (14 tiles remaining)"
**And** the turn advances to the next player immediately

### AC-3: Wall Closure Indicator

**Given** the wall has 15-20 tiles remaining
**When** the wall counter updates
**Then** a warning appears: "⚠️ Wall closing soon - X tiles remaining"
**And** the wall counter is highlighted (yellow/orange)

**Given** the wall has 14 or fewer tiles
**Then** the wall counter is highlighted (red)
**And** a "WALL CLOSED" badge appears

### AC-4: Mahjong Allowed During Closure

**Given** the wall is closed (14 or fewer tiles)
**When** a player can declare Mahjong on self-draw
**Then** they can still declare Mahjong
**Note:** Wall closure only prevents calling discards, not self-drawn Mahjong

### AC-5: Draw Game if Wall Exhausted

**Given** the wall reaches 0 tiles (after accounting for dead wall)
**When** no one has declared Mahjong
**Then** the server emits `WallExhausted`
**And** the game ends in a draw (see US-021)

## Technical Details

### Events (Backend → Frontend)

No new events - existing events already handle this:

```typescript
{
  kind: 'Public',
  event: {
    TileDrawnPublic: {
      remaining_tiles: 14  // Wall closure threshold
    }
  }
}

// Call window NOT emitted when wall closed
```text

### Backend References

- **Rust Code**: `crates/mahjong_core/src/flow/playing.rs` - Wall closure logic
- **Game Design Doc**: Section 3.6 (Wall Closure Rule)

## Components Involved

- **`<WallCounter>`** - Shows wall status and closure warning
- **`<WallClosureIndicator>`** - "WALL CLOSED" badge

**Component Specs:**

- `component-specs/presentational/WallCounter.md` (update)
- `component-specs/presentational/WallClosureIndicator.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/wall-closure-prevents-calls.md`**
- **`tests/test-scenarios/wall-closure-mahjong-allowed.md`**

## Edge Cases

### EC-1: Dead Wall = 14 Tiles

Per NMJL rules, last 14 tiles are reserved (dead wall).

### EC-2: Self-Draw Mahjong Still Allowed

Wall closure only affects calling discards, not self-draw wins.

### EC-3: House Rule Variation

Some house rules use different dead wall sizes (configurable).

## Related User Stories

- **US-011**: Call Window & Intent Buffering - Blocked by wall closure
- **US-021**: Wall Game (Draw) - Triggered when wall exhausted
- **US-034**: Configure House Rules - Dead wall size setting

## Accessibility Considerations

### Screen Reader

- **Warning**: "Wall closing soon. 18 tiles remaining."
- **Closed**: "Wall closed. Cannot call discards. 14 tiles remaining."

## Priority

**MEDIUM** - Rule enforcement

## Story Points / Complexity

**2** - Low complexity

## Definition of Done

- [ ] Call window does not open when wall ≤ 14 tiles
- [ ] Wall closure message displayed
- [ ] Wall counter highlighted when ≤ 14 tiles
- [ ] "WALL CLOSED" badge shown
- [ ] Warning shown when 15-20 tiles
- [ ] Self-draw Mahjong still allowed
- [ ] Component tests pass
- [ ] Integration tests pass
- [ ] Code reviewed and approved

## Notes for Implementers

### Wall Closure Check

```typescript
const DEAD_WALL_SIZE = 14;

function isWallClosed(remainingTiles: number): boolean {
  return remainingTiles <= DEAD_WALL_SIZE;
}

function showWallClosureWarning(remainingTiles: number): boolean {
  return remainingTiles > DEAD_WALL_SIZE && remainingTiles <= 20;
}
```text

### Wall Counter Display

```typescript
<WallCounter
  remainingTiles={remainingTiles}
  isClosed={remainingTiles <= 14}
  showWarning={remainingTiles > 14 && remainingTiles <= 20}
/>
```text

Display states:

- **Normal** (>20): "107 tiles"
- **Warning** (15-20): "⚠️ 18 tiles - wall closing soon"
- **Closed** (≤14): "🚫 14 tiles - WALL CLOSED"

```text

```text
```
