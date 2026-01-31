# US-031: Leave Game

## Story

**As a** player in an active game
**I want** to leave the game gracefully without disrupting other players
**So that** I can exit when needed while allowing the game to continue with a bot taking my place

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
**Then** a confirmation dialog opens with message: "Leave game? A bot will take your place and the game will continue."
**And** the dialog has two buttons: "Leave Game" (destructive/red) and "Cancel" (neutral)
**And** the dialog explains consequences: "Your current hand and position will be preserved for the bot."

### AC-3: Send Leave Command

**Given** the leave confirmation dialog is open
**When** I click "Leave Game" (confirm)
**Then** a `LeaveGame { player: [my_seat] }` command is sent to the server
**And** a loading overlay appears: "Leaving game..."
**And** the confirmation dialog closes

### AC-4: Bot Takeover Event Received

**Given** I sent the leave game command
**When** the server processes the request
**Then** a `PlayerLeft { player: [my_seat], replaced_by_bot: true, bot_difficulty }` event is emitted
**And** the event is broadcast to all players (Public event)
**And** my client receives the event confirming I left

### AC-5: Bot Takes Over Immediately

**Given** the `PlayerLeft` event was received
**When** the event is processed
**Then** a bot replaces me in my seat
**And** the bot difficulty matches the room's bot difficulty setting (e.g., "Medium")
**And** the bot has access to my current hand (preserved state)
**And** the bot can immediately take actions on my behalf

### AC-6: Game Continues Uninterrupted

**Given** the bot has taken over my seat
**When** the game state updates
**Then** the game continues normally without pausing
**And** if it was my turn, the bot takes its turn automatically
**And** other players see "[My Name] left. Bot (Medium) took over." message
**And** the bot player displays as "Bot ([My Name])" in the seat indicator

### AC-7: Return to Lobby

**Given** I successfully left the game
**When** the `PlayerLeft` event is processed on my client
**Then** I am immediately navigated back to the lobby screen
**And** a toast notification displays: "You left the game. A bot is now playing for you."
**And** the room I left is no longer shown in my "Active Games" list

### AC-8: Reconnection Option (Optional)

**Given** I left a game and returned to the lobby
**When** I view my recent games or room list
**Then** the game I left shows status: "In Progress (Bot Playing)"
**And** a "Spectate" button is available (future feature)
**And** I cannot rejoin as a player (bot has permanently replaced me)

### AC-9: Leave During Critical Phases

**Given** I click "Leave Game" during Charleston, my turn, or call window
**When** the confirmation dialog shows
**Then** an additional warning appears: "Leaving now will forfeit your current action. Bot will continue from next action."
**And** if I confirm, the bot handles the current action (e.g., selects random tiles for Charleston)

### AC-10: Score Preservation

**Given** I left the game and bot took over
**When** the game ends (someone wins or game abandoned)
**Then** my original player name appears in final scores
**And** scores earned/lost after I left are attributed to me (not marked as "bot scores")
**And** final score screen shows: "[My Name] (left early, bot finished)"

## Technical Details

### Commands (Frontend → Backend)

````typescript
{
  LeaveGame: {
    player: Seat;
  }
}
```text

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
```text

### Events (Backend → Frontend)

**Public Events:**

```typescript
// Player successfully left, bot took over
{
  kind: 'Public',
  event: {
    PlayerLeft: {
      player: Seat;
      player_id: string;
      player_name: string;
      replaced_by_bot: true;
      bot_difficulty: "Basic" | "Easy" | "Medium" | "Hard";
      timestamp: number;
    }
  }
}

// If bot immediately takes action after takeover
{
  kind: 'Public',
  event: {
    BotAction: {
      player: Seat;
      action: "DrawTile" | "DiscardTile" | "PassTiles" | etc.
    }
  }
}
```text

**Private Events (to leaving player):**

```typescript
// Confirmation of successful leave
{
  kind: 'Private',
  event: {
    LeaveGameConfirmed: {
      player: Seat;
      message: "You have left the game. A bot will continue playing."
    }
  }
}
```text

