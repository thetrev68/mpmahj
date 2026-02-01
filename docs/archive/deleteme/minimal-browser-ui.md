# Implementation Plan: Minimal Browser Testing UI

## Overview

Build a simple, text-based browser interface to replace the CLI for testing the backend. No animations, no styling polish - just functional UI components to play a full game of American Mahjong in the browser.

## Current State

### What Works ✅

- **Backend**: Fully functional (game logic, WebSocket server, AI bots, room management)
- **Terminal CLI**: Working text-based client with command parsing
- **Frontend Infrastructure**:
  - WebSocket connection + authentication (`useGameSocket.ts`)
  - State management (Zustand: `gameStore.ts`, `uiStore.ts`)
  - Event processing queue (`useActionQueue.ts`)
  - Command validation (`commands.ts`)
  - TypeScript bindings auto-generated from Rust

### What's Missing ❌

- **UI Components**: No visual components to display game state or handle user input
- **Current App.tsx**: Just a testing harness (connection status, manual form, stub buttons)
- **No Gameplay Interface**: Can't see hand, can't discard, can't call, can't play Charleston

## Terminal CLI Feature Parity

The terminal client supports these features (which we need to match):

1. **Connection & Room Management**
   - Connect to server (auto-authenticate)
   - Create room with card year selection (2017-2025)
   - Join existing room by ID
   - Display connection status, player ID, room ID, seat

2. **Game Display**
   - Phase indicator (WaitingForPlayers, Charleston stages, Playing stages, GameOver)
   - Turn indicator (whose turn, "YOUR TURN" highlight)
   - Wall remaining count
   - Recent events log (last 5 events)
   - Player's hand (TODO in CLI, but structure exists)

3. **Game Commands** (from `input.rs`)
   - `discard <index>` - Discard tile at index
   - `call pung|kong|quint` - Call a meld
   - `pass` - Pass on call window
   - `mahjong` - Declare win
   - `pass-tiles <i1> <i2> <i3>` - Charleston pass
   - `vote continue|stop` - Charleston voting
   - `courtesy-pass <count>` - Courtesy pass proposal
   - `courtesy-accept <indices>` - Accept courtesy
   - `exchange-joker <player> <meld-index> <tile-index>` - Joker exchange

4. **Helper Commands**
   - `help` - Show available commands
   - `state` - Show full game state
   - `quit/exit` - Exit client

## Implementation Strategy

### Phase 1: Connection & Room Setup (Priority 1)

**File**: `apps/client/src/components/ConnectionPanel.tsx`

**Component Responsibilities**:

- Display connection status (Connected/Disconnected/Connecting)
- Show player info: Player ID (truncated), Seat, Room ID
- Create room form:
  - Card year dropdown (2017, 2018, 2019, 2020, 2025)
  - Bot difficulty dropdown (Easy, Medium, Hard, Expert) - optional
  - "Fill with Bots" checkbox - if checked, server fills empty seats with AI
  - "Create Room" button
- Join room form: Room ID input, "Join Room" button
- Connect/Disconnect button
- Error display

**State Dependencies**:

- `useGameSocket()` - connection, sendMessage, createRoom, joinRoom
- `gameStore` - yourSeat, phase
- `uiStore` - errors

**Bot Integration**:

- Add UI controls for bot configuration (difficulty dropdown, "Fill with Bots" checkbox)
- **Note**: Current server API (`CreateRoomPayload`) only accepts `card_year` field
- **Implementation approach**:
  - For MVP: After creating room, server automatically fills empty seats with bots (default Easy difficulty)
  - Bot controls in UI are **UI-only for now** (no server API to set difficulty on room creation)
  - Future enhancement: Add bot config to CreateRoomPayload on server side, then wire up UI
- Server handles spawning AI players automatically via `bot_runner.rs` (mahjong_ai crate)
- Bot difficulty affects AI decision quality (Easy, Medium, Hard, Expert per `mahjong_ai::Difficulty`)

**Implementation Details**:

```typescript
interface ConnectionPanelProps {}

// Sections:
// 1. Status bar (connection, player ID, seat, room ID)
// 2. Room controls (create with year, join by ID)
// 3. Error messages
```text

