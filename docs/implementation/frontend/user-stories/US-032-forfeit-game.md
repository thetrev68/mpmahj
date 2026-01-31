# US-032: Forfeit Game

## Story

**As a** player in an active game
**I want** to forfeit the game and accept an immediate loss with penalty
**So that** I can end a game I cannot win without waiting for the game to finish naturally

## Acceptance Criteria

### AC-1: Forfeit Button Available During Play

**Given** I am in an active game (Playing phase)
**When** the game UI is displayed
**Then** a "Forfeit" button is visible in the game menu
**And** the button is only enabled during the Playing phase (not Charleston or Setup)
**And** the button has a warning icon (e.g., white flag) for visual clarity

### AC-2: Confirmation Dialog with Penalty Warning

**Given** I am in the Playing phase
**When** I click the "Forfeit" button
**Then** a confirmation dialog opens with message: "Forfeit game? You will lose immediately with a -100 point penalty."
**And** the dialog has two buttons: "Forfeit Game" (destructive/red) and "Cancel" (neutral)
**And** the dialog explains consequences: "Your hand will be revealed and the game will continue for other players."
**And** the penalty amount is prominently displayed (configurable, default: -100 points)

### AC-3: Send Forfeit Command

**Given** the forfeit confirmation dialog is open
**When** I click "Forfeit Game" (confirm)
**Then** a `ForfeitGame { player: [my_seat] }` command is sent to the server
**And** a loading overlay appears: "Forfeiting game..."
**And** the confirmation dialog closes

### AC-4: Forfeit Event Received

**Given** I sent the forfeit game command
**When** the server processes the request
**Then** a `PlayerForfeited { player: [my_seat], penalty_score }` event is emitted
**And** the event is broadcast to all players (Public event)
**And** my client receives the event confirming I forfeited

### AC-5: Penalty Score Applied

**Given** the `PlayerForfeited` event was received
**When** scores are updated
**Then** the penalty score (e.g., -100 points) is applied to my total score
**And** the penalty is displayed in the score panel
**And** my final score cannot go below a minimum (e.g., -500 points floor)

### AC-6: Hand Revealed to All Players

**Given** I forfeited the game
**When** the forfeit is processed
**Then** my hand is revealed to all other players
**And** other players see my tiles displayed face-up in my rack area
**And** a message shows: "[My Name] forfeited. Hand revealed."
**And** my tiles remain visible until the game ends

### AC-7: Game Continues for Other Players

**Given** I forfeited the game
**When** the game state updates
**Then** the game continues normally for the remaining 3 players
**And** I am marked as "Forfeited" in the player list
**And** my seat shows status: "Forfeited (not playing)"
**And** I cannot take any further actions (draw, discard, call, Charleston)

### AC-8: Forfeited Player View

**Given** I have forfeited
**When** the game UI updates for me
**Then** I see a spectator-like view (cannot interact)
**And** I can still see the game progress
**And** a banner shows: "You have forfeited. You can watch the game or return to lobby."
**And** I have options: "Watch Game" or "Return to Lobby"

### AC-9: Final Scores Include Penalty

**Given** the game ends (someone wins or game is abandoned)
**When** final scores are displayed
**Then** my score includes the forfeit penalty
**And** my name shows status: "[My Name] (forfeited)"
**And** the penalty is listed separately: "Base score: 50, Forfeit penalty: -100, Total: -50"

### AC-10: Multiple Players Forfeit

**Given** I forfeit and another player also forfeits
**When** 2 or more players have forfeited
**Then** the game continues as long as at least 2 active players remain
**And** if only 1 active player remains, the game ends automatically
**And** the remaining player wins by default with no bonus

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  ForfeitGame: {
    player: Seat;
  }
}
```text

**Example Payload:**

```typescript
{
  ForfeitGame: {
    player: {
      West: {
      }
    }
  }
}
```text

### Events (Backend → Frontend)

**Public Events:**

```typescript
// Player forfeited
{
  kind: 'Public',
  event: {
    PlayerForfeited: {
      player: Seat;
      player_id: string;
      player_name: string;
      penalty_score: number;  // e.g., -100
      hand_revealed: Tile[];  // Forfeiting player's tiles
      timestamp: number;
    }
  }
}