**Error Events:**

```typescript
// Cannot leave (edge case, e.g., single-player mode)
{
  kind: 'Private',
  event: {
    Error: {
      code: "CannotLeaveGame",
      message: "Cannot leave game at this time"
    }
  }
}
```text

### Backend References

- **Rust Code**: `crates/mahjong_server/src/network/session.rs:handle_leave_game()` - Leave game handler
- **Rust Code**: `crates/mahjong_server/src/bot/takeover.rs` - Bot takeover logic
- **Rust Code**: `crates/mahjong_core/src/table/types.rs:Player` - Player/Bot state transition
- **Game Design Doc**: Section 7.3 (Leave Game and Reconnection), Section 8.5 (Bot Takeover)

## Components Involved

### Container Components

- **`<GameMenu>`** - Contains leave game button
- **`<LeaveConfirmationDialog>`** - Confirmation modal with warnings

### Presentational Components

- **`<LeaveGameButton>`** - Button with icon and label
- **`<PlayerSeatIndicator>`** - Updates to show bot takeover
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
- `tests/test-scenarios/bot-takeover-behavior.md` - Bot continues game correctly

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
    "South": { "player_id": "bot_south_456", "is_bot": true, "original_player_name": "Bob" },
    "West": { "player_id": "carol_789", "is_bot": false },
    "North": { "player_id": "dave_012", "is_bot": false }
  }
}
```text

**Sample Event Sequences:**

```json
// tests/fixtures/events/leave-game-success.json
{
  "scenario": "Player Leaves, Bot Takes Over",
  "initial_state": "playing_discarding",
  "events": [
    {
      "kind": "Public",
      "event": {
        "PlayerLeft": {
          "player": { "South": {} },
          "player_id": "bob_456",
          "player_name": "Bob",
          "replaced_by_bot": true,
          "bot_difficulty": "Medium",
          "timestamp": 1706634000000
        }
      }
    },
    {
      "kind": "Private",
      "recipient": "bob_456",
      "event": {
        "LeaveGameConfirmed": {
          "player": { "South": {} },
          "message": "You have left the game. A bot will continue playing."
        }
      }
    }
  ],
  "expected_ui_state": {
    "view": "lobby",
    "toast_message": "You left the game. A bot is now playing for you.",
    "active_games": []
  }
}