---

### Phase 2: Game State Display (Priority 1)

**File**: `apps/client/src/components/GameStatus.tsx`

**Component Responsibilities**:

- Phase display with human-readable text
  - "Waiting for Players"
  - "Charleston: Pass Right (1st)"
  - "Playing: East discarding"
  - "Game Over: East wins!"
- Turn indicator with "YOUR TURN" highlight
- Wall remaining count (152 total - 14 dead - 52 dealt - tiles_drawn)
- Player status table (4 seats: tile count, exposed melds count, status)

**State Dependencies**:

- `gameStore` - phase, currentTurn, remainingTiles, players, yourSeat, dealer

**Format Functions** (port from `ui.rs`):

- `formatPhase(phase)` - Convert GamePhase to readable string
- `formatTurn(phase, yourSeat)` - Show active player with YOUR TURN highlight
- `formatWall(remainingTiles)` - "86 tiles remaining (0% drawn)"

---

### Phase 3: Hand Display (Priority 1)

**File**: `apps/client/src/components/HandDisplay.tsx`

**Component Responsibilities**:

- Display 14 tiles from `yourHand` array
- Show tiles as text buttons (e.g., "1B", "2C", "Dragon-Red", "Joker")
- Tile selection (toggle selected state on click)
- Sort controls: By Suit / By Rank toggle
- Exposed melds section (show your exposed Pungs/Kongs/Quints)

**State Dependencies**:

- `gameStore.yourHand` - array of Tile (0-36)
- `uiStore.selectedTiles` - Set<string> for multi-select
- `uiStore.sortingMode` - "suit" | "rank"

**Tile Display**:

- Use `tileToString(tile: Tile): string` utility to convert Tile index to readable name
- Format: Bam 1-9 (1B-9B), Crak 1-9 (1C-9C), Dot 1-9 (1D-9D), Winds (E/S/W/N), Dragons (G/R/W), Flowers (F), Joker (J)
- Display as simple text buttons with index labels (0-13)
- Selected tiles: highlight with border/background color

**Sorting**:

- By Suit: Flowers → Bam → Crak → Dot → Dragons → Winds → Jokers
- By Rank: 1s → 2s → 3s → ... → 9s → Flowers → Dragons → Winds → Jokers

---

### Phase 4: Turn Actions (Priority 1)

**File**: `apps/client/src/components/TurnActions.tsx`

**Component Responsibilities**:

- **Discard Phase**: Show "Discard Tile" button (click tile in hand first to select)
- **Call Window**: Show "Call Pung", "Call Kong", "Call Quint", "Pass" buttons
- **Charleston Phase**: Show "Pass 3 Tiles" button (select 3 tiles first)
- **Charleston Voting**: Show "Continue" / "Stop" buttons
- **Mahjong**: Show "Declare Mahjong" button (when applicable)
- **Ready to Start**: Show "Ready" button in WaitingForPlayers phase

**State Dependencies**:

- `gameStore` - phase, yourSeat, yourHand, canDiscard(), canCall(), isMyTurn()
- `uiStore.selectedTiles`
- `useCommandSender()` hook from commands.ts

**Action Logic**:

```typescript
// Discard: requires 1 selected tile + canDiscard()
// Call: requires CallWindow phase
// Charleston: requires Charleston phase + 3 selected tiles (or 0-3 for courtesy)
// Vote: requires VotingToContinue phase
// Mahjong: always available (server validates)
```text

**Command Sending**:

```typescript
const { sendDiscard, sendCall, sendPass, sendCharlestonPass, sendVote } = useCommandSender();

// Example: discard button
onClick={() => {
  const tile = Array.from(selectedTiles)[0]; // first selected tile
  const { command, error } = sendDiscard(yourSeat, tile);
  if (error) showError(error);
  else sendCommand(command);
}}
```text

---

### Phase 5: Event Log (Priority 2)

**File**: `apps/client/src/components/EventLog.tsx`

**Component Responsibilities**:

- Display last 10 events from server
- Scrollable list (auto-scroll to bottom on new events)
- Format events as human-readable text
  - "East drew a tile"
  - "South discarded 3 Bam"
  - "West called Pung on 3 Bam"
  - "Charleston: Pass Right (1st) complete"

**State Dependencies**:

- New `uiStore.eventLog: string[]` - add in implementation
- Listen to game store events via `applyEvent()` and log them

**Event Formatting**:

```typescript
function formatEvent(event: GameEvent): string {
  switch (event.type) {
    case 'TileDrawn':
      return `${event.player} drew a tile`;
    case 'TileDiscarded':
      return `${event.player} discarded ${tileToString(event.tile)}`;
    case 'TileCalled':
      return `${event.player} called ${event.meld.type}`;
    // ... etc
  }
}
```text

---

### Phase 6: Discard Pile & Table View (Priority 2)

**File**: `apps/client/src/components/DiscardPile.tsx`

**Component Responsibilities**:

- Show 4 discard piles (one per player)
- Display last 6 discards per player as text
- Highlight most recent discard (if CallWindow active)

**State Dependencies**:

- `gameStore.discardPile` - array of `{ tile, discarded_by }`

**Layout**:

```text
East:   [3B] [5D] [Dragon-R] [2C] [Joker] [Wind-N]
South:  [1B] [7C] ...
West:   ...
North:  ...
```text

---

### Phase 7: App Layout (Priority 1)

**File**: Update `apps/client/src/App.tsx`

**Layout Structure**:

```text
┌─────────────────────────────────────────┐
│ ConnectionPanel (status, room controls) │
├─────────────────────────────────────────┤
│ GameStatus (phase, turn, wall, players) │
├─────────────────────────────────────────┤
│ DiscardPile (4 player discard piles)    │
├─────────────────────────────────────────┤
│ HandDisplay (your 14 tiles)             │
├─────────────────────────────────────────┤
│ TurnActions (discard/call/pass buttons) │
├─────────────────────────────────────────┤
│ EventLog (last 10 events)               │
└─────────────────────────────────────────┘
```text

**Conditional Rendering**:

- Show ConnectionPanel always
- Show GameStatus only when `yourSeat` is assigned
- Show HandDisplay only when hand.length > 0
- Show TurnActions only when in game (not WaitingForPlayers)
- Show EventLog always

---

### Phase 8: Utilities (Priority 1)

**File**: `apps/client/src/utils/tileFormatter.ts`

**Functions**:

```typescript
/**
 * Convert Tile index (0-36) to human-readable string.
 *
 * Examples:
 * - 0 → "1 Bam"
 * - 9 → "1 Crak"
 * - 27 → "East Wind"
 * - 31 → "Green Dragon"
 * - 34 → "Flower"
 * - 35 → "Joker"
 */
export function tileToString(tile: Tile): string;

/**
 * Convert Tile to short code (for compact display).
 *
 * Examples:
 * - 0 → "1B"
 * - 9 → "1C"
 * - 27 → "E"
 * - 31 → "GD"
 * - 34 → "F"
 * - 35 → "J"
 */
export function tileToCode(tile: Tile): string;

/**
 * Sort tiles by suit.
 */
export function sortBySuit(tiles: Tile[]): Tile[];

/**
 * Sort tiles by rank.
 */
export function sortByRank(tiles: Tile[]): Tile[];
```text

**Tile Index Map** (from CLAUDE.md):

- 0-8: Bams (1B-9B)
- 9-17: Craks (1C-9C)
- 18-26: Dots (1D-9D)
- 27-30: Winds (E, S, W, N)
- 31-33: Dragons (Green, Red, White/Soap)
- 34: Flowers
- 35-36: Jokers (treat as 35+ for all Jokers in display)

---

## File Structure

