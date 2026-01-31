# US-010: Discarding a Tile

## Story

**As a** player whose turn it is
**I want** to select and discard a tile from my hand
**So that** I can complete my turn and allow other players to call or proceed

## Acceptance Criteria

### AC-1: Discarding Stage Entry

**Given** I have drawn a tile and my hand has 14 tiles
**When** the server emits `TurnChanged { player: me, stage: Discarding }`
**Then** my hand becomes interactive for tile selection
**And** a message displays: "Your turn - Select a tile to discard"
**And** all 14 tiles in my hand are clickable
**And** the turn indicator remains highlighted on me

### AC-2: Tile Selection for Discard

**Given** I am in the `Discarding` stage
**When** I click on a tile in my hand
**Then** the tile is visually highlighted (raised 10px, yellow border)
**And** a "Discard" button appears in the action bar (enabled)
**And** the selected tile shows a discard icon (↓ or trash can)

### AC-3: Tile Deselection

**Given** I have selected a tile
**When** I click on the same tile again
**Then** the tile is deselected (highlight removed)
**And** the "Discard" button is disabled/hidden
**And** the discard icon disappears

### AC-4: Changing Selection

**Given** I have selected tile A
**When** I click on tile B (different tile)
**Then** tile A is deselected
**And** tile B becomes selected
**And** the "Discard" button remains enabled for tile B

### AC-5: Discard Submission

**Given** I have selected a tile (e.g., Dot5)
**When** I click the "Discard" button
**Then** a `DiscardTile { player: me, tile: Dot5 }` command is sent
**And** the button shows a loading state (disabled)
**And** my hand becomes non-interactive
**And** a discard animation plays (tile slides from hand to discard pool, 0.4s)
**And** a tile discard sound effect plays

### AC-6: Tile Discarded (Public Event)

**Given** I sent the `DiscardTile` command
**When** the server emits `TileDiscarded { player: me, tile: Dot5 }`
**Then** the tile (Dot5) is removed from my hand
**And** my tile count decreases to 13
**And** the tile appears in the discard pool (center of table)
**And** the tile is face-up and visible to all players
**And** all players see message: "[My Name] discarded 5 of Dots"

### AC-7: Call Window Opened

**Given** I discarded a tile that is callable (Pung/Kong/Mahjong possible)
**When** the server emits `CallWindowOpened { tile: Dot5, discarded_by: me, can_call: [South, West], timer: 10, ... }`
**Then** a call window UI appears for eligible players (South, West)
**And** other players can declare call intent (see US-011)
**And** my turn is paused until call window resolves

### AC-8: Call Window Closed (No Calls)

**Given** the call window opened after my discard
**When** no players call (all passed or timer expired)
**Then** the server emits `CallWindowClosed`
**And** the server emits `TurnChanged { player: next_player, stage: Drawing }`
**And** the turn advances to the next player (clockwise)

### AC-9: Discard After Meld Upgrade

**Given** I upgraded an exposed meld on my turn (e.g., Pung → Kong)
**When** I am in `Discarding` stage after the upgrade
**Then** I can discard normally (same flow as AC-1 through AC-6)
**Note:** Meld upgrade happens before discard (see US-016)

### AC-10: Bot Auto-Discard

**Given** it is a bot's turn and the bot is in `Discarding` stage
**When** the bot's AI selects a tile to discard
**Then** the bot sends `DiscardTile` command after a delay (0.5-1.5s)
**And** human players see the discard animation and message
**And** the bot's hand updates to show 13 tiles

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  DiscardTile: {
    player: Seat,
    tile: Tile  // E.g., "Dot5"
  }
}
```text

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    TurnChanged: {
      player: Seat,
      stage: { Playing: "Discarding" }
    }
  }
}

{
  kind: 'Public',
  event: {
    TileDiscarded: {
      player: Seat,
      tile: Tile
    }
  }
}

// If callable
{
  kind: 'Public',
  event: {
    CallWindowOpened: {
      tile: Tile,
      discarded_by: Seat,
      can_call: [Seat],  // Eligible callers
      timer: 10,         // Seconds
      started_at_ms: 1706634300000,
      timer_mode: "Standard"
    }
  }
}

// If not called
{
  kind: 'Public',
  event: {
    CallWindowClosed: {}
  }
}

{
  kind: 'Public',
  event: {
    TurnChanged: {
      player: Seat,  // Next player
      stage: { Playing: "Drawing" }
    }
  }
}
```text

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `DiscardTile` command
  - `crates/mahjong_core/src/flow/playing.rs` - Discarding stage logic
  - `crates/mahjong_core/src/event/public_events.rs` - `TileDiscarded`, `CallWindowOpened`
- **Game Design Doc**:
  - Section 3.1.2 (Discarding Phase)
  - Section 3.2.1 (Call Window Initiation)

## Components Involved

- **`<TurnIndicator>`** - Highlights current player
- **`<ConcealedHand>`** - Hand with tile selection for discard
- **`<ActionBar>`** - "Discard" button
- **`<DiscardPool>`** - Center table area showing discarded tiles
- **`<DiscardAnimationLayer>`** - Tile sliding from hand to pool
- **`useSoundEffects()`** - Tile discard sound

**Component Specs:**

