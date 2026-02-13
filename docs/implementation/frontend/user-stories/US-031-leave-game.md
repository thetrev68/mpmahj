# US-031: Leave Game

## Story

**As a** player in an active game
**I want** to leave the game gracefully without disrupting other players
**So that** I can exit when needed while my seat is marked disconnected and the game can continue

## Acceptance Criteria

### AC-1: Leave Button Always Visible

**Given** I am in an active game (any phase)
**When** the game UI is displayed
**Then** a "Leave Game" button is visible in the game menu or header
**And** the button is always enabled (no restrictions based on phase)
**And** the button has an icon (e.g., door/exit icon) for visual clarity

### AC-2: Confirmation Dialog Opens

**Given** I am in an active game
**When** I click the "Leave Game" button
**Then** a confirmation dialog opens with message: "Leave game? You will be marked disconnected and returned to the lobby."
**And** the dialog has two buttons: "Leave Game" (destructive/red) and "Cancel" (neutral)
**And** the dialog explains consequences: "Your seat will be marked disconnected. A bot will take over play from your seat."

### AC-3: Send Leave Command

**Given** the leave confirmation dialog is open
**When** I click "Leave Game" (confirm)
**Then** a `LeaveGame { player: [my_seat] }` command is sent to the server
**And** a loading overlay appears: "Leaving game..."
**And** the confirmation dialog closes

### AC-4: Seat Marked Disconnected

**Given** I sent the leave game command
**When** the server processes the request
**Then** my player status is set to `Disconnected` in server state
**And** no public leave event is emitted

### AC-5: Disconnected Indicator

**Given** the server state is updated
**When** other clients fetch state or receive a snapshot
**Then** my seat shows as a bot

### AC-6: Return to Lobby

**Given** I successfully left the game
**When** the leave command is accepted
**Then** I am immediately navigated back to the lobby screen
**And** a toast notification displays: "You left the game."
**And** the room I left is no longer shown in my "Active Games" list

### AC-7: Leave During Critical Phases

**Given** I click "Leave Game" during Charleston, my turn, or call window
**When** the confirmation dialog shows
**Then** an additional warning appears: "Leaving now will forfeit your current action. You will be marked disconnected."
**And** if I confirm, the leave command is sent

### AC-8: Bot Takeover

**Given** I left the game
**When** the game continues
**Then** automated bot actions are generated for my seat
**And** game progression follows existing timers/host controls

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  LeaveGame: {
    player: Seat;
  }
}
```

**Example Payload:**

```typescript
{
  LeaveGame: {
    player: {
      South: {
      }
    }
  }
}
```

### Events (Backend → Frontend)

LeaveGame does not emit a public event. The server updates the player's status to `Disconnected` in table state, which is visible via the next state snapshot (`RequestState`) or reconnection flow.

### Backend References

- **Rust Code**: `crates/mahjong_core/src/command.rs` - `LeaveGame` command definition
- **Rust Code**: `crates/mahjong_core/src/table/mod.rs` - Marks player status as `Disconnected`
- **Rust Code**: `crates/mahjong_core/src/snapshot.rs` - `PublicPlayerInfo.status` in snapshots

## Components Involved

### Container Components

- **`<GameMenu>`** - Contains leave game button
- **`<LeaveConfirmationDialog>`** - Confirmation modal with warnings

### Presentational Components

- **`<LeaveGameButton>`** - Button with icon and label
- **`<PlayerSeatIndicator>`** - Updates to show disconnected status
- **`<NotificationToast>`** - Shows leave success/error messages

### Hooks

- **`useLeaveGame()`** - Handles leave command and navigation
- **`useGameNavigation()`** - Navigates back to lobby after leave

## Component Specs

**Component Specification Files:**

- `component-specs/container/GameMenu.md`
- `component-specs/container/LeaveConfirmationDialog.md`
- `component-specs/presentational/LeaveGameButton.md`
- `component-specs/hooks/useLeaveGame.md`

## Test Scenarios

**Test Scenario Files:**

- `tests/test-scenarios/leave-game-basic.md` - Normal leave flow
- `tests/test-scenarios/leave-game-during-turn.md` - Leave during my turn
- `tests/test-scenarios/leave-game-charleston.md` - Leave during Charleston
- `tests/test-scenarios/leave-game-call-window.md` - Leave during call window
- `tests/test-scenarios/leave-game-disconnected-state.md` - Disconnected status visible in snapshots

## Mock Data

### Fixtures

**Game State Fixtures:**

```json
// tests/fixtures/game-states/before-leave.json
{
  "table_id": "table_123",
  "phase": {
    "Playing": {
      "stage": "Discarding",
      "current_player": "South"
    }
  },
  "seats": {
    "East": { "player_id": "alice_123", "is_bot": false },
    "South": { "player_id": "bob_456", "is_bot": false },
    "West": { "player_id": "carol_789", "is_bot": false },
    "North": { "player_id": "dave_012", "is_bot": false }
  }
}