```text
apps/client/src/
├── App.tsx                          # Main layout (updated)
├── components/
│   ├── ConnectionPanel.tsx          # NEW - Connection + room controls
│   ├── GameStatus.tsx               # NEW - Phase, turn, wall, players
│   ├── HandDisplay.tsx              # NEW - Your 14 tiles
│   ├── TurnActions.tsx              # NEW - Discard/call/pass buttons
│   ├── EventLog.tsx                 # NEW - Event history
│   ├── DiscardPile.tsx              # NEW - 4-player discard piles
│   └── ui/
│       └── CardViewer.tsx           # EXISTING - Keep as-is
├── utils/
│   ├── tileFormatter.ts             # NEW - Tile display utilities
│   ├── commands.ts                  # EXISTING - Use as-is
│   ├── cardLoader.ts                # EXISTING - Use as-is
│   └── seat.ts                      # EXISTING - Use as-is
├── hooks/
│   ├── useGameSocket.ts             # EXISTING - Use as-is
│   └── useActionQueue.ts            # EXISTING - Use as-is
└── store/
    ├── gameStore.ts                 # EXISTING - Minor updates for helper methods
    └── uiStore.ts                   # EXISTING - Add eventLog array
```text

---

## Implementation Order

### Iteration 1: Core Gameplay (Minimum Viable)

1. ✅ **tileFormatter.ts** - Utility functions first (no dependencies)
2. ✅ **ConnectionPanel.tsx** - Get connected and create/join rooms
3. ✅ **GameStatus.tsx** - See what's happening in the game
4. ✅ **HandDisplay.tsx** - See your tiles
5. ✅ **TurnActions.tsx** - Play the game (discard, call, pass)
6. ✅ **App.tsx** - Wire everything together

**At this point**: You can play a full game in the browser (no Charleston, no polish)

### Iteration 2: Charleston Support

1. ✅ Update **TurnActions.tsx** - Add Charleston tile selection + pass button
2. ✅ Update **TurnActions.tsx** - Add Charleston voting buttons
3. ✅ Update **GameStatus.tsx** - Show Charleston stage clearly

**At this point**: Full game playable including Charleston

### Iteration 3: Enhanced Feedback

1. ✅ **EventLog.tsx** - See what happened recently
2. ✅ **DiscardPile.tsx** - See all discards
3. ✅ Minor CSS - Add basic spacing, borders, and colors for readability

**At this point**: Production-ready testing interface

---

## Technical Notes

### Type Safety

- All components use TypeScript strict mode
- Import types from `src/types/bindings/index.ts`
- No `any` types without justification

### State Updates

- **Never mutate game state directly** - all updates via `applyEvent()`
- Commands are validated client-side but server is authoritative
- Use `useCommandSender()` for pre-validated command builders

### Error Handling

- Display errors from `uiStore.errors[]` in ConnectionPanel
- Server errors automatically added to error array (see `gameStore.applyEvent`)
- 5-second auto-dismiss for errors

### Testing Strategy

1. Test with 4 bots: Create room, let AI play full game
2. Test with 1 human + 3 bots: Join, play through Charleston, discard, call, win
3. Test room creation with different card years (2017-2025)
4. Test reconnection: Disconnect, reconnect, verify state snapshot loads
5. Test error cases: Invalid commands, bad room IDs, disconnections

---

## Verification Checklist

After implementation, verify these flows work:

### Connection Flow

