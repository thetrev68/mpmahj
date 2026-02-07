# US-009: Drawing a Tile

## Story

**As a** player whose turn it is
**I want** the game to automatically draw a tile for me
**So that** gameplay is fast-paced and I can focus on my hand and discards

## Acceptance Criteria

### AC-1: Turn Start (Drawing Stage)

**Given** Charleston has completed and main game has started
**When** the server emits `TurnChanged { player: me, stage: Drawing }`
**Then** the turn indicator highlights my seat
**And** the client automatically sends a `DrawTile { player: me }` command after a short delay (0.5s)
**And** a message displays: "Your turn - Drawing tile..."
**And** the wall shows remaining tiles count
**And** other players see: "[My Name]'s turn - Drawing"

### AC-2: Auto-Draw Animation

**Given** the `DrawTile` command has been sent
**When** the server acknowledges the draw
**Then** a draw animation plays (tile slides from wall to my hand, 0.4s)
**And** a tile draw sound effect plays
**And** the action bar remains clear of "Draw" buttons (drawing is fully automatic)

### AC-3: Tile Drawn (Private Event)

**Given** the `DrawTile` command was processed
**When** the server emits `TileDrawnPrivate { tile: Dot5, remaining_tiles: 107 }`
**Then** the drawn tile (Dot5) appears in my hand
**And** my hand auto-sorts with the new tile
**And** the new tile is briefly highlighted (2s pulsing border)
**And** my tile count increases to 14
**And** the wall counter updates to show 107 remaining tiles

### AC-4: Tile Drawn (Public Event to Others)

**Given** a player (me or another) drew a tile
**When** the server emits `TileDrawnPublic { remaining_tiles: 107 }` to other players
**Then** other players see:

- Draw animation from wall (but no tile value shown)
- Message: "[Player Name] drew a tile"
- Wall counter updates to 107 remaining
- Player's rack shows 14 tiles (but tiles are concealed/face-down)

### AC-5: Turn Stage Advancement

**Given** I successfully drew a tile
**When** the server emits `TurnChanged { player: me, stage: Discarding }`
**Then** the turn indicator remains on me
**And** the message updates: "Your turn - Discard a tile"
**And** my hand becomes interactive for tile selection

### AC-6: Automatic Drawing for All Players (Including Bots)

**Given** it is any player's turn (Human or Bot)
**When** the `Drawing` stage starts
**Then** the client (or Bot controller) automatically sends `DrawTile` command after a delay (0.5-1.5s)
**And** all players see the draw animation and message consistency

### AC-7: Wall Low Warning

**Given** the wall has 20 or fewer tiles remaining
**When** a tile is drawn
**Then** a warning indicator appears: "Wall Low - 20 tiles remaining"
**And** the wall counter is visually highlighted (yellow/orange)

### AC-8: Wall Exhausted (Draw Game)

**Given** the wall has 0 tiles remaining (after dead wall reserved tiles)
**When** any player attempts to draw
**Then** the server emits `WallExhausted { remaining_tiles: 0 }`
**And** a message appears: "Wall exhausted - Draw game"
**And** the game proceeds to scoring (see US-021)

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  DrawTile: {
    player: Seat;
  }
}
```

### Events (Backend → Frontend)

**Private Event (to me only):**

```typescript
{
  kind: 'Private',
  event: {
    TileDrawnPrivate: {
      tile: Tile,  // E.g., "Dot5"
      remaining_tiles: 107
    }
  }
}
```

**Public Events (to all players):**

```typescript
{
  kind: 'Public',
  event: {
    TurnChanged: {
      player: Seat,
      stage: { Playing: "Drawing" }
    }
  }
}

{
  kind: 'Public',
  event: {
    TileDrawnPublic: {
      remaining_tiles: 107  // No tile value
    }
  }
}

{
  kind: 'Public',
  event: {
    TurnChanged: {
      player: Seat,
      stage: { Playing: "Discarding" }
    }
  }
}

