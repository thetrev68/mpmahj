# US-001: Roll Dice & Break Wall

## Story

**As a** player in the East seat
**I want** to roll dice to determine the wall break position
**So that** the game can begin with a random starting point for tile distribution

## Acceptance Criteria

### AC-1: Dice Roll Initiation (Human Player)

**Given** the game is in `Setup(RollingDice)` phase
**And** I am seated as East (dealer)
**When** I click the "Roll Dice" button
**Then** two dice are rolled with random values (1-6 each)
**And** the sum is displayed prominently (e.g., "East rolled 7")
**And** the dice roll animation plays for 0.5 seconds
**And** a dice roll sound effect plays
**And** a `RollDice` command is sent to the server

### AC-2: Wall Break Visualization

**Given** the dice have been rolled (sum = N)
**When** the server emits `WallBroken { position }` event
**Then** a visual gap appears in the wall at the calculated position
**And** the wall counter shows total drawable tiles (152 tiles standard, or 160 if "Use Blanks" house rule is enabled)
**And** a draw direction indicator shows tiles will be drawn right-to-left from break point
**And** the wall break animation plays: the left section stays anchored while the right section pivots outward toward the center of the board
**And** the phase advances to `Setup(Dealing)`

### AC-3: Only East Can Roll

**Given** the game is in `Setup(RollingDice)` phase
**And** I am NOT seated as East
**When** the UI renders
**Then** the "Roll Dice" button is NOT visible to me
**And** I see a message "Waiting for East to roll dice..."

### AC-4: Bot Auto-Roll

**Given** the game is in `Setup(RollingDice)` phase
**And** East seat is occupied by a bot player
**When** the phase begins
**Then** the bot automatically sends a `RollDice` command after a brief delay (0.5-1.5 seconds for realism)
**And** the same roll animation and wall break sequence occurs as with human players
**And** other human players see "East (Bot) is rolling dice..." message

### AC-5: Animation Settings

**Given** the user has enabled "Instant Animations" in settings
**When** dice are rolled or the wall breaks
**Then** all animations are skipped (no 0.5s dice roll, no wall pivot animation)
**And** the dice result and wall break appear instantly
**And** sound effects still play (unless also disabled)

## Technical Details

### Commands (Frontend → Backend)

````typescript
{
  RollDice: {
    player: Seat.East;
  }
}
```text

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    DiceRolled: {
      roll: 7  // Sum of two dice (2-12)
    }
  }
}

{
  kind: 'Public',
  event: {
    WallBroken: {
      position: 42  // Index where wall breaks
    }
  }
}
```text

### Backend References

- **Rust Code**: `crates/mahjong_core/src/command.rs` - `RollDice` command
- **Game Design Doc**: Section 2.1.1 (Dice Roll Mechanic), Section 2.1.2 (Wall Break Logic)

## Components Involved

- **`<DiceOverlay>`** - Displays dice roll animation, sound, and result
- **`<Wall>`** - Renders wall sections with break visualization and pivot animation
- **`<WallCounter>`** - Shows remaining tiles count (152/160)
- **`<ActionBar>`** - Contains "Roll Dice" button (East only, hidden for bots)
- **`useSoundEffects()`** - Hook for playing dice roll sound

**Component Specs:**

- `component-specs/presentational/DiceOverlay.md`
- `component-specs/presentational/WallCounter.md`
- `component-specs/container/Wall.md`
- `component-specs/hooks/useSoundEffects.md`

## Test Scenarios