- `component-specs/container/ConcealedHand.md`
- `component-specs/presentational/DiscardPool.md`
- `component-specs/presentational/ActionBar.md`

## Test Scenarios

- **`tests/test-scenarios/turn-discard-standard.md`** - Normal discard flow
- **`tests/test-scenarios/turn-discard-callable.md`** - Discard opens call window
- **`tests/test-scenarios/turn-discard-bot.md`** - Bot auto-discard
- **`tests/test-scenarios/turn-discard-after-kong.md`** - Discard after meld upgrade

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/playing-discarding.json`
- `tests/fixtures/events/turn-discard-sequence.json`

## Edge Cases

### EC-1: Not My Turn

**Given** it is not my turn
**When** I send a `DiscardTile` command
**Then** the server rejects with error: "Not your turn"

### EC-2: Wrong Stage

**Given** it is my turn but I am in `Drawing` stage
**When** I send a `DiscardTile` command
**Then** the server rejects with error: "Cannot discard during Drawing stage"

### EC-3: Invalid Tile (Not in Hand)

**Given** I send `DiscardTile` with tile "Bam9"
**When** Bam9 is not in my hand
**Then** the server rejects with error: "Tile not in hand"

### EC-4: Double-Click Prevention

**Given** I click "Discard" for Dot5
**When** I rapidly click again before server responds
**Then** only ONE `DiscardTile` command is sent

### EC-5: Network Error on Discard

**Given** I send `DiscardTile` but network fails
**When** no `TileDiscarded` acknowledgment is received within 5 seconds
**Then** retry logic applies (max 3 attempts)

## Related User Stories

- **US-009**: Drawing a Tile - Previous stage
- **US-011**: Call Window & Intent Buffering - Next stage (if callable)
- **US-016**: Upgrading Meld - Can occur before discard

## Accessibility Considerations

### Keyboard Navigation

- **Arrow Keys**: Navigate between tiles in hand
- **Space/Enter**: Select/deselect focused tile
- **D Key**: Discard selected tile (shortcut)

### Screen Reader

- **Stage**: "Your turn. Discarding phase. Select a tile to discard."
- **Selection**: "Tile selected: 5 of Dots. Press D or click Discard button."
- **Discarded**: "Discarded 5 of Dots. 13 tiles in hand."

### Visual

- **High Contrast**: Selected tile has clear border
- **Motion**: Respect `prefers-reduced-motion` for discard animation

## Priority

**CRITICAL** - Core gameplay mechanic, required for every turn

## Story Points / Complexity

**3** - Medium complexity

- Tile selection UI
- Discard animation
- Discard pool management
- Call window trigger logic
- Bot auto-discard

## Definition of Done

- [ ] Hand interactive when in Discarding stage
- [ ] Click tile to select for discard
- [ ] "Discard" button enabled when tile selected
- [ ] Click "Discard" sends `DiscardTile` command
- [ ] Discard animation plays
- [ ] Tile discard sound plays
- [ ] `TileDiscarded` event removes tile from hand
- [ ] Tile appears in discard pool (face-up)
- [ ] My tile count decreases to 13
- [ ] Call window opens if tile is callable
- [ ] Turn advances to next player if no calls
- [ ] Bot auto-discard works
- [ ] Component tests pass
- [ ] Integration tests pass
- [ ] E2E test passes
- [ ] Accessibility tests pass
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### Tile Selection for Discard

```typescript
const [selectedTileForDiscard, setSelectedTileForDiscard] = useState<Tile | null>(null);

function handleTileClick(tile: Tile) {
  if (selectedTileForDiscard === tile) {
    setSelectedTileForDiscard(null); // Deselect
  } else {
    setSelectedTileForDiscard(tile); // Select/change selection
  }
}
```text

### Discard Animation

```typescript
<DiscardAnimation
  from={handPosition}
  to={discardPoolPosition}
  tile={discardedTile}
  duration={400}
  onComplete={() => {
    removeTileFromHand(discardedTile);
    addTileToDiscardPool(discardedTile);
  }}
/>
```text

### Discard Pool Layout

Tiles arranged in a grid in the center of the table:

```text
[Bam1] [Dot3] [Crak5]
[Wind2] [Dot7] [Bam9]
...
```text

Most recent discard should be visually distinct (e.g., slightly raised or glowing).

### Bot Auto-Discard

```typescript
useEffect(() => {
  if (currentTurn === botSeat && turnStage === 'Discarding') {
    const delay = randomInt(500, 1500);
    const timer = setTimeout(() => {
      const tileToDiscard = selectBotDiscard(botHand, difficulty);
      sendCommand({ DiscardTile: { player: botSeat, tile: tileToDiscard } });
    }, delay);
    return () => clearTimeout(timer);
  }
}, [currentTurn, turnStage, botSeat]);
```text

### Zustand Store Updates

```typescript
case 'TileDiscarded':
  if (event.player === mySeat) {
    state.yourHand = state.yourHand.filter(t => t !== event.tile);
  }
  state.discardPool.push({
    tile: event.tile,
    discardedBy: event.player,
    timestamp: Date.now()
  });
  state.mostRecentDiscard = event.tile;
  break;
```text

### Instant Animation Mode

- Skip discard animation
- Tile instantly disappears from hand and appears in discard pool
- Sound effect still plays
