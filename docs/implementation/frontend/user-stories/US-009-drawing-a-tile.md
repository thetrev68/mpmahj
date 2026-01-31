# US-009: Drawing a Tile

## Story

**As a** player whose turn it is
**I want** to draw a tile from the wall
**So that** I can progress my hand toward a winning pattern

## Acceptance Criteria

### AC-1: Turn Start (Drawing Stage)

**Given** Charleston has completed and main game has started
**When** the server emits `TurnChanged { player: me, stage: Drawing }`
**Then** the turn indicator highlights my seat
**And** a "Draw Tile" button appears in the action bar
**And** a message displays: "Your turn - Draw a tile"
**And** the wall shows remaining tiles count
**And** other players see: "[My Name]'s turn - Drawing"

### AC-2: Draw Tile Action

**Given** it is my turn and I am in the `Drawing` stage
**When** I click the "Draw Tile" button
**Then** a `DrawTile { player: me }` command is sent to the server
**And** the button shows a loading state (spinner, disabled)
**And** a draw animation plays (tile slides from wall to my hand, 0.4s)
**And** a tile draw sound effect plays

### AC-3: Tile Drawn (Private Event)

**Given** I sent the `DrawTile` command
**When** the server emits `TileDrawnPrivate { tile: Dot5, remaining_tiles: 107 }`
**Then** the drawn tile (Dot5) appears in my hand
**And** my hand auto-sorts with the new tile
**And** the new tile is briefly highlighted (2s pulsing border)
**And** my tile count increases to 14
**And** the wall counter updates to show 107 remaining tiles

### AC-4: Tile Drawn (Public Event to Others)

**Given** I drew a tile
**When** the server emits `TileDrawnPublic { remaining_tiles: 107 }` to other players
**Then** other players see:

- Draw animation from wall (but no tile value shown)
- Message: "[My Name] drew a tile"
- Wall counter updates to 107 remaining
- My rack shows 14 tiles (but tiles are concealed/face-down)

### AC-5: Turn Stage Advancement

**Given** I successfully drew a tile
**When** the server emits `TurnChanged { player: me, stage: Discarding }`
**Then** the turn indicator remains on me
**And** the message updates: "Your turn - Discard a tile"
**And** my hand becomes interactive for tile selection
**And** the "Draw Tile" button is replaced with instructions to discard

### AC-6: Auto-Draw for Bots

**Given** it is a bot's turn
**When** the server emits `TurnChanged { player: bot_seat, stage: Drawing }`
**Then** the bot automatically sends `DrawTile` command after a delay (0.5-1.5s)
**And** human players see the draw animation and message
**And** the bot's rack updates to show 14 tiles (concealed)

### AC-7: Replacement Draw (After Kong/Quint)

**Given** I exposed a Kong or Quint on my turn
**When** the server emits `ReplacementDrawn { player: me, tile: Bam3, reason: Kong }`
**Then** the replacement tile (Bam3) is added to my hand
**And** the tile is highlighted as "replacement tile"
**And** a message displays: "Drew replacement tile for Kong"
**And** my tile count remains 14 (draw compensates for exposed tile)
**And** the wall counter decrements

### AC-8: Wall Low Warning

**Given** the wall has 20 or fewer tiles remaining
**When** I draw a tile
**Then** a warning indicator appears: "Wall Low - 20 tiles remaining"
**And** the wall counter is visually highlighted (yellow/orange)

### AC-9: Wall Exhausted (Draw Game)

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