// Game ends if too few active players
{
  kind: 'Public',
  event: {
    GameEndedEarly: {
      reason: "TooFewActivePlayers";
      remaining_players: Seat[];
      winner: Seat | null;  // null if no winner
    }
  }
}
```text

**Private Events (to forfeiting player):**

```typescript
// Confirmation of forfeit
{
  kind: 'Private',
  event: {
    ForfeitConfirmed: {
      player: Seat;
      penalty_score: number;
      message: "You have forfeited the game."
    }
  }
}
```text

**Error Events:**

```typescript
// Cannot forfeit (e.g., during Charleston)
{
  kind: 'Private',
  event: {
    Error: {
      code: "CannotForfeitNow",
      message: "Forfeit is only available during active play"
    }
  }
}
```text

### Backend References

- **Rust Code**: `crates/mahjong_server/src/network/session.rs:handle_forfeit_game()` - Forfeit handler
- **Rust Code**: `crates/mahjong_core/src/scoring.rs:apply_forfeit_penalty()` - Penalty calculation
- **Rust Code**: `crates/mahjong_core/src/table/types.rs:PlayerStatus` - Forfeit status tracking
- **Game Design Doc**: Section 7.4 (Forfeit and Penalties), Section 9.3 (Penalty Scoring)

## Components Involved

### Container Components

- **`<GameMenu>`** - Contains forfeit button
- **`<ForfeitConfirmationDialog>`** - Confirmation modal with penalty warning
- **`<SpectatorView>`** - View for forfeited player

### Presentational Components

- **`<ForfeitButton>`** - Button with warning icon and label
- **`<PenaltyScoreDisplay>`** - Shows penalty in score panel
- **`<RevealedHandDisplay>`** - Shows forfeited player's tiles to others
- **`<PlayerStatusBadge>`** - "Forfeited" badge on player seat

### Hooks

- **`useForfeitGame()`** - Handles forfeit command and state updates
- **`usePlayerStatus()`** - Tracks player forfeit status

## Component Specs

**Component Specification Files:**

- `component-specs/container/ForfeitConfirmationDialog.md`
- `component-specs/presentational/ForfeitButton.md`
- `component-specs/presentational/PenaltyScoreDisplay.md`
- `component-specs/presentational/RevealedHandDisplay.md`
- `component-specs/hooks/useForfeitGame.md`

## Test Scenarios

**Test Scenario Files:**

- `tests/test-scenarios/forfeit-game-basic.md` - Normal forfeit flow
- `tests/test-scenarios/forfeit-penalty-applied.md` - Score penalty calculation
- `tests/test-scenarios/forfeit-hand-revealed.md` - Hand revealed to other players
- `tests/test-scenarios/multiple-forfeits.md` - Multiple players forfeit
- `tests/test-scenarios/forfeit-game-ends-early.md` - Game ends when too few active players

## Mock Data

### Fixtures

**Game State Fixtures:**

```json
// tests/fixtures/game-states/before-forfeit.json
{
  "table_id": "table_456",
  "phase": {
    "Playing": {
      "stage": "Discarding",
      "current_player": "East"
    }
  },
  "scores": {
    "East": 120,
    "South": 80,
    "West": 100,
    "North": 90
  },
  "player_statuses": {
    "East": "Active",
    "South": "Active",
    "West": "Active",
    "North": "Active"
  }
}

// tests/fixtures/game-states/after-forfeit.json
{
  "table_id": "table_456",
  "phase": {
    "Playing": {
      "stage": "Discarding",
      "current_player": "East"
    }
  },
  "scores": {
    "East": 120,
    "South": 80,
    "West": 0,
    "North": 90
  },
  "player_statuses": {
    "East": "Active",
    "South": "Active",
    "West": "Forfeited",
    "North": "Active"
  },
  "forfeit_penalties": {
    "West": -100
  }
}
```text

**Sample Event Sequences:**

```json
// tests/fixtures/events/forfeit-game-success.json
{
  "scenario": "Player Forfeits, Penalty Applied, Hand Revealed",
  "initial_state": "playing_discarding",
  "events": [
    {
      "kind": "Public",
      "event": {
        "PlayerForfeited": {
          "player": { "West": {} },
          "player_id": "carol_789",
          "player_name": "Carol",
          "penalty_score": -100,
          "hand_revealed": [
            { "Bamboo": 1 },
            { "Bamboo": 2 },
            { "Bamboo": 3 },
            { "Character": 5 },
            { "Character": 6 },
            { "Dot": 7 },
            { "Dot": 8 },
            { "Dot": 9 },
            { "Dragon": { "Red": {} } },
            { "Wind": { "East": {} } },
            { "Joker": {} },
            { "Joker": {} },
            { "Flower": 1 }
          ],
          "timestamp": 1706634000000
        }
      }
    },
    {
      "kind": "Private",
      "recipient": "carol_789",
      "event": {
        "ForfeitConfirmed": {
          "player": { "West": {} },
          "penalty_score": -100,
          "message": "You have forfeited the game."
        }
      }
    }
  ],
  "expected_ui_state": {
    "west_status": "Forfeited",
    "west_score": 0,
    "west_hand_revealed": true,
    "west_can_act": false
  }
}

