# Test Scenario: View Move History

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-024 - View Move History
**Component Specs**: HistoryPanel.md, GameTable.md, HistoryItem.md
**Fixtures**: `playing-mid-game.json`, `history-sequence.json`
**Manual Test**: Manual Testing Checklist #24

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-mid-game.json`
- **Mock WebSocket**: Connected
- **User seated as**: East
- **Current turn**: South (not user's turn)
- **Game phase**: Playing
- **Move history**: 25 moves recorded (from game start to current state)
- **History panel**: Closed (hidden by default)

## Steps (Act)

### Step 1: Verify game state before opening history

- UI shows game table with all players' hands (concealed)
- UI shows discard pile with 15 tiles
- UI shows exposed melds for each player
- History panel is closed (not visible)
- "History" button is visible in toolbar or menu

### Step 2: User opens history panel

- User clicks "History" button
- History panel slides in from right side of screen
- UI shows history panel with:
  - Header: "Move History"
  - Move count: "25 moves"
  - List of moves (most recent at top)
  - "Close" button
  - "Jump to Move" button (for each move)

### Step 3: User views move history list

- History panel displays moves in reverse chronological order:
  - **Move 25**: South discarded 7 Dot (26) - 2 minutes ago
  - **Move 24**: South drew tile - 2 minutes ago
  - **Move 23**: West discarded 3 Bam (2) - 3 minutes ago
  - **Move 22**: West drew tile - 3 minutes ago
  - **Move 21**: North called Pung on 5 Crak (13) - 4 minutes ago
  - **Move 20**: East discarded 5 Crak (13) - 4 minutes ago
  - **...**
  - **Move 1**: East rolled dice (3 + 4 = 7) - 45 minutes ago
- Each move shows:
  - Move number
  - Player name
  - Action description
  - Time elapsed
  - "Jump to Move" button

### Step 4: User scrolls through history

- User scrolls down to view older moves
- History panel shows moves 1-25
- User scrolls back up to view recent moves
- Scroll position is preserved

### Step 5: User filters history by move type

- User clicks "Filter" dropdown
- Filter options appear:
  - "All Moves" (default)
  - "Draws Only"
  - "Discards Only"
  - "Calls Only"
  - "Mahjong Only"
- User selects "Discards Only"
- History panel updates to show only discard moves:
  - **Move 25**: South discarded 7 Dot (26)
  - **Move 23**: West discarded 3 Bam (2)
  - **Move 20**: East discarded 5 Crak (13)
  - **...**

### Step 6: User searches for specific move

- User clicks "Search" input field
- User types "Pung"
- History panel filters to show moves containing "Pung":
  - **Move 21**: North called Pung on 5 Crak (13)
  - **Move 15**: East called Pung on 8 Bam (6)
  - **Move 8**: West called Pung on 2 Dot (18)
- User clears search (clicks "X" button)
- History panel shows all moves again

### Step 7: User views move details

- User clicks on Move 21 (North called Pung)
- History panel expands to show move details:
  - **Player**: North
  - **Action**: Called Pung
  - **Tile**: 5 Crak (13)
  - **Discarded by**: East
  - **Meld exposed**: [5 Crak, 5 Crak, 5 Crak]
  - **Turn changed to**: North
  - **Timestamp**: 4 minutes ago
- User clicks "Close Details" button
- Move details collapse

### Step 8: User closes history panel

- User clicks "Close" button
- History panel slides out to the right
- UI returns to normal game view
- "History" button remains visible

### Step 9: User reopens history panel

- User clicks "History" button
- History panel slides in from right side
- History panel shows same state as before (scroll position, filters preserved)

## Expected Outcome (Assert)

- ✅ History panel opened and closed correctly
- ✅ All 25 moves displayed in correct order (most recent first)
- ✅ Each move showed correct information (player, action, time)
- ✅ Filtering by move type worked correctly
- ✅ Search functionality worked correctly
- ✅ Move details expanded and collapsed correctly
- ✅ Scroll position and filters preserved between open/close
- ✅ UI remained responsive during history viewing

## Error Cases

### Opening history panel during call window

- **When**: User clicks "History" button while call window is open
- **Expected**: History panel opens, call window remains visible (overlay)
- **Assert**:
  - History panel slides in
  - Call window overlay remains on top
  - User can interact with both panels

### Opening history panel during user's turn

- **When**: User clicks "History" button during their turn
- **Expected**: History panel opens, turn timer continues
- **Assert**:
  - History panel slides in
  - Turn timer continues counting down
  - User can still make moves while history is open

### Empty history (new game)

- **When**: User clicks "History" button in a new game with no moves
- **Expected**: History panel shows "No moves yet" message
- **Assert**:
  - History panel displays: "No moves recorded yet"
  - Move count shows: "0 moves"
  - Filter and search options disabled

### Large history (100+ moves)

- **When**: Game has 100+ moves recorded
- **Expected**: History panel shows moves with pagination or virtual scrolling
- **Assert**:
  - History panel shows first 50 moves
  - "Load More" button appears
  - User can load additional moves in batches

### WebSocket disconnect during history viewing

- **When**: Connection lost while history panel is open
- **Expected**: History panel remains open, shows cached data
- **Assert**:
  - History panel shows last known state
  - "Reconnecting..." overlay appears
  - On reconnect, history panel updates with latest moves

### Search with no results

- **When**: User searches for "Quint" but no Quint moves exist
- **Expected**: History panel shows "No matching moves" message
- **Assert**:
  - History panel displays: "No moves match 'Quint'"
  - Move count shows: "0 matching moves"

## History Panel Features

### Move Types

| Move Type | Description | Icon |
|-----------|-------------|------|
| Draw | Player drew a tile from wall | 🎴 |
| Discard | Player discarded a tile | 🗑️ |
| Pung | Player called Pung | 📦 |
| Kong | Player called Kong | 📦📦 |
| Quint | Player called Quint | 📦📦📦 |
| Sextet | Player called Sextet | 📦📦📦📦 |
| Mahjong | Player declared Mahjong | 🏆 |
| Joker Exchange | Player exchanged a Joker | 🃏 |
| Undo | Player undid a move | ↩️ |

### Filtering Options

- **All Moves**: Show all move types
- **Draws Only**: Show only draw moves
- **Discards Only**: Show only discard moves
- **Calls Only**: Show only Pung, Kong, Quint, Sextet calls
- **Mahjong Only**: Show only Mahjong declarations

### Search Functionality

- Search by move type (e.g., "Pung", "Kong")
- Search by player name (e.g., "East", "South")
- Search by tile name (e.g., "5 Bam", "Red Dragon")
- Search is case-insensitive
- Partial matches supported

## Cross-References

### Related Scenarios

- `history-jump.md` - Jump to historical move
- `history-resume.md` - Resume from history point
- `undo-solo.md` - Smart undo (solo mode)
- `undo-voting.md` - Smart undo (multiplayer voting)

### Related Components

- [HistoryPanel](../../component-specs/game/HistoryPanel.md)
- [HistoryItem](../../component-specs/game/HistoryItem.md)
- [GameTable](../../component-specs/game/GameTable.md)
- [Toolbar](../../component-specs/game/Toolbar.md)

### Backend References

- Events: `mahjong_core::event::MoveRecorded` (hypothetical event for history tracking)
- State: `GameState::history` (array of move records)
- API: `mahjong_core::api::get_history()` (endpoint to fetch move history)

### Accessibility Notes

- "History" button announced: "View move history, 25 moves recorded"
- History panel announced: "Move history panel opened, 25 moves"
- Move item announced: "Move 25: South discarded 7 Dot (26), 2 minutes ago"
- Filter dropdown announced: "Filter moves, All Moves selected"
- Search input announced: "Search moves, type to filter"
- Move details announced: "Move 21 details: North called Pung on 5 Crak (13), discarded by East"
- "Close" button announced: "Close move history"