// Replacement draw (after Kong/Quint)
{
  kind: 'Private',
  event: {
    ReplacementDrawn: {
      player: Seat,
      tile: Tile,
      reason: "Kong"  // or "Quint", "BlankExchange"
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
  - `crates/mahjong_core/src/event/private_events.rs` - `TileDrawnPrivate`, `ReplacementDrawn`
  - `crates/mahjong_core/src/event/public_events.rs` - `TileDrawnPublic`, `WallExhausted`
- **Game Design Doc**:
  - Section 3.1.1 (Drawing Phase)
  - Section 3.1.6 (Wall Management and Dead Wall)

## Components Involved

- **`<TurnIndicator>`** - Highlights current player
- **`<ActionBar>`** - "Draw Tile" button
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

- **`tests/test-scenarios/turn-draw-standard.md`** - Normal draw flow
- **`tests/test-scenarios/turn-draw-bot.md`** - Bot auto-draw
- **`tests/test-scenarios/turn-draw-replacement.md`** - Replacement draw after Kong
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

### EC-3: Double-Click Prevention

**Given** I click "Draw Tile"
**When** I rapidly click again before server responds
**Then** only ONE `DrawTile` command is sent
**And** the button is disabled after first click

### EC-4: Network Error on Draw

**Given** I send `DrawTile` but network fails
**When** no `TileDrawnPrivate` acknowledgment is received within 5 seconds
**Then** an error toast appears: "Failed to draw tile. Retrying..."
**And** the command is automatically retried (max 3 attempts)

### EC-5: Wall Exhausted During My Turn

**Given** the wall has 0 drawable tiles
**When** my turn starts
**Then** the server emits `WallExhausted`
**And** the game ends (draw game)
**And** I cannot draw

## Related User Stories

- **US-010**: Discarding a Tile - Next stage after drawing
- **US-016**: Upgrading Meld (Pung → Kong → Quint) - Triggers replacement draw
- **US-021**: Wall Game (Draw) - Occurs when wall exhausted

## Accessibility Considerations

### Keyboard Navigation

- **D Key**: Shortcut for "Draw Tile" (when it's my turn)
- **Enter/Space**: Activate "Draw Tile" button when focused

### Screen Reader

- **Turn Start**: "Your turn. Drawing phase. Press D or click Draw Tile button."
- **Tile Drawn**: "Drew 5 of Dots. 14 tiles in hand. 107 tiles remaining in wall."
- **Replacement**: "Drew replacement tile: 3 of Bamboo. Reason: Kong."
- **Wall Low**: "Warning: Wall low. 20 tiles remaining."

### Visual

- **High Contrast**: Turn indicator has bold, high-contrast border
- **Motion**: Respect `prefers-reduced-motion` for draw animation
- **Tile Highlight**: Newly drawn tile has clear, pulsing highlight

## Priority

**CRITICAL** - Core gameplay mechanic, required for every turn

## Story Points / Complexity

**3** - Medium complexity

- Simple command/event flow
- Draw animation from wall to hand
- Tile highlighting
- Wall counter update
- Replacement draw variant
- Bot auto-draw
- Wall exhaustion detection

## Definition of Done

- [ ] "Draw Tile" button visible when it's my turn and stage is Drawing
- [ ] Button click sends `DrawTile` command
- [ ] Draw animation plays from wall to hand
- [ ] Tile draw sound effect plays
- [ ] `TileDrawnPrivate` event adds tile to my hand
- [ ] `TileDrawnPublic` event updates wall counter for other players
- [ ] Newly drawn tile is highlighted for 2 seconds
- [ ] Hand auto-sorts after drawing
- [ ] My tile count increases to 14
- [ ] Wall counter decrements
- [ ] Turn stage advances to Discarding
- [ ] Bot auto-draw behavior works (0.5-1.5s delay)
- [ ] Replacement draw works after Kong/Quint
- [ ] Wall low warning appears at 20 tiles
- [ ] Wall exhausted triggers draw game
- [ ] Component tests pass
- [ ] Integration tests pass (full draw flow)
- [ ] E2E test passes (turn sequence)
- [ ] Accessibility tests pass
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

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

### Wall Position Calculation

Tiles are drawn from the break point, moving right-to-left:

```typescript
function getDrawPosition(breakPoint: number, tilesDrawn: number): Position {
  // Tiles drawn from right of break, wrapping around wall
  const index = (breakPoint + tilesDrawn) % totalWallTiles;
  return wallTilePositions[index];
}
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

### Replacement Draw

After exposing Kong or Quint, the player draws a replacement tile from the end of the wall (dead wall):

```typescript
case 'ReplacementDrawn':
  state.yourHand.push(event.tile);
  state.yourHand = sortHand(state.yourHand);
  state.replacementTile = event.tile;  // Track for special highlighting
  state.replacementReason = event.reason;  // "Kong", "Quint", or "BlankExchange"
  break;
```

Display: "Drew replacement tile: 3 Bam (Kong)"

### Bot Auto-Draw

```typescript
useEffect(() => {
  if (currentTurn === botSeat && turnStage === 'Drawing') {
    const delay = randomInt(500, 1500); // ms
    const timer = setTimeout(() => {
      sendCommand({ DrawTile: { player: botSeat } });
    }, delay);
    return () => clearTimeout(timer);
  }
}, [currentTurn, turnStage, botSeat]);
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
