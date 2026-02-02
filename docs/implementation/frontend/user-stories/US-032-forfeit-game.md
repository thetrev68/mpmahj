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
**And** the dialog explains consequences: "The game will end immediately with you marked as the forfeiting player."
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
**Then** a `PlayerForfeited { player: [my_seat] }` event is emitted
**And** the event is broadcast to all players (Public event)
**And** my client receives the event confirming I forfeited

### AC-5: Game Ends Immediately

**Given** the `PlayerForfeited` event was received
**When** the server emits `GameOver { winner: None, result }`
**Then** the game ends immediately
**And** the scoring screen shows the forfeit outcome
**And** the forfeiting player's final score reflects the penalty in `result.final_scores`

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
      reason?: string;
    }
  }
}

// Game over (forfeit ends the game immediately)
{
  kind: 'Public',
  event: {
    GameOver: {
      winner: Seat | null;
      result: GameResult;
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

### Presentational Components

- **`<ForfeitButton>`** - Button with warning icon and label
- **`<PenaltyScoreDisplay>`** - Shows penalty in score panel

### Hooks

- **`useForfeitGame()`** - Handles forfeit command and state updates
- **`usePlayerStatus()`** - Tracks player forfeit status

## Component Specs

**Component Specification Files:**

- `component-specs/container/ForfeitConfirmationDialog.md`
- `component-specs/presentational/ForfeitButton.md`
- `component-specs/presentational/PenaltyScoreDisplay.md`
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
          "reason": "PlayerForfeit"
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "GameOver": {
          "winner": null,
          "result": {
            "end_condition": "Abandoned(Forfeit)"
          }
        }
      }
    }
  ],
  "expected_ui_state": {
    "game_ended": true,
    "winner": null,
    "end_reason": "Forfeit"
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
**Alternative**: Allow forfeit but treat it as "Leave Game" (mark player disconnected)

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

- **US-031: Leave Game** - Alternative exit (mark player disconnected)
- **US-033: Abandon Game (Consensus)** - Collaborative exit (mutual agreement)
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
- Immediate game end flow on `GameOver`

**Complexity Factors:**

- Mapping `GameOver` result to scoring UI

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

### Game End

- [ ] `PlayerForfeited` event confirms forfeit
- [ ] `GameOver` event follows and ends the game immediately
- [ ] Final scores shown from `result.final_scores`
- [ ] Forfeiting player labeled as forfeited in final results

### Edge Cases Verification

- [ ] Forfeit disabled during Charleston phase
- [ ] Network disconnection during forfeit handled gracefully

### Testing

- [ ] Unit tests pass for ForfeitButton, ForfeitConfirmationDialog
- [ ] Integration test passes (forfeit → GameOver → scoring)
- [ ] E2E test passes (forfeit → game over)

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
- [ ] Confirmed final scores show forfeit outcome

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

### Event Handlers

```typescript
// In game event handler
case 'PlayerForfeited':
  updatePlayerStatus(event.player, 'Forfeited');
  showNotification('Player forfeited. Game ending...');
  break;

case 'GameOver':
  showScoringScreen(event.result);
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
      The game will end immediately with you marked as the forfeiting player.
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

Forfeit penalties are reflected in `GameOver.result.final_scores`.

```text

```text
```