// tests/fixtures/events/leave-game-during-turn.json
{
  "scenario": "Leave During My Turn",
  "initial_state": "playing_discarding_my_turn",
  "events": [
    {
      "kind": "Public",
      "event": {
        "PlayerLeft": {
          "player": { "South": {} },
          "player_id": "bob_456",
          "player_name": "Bob",
          "replaced_by_bot": true,
          "bot_difficulty": "Medium",
          "timestamp": 1706634000000
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "TileDiscarded": {
          "player": { "South": {} },
          "tile": { "Bamboo": 7 },
          "by_bot": true
        }
      }
    }
  ],
  "expected_ui_state": {
    "view": "lobby",
    "toast_message": "You left the game. A bot is now playing for you."
  }
}
```text

## Edge Cases

### EC-1: Leave During My Turn

**Given** it is currently my turn (Discarding phase)
**When** I confirm leaving the game
**Then** the bot takes over immediately
**And** the bot automatically discards a tile (using its AI strategy)
**And** the game flow continues to the next player
**And** no turn delay or timeout occurs

**Implementation Note**: Bot must have immediate access to current game state and hand to take action.

### EC-2: Leave During Charleston

**Given** I am in Charleston phase (e.g., FirstRight pass stage)
**When** I leave the game
**Then** the bot takes over and selects 3 random tiles to pass
**And** Charleston continues normally
**And** other players are not blocked waiting for me

**Alternative**: Bot could use AI strategy to select tiles, but random is simpler for immediate takeover.

### EC-3: Leave During Call Window

**Given** another player discarded and I have a call window (can Pung/Kong)
**When** I leave the game before the call window expires
**Then** the bot takes over
**And** the bot decides whether to call (based on AI evaluation)
**Or** the call window expires and bot takes no action
**And** game continues to next player

### EC-4: Last Human Player Leaves

**Given** I am the only human player in a game with 3 bots
**When** I leave the game
**Then** the game becomes "all bots"
**And** the server may choose to auto-finish the game (configurable)
**Or** bots continue playing to completion
**And** final scores are still recorded for statistics

**Implementation Note**: Check room settings for "auto-finish when all bots" policy.

### EC-5: Leave Twice (Double-Click Prevention)

**Given** I click "Leave Game"
**When** I rapidly click "Leave Game" again before the dialog opens
**Then** only ONE confirmation dialog opens
**And** the button is disabled after first click until dialog is dismissed

**Client-Side Validation**: Debounce/disable button on first click.

### EC-6: Network Disconnection During Leave

**Given** I confirm leaving the game
**When** network disconnects before `PlayerLeft` event is received
**Then** the leave command is still processed on the server (idempotent)
**And** when I reconnect, I am in the lobby (not in the game)
**And** the bot has already taken over

**Backend Behavior**: Server processes leave command even if client disconnects immediately after.

## Related User Stories

- **US-030: Join Room** - Opposite action; join a game room
- **US-032: Forfeit Game** - Alternative exit (accepts loss penalty instead of bot takeover)
- **US-033: Abandon Game (Voting)** - Collaborative exit (all players vote to end)

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
- Dialog opens: "Leave game confirmation. Leaving will replace you with a bot. Game will continue."
- Confirm button: "Leave game. Destructive action. Press Enter to confirm."
- Cancel button: "Cancel. Press Enter to stay in game."
- Leave success: "You have left the game. A bot is now playing for you. Navigating to lobby."

**ARIA Labels:**

- `aria-label="Leave game (bot will replace you)"` on leave button
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
- Backend command: straightforward (bot takeover logic already exists)
- Navigation: simple redirect to lobby

**Complexity Factors:**

- Bot takeover during critical phases (turn, Charleston, call window)
- State preservation for bot
- Ensuring game continues without interruption

## Definition of Done

### Core Functionality

- [ ] "Leave Game" button visible in game menu/header
- [ ] Button is always enabled during active game
- [ ] Click button opens confirmation dialog
- [ ] Dialog shows warning message about bot takeover
- [ ] Dialog has "Leave Game" (red/destructive) and "Cancel" buttons
- [ ] Click "Leave Game" sends `LeaveGame` command
- [ ] Loading overlay shows "Leaving game..."

### Bot Takeover

- [ ] `PlayerLeft` event confirms leave and bot takeover
- [ ] Bot replaces player in same seat immediately
- [ ] Bot difficulty matches room settings
- [ ] Bot has access to player's hand and game state
- [ ] Game continues without pause or delay
- [ ] Other players see notification: "[Name] left. Bot took over."

### Navigation

- [ ] After leave, player navigates to lobby screen
- [ ] Toast notification shows: "You left the game. A bot is now playing for you."
- [ ] Left game no longer in "Active Games" list
- [ ] Player cannot rejoin the game as a player

### Edge Cases Verification

- [ ] Leave during my turn: bot immediately takes turn
- [ ] Leave during Charleston: bot selects and passes tiles
- [ ] Leave during call window: bot makes call decision or passes
- [ ] Double-click prevention on leave button
- [ ] Network disconnection during leave handled gracefully

### Testing

- [ ] Unit tests pass for LeaveGameButton, LeaveConfirmationDialog
- [ ] Integration test passes (leave → bot takeover → game continues)
- [ ] E2E test passes (full flow: leave → lobby navigation)
- [ ] Bot takeover tests pass (turn, Charleston, call window)
- [ ] Score preservation test passes (final scores show original player name)

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
- [ ] Verified bot takeover behavior with multiple players
- [ ] Confirmed scores are preserved correctly

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

      // Wait for confirmation event (with timeout)
      const timeout = setTimeout(() => {
        showError('Leave game timed out. Please try again.');
        setIsLeaving(false);
      }, 5000);

      // Event handler will clear timeout and navigate
    } catch (error) {
      showError('Failed to leave game. Please try again.');
      setIsLeaving(false);
    }
  };

  return { leaveGame, isLeaving };
};
```text

### Event Handler for PlayerLeft

```typescript
// In game event handler
case 'PlayerLeft':
  if (event.player_id === myPlayerId) {
    // I left successfully
    showToast('You left the game. A bot is now playing for you.');
    navigate('/lobby');
  } else {
    // Another player left
    updatePlayerSeat(event.player, {
      is_bot: true,
      bot_difficulty: event.bot_difficulty,
      original_name: event.player_name
    });
    showNotification(`${event.player_name} left. Bot (${event.bot_difficulty}) took over.`);
  }
  break;
```text

### Confirmation Dialog Component

```typescript
<Dialog open={showLeaveDialog} onClose={handleCancel}>
  <DialogTitle>Leave Game?</DialogTitle>
  <DialogContent>
    <Typography>
      A bot will take your place and the game will continue. Your current hand and
      position will be preserved for the bot.
    </Typography>
    {isDuringCriticalPhase && (
      <Alert severity="warning">
        Leaving now will forfeit your current action. Bot will continue from next action.
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
```text

### Bot Takeover Logic (Backend Reference)

The backend must:

1. **Preserve State**: Copy player's hand, tiles, and in-progress actions to bot
2. **Assign Bot**: Create bot player with same seat and room's bot difficulty
3. **Emit Event**: Broadcast `PlayerLeft` to all players
4. **Continue Game**: If it was the player's turn, bot immediately takes action

```rust
// crates/mahjong_server/src/bot/takeover.rs (pseudo-code for reference)
pub fn replace_player_with_bot(
    table: &mut Table,
    leaving_player: Seat,
    bot_difficulty: BotDifficulty
) -> Result<(), GameError> {
    let player_state = table.get_player_state(leaving_player)?;

    // Create bot with same state
    let bot = BotPlayer::new(bot_difficulty, player_state);

    // Replace player
    table.replace_player(leaving_player, bot);

    // If it's bot's turn, take action immediately
    if table.current_turn() == leaving_player {
        bot.take_turn(&table)?;
    }

    Ok(())
}
```text

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
```text

### Score Preservation

Final score display should show original player name even after bot takeover:

```typescript
// Final score display
<ScoreCard>
  <PlayerName>
    {player.original_name || player.name}
    {player.is_bot && <Chip label="left early, bot finished" size="small" />}
  </PlayerName>
  <Score>{player.score}</Score>
</ScoreCard>
```text

### Idempotent Leave Command

Backend should handle duplicate leave commands gracefully:

```rust
// If player already left or is already a bot, return success without error
if table.get_player(player)?.is_bot {
    return Ok(()); // Already replaced with bot, no-op
}
```text

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
```text

### Testing Bot Takeover During Turn

```typescript
// tests/integration/leave-game-during-turn.test.ts
test('bot takes turn immediately when player leaves during their turn', async () => {
  const game = createMockGame({ currentPlayer: 'South' });
  const southPlayer = 'player_south_123';

  // South player leaves
  await sendCommand({ LeaveGame: { player: { South: {} } } });

  // Expect PlayerLeft event
  expect(mockSocket).toHaveEmitted({
    event: { PlayerLeft: { player: { South: {} }, replaced_by_bot: true } },
  });

  // Expect bot to discard immediately (within 2 seconds)
  await waitFor(
    () => {
      expect(mockSocket).toHaveEmitted({
        event: { TileDiscarded: { player: { South: {} }, by_bot: true } },
      });
    },
    { timeout: 2000 }
  );

  // Game continues to next player
  expect(game.currentPlayer).toBe('West');
});
```text

This test ensures bot takeover is seamless and doesn't block game flow.
````