- **`tests/test-scenarios/dice-roll-standard.md`** - Normal dice roll flow (human player)
- **`tests/test-scenarios/dice-roll-bot.md`** - Bot auto-roll behavior
- **`tests/test-scenarios/dice-roll-instant.md`** - Instant animation mode

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/setup-rolling-dice.json` - Initial state before roll
- `tests/fixtures/game-states/setup-wall-broken.json` - State after wall broken

**Sample Event Sequence:**

```json
{
  "scenario": "Dice Roll and Wall Break",
  "events": [
    {
      "kind": "Public",
      "event": { "DiceRolled": { "roll": 7 } }
    },
    {
      "kind": "Public",
      "event": { "WallBroken": { "position": 42 } }
    }
  ]
}
```text

## Edge Cases

### EC-1: Non-East Player Attempts Roll

**Given** I am NOT East
**When** I somehow send a `RollDice` command (e.g., via console/hack)
**Then** the server rejects with error: "Only East can roll dice"
**And** no dice roll occurs

### EC-2: Double-Click Prevention

**Given** I am East and click "Roll Dice"
**When** I rapidly click the button again before server responds
**Then** the button is disabled after first click
**And** only ONE `RollDice` command is sent

### EC-3: Instant Animation Mode

**Given** "Instant Animations" setting is enabled (see AC-5)
**When** dice are rolled and wall breaks
**Then** all visual transitions happen instantly
**And** the game proceeds immediately to the next phase
**And** sound effects still play unless audio is also disabled

### EC-4: Invalid Dice Sum (Backend Sanity Check)

**Given** the backend generates invalid dice values (e.g., sum < 2 or > 12)
**When** the `DiceRolled` event is received
**Then** the frontend displays an error: "Invalid dice roll detected"
**And** the game does not proceed
**Note:** This should never happen with correct backend, but frontend should handle gracefully.

## Related User Stories

- **US-035**: Animation Settings & Preferences (Instant Animation mode)
- **US-034**: Configure House Rules (Use Blanks setting affects tile count)

## Accessibility Considerations

### Keyboard Navigation

- **Focus**: "Roll Dice" button is auto-focused when visible
- **Shortcut**: `R` key triggers roll when button is focused

### Screen Reader

- **Announce**: "East rolled 7. Wall breaks at position 42. 152 tiles remaining."
- **ARIA Label**: Button has `aria-label="Roll dice to start game"`

### Visual

- **High Contrast**: Dice result is large, bold text with high contrast against background
- **Motion**: Respects `prefers-reduced-motion` for animation skipping

## Priority

**HIGH** - Required for game start, blocks all subsequent gameplay

## Story Points / Complexity

**3** - Medium complexity

- Dice animation logic
- Wall break visualization
- Event synchronization
- Limited to East seat (conditional rendering)

## Definition of Done

- [ ] "Roll Dice" button visible only to East player (human)
- [ ] Button click sends `RollDice` command
- [ ] Dice animation plays with sound effect (or skips if instant mode)
- [ ] Bot auto-triggers roll when East is a bot
- [ ] `DiceRolled` event displays sum prominently
- [ ] `WallBroken` event visualizes gap in wall with pivot animation
- [ ] Wall counter shows correct tile count (152 or 160 with blanks)
- [ ] Draw direction indicator shows right-to-left
- [ ] Phase advances to `Setup(Dealing)`
- [ ] Instant animation mode works (AC-5)
- [ ] Component tests pass (DiceOverlay, Wall, ActionBar, WallCounter)
- [ ] Integration test passes (command → events → state update)
- [ ] E2E test passes (full dice roll → wall break → deal sequence)
- [ ] Bot behavior test passes (auto-roll timing)
- [ ] Accessibility tests pass (keyboard nav, screen reader, sound)
- [ ] Manually tested against `user-testing-plan.md` (Part 2, Scenario 2.1)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### Dice Roll Algorithm (Backend)

The backend uses Rust's `rand` crate to generate two random values (1-6):

```rust
let die1 = rng.gen_range(1..=6);
let die2 = rng.gen_range(1..=6);
let sum = die1 + die2;
```text

Frontend receives only the sum, not individual dice values. If you want to display individual dice faces for realism, you can:

1. Derive from sum (e.g., sum=7 → show [3,4] or [2,5] or [1,6] randomly)
2. Request backend enhancement to return individual values

### Wall Break Position Calculation

From Game Design Doc Section 2.1.2:

- Count counterclockwise from East's wall
- `dice_sum` stacks from the **right** end
- Break point = index where drawing begins

Frontend doesn't calculate this—just visualizes the `position` value from backend.

### Animation Timing

Coordinate with `useActionQueue` orchestrator:

- Dice roll: 500ms (or instant if "Instant Animations" enabled)
- Wall break pivot: 300ms (or instant)
- Brief pause before dealing: 200ms
- Total: ~1 second from roll to first tile dealt (or ~200ms in instant mode)

Ensure `getEventAnimationDelay()` in `apps/client/src/animations/orchestrator.ts` accounts for this.

### Bot Behavior

When East is a bot:

- Frontend detects bot status from game state
- Automatically sends `RollDice` command after random delay (500-1500ms)
- Delay adds realism and prevents instant actions feeling "robotic"
- Shows message to other players: "East (Bot) is rolling dice..."

Check `gameState.seats[Seat.East].player.is_bot` to determine if East is a bot.

### Sound Effects

Dice roll sound should:

- Play simultaneously with animation start
- Be a realistic "dice tumbling" sound (~0.5s duration)
- Respect user's sound settings (muted if disabled)
- Play even in instant animation mode (unless audio is disabled)

Use `useSoundEffects()` hook: `playSoundEffect('dice_roll')`

### Wall Break Animation

The pivot animation:

- **Anchor point**: Left edge of the break stays fixed
- **Pivot**: Right section rotates outward ~15-20 degrees
- **Direction**: Swings toward the center of the board
- **Duration**: 300ms with ease-out easing
- In instant mode: gap appears immediately with no pivot

Wall tiles on either side of the break should visually separate to show the gap clearly.

```text

```text
````
