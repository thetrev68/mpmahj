# US-026: Resume from History Point

## Story

**As a** player in a solo/practice game
**I want** to resume playing from a historical move, creating a new branch of gameplay
**So that** I can explore different strategies from a past state

## Acceptance Criteria

### AC-1: Resume Option in Historical View (Solo Only)

**Given** I am viewing a historical state (move #42) in a solo game
**When** the historical view banner is displayed
**Then** a "Resume from Here" button appears next to "Return to Current"
**And** the button is only visible in solo games (not multiplayer or completed games)

### AC-2: Resume Confirmation Dialog

**Given** I click "Resume from Here" at move #42
**When** the button is clicked
**Then** a confirmation dialog appears:

- **Title**: "Resume Playing from Move #42?"
- **Warning**: "This will delete all moves after #42 (45 moves will be lost)"
- **Details**: "Current move: #87 → New move: #42"
- **Buttons**: "Confirm Resume" | "Cancel"

### AC-3: Initiate Resume from Historical Move

**Given** I confirmed resume from move #42
**When** I click "Confirm Resume"
**Then** a `ResumeFromHistory { player: me, move_number: 42 }` command is sent
**And** a loading overlay appears: "Resuming from move #42..."

### AC-4: History Truncation

**Given** the server processed my resume request
**When** the server emits `HistoryTruncated { from_move: 43 }`
**Then** all moves from #43 onward are deleted
**And** the move history now ends at move #42
**And** a message displays: "45 future moves deleted. Game resumed from move #42."

### AC-5: State Restoration for Playable Mode

**Given** history was truncated
**When** the server emits `StateRestored { move_number: 42, description: "Resumed from move 42", mode: Resume }`
**Then** the game state is restored to move #42
**And** the historical view banner is removed
**And** the game becomes playable again (not read-only)
**And** all action buttons are re-enabled
**And** I can now make new decisions from this point

### AC-6: New Branch of Gameplay

**Given** I resumed from move #42 (original: South discarded 5 Dots)
**When** I make a different decision (e.g., discard 7 Bamboo instead)
**Then** a new move #43 is created with my new action
**And** the history diverges from the original timeline
**And** the old moves #43-#87 are permanently lost

### AC-7: Cannot Resume in Multiplayer

**Given** I am in an active multiplayer game (2+ human players)
**When** I view a historical state
**Then** the "Resume from Here" button does NOT appear
**And** a tooltip explains: "Resume only available in solo games"

### AC-8: Cannot Resume in Completed Games

**Given** I am viewing a completed game (game over)
**When** I jump to a historical state
**Then** the "Resume from Here" button does NOT appear
**And** a message: "Cannot resume from completed game. Start a new game to practice."

### AC-9: Auto-Save Before Resume (Optional)

**Given** I am about to resume from move #42
**When** auto-save is enabled in settings
**Then** the current game state (all 87 moves) is auto-saved to a file
**And** a notification: "Game auto-saved before resume: game-{timestamp}.json"
**And** I can restore the original timeline from the saved file later

### AC-10: Resume Cancellation

**Given** the confirmation dialog is open
**When** I click "Cancel" or press Escape
**Then** the dialog closes
**And** no history is truncated
**And** I remain in historical view mode at move #42

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  ResumeFromHistory: {
    player: Seat,
    move_number: number
  }
}
```text

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    HistoryTruncated: {
      from_move: number  // First move deleted (43 onwards)
    }
  }
}

{
  kind: 'Public',
  event: {
    StateRestored: {
      move_number: number,
      description: string,
      mode: "Resume"
    }
  }
}
```text

### Backend References

- `crates/mahjong_core/src/command.rs` - `ResumeFromHistory`
- `crates/mahjong_core/src/history.rs` - History truncation
- `crates/mahjong_core/src/event/public_events.rs` - `HistoryTruncated`, `StateRestored`

## Components Involved

- **`<ResumeButton>`** - "Resume from Here" button
- **`<ResumeConfirmationDialog>`** - Warning dialog
- **`<HistoricalViewBanner>`** - Updated to show resume option

## Test Scenarios

- **`tests/test-scenarios/resume-from-history-solo.md`**
- **`tests/test-scenarios/resume-history-truncation.md`**
- **`tests/test-scenarios/resume-blocked-multiplayer.md`**

## Edge Cases

### EC-1: Resume from Move #1

Resume from start deletes entire game history.

### EC-2: Resume from Current Move

Resume from current move is no-op (no changes).

### EC-3: Multiplayer Restriction

Resume blocked in multiplayer games.

### EC-4: Network Error

Retry logic applies if network fails during resume.

## Related User Stories

- US-025: Jump to Historical Move
- US-022: Smart Undo (Solo)

## Accessibility Considerations

### Keyboard

- **R Key**: Resume from current historical view
- **Enter**: Confirm resume in dialog

### Screen Reader

- "Resume button available. Press R to resume playing from move 42. Warning: This will delete 45 future moves."

## Priority

**MEDIUM** - Practice/learning feature

## Story Points

**8** - High complexity (state branching, history truncation)

## Definition of Done

- [ ] "Resume from Here" button in historical view (solo only)
- [ ] Confirmation dialog with warning about deleted moves
- [ ] `ResumeFromHistory` command sent on confirm
- [ ] `HistoryTruncated` event deletes future moves
- [ ] `StateRestored` event makes game playable
- [ ] New decisions create divergent timeline
- [ ] Resume blocked in multiplayer and completed games
- [ ] Optional auto-save before resume
- [ ] Component tests pass
- [ ] Integration tests pass
- [ ] Code reviewed and approved

## Notes

Resume creates a new branch. Original timeline is lost unless auto-saved.

```text

```text
```
