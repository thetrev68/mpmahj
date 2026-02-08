# US-013: Calling Pung/Kong/Quint/Sextet

## Story

**As a** player who won a call for a meld
**I want** to expose the meld with the called tile and continue my turn
**So that** I can progress toward my winning pattern

## Acceptance Criteria

### AC-1: Meld Call Won (Pung)

**Given** I declared intent for Meld and won the call resolution
**When** the server emits `TileCalled { player: me, meld: Pung([Dot5, Dot5, Dot5]), called_tile: Dot5 }`
**Then** the called tile (Dot5) is removed from the discard pool
**And** a Pung meld appears in my exposed melds area
**And** 2 Dot5 tiles are removed from my concealed hand
**And** my turn begins in the `Discarding` stage (I have 14 total tiles including exposures)

### AC-2: Kong Call (4 Tiles)

**Given** I called for Kong
**When** the server emits `TileCalled { player: me, meld: Kong([Wind1, Wind1, Wind1, Wind1]), called_tile: Wind1 }`
**Then** a Kong meld appears in my exposed area (4 Wind1 tiles)
**And** 3 Wind1 tiles are removed from my hand
**And** I move directly to the `Discarding` stage (no replacement draw needed)
**And** my total tile count (hand + exposures) is 14

### AC-3: Quint Call (5 Tiles)

**Given** I called for Quint (with Jokers)
**When** the server emits `TileCalled { player: me, meld: Quint([Crak2, Crak2, Crak2, Joker, Joker]), called_tile: Crak2 }`
**Then** a Quint meld appears (5 tiles: 3 Crak2 + 2 Jokers)
**And** 2 Crak2 and 2 Jokers are removed from my hand
**And** I move directly to the `Discarding` stage

### AC-4: Sextet Call (6 Tiles)

**Given** I called for Sextet (with Jokers)
**When** the server emits `TileCalled { player: me, meld: Sextet([Bam9, Bam9, Bam9, Joker, Joker, Joker]), called_tile: Bam9 }`
**Then** a Sextet meld appears (6 tiles: 3 Bam9 + 3 Jokers)
**And** 5 tiles are removed from my hand
**And** I move directly to the `Discarding` stage

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
**When** the `TileCalled` event is processed
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

- `component-specs/presentational/ExposedMeldsArea.md`
- `component-specs/presentational/MeldDisplay.md`

## Test Scenarios

- **`tests/test-scenarios/call-pung.md`**
- **`tests/test-scenarios/call-kong.md`**
- **`tests/test-scenarios/call-quint-with-jokers.md`**

## Edge Cases

### EC-1: No Replacement Draw

NMJL rules do not require replacement draws after calling a Kong, Quint, or Sextet from a discard. The player already has 14 tiles (including the called one) and must discard.

### EC-2: Multiple Jokers in Meld

Quint and Sextet can contain multiple Jokers as wild tiles.

### EC-3: Cannot Call Own Discard

Player who discarded cannot call their own tile.

## Related User Stories

- **US-011**: Call Window & Intent Buffering - Previous stage
- **US-014**: Exchanging Joker - Can occur after exposing Joker meld
- **US-016**: Upgrading Meld - Can upgrade exposed melds later
- **US-010**: Discarding a Tile - Next stage

## Accessibility Considerations

### Keyboard Navigation

- **Tab**: Navigate through exposed melds
- **Arrow Keys**: Navigate tiles within meld

### Screen Reader

- **Meld Exposed**: "Exposed Pung of 5 Dots. Called from East. 3 tiles."

### Visual

- **High Contrast**: Exposed melds have clear borders
- **Rotation**: Called tile clearly rotated to indicate source
- **Color-Blind**: Use rotation direction, not just color

## Priority

**CRITICAL** - Core calling mechanic

## Story Points / Complexity

**6** - Medium complexity

- Multiple meld types (Pung, Kong, Quint, Sextet)
- Meld visualization with rotation
- Joker handling in melds
- Turn continuation logic (Discarding stage)

## Definition of Done

- [ ] `TileCalled` event creates exposed meld
- [ ] Meld appears in exposed melds area
- [ ] Called tile rotated to indicate source
- [ ] Tiles removed from concealed hand
- [ ] Called tile removed from discard pool
- [ ] Turn continues to Discarding stage (no replacement draws)
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
