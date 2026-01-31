# US-022: Smart Undo (Solo - Immediate)

## Story

**As a** player in a solo/practice game or testing mode
**I want** to undo my last action immediately without voting
**So that** I can experiment with different strategies and learn the game

## Acceptance Criteria

### AC-1: Undo Availability (Solo Game Only)

**Given** I am in a solo game (all other players are bots) or practice mode
**When** I complete an action (discard, pass tiles, call, etc.)
**Then** an "Undo" button appears in the action bar
**And** a keyboard shortcut (Ctrl+Z) is active
**And** a message displays: "Press Ctrl+Z to undo last action"

### AC-2: Undo Last Action

**Given** I am in a solo game and I discarded a tile
**When** I click the "Undo" button or press Ctrl+Z
**Then** a `RequestUndo { player: me }` command is sent
**And** the button shows loading state

### AC-3: Undo Executed

**Given** I requested undo
**When** the server emits `StateRestored { move_number: N-1, description: "Undid discard", mode: Immediate }`
**Then** the game state reverts to before my last action
**And** my hand is restored to the pre-action state
**And** the discarded tile returns to my hand
**And** a message displays: "Undid: Discarded 5 Dots"
**And** an undo sound effect plays (soft "whoosh")

### AC-4: Undo Limit

**Given** I am in a solo game
**When** I can undo multiple times
**Then** I can undo up to the last 10 moves (configurable)
**And** the "Undo" button shows "Undo (3 available)" if 3 undos remaining
**And** once limit is reached, button is disabled with message: "Undo limit reached"

### AC-5: Undo During Charleston

**Given** I am in Charleston phase and passed tiles
**When** I undo
**Then** the tile pass is reversed
**And** the passed tiles return to my hand
**And** my selection state is reset
**And** I can re-select different tiles to pass

### AC-6: Undo After Calling

**Given** I called a discard for Pung
**When** I undo
**Then** the Pung meld is removed from my exposed melds
**And** the tiles return to my concealed hand
**And** the called tile returns to the discard pool
**And** the turn state is restored

### AC-7: Cannot Undo in Multiplayer

**Given** I am in a multiplayer game with other human players
**When** I look for the "Undo" button
**Then** the button does NOT appear
**And** Ctrl+Z does nothing
**And** a message displays: "Undo not available in multiplayer - use voting undo (see Help)"
**Note:** Use US-023 for multiplayer undo

### AC-8: Undo Not Available After Mahjong

**Given** someone declared Mahjong (including me)
**When** validation is pending or complete
**Then** the "Undo" button is disabled
**And** undo cannot be used (game is ending)

### AC-9: Undo Confirmation (Optional)

**Given** undo confirmation is enabled in settings
**When** I click "Undo"
**Then** a confirmation dialog appears: "Undo last action?"
**And** I can confirm or cancel

### AC-10: Undo History Display

**Given** I am in a solo game
**When** I hover over the "Undo" button
**Then** a tooltip shows my last 3 actions:
  - "Discarded 5 Dots"
  - "Drew tile"
  - "Passed 3 tiles right"
**And** clicking undo will reverse the most recent (top) action

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  RequestUndo: {
    player: Seat
  }
}
```

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    StateRestored: {
      move_number: number,  // Move reverted to
      description: string,  // "Undid discard of 5 Dots"
      mode: "Immediate"     // Solo undo (not voting)
    }
  }
}

{
  kind: 'Public',
  event: {
    HistoryTruncated: {
      from_move: number  // Moves N onward are deleted
    }
  }
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `RequestUndo`
  - `crates/mahjong_core/src/history.rs` - Move history and restoration
  - `crates/mahjong_core/src/table/snapshot.rs` - State snapshots
  - `crates/mahjong_core/src/event/public_events.rs` - `StateRestored`, `HistoryTruncated`
- **Game Design Doc**:
  - Section 5.1 (Undo System - Solo Mode)
  - Section 5.2 (Move History and State Restoration)

## Components Involved

- **`<ActionBar>`** - "Undo" button
- **`<UndoButton>`** - Button with undo count and tooltip
- **`<UndoConfirmationDialog>`** - Optional confirmation
- **`<UndoTooltip>`** - Shows recent actions
- **`useSoundEffects()`** - Undo sound

**Component Specs:**

- `component-specs/presentational/UndoButton.md` (NEW)
- `component-specs/presentational/UndoConfirmationDialog.md` (NEW)
- `component-specs/presentational/UndoTooltip.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/undo-solo-discard.md`** - Undo last discard
- **`tests/test-scenarios/undo-solo-charleston.md`** - Undo Charleston pass
- **`tests/test-scenarios/undo-solo-call.md`** - Undo called meld
- **`tests/test-scenarios/undo-limit.md`** - Undo limit reached
- **`tests/test-scenarios/undo-multiplayer-blocked.md`** - Undo unavailable in multiplayer

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/solo-game-with-undo.json`
- `tests/fixtures/events/undo-solo-sequence.json`

