# Phase 15: History & Replay System

**Priority:** MEDIUM
**Estimated Complexity:** High
**Dependencies:** None

## Overview

Implement a comprehensive history and replay system that allows players to view past game states, jump to specific moves, resume playing from a historical point, and return to the present.

**Important accuracy notes:**

- Command helpers live in `apps/client/src/utils/commands.ts`.
- History features are **practice-mode only** (server rejects history commands otherwise).
- History list entries are `MoveHistorySummary` (no full state in the list).
- History view changes arrive via `StateRestored` and `HistoryTruncated` events.

## Commands to Implement (4)

### 1. RequestHistory

**Backend Location:** [command.rs:182](../../../crates/mahjong_core/src/command.rs#L182)

**Description:** Request the full history list containing all moves made in the game.

**Current Status:**

- Command builder: Needs to be created in `apps/client/src/utils/commands.ts`
- Validation: Practice mode only (server rejects otherwise)
- Returns: `HistoryList` event with `MoveHistorySummary` entries

**UI Requirements:**

- Add "View History" button in game menu
- Display history panel/sidebar showing all moves chronologically
- Each move entry shows:
  - Move number
  - Timestamp
  - Player who made the move
  - Action description (e.g., "East discarded 5 Dot")
  - Optional: Thumbnail of game state
- Click move → jump to that state (uses JumpToMove)
- Scroll to current move (highlighted)
- Search/filter moves (optional)

**Design Considerations:**

- Should history be a sidebar, modal, or separate panel?
- How much detail to show per move?
- Should history auto-update as game progresses?
- Lazy load history for long games?

---

### 2. JumpToMove

**Backend Location:** [command.rs:185](../../../crates/mahjong_core/src/command.rs#L185)

**Description:** Jump to a specific move in history to view that game state (read-only view mode).

**Parameters:**

- `move_number`: u32 - 0-indexed

**Current Status:**

- Command builder: Needs to be created in `apps/client/src/utils/commands.ts`
- Validation: Practice mode only; move number must exist in history
- Effect: Enter "history view mode" - game state shown at that point, but actions disabled

**UI Requirements:**

- History view mode indicators:
  - Banner: "Viewing History - Move 42 of 120"
  - Disable all game action buttons
  - Show "Return to Present" button prominently
  - Gray out or dim UI to indicate read-only
- Game board shows state at selected move
- History panel shows current move highlighted
- Navigation controls:
  - Previous move (◀)
  - Next move (▶)
  - Slider to scrub through moves
  - Jump to move number input

**Design Considerations:**

- Should history mode pause the live game?
- Can multiple players view history simultaneously?
- How to handle new moves while in history view?
- Should there be a play/pause auto-replay feature?

---

### 3. ResumeFromHistory

**Backend Location:** [command.rs:188](../../../crates/mahjong_core/src/command.rs#L188)

**Description:** Resume playing from the current history point, discarding all future moves.

**Parameters:**

- `move_number`: u32 - point to resume from (future moves deleted)

**Current Status:**

- Command builder: Needs to be created in `apps/client/src/utils/commands.ts`
- Validation: Practice mode only (no multiplayer vote flow in current backend)
- Effect: Destructive action - all moves after this point are permanently deleted

**UI Requirements:**

- Add "Resume from Here" button when viewing history
- **Critical**: Show strong warning dialog:

  ```text
  ⚠️  Warning: Resume from Move 42?

  This will DELETE all moves after move 42.

  Moves 43-120 will be permanently lost.

  Practice Mode: Immediate effect
  Multiplayer: Requires unanimous vote

  [Cancel] [Resume from Here]
  ```

- Multiplayer voting is not implemented for history resume; if required, add backend support.
- After resume: Exit history mode, enable actions, continue game from that point

**Design Considerations:**

- Should this require double confirmation?
- Should there be a backup/export before destructive resume?
- In multiplayer, how to handle vote rejection?
- Can you resume from move 0 (restart game)?

---

### 4. ReturnToPresent

**Backend Location:** [command.rs:191](../../../crates/mahjong_core/src/command.rs#L191)

**Description:** Exit history view mode and return to the present game state.

**Current Status:**

- Command builder: Needs to be created in `apps/client/src/utils/commands.ts`
- Validation: Only valid when in history view mode
- Effect: Exit read-only mode, restore current game state, re-enable actions

**UI Requirements:**

- "Return to Present" button always visible in history mode
- Button should be prominent and easy to find
- Click → immediate return to current state
- Close history panel
- Remove history mode indicators
- Re-enable game action buttons
- Restore normal UI colors/styling
- Auto-scroll to current move if history panel stays open

**Design Considerations:**

- Should return also close history panel?
- Or keep history panel open but show current state?
- Keyboard shortcut for quick return (Esc key)?
- What if current game state changed while viewing history?

---

## Testing Checklist

### RequestHistory

- [ ] History button appears in game menu
- [ ] Clicking history button fetches move list
- [ ] All moves displayed chronologically
- [ ] Move details accurate (player, action, timestamp)
- [ ] Current move highlighted
- [ ] History updates when new moves occur

### JumpToMove

- [ ] Clicking move in history jumps to that state
- [ ] Game board accurately shows historical state
- [ ] All UI elements reflect historical state (hands, melds, etc.)
- [ ] Action buttons disabled in history mode
- [ ] "Viewing History" indicator shown
- [ ] Can navigate between moves (prev/next)
- [ ] Invalid move numbers rejected

### ResumeFromHistory

- [ ] "Resume from Here" button appears in history mode
- [ ] Warning dialog shows move count to be deleted
- [ ] In practice mode: immediate resume after confirmation
- [ ] In multiplayer: triggers voting
- [ ] After resume: game continues from that point
- [ ] Future moves deleted permanently
- [ ] History panel updates to reflect new timeline

### ReturnToPresent

- [ ] "Return to Present" button always visible in history mode
- [ ] Clicking returns to current game state
- [ ] History mode indicators cleared
- [ ] Action buttons re-enabled
- [ ] Game state matches current reality
- [ ] Esc key shortcut works (if implemented)

---

## Files to Modify

### New Files

- `apps/client/src/components/HistoryPanel.tsx` - Main history UI
- `apps/client/src/components/HistoryTimeline.tsx` - Timeline/list of moves
- `apps/client/src/components/HistoryControls.tsx` - Prev/Next/Return buttons
- `apps/client/src/components/ResumeFromHistoryDialog.tsx` - Warning dialog
- `apps/client/src/hooks/useHistory.ts` - History state management

### Modified Files

- `apps/client/src/App.tsx` - Add history button and panel
- `apps/client/src/utils/commands.ts` - Add all 4 command builders
- `apps/client/src/store/gameStore.ts` - Add history state, view mode flag
- `apps/client/src/hooks/useGameSocket.ts` - Handle history events
- `apps/client/src/components/TurnActions.tsx` - Disable actions in history mode

---

## Backend Events to Handle

### Expected Server Events

- `HistoryList { entries: MoveHistorySummary[] }` - Full move history (summaries)
- `StateRestored { move_number, description, mode }` - Jumped/returned/resumed state restore
- `HistoryTruncated { from_move }` - Future moves deleted after resume
- `HistoryError { message }` - Invalid history request (wrong mode/invalid move/practice-only)

### Error Events

- `HistoryError { message }` - All invalid history requests (invalid move, not in history mode, not practice mode)

---

## Type Definitions

### Move Type

```typescript
Use generated types:

- `MoveHistorySummary` (from bindings)
- `MoveAction` (from bindings)
```text

### History State

```typescript
interface HistoryState {
  moves: MoveHistorySummary[];
  currentMove: number; // Current position in timeline
  isViewingHistory: boolean;
  viewingMove?: number; // Which move being viewed
}
```text

---

## UI/UX Design

### History Panel Layout

```text
┌─────────────────────────────────┐
│ Game History                [X] │
├─────────────────────────────────┤
│                                 │
│ Move 1 - East rolled dice      │
│ Move 2 - East drew tile        │
│ Move 3 - East discarded 5 Dot  │
│ ...                             │
│ ● Move 42 - South called Pung  │ ← Current
│ Move 43 - South discarded...   │
│ ...                             │
│                                 │
├─────────────────────────────────┤
│ [◀ Prev] [▶ Next] [⏮ Present] │
└─────────────────────────────────┘
```text

### History View Mode Banner

```text
┌─────────────────────────────────────────┐
│ 📜 Viewing History - Move 42 of 120     │
│ [⏮ Return to Present]                   │
└─────────────────────────────────────────┘
```text

---

## Success Criteria

✅ History panel shows all moves chronologically
✅ Can jump to any move in history
✅ Game state accurately reflects selected move
✅ History view mode disables game actions
✅ Can navigate between moves smoothly
✅ Return to present restores current state
✅ Resume from history works with proper warnings
✅ Resume from history is practice-mode only (no multiplayer vote flow)
✅ Future moves deleted after resume
✅ UI clearly indicates history mode vs live game
