# US-013: Calling Pung/Kong/Quint/Sextet

## Story

**As a** player who won a call for a meld
**I want** to expose the meld with the called tile and continue my turn
**So that** I can progress toward my winning pattern

## Acceptance Criteria

### AC-1: Meld Call Won

**Given** I declared intent for Meld and won the call resolution
**When** the server emits `TileCalled { player: me, meld: Pung([Dot5, Dot5, Dot5]), called_tile: Dot5 }`
**Then** the called tile (Dot5) is removed from the discard pool
**And** a Pung meld appears in my exposed melds area
**And** the meld shows 3 Dot5 tiles (one rotated sideways to indicate it was called)
**And** 2 Dot5 tiles are removed from my concealed hand
**And** my turn begins in the `Discarding` stage

### AC-2: Kong Call (4 Tiles)

**Given** I called for Kong
**When** the server emits `TileCalled { player: me, meld: Kong([Wind1, Wind1, Wind1, Wind1]), called_tile: Wind1 }`
**Then** a Kong meld appears in my exposed area (4 Wind1 tiles)
**And** 3 Wind1 tiles are removed from my hand
**And** the server emits `ReplacementDrawn { player: me, tile: Bam7, reason: Kong }`
**And** I draw a replacement tile (Bam7) from the dead wall
**And** my tile count remains 14
**And** I can then discard normally

### AC-3: Quint Call (5 Tiles)

**Given** I called for Quint (with Jokers)
**When** the server emits `TileCalled { player: me, meld: Quint([Crak2, Crak2, Crak2, Joker, Joker]), called_tile: Crak2 }`
**Then** a Quint meld appears (5 tiles: 3 Crak2 + 2 Jokers)
**And** 2 Crak2 and 2 Jokers are removed from my hand
**And** the server emits `ReplacementDrawn { player: me, tile: Dot8, reason: Quint }`
**And** I draw a replacement tile
**And** I can then discard

### AC-4: Sextet Call (6 Tiles)

**Given** I called for Sextet (with Jokers)
**When** the server emits `TileCalled { player: me, meld: Sextet([Bam9, Bam9, Bam9, Joker, Joker, Joker]), called_tile: Bam9 }`
**Then** a Sextet meld appears (6 tiles: 3 Bam9 + 3 Jokers)
**And** tiles are removed from my hand accordingly
**And** I draw 2 replacement tiles (Sextet = 2 replacements)
**And** I can then discard

### AC-5: Meld Visualization

**Given** I exposed a meld
**Then** the meld is displayed in my exposed melds area (below my concealed hand)
**And** the called tile is rotated 90° sideways to indicate it was called (not from hand)
**And** the direction of rotation indicates who discarded:

- **Left player**: Rotate left
- **Across player**: Rotate upside-down
- **Right player**: Rotate right

### AC-6: Turn Continues After Call

**Given** I exposed a meld
**When** I have drawn replacement tiles (if Kong/Quint/Sextet)
**Then** the server emits `TurnChanged { player: me, stage: Discarding }`
**And** I must discard a tile to complete my turn
**And** I cannot call my own discard

### AC-7: Joker Exchange Opportunity

**Given** I exposed a meld containing Jokers
**When** other players have matching tiles in their hands
**Then** they can exchange Jokers from my meld during their turns (see US-014)

## Technical Details

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    TileCalled: {
      player: Seat,
      meld: {
        Kong: {
          tiles: [Tile, Tile, Tile, Tile],
          called: true,
          called_from: Seat
        }
      },
      called_tile: Tile
    }
  }
}

{
  kind: 'Private',
  event: {
    ReplacementDrawn: {
      player: Seat,
      tile: Tile,
      reason: "Kong"  // or "Quint", "Sextet"
    }
  }
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/meld.rs` - Meld definitions
  - `crates/mahjong_core/src/event/public_events.rs` - `TileCalled`
- **Game Design Doc**: Section 3.3 (Calling and Exposing Melds)

## Components Involved

- **`<ExposedMeldsArea>`** - Container for exposed melds
- **`<MeldDisplay>`** - Individual meld visualization with rotation
- **`<ConcealedHand>`** - Updates after tiles removed
- **`<DiscardPool>`** - Removes called tile

**Component Specs:**

- `component-specs/presentational/ExposedMeldsArea.md` (NEW)
- `component-specs/presentational/MeldDisplay.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/call-pung.md`**
- **`tests/test-scenarios/call-kong-replacement.md`**
- **`tests/test-scenarios/call-quint-with-jokers.md`**

## Edge Cases

### EC-1: Kong/Quint Replacement Draw

After Kong/Quint, player must draw replacement before discarding.

### EC-2: Multiple Jokers in Meld

Quint and Sextet can contain multiple Jokers as wild tiles.

### EC-3: Cannot Call Own Discard

Player who discarded cannot call their own tile.

## Related User Stories

- **US-011**: Call Window & Intent Buffering - Previous stage
- **US-014**: Exchanging Joker - Can occur after exposing Joker meld
- **US-016**: Upgrading Meld - Can upgrade exposed melds later

## Accessibility Considerations

### Keyboard Navigation

- **Tab**: Navigate through exposed melds
- **Arrow Keys**: Navigate tiles within meld

### Screen Reader

- **Meld Exposed**: "Exposed Pung of 5 Dots. Called from East. 3 tiles."
- **Kong Replacement**: "Drew replacement tile: 7 Bamboo. Reason: Kong."

### Visual

- **High Contrast**: Exposed melds have clear borders
- **Rotation**: Called tile clearly rotated to indicate source
- **Color-Blind**: Use rotation direction, not just color

## Priority

**CRITICAL** - Core calling mechanic

## Story Points / Complexity

**8** - High complexity

- Multiple meld types (Pung, Kong, Quint, Sextet)
- Meld visualization with rotation
- Replacement draw logic for Kong/Quint/Sextet
- Joker handling in melds
- Turn continuation logic

## Definition of Done

- [ ] `TileCalled` event creates exposed meld
- [ ] Meld appears in exposed melds area
- [ ] Called tile rotated to indicate source
- [ ] Tiles removed from concealed hand
- [ ] Called tile removed from discard pool
- [ ] Kong/Quint/Sextet trigger replacement draw
- [ ] Replacement tile added to hand
- [ ] Turn continues to Discarding stage
- [ ] Component tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Accessibility tests pass
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### Meld Display Component

```typescript
<MeldDisplay
  meld={meld}
  calledFrom={calledFrom}
  rotateDirection={getRotationDirection(mySeat, calledFrom)}
/>
```

### Rotation Direction

```typescript
function getRotationDirection(mySeat: Seat, calledFrom: Seat): 'left' | 'up' | 'right' {
  // Calculate which player is left/across/right relative to me
  const offset = (calledFrom - mySeat + 4) % 4;
  return { 1: 'left', 2: 'up', 3: 'right' }[offset];
}
```

### Replacement Draw Count

- **Pung**: 0 replacements
- **Kong**: 1 replacement
- **Quint**: 1 replacement
- **Sextet**: 2 replacements

### Zustand Store Updates

```typescript
case 'TileCalled':
  if (event.player === mySeat) {
    // Remove tiles from hand
    state.yourHand = removeMeldTilesFromHand(state.yourHand, event.meld);
  }
  state.exposedMelds[event.player].push(event.meld);
  state.discardPool = state.discardPool.filter(d => d.tile !== event.called_tile);
  break;
```

```text

```