## Edge Cases

### EC-1: Undo Limit

After 10 undos (configurable), button disabled. Must play forward or restart game.

### EC-2: Cannot Undo in Multiplayer

Solo undo only works in solo/practice mode. Multiplayer requires voting (US-023).

### EC-3: Undo After Mahjong Declaration

Cannot undo once Mahjong declared (game ending).

### EC-4: Network Error on Undo

If undo command fails, retry logic applies (max 3 attempts).

## Related User Stories

- **US-023**: Smart Undo (Voting - Multiplayer) - Multiplayer variant
- **US-024**: View Move History - See move history
- **US-025**: Jump to Historical Move - Jump to specific move

## Accessibility Considerations

### Keyboard Navigation

- **Ctrl+Z**: Undo last action
- **Alt+Z**: Show undo tooltip

### Screen Reader

- **Undo Available**: "Undo available. Press Ctrl+Z to undo last action: Discarded 5 Dots."
- **Undo Executed**: "Undid last action: Discarded 5 Dots. Game state restored to move 42."

### Visual

- **High Contrast**: Undo button clearly labeled
- **Undo Icon**: Curved arrow icon (⟲)

## Priority

**MEDIUM** - Useful for learning and practice

## Story Points / Complexity

**5** - Medium-High complexity

- State restoration
- History management
- Undo limit tracking
- Solo vs multiplayer detection
- Multiple action types (discard, pass, call, etc.)

## Definition of Done

- [ ] "Undo" button appears in solo games only
- [ ] Ctrl+Z keyboard shortcut works
- [ ] Click/shortcut sends `RequestUndo` command
- [ ] `StateRestored` event reverts game state
- [ ] Previous game state fully restored (hand, melds, discards, etc.)
- [ ] Undo message displays action reversed
- [ ] Undo sound effect plays
- [ ] Undo limit enforced (default 10)
- [ ] Button shows "Undo (X available)"
- [ ] Button disabled when limit reached
- [ ] Tooltip shows last 3 actions
- [ ] Cannot undo after Mahjong declaration
- [ ] Undo not available in multiplayer games
- [ ] Optional confirmation dialog works
- [ ] Component tests pass
- [ ] Integration tests pass
- [ ] E2E test passes
- [ ] Accessibility tests pass
- [ ] Code reviewed and approved

## Notes for Implementers

### Solo Game Detection

```typescript
function isSoloGame(players: Player[]): boolean {
  const humanPlayers = players.filter(p => !p.is_bot);
  return humanPlayers.length === 1;
}

const canUseImmediateUndo = isSoloGame(players);
```

### Undo Button

```typescript
<UndoButton
  available={canUseImmediateUndo && undoCount > 0}
  count={undoCount}
  limit={10}
  recentActions={recentActions}
  onUndo={() => {
    sendCommand({ RequestUndo: { player: mySeat } });
  }}
/>
```

### State Restoration

Backend maintains move history with snapshots. On undo:

```rust
pub fn undo(&mut self) -> Result<(), Error> {
    if !self.can_undo() {
        return Err(Error::UndoNotAvailable);
    }

    let previous_move = self.history.current_move - 1;
    let snapshot = self.history.get_snapshot(previous_move)?;
    self.restore_from_snapshot(snapshot);
    self.history.current_move = previous_move;

    Ok(())
}
```

Frontend receives `StateRestored` event with full state update.

### Zustand Store Updates

```typescript
case 'StateRestored':
  // Restore full game state from snapshot
  state.phase = restoredState.phase;
  state.yourHand = restoredState.yourHand;
  state.exposedMelds = restoredState.exposedMelds;
  state.discardPool = restoredState.discardPool;
  state.currentMove = event.move_number;
  state.undoCount = Math.max(0, state.undoCount - 1);
  break;
```