- [ ] Can connect to server (ws://localhost:3000/ws)
- [ ] Auto-authenticates as guest
- [ ] Can create room with card year selection
- [ ] Can join existing room by ID
- [ ] Connection status displays correctly
- [ ] Player ID, seat, and room ID show after joining

### Game Setup Flow

- [ ] See "Waiting for Players" phase
- [ ] Can click "Ready" button
- [ ] Game starts when 4 players ready (or auto-starts with bots)
- [ ] Tiles dealt and displayed in hand

### Charleston Flow (if enabled)

- [ ] See Charleston phase indicator (Pass Right/Across/Left)
- [ ] Can select 3 tiles (or 0-3 for courtesy)
- [ ] "Pass Tiles" button enabled when 3 selected
- [ ] Receive tiles after pass completes
- [ ] Voting UI appears after first Charleston
- [ ] Second Charleston optional (based on votes)

### Main Game Flow

- [ ] See whose turn it is
- [ ] "YOUR TURN" highlights when it's your turn
- [ ] Can discard tile (select tile, click "Discard")
- [ ] Discard appears in discard pile
- [ ] Call window appears after discard
- [ ] Can call Pung/Kong/Quint with buttons
- [ ] Can pass on call window
- [ ] Meld appears in exposed melds section
- [ ] Turn advances correctly

### Win Flow

- [ ] Can declare Mahjong when hand matches pattern
- [ ] Game ends with winner announcement
- [ ] Can start new game (create/join new room)

### Error Handling Verification

- [ ] Invalid commands show error message
- [ ] Server errors display in UI
- [ ] Errors auto-dismiss after 5 seconds
- [ ] Disconnection shows in connection status
- [ ] Reconnection restores game state

---

## Known Limitations (Acceptable for MVP)

1. **No animations** - Instant state updates only (animation queue disabled for testing)
2. **No drag-and-drop** - Click to select tiles
3. **No tile images** - Text-based display only (e.g., "3 Bam", "Red Dragon")
4. **No sound effects** - Silent gameplay
5. **No mobile optimization** - Desktop browser only
6. **No pattern matching in CardViewer** - Browse patterns but no hand highlighting (future enhancement)
7. **No score tracking** - Win/loss only, no point tallying across games
8. **No replay viewer** - Play only, no game history browsing
9. **No spectator mode** - Must be a player to view game
10. **No advanced bot configuration** - Just difficulty level, no custom strategies

These can be added later as Phase 2 enhancements once core gameplay is validated.

---

## Dependencies

All dependencies already installed:

- React 19.2.0
- Zustand 5.0.2
- TypeScript (strict mode)
- Existing WebSocket integration
- Existing state management

**No new packages needed** for MVP.

---

## Styling Strategy

Use minimal inline styles or basic CSS classes for **basic readability**:

- **Borders**: Sections clearly separated
- **Colors**:
  - Green text/background for "YOUR TURN" indicator
  - Blue border for selected tiles
  - Red text for errors
  - Yellow/amber for warnings (e.g., "Call Window")
  - Gray for disabled buttons
- **Typography**:
  - Bold text for emphasis (YOUR TURN, phase names)
  - Monospace font for tile codes (1B, 2C, etc.)
- **Layout**: Flexbox for simple responsive layouts
- **Buttons**: Basic border + padding, color-coded by action type
  - Primary actions (Discard, Call, Ready): Blue/green
  - Negative actions (Pass): Gray
  - Destructive (Leave Room): Red

**No CSS framework needed** - keep it simple and fast.

---

## Success Criteria

Implementation is complete when:

1. ✅ Can create/join rooms in browser
2. ✅ Can play full game from WaitingForPlayers → Charleston → Playing → GameOver
3. ✅ Can see all game state (hand, phase, turn, discards, players)
4. ✅ Can execute all game commands (discard, call, pass, charleston, vote, mahjong)
5. ✅ Can test backend by playing 1 human + 3 bots
6. ✅ All errors display clearly
7. ✅ No console errors or warnings
8. ✅ TypeScript strict mode passes

---

## Estimated Effort

- **Iteration 1 (Core Gameplay)**: ~6 components, ~800 LOC, 4-6 hours
- **Iteration 2 (Charleston)**: ~2 component updates, ~200 LOC, 1-2 hours
- **Iteration 3 (Polish)**: ~2 components + CSS, ~200 LOC, 1-2 hours

**Total**: ~1200 LOC, 6-10 hours

---

## Files to Modify

### New Files (7)

1. `apps/client/src/components/ConnectionPanel.tsx`
2. `apps/client/src/components/GameStatus.tsx`
3. `apps/client/src/components/HandDisplay.tsx`
4. `apps/client/src/components/TurnActions.tsx`
5. `apps/client/src/components/EventLog.tsx`
6. `apps/client/src/components/DiscardPile.tsx`
7. `apps/client/src/utils/tileFormatter.ts`

### Modified Files (2)

1. `apps/client/src/App.tsx` - Update layout
2. `apps/client/src/store/uiStore.ts` - Add eventLog array

### Unchanged Files (Use As-Is)

- All existing hooks, stores (except uiStore minor update), utils, bindings