// tests/fixtures/game-states/after-leave.json
{
  "table_id": "table_123",
  "phase": {
    "Playing": {
      "stage": "Discarding",
      "current_player": "South"
    }
  },
  "seats": {
    "East": { "player_id": "alice_123", "is_bot": false },
    "South": { "player_id": "bob_456", "is_bot": true }, // "status": "Disconnected" ?
    "West": { "player_id": "carol_789", "is_bot": false },
    "North": { "player_id": "dave_012", "is_bot": false }
  }
}
```

**Sample Snapshot (after leave):**

```json
{
  "players": [
    {
      "seat": "South",
      "player_id": "bob_456",
      "is_bot": true
      // "status": "Disconnected"
    }
  ]
}
```

## Edge Cases

### EC-1: Leave During My Turn

**Given** it is currently my turn (Discarding phase)
**When** I confirm leaving the game
**Then** my seat is marked disconnected
**And** no automated action is taken on my behalf
**And** game progression relies on existing timers/host controls

### EC-2: Leave During Charleston

**Given** I am in Charleston phase (e.g., FirstRight pass stage)
**When** I leave the game
**Then** my seat is marked disconnected
**And** no automatic tile selection occurs for my seat
**And** Charleston progression relies on timers/host controls

### EC-3: Leave During Call Window

**Given** another player discarded and I have a call window (can Pung/Kong)
**When** I leave the game before the call window expires
**Then** my seat is marked disconnected
**And** the call window resolves via the existing timer/timeout logic
**And** game continues to next player

### EC-4: Last Human Player Leaves

**Given** I am the only human player in a game with 3 bots
**When** I leave the game
**Then** my seat is marked disconnected
**And** the host may choose to abandon the game if needed (US-033)

### EC-5: Leave Twice (Double-Click Prevention)

**Given** I click "Leave Game"
**When** I rapidly click "Leave Game" again before the dialog opens
**Then** only ONE confirmation dialog opens
**And** the button is disabled after first click until dialog is dismissed

**Client-Side Validation**: Debounce/disable button on first click.

### EC-6: Network Disconnection During Leave

**Given** I confirm leaving the game
**When** network disconnects before any acknowledgment
**Then** the leave command is still processed on the server (idempotent)
**And** when I reconnect, I return to the lobby and can request state if needed

**Backend Behavior**: Server processes leave command even if client disconnects immediately after.

## Related User Stories

- **US-030: Join Room** - Opposite action; join a game room
- **US-032: Forfeit Game** - Alternative exit (accepts loss penalty)
- **US-033: Abandon Game (Consensus)** - Collaborative exit (mutual agreement)

## Accessibility Considerations

### Keyboard Navigation

**Focus Management:**

- "Leave Game" button is accessible via Tab navigation
- Enter or Space key activates button
- Confirmation dialog receives focus when opened
- Escape key cancels confirmation dialog

**Shortcuts:**

- No default shortcut (to prevent accidental leave)
- Optional: Ctrl+Q or Cmd+Q opens leave confirmation (configurable in settings)

### Screen Reader

**Announcements:**

- Button label: "Leave game. Opens confirmation dialog."
- Dialog opens: "Leave game confirmation. Leaving will mark you disconnected and return you to the lobby."
- Confirm button: "Leave game. Destructive action. Press Enter to confirm."
- Cancel button: "Cancel. Press Enter to stay in game."
- Leave success: "You have left the game. Navigating to lobby."

**ARIA Labels:**

- `aria-label="Leave game (marks you disconnected)"` on leave button
- `aria-describedby="leave-warning-text"` on confirmation dialog
- `role="alertdialog"` on confirmation modal
- `aria-live="polite"` on notification toast

### Visual

**High Contrast:**

- Leave button has clear icon (door/exit) and label
- Confirmation dialog has red "Leave Game" button for destructive action
- Warning text is bold and uses warning color (yellow/orange)

**Motion:**

- Dialog open/close animation respects `prefers-reduced-motion`
- Lobby navigation transition is smooth or instant based on settings

## Priority

**HIGH** - Required for proper player experience; players must be able to exit gracefully

## Story Points / Complexity

**2** - Low-Medium Complexity

**Justification:**

- Leave button: simple UI component
- Confirmation dialog: standard modal pattern
- Backend command: straightforward (marks player disconnected)
- Navigation: simple redirect to lobby

**Complexity Factors:**

- Ensuring UI reflects disconnected status

## Definition of Done

### Core Functionality

- [ ] "Leave Game" button visible in game menu/header
- [ ] Button is always enabled during active game
- [ ] Click button opens confirmation dialog
- [ ] Dialog shows warning message about disconnected status
- [ ] Dialog has "Leave Game" (red/destructive) and "Cancel" buttons
- [ ] Click "Leave Game" sends `LeaveGame` command
- [ ] Loading overlay shows "Leaving game..."

### Disconnected Status

- [ ] Leaving player is marked `Disconnected` in server state
- [ ] Other players see seat status update on next snapshot/state refresh
- [ ] No bot takeover actions are generated

### Navigation

- [ ] After leave, player navigates to lobby screen
- [ ] Toast notification shows: "You left the game."
- [ ] Left game no longer in "Active Games" list
- [ ] Player can reconnect only via standard reconnect flow (if supported)

### Edge Cases Verification

- [ ] Leave during my turn: no automated actions occur
- [ ] Leave during Charleston: no automated tile selection occurs
- [ ] Leave during call window: no automated call decision occurs
- [ ] Double-click prevention on leave button
- [ ] Network disconnection during leave handled gracefully

### Testing

- [ ] Unit tests pass for LeaveGameButton, LeaveConfirmationDialog
- [ ] Integration test passes (leave → disconnected status visible)
- [ ] E2E test passes (full flow: leave → lobby navigation)
- [ ] Disconnected status tests pass (turn, Charleston, call window)

### Accessibility

- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Screen reader announces all state changes
- [ ] ARIA labels on all interactive elements
- [ ] Focus management correct (dialog open, lobby navigation)
- [ ] High contrast mode supported

### Documentation & Quality

- [ ] Component specs created (GameMenu, LeaveConfirmationDialog)
- [ ] Test scenarios documented (leave-game-\*.md files)
- [ ] Mock data fixtures created (events, game states)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

### User Testing

- [ ] Manually tested against `user-testing-plan.md` (Part 7, Leave Game)
- [ ] Tested during different game phases (Charleston, Playing, Calling)
- [ ] Verified disconnected status is reflected in snapshots

## Notes for Implementers

### Leave Game Flow

```typescript
// useLeaveGame hook
const useLeaveGame = () => {
  const [isLeaving, setIsLeaving] = useState(false);
  const navigate = useNavigate();

  const leaveGame = async (mySeat: Seat) => {
    try {
      setIsLeaving(true);
      await sendCommand({ LeaveGame: { player: mySeat } });
      navigate('/lobby');
    } catch (error) {
      showError('Failed to leave game. Please try again.');
      setIsLeaving(false);
    }
  };

  return { leaveGame, isLeaving };
};
```

### Event Handling

LeaveGame does not emit a dedicated event. Update the UI optimistically after the command succeeds and rely on the next state snapshot to reflect `Disconnected` status for other seats.

### Confirmation Dialog Component

```typescript
<Dialog open={showLeaveDialog} onClose={handleCancel}>
  <DialogTitle>Leave Game?</DialogTitle>
  <DialogContent>
    <Typography>
      You will be marked disconnected and returned to the lobby.
    </Typography>
    {isDuringCriticalPhase && (
      <Alert severity="warning">
        Leaving now will forfeit your current action. You will be marked disconnected.
      </Alert>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={handleCancel}>Cancel</Button>
    <Button onClick={handleConfirmLeave} color="error" variant="contained">
      Leave Game
    </Button>
  </DialogActions>
</Dialog>
```

### Disconnected Status (Backend Reference)

The backend marks the player status as `Disconnected` when processing `LeaveGame`. No bot takeover is performed in core.

### Critical Phase Detection

```typescript
// Determine if leave happens during critical phase
const isDuringCriticalPhase = (): boolean => {
  const { phase, currentPlayer } = gameState;

  // My turn
  if (currentPlayer === mySeat) return true;

  // Charleston (I'm selecting tiles)
  if (phase.Charleston) return true;

  // Call window (I can call)
  if (phase.Playing?.stage === 'CallWindow' && canICall()) return true;

  return false;
};
```

### Idempotent Leave Command

Backend should handle duplicate leave commands gracefully:

```rust
// If player already disconnected, return success without error
if table.get_player(player)?.status == PlayerStatus::Disconnected {
  return Ok(()); // Already left, no-op
}
```

This prevents errors if network issues cause duplicate commands.

### Lobby Navigation

Ensure clean navigation to lobby:

```typescript
// Clean up game state before navigating
const navigateToLobby = () => {
  // Unsubscribe from game events
  gameSocket.unsubscribeFromGame(tableId);

  // Clear game state
  gameStore.getState().resetGame();

  // Navigate
  navigate('/lobby');
};
```

### Testing Disconnected Status

```typescript
// tests/integration/leave-game-disconnected.test.ts
test('player is marked disconnected after leaving', async () => {
  await sendCommand({ LeaveGame: { player: { South: {} } } });

  const snapshot = await requestState();
  const south = snapshot.players.find((p) => p.seat === 'South');

  expect(south?.status).toBe('Disconnected');
});
```

This test ensures the leave command updates the player's status in state snapshots.