// tests/fixtures/events/multiple-forfeits-game-ends.json
{
  "scenario": "Multiple Players Forfeit, Game Ends Early",
  "initial_state": "playing_with_two_forfeits",
  "events": [
    {
      "kind": "Public",
      "event": {
        "PlayerForfeited": {
          "player": { "North": {} },
          "player_id": "dave_012",
          "player_name": "Dave",
          "penalty_score": -100,
          "hand_revealed": [],
          "timestamp": 1706634100000
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "GameEndedEarly": {
          "reason": "TooFewActivePlayers",
          "remaining_players": [{ "East": {} }],
          "winner": { "East": {} }
        }
      }
    }
  ],
  "expected_ui_state": {
    "game_ended": true,
    "winner": "East",
    "end_reason": "Only one active player remaining"
  }
}
```text

## Edge Cases

### EC-1: Forfeit During My Turn

**Given** it is currently my turn (Discarding phase)
**When** I forfeit the game
**Then** my turn is immediately skipped
**And** the next player becomes the current player
**And** no tile is discarded by me (my action is cancelled)
**And** the game continues normally

### EC-2: Forfeit During Charleston

**Given** I am in Charleston phase
**When** I click the "Forfeit" button
**Then** the button is disabled
**And** a tooltip shows: "Cannot forfeit during Charleston. Wait for playing phase or leave game instead."
**Alternative**: Allow forfeit but treat it as "Leave Game" (bot takeover)

### EC-3: Minimum Score Floor

**Given** my current score is -450
**When** I forfeit with -100 penalty
**Then** my score becomes -550 (below -500 floor)
**And** the score is capped at -500 (minimum floor)
**And** a message shows: "Score capped at minimum -500."

**Configuration**: Floor can be configured in room settings (default: -500 or no floor).

### EC-4: All Players Except One Forfeit

**Given** 3 players have forfeited (only East remains active)
**When** the third forfeit is processed
**Then** the game ends immediately
**And** East wins by default (no Mahjong bonus)
**And** East's score remains unchanged (no win points)
**And** final scores show all forfeits and penalties

### EC-5: Forfeit After Someone Declares Mahjong

**Given** another player declared Mahjong but scores are not yet finalized
**When** I try to forfeit
**Then** forfeit is blocked
**And** error message: "Cannot forfeit. Game has ended."
**And** I proceed to final score screen

### EC-6: Network Disconnection During Forfeit

**Given** I confirm forfeit
**When** network disconnects before `PlayerForfeited` event is received
**Then** the forfeit is still processed on the server
**And** when I reconnect, I see my forfeited status
**And** I cannot undo the forfeit

**Backend Behavior**: Forfeit command is idempotent and irreversible.

## Related User Stories

- **US-031: Leave Game** - Alternative exit (bot takeover instead of forfeit)
- **US-033: Abandon Game (Voting)** - Collaborative exit (all players vote)
- **US-011: Declare Mahjong** - Normal win condition (opposite of forfeit)

## Accessibility Considerations

### Keyboard Navigation

**Focus Management:**

- "Forfeit" button is accessible via Tab navigation
- Enter or Space key activates button
- Confirmation dialog receives focus when opened
- Escape key cancels confirmation dialog

**Shortcuts:**

- No default shortcut (to prevent accidental forfeit)
- Requires explicit button click for safety

### Screen Reader

**Announcements:**

- Button label: "Forfeit game. Lose immediately with penalty. Opens confirmation dialog."
- Dialog opens: "Forfeit game confirmation. You will lose immediately with -100 point penalty. Your hand will be revealed."
- Confirm button: "Forfeit game. Destructive action. Penalty: -100 points. Press Enter to confirm."
- Cancel button: "Cancel. Press Enter to continue playing."
- Forfeit success: "You have forfeited the game. Penalty applied: -100 points. Your hand has been revealed to other players."

**ARIA Labels:**

- `aria-label="Forfeit game (lose with -100 point penalty)"` on forfeit button
- `aria-describedby="forfeit-warning-text"` on confirmation dialog
- `role="alertdialog"` on confirmation modal
- `aria-live="assertive"` on penalty applied notification

### Visual

**High Contrast:**

- Forfeit button has warning color (orange/red) and flag icon
- Confirmation dialog has red "Forfeit Game" button for destructive action
- Penalty score is displayed in red with negative sign
- Forfeited status badge is gray with strikethrough effect

**Motion:**

- Dialog open/close animation respects `prefers-reduced-motion`
- Hand reveal animation can be instant or gradual based on settings

## Priority

**MEDIUM** - Nice-to-have for player control; not essential but improves experience

## Story Points / Complexity

**3** - Medium Complexity

**Justification:**

- Forfeit button and dialog: standard UI components
- Penalty score calculation: straightforward arithmetic
- Hand reveal: requires displaying tiles to other players
- Game continuation logic: ensure game doesn't break with forfeited player

**Complexity Factors:**

- Score penalty calculation and floor enforcement
- Hand reveal to other players (public/private data handling)
- Game end condition when too few active players
- Spectator view for forfeited player

## Definition of Done

### Core Functionality

- [ ] "Forfeit" button visible in game menu during Playing phase
- [ ] Button is disabled during Charleston and Setup phases
- [ ] Click button opens confirmation dialog
- [ ] Dialog shows warning about penalty and hand reveal
- [ ] Dialog displays penalty amount (e.g., -100 points)
- [ ] Dialog has "Forfeit Game" (red/destructive) and "Cancel" buttons
- [ ] Click "Forfeit Game" sends `ForfeitGame` command
- [ ] Loading overlay shows "Forfeiting game..."

### Penalty and Hand Reveal

- [ ] `PlayerForfeited` event confirms forfeit
- [ ] Penalty score applied to player's total score
- [ ] Penalty displayed in score panel (e.g., "Penalty: -100")
- [ ] Player's hand revealed to all other players
- [ ] Revealed tiles displayed face-up in player's rack area
- [ ] Other players see notification: "[Name] forfeited. Hand revealed."

### Game Continuation

- [ ] Forfeited player marked as "Forfeited" status
- [ ] Forfeited player cannot take further actions
- [ ] Game continues for remaining active players
- [ ] If forfeited player's turn, skip to next player
- [ ] Forfeited player sees spectator-like view

### Game End Conditions

- [ ] If only 1 active player remains, game ends automatically
- [ ] Remaining player wins by default (no bonus)
- [ ] Final scores include forfeit penalties
- [ ] Final scores show "[Name] (forfeited)" status

### Edge Cases Verification

- [ ] Forfeit disabled during Charleston phase
- [ ] Score floor enforced (e.g., minimum -500)
- [ ] Multiple forfeits handled correctly
- [ ] Game ends early when too few active players
- [ ] Network disconnection during forfeit handled gracefully

### Testing

- [ ] Unit tests pass for ForfeitButton, ForfeitConfirmationDialog
- [ ] Integration test passes (forfeit → penalty → hand reveal → game continues)
- [ ] E2E test passes (full flow: forfeit → spectator view)
- [ ] Multiple forfeit test passes (game ends when only 1 active player)
- [ ] Score penalty test passes (calculation and floor)

### Accessibility

- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Screen reader announces all state changes
- [ ] ARIA labels on all interactive elements
- [ ] Focus management correct (dialog open, forfeit confirmed)
- [ ] High contrast mode supported

### Documentation & Quality

- [ ] Component specs created (ForfeitConfirmationDialog, PenaltyScoreDisplay)
- [ ] Test scenarios documented (forfeit-game-\*.md files)
- [ ] Mock data fixtures created (events, game states)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

### User Testing

- [ ] Manually tested against `user-testing-plan.md` (Part 7, Forfeit Game)
- [ ] Tested with multiple players forfeiting
- [ ] Verified hand reveal works correctly for all players
- [ ] Confirmed penalty score calculation is accurate

## Notes for Implementers

### Forfeit Game Flow

```typescript
// useForfeitGame hook
const useForfeitGame = () => {
  const [isForfeiting, setIsForfeiting] = useState(false);
  const mySeat = useGameStore((state) => state.mySeat);
  const phase = useGameStore((state) => state.phase);

  const canForfeit = (): boolean => {
    // Only allow forfeit during Playing phase
    return phase.Playing !== undefined;
  };

  const forfeitGame = async () => {
    if (!canForfeit()) {
      showError('Cannot forfeit during this phase');
      return;
    }

    try {
      setIsForfeiting(true);
      await sendCommand({ ForfeitGame: { player: mySeat } });

      // Event handler will update UI
    } catch (error) {
      showError('Failed to forfeit game. Please try again.');
      setIsForfeiting(false);
    }
  };

  return { forfeitGame, isForfeiting, canForfeit };
};
```text

### Event Handler for PlayerForfeited

```typescript
// In game event handler
case 'PlayerForfeited':
  // Update player status
  updatePlayerStatus(event.player, 'Forfeited');

  // Apply penalty score
  updatePlayerScore(event.player, event.penalty_score);

  // Reveal hand (if not me)
  if (event.player !== mySeat) {
    setRevealedHand(event.player, event.hand_revealed);
  }

  // Show notification
  if (event.player_id === myPlayerId) {
    showNotification('You have forfeited the game. Penalty: ' + event.penalty_score);
    setSpectatorMode(true);
  } else {
    showNotification(`${event.player_name} forfeited. Hand revealed.`);
  }

  // Check if game should end early
  const activePlayers = getActivePlayers();
  if (activePlayers.length === 1) {
    // Expect GameEndedEarly event from server
  }
  break;
```text

### Confirmation Dialog Component

```typescript
<Dialog open={showForfeitDialog} onClose={handleCancel}>
  <DialogTitle>Forfeit Game?</DialogTitle>
  <DialogContent>
    <Alert severity="error">
      You will lose immediately with a {penaltyScore} point penalty.
    </Alert>
    <Typography variant="body1" sx={{ mt: 2 }}>
      Your hand will be revealed to all other players and the game will continue
      for the remaining players.
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
      This action cannot be undone.
    </Typography>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleCancel}>Cancel</Button>
    <Button onClick={handleConfirmForfeit} color="error" variant="contained">
      Forfeit Game
    </Button>
  </DialogActions>