// Wall exhausted
{
  kind: 'Public',
  event: {
    WallExhausted: {
      remaining_tiles: 0
    }
  }
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `DrawTile` command
  - `crates/mahjong_core/src/flow/playing.rs` - Drawing stage logic
  - `crates/mahjong_core/src/event/private_events.rs` - `TileDrawnPrivate`
  - `crates/mahjong_core/src/event/public_events.rs` - `TileDrawnPublic`, `WallExhausted`
- **Game Design Doc**:
  - Section 3.1.1 (Drawing Phase)
  - Section 3.1.6 (Wall Management and Dead Wall)

## Components Involved

- **`<TurnIndicator>`** - Highlights current player
- **`<ConcealedHand>`** - Player's hand with new tile
- **`<Wall>`** - Wall visualization with draw animation
- **`<WallCounter>`** - Remaining tiles count
- **`<DrawAnimationLayer>`** - Tile sliding from wall to hand
- **`<TileHighlight>`** - Highlights newly drawn tile
- **`useSoundEffects()`** - Tile draw sound

**Component Specs:**

- `component-specs/presentational/TurnIndicator.md`
- `component-specs/presentational/WallCounter.md`
- `component-specs/container/ConcealedHand.md`
- `component-specs/container/Wall.md`
- `component-specs/hooks/useSoundEffects.md`

## Test Scenarios

- **`tests/test-scenarios/turn-draw-standard.md`** - Normal auto-draw flow
- **`tests/test-scenarios/turn-draw-wall-exhausted.md`** - Draw game scenario

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/playing-drawing.json` - Drawing stage state
- `tests/fixtures/events/turn-draw-sequence.json` - Draw event flow

**Sample Draw Event Sequence:**

```json
{
  "scenario": "Standard Draw",
  "events": [
    {
      "kind": "Public",
      "event": { "TurnChanged": { "player": "South", "stage": { "Playing": "Drawing" } } }
    },
    {
      "kind": "Private",
      "event": { "TileDrawnPrivate": { "tile": "Dot5", "remaining_tiles": 107 } }
    },
    {
      "kind": "Public",
      "event": { "TileDrawnPublic": { "remaining_tiles": 107 } }
    },
    {
      "kind": "Public",
      "event": { "TurnChanged": { "player": "South", "stage": { "Playing": "Discarding" } } }
    }
  ]
}
```

## Edge Cases

### EC-1: Not My Turn

**Given** it is not my turn
**When** I somehow send a `DrawTile` command
**Then** the server rejects with error: "Not your turn"
**And** no tile is drawn

### EC-2: Wrong Stage

**Given** it is my turn but I am in `Discarding` stage
**When** I send a `DrawTile` command
**Then** the server rejects with error: "Cannot draw during Discarding stage"

### EC-3: Network Error on Auto-Draw

**Given** client attempts to auto-send `DrawTile` but network fails
**When** no `TileDrawnPrivate` acknowledgment is received within 5 seconds
**Then** an error toast appears: "Failed to draw tile. Retrying..."
**And** the command is automatically retried (max 3 attempts)

### EC-4: Wall Exhausted During My Turn

**Given** the wall has 0 drawable tiles
**When** my turn starts
**Then** the server emits `WallExhausted`
**And** the game ends (draw game)
**And** I cannot draw

## Related User Stories

- **US-010**: Discarding a Tile - Next stage after drawing
- **US-021**: Wall Game (Draw) - Occurs when wall exhausted

## Accessibility Considerations

### Screen Reader

- **Turn Start**: "Your turn. Drawing tile."
- **Tile Drawn**: "Drew 5 of Dots. 14 tiles in hand. 107 tiles remaining in wall."
- **Wall Low**: "Warning: Wall low. 20 tiles remaining."

### Visual

- **High Contrast**: Turn indicator has bold, high-contrast border
- **Motion**: Respect `prefers-reduced-motion` for draw animation
- **Tile Highlight**: Newly drawn tile has clear, pulsing highlight

## Priority

**CRITICAL** - Core gameplay mechanic, required for every turn

## Story Points / Complexity

**2** - Low-Medium complexity (Simpler than manual draw)

- Automatic command/event flow
- Draw animation from wall to hand
- Tile highlighting
- Wall counter update
- Wall exhaustion detection

## Definition of Done

- [ ] `TurnChanged` event triggers automatic `DrawTile` command
- [ ] Draw animation plays from wall to hand
- [ ] Tile draw sound effect plays
- [ ] `TileDrawnPrivate` event adds tile to my hand
- [ ] `TileDrawnPublic` event updates wall counter for other players
- [ ] Newly drawn tile is highlighted for 2 seconds
- [ ] Hand auto-sorts after drawing
- [ ] My tile count increases to 14
- [ ] Wall counter decrements
- [ ] Turn stage advances to Discarding
- [ ] Wall low warning appears at 20 tiles
- [ ] Wall exhausted triggers draw game
- [ ] Component tests pass
- [ ] Integration tests pass (full draw flow)
- [ ] E2E test passes (turn sequence)
- [ ] Accessibility tests pass
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### Auto-Draw Logic

When it becomes the player's turn, wait a brief moment for visual transition before drawing:

```typescript
useEffect(() => {
  if (currentTurn === mySeat && turnStage === 'Drawing') {
    const timer = setTimeout(() => {
      sendCommand({ DrawTile: { player: mySeat } });
    }, 500); // 500ms delay for turn transition visibility
    return () => clearTimeout(timer);
  }
}, [currentTurn, turnStage, mySeat]);
```

### Draw Animation

Tile slides from wall position to hand position:

```typescript
<DrawAnimation
  from={wallPosition}
  to={handPosition}
  tile={drawnTile}  // Only shown to drawer
  duration={400}  // ms
  onComplete={() => {
    addTileToHand(drawnTile);
    highlightTile(drawnTile, 2000);  // 2s highlight
  }}
/>
```

### Tile Highlighting

```typescript
const highlightedTiles = useMemo(() => {
  if (newlyDrawnTile) {
    return [newlyDrawnTile];
  }
  return [];
}, [newlyDrawnTile]);

// Auto-remove highlight after 2 seconds
useEffect(() => {
  if (newlyDrawnTile) {
    const timer = setTimeout(() => setNewlyDrawnTile(null), 2000);
    return () => clearTimeout(timer);
  }
}, [newlyDrawnTile]);
```

### Wall Counter

```typescript
<WallCounter
  remainingTiles={remainingTiles}
  totalTiles={152}  // or 160 with blanks
  warningThreshold={20}
  isLow={remainingTiles <= 20}
/>
```

Display:

- **Normal**: "107 tiles"
- **Low** (≤20): "⚠️ 20 tiles" (yellow/orange)
- **Exhausted** (0): "Wall Exhausted" (red)

### Zustand Store Updates

```typescript
case 'TileDrawnPrivate':
  state.yourHand.push(event.tile);
  state.yourHand = sortHand(state.yourHand);
  state.newlyDrawnTile = event.tile;
  state.wallTiles = event.remaining_tiles;
  break;

case 'TileDrawnPublic':
  state.wallTiles = event.remaining_tiles;
  // Other players see wall update but not tile value
  break;

case 'WallExhausted':
  state.wallTiles = 0;
  state.gameResult = 'Draw';  // Will be confirmed by scoring events
  break;
```

### Instant Animation Mode

- Skip draw animation (tile instantly appears in hand)
- No tile slide from wall
- Sound effect still plays
- Highlight still appears (no pulsing animation, just static highlight)

```text

```

```text

```