</Dialog>
```text

### Penalty Score Calculation (Backend Reference)

```rust
// crates/mahjong_core/src/scoring.rs (pseudo-code for reference)
pub fn apply_forfeit_penalty(
    player_score: i32,
    penalty: i32,
    score_floor: Option<i32>
) -> i32 {
    let new_score = player_score + penalty; // penalty is negative, e.g., -100

    match score_floor {
        Some(floor) => new_score.max(floor), // Enforce floor
        None => new_score, // No floor
    }
}
```text

Default penalty: -100 points
Default floor: -500 points (configurable in room settings)

### Revealed Hand Display

```typescript
// Component to show forfeited player's hand to others
<RevealedHandDisplay player={forfeitedPlayer} hand={revealedHand}>
  <Typography variant="caption" color="error">
    Forfeited - Hand Revealed
  </Typography>
  <Box className="revealed-tiles">
    {revealedHand.map((tile, index) => (
      <TileImage key={index} tile={tile} faceUp={true} />
    ))}
  </Box>
</RevealedHandDisplay>
```text

### Spectator View for Forfeited Player

After forfeiting, the player should see a read-only view:

```typescript
{hasForfeited && (
  <>
    <Alert severity="warning" sx={{ mb: 2 }}>
      You have forfeited this game. You can watch the game or return to the lobby.
    </Alert>
    <Box className="spectator-controls">
      <Button variant="outlined" onClick={() => setWatchingGame(true)}>
        Watch Game
      </Button>
      <Button variant="contained" onClick={() => navigate('/lobby')}>
        Return to Lobby
      </Button>
    </Box>
    {watchingGame && <SpectatorGameView />}
  </>
)}
```text

### Game End Early Logic (Backend)

```rust
// Check if game should end due to too few active players
fn check_game_end_condition(table: &Table) -> Option<GameEndReason> {
    let active_players: Vec<Seat> = table.seats
        .iter()
        .filter(|(_, player)| player.status == PlayerStatus::Active)
        .map(|(seat, _)| seat)
        .collect();

    if active_players.len() <= 1 {
        Some(GameEndReason::TooFewActivePlayers {
            remaining: active_players,
            winner: active_players.first().cloned()
        })
    } else {
        None
    }
}
```text

### Testing Hand Reveal

```typescript
// tests/integration/forfeit-hand-revealed.test.ts
test('forfeited player hand is revealed to other players', async () => {
  const game = createMockGame({ players: ['Alice', 'Bob', 'Carol', 'Dave'] });
  const carolHand = [
    { Bamboo: 1 },
    { Bamboo: 2 },
    { Bamboo: 3 },
    { Character: 5 },
    { Dragon: { Red: {} } },
  ];

  // Carol (West) forfeits
  await sendCommand({ ForfeitGame: { player: { West: {} } } });

  // Expect PlayerForfeited event
  const event = await waitForEvent('PlayerForfeited');
  expect(event.player).toEqual({ West: {} });
  expect(event.hand_revealed).toEqual(carolHand);

  // Other players (Alice, Bob, Dave) see Carol's hand
  expect(getRevealedHand('West')).toEqual(carolHand);

  // Carol herself sees forfeit confirmation
  expect(getPlayerStatus('West')).toBe('Forfeited');
  expect(isSpectatorMode()).toBe(true);
});
```text

This ensures hand reveal works correctly for all players.
