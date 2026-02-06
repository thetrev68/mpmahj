# Test Scenario: Roll Dice & Break Wall

**User Story**: US-001 - Roll Dice & Break Wall
**Fixtures**: `game-states/setup-rolling-dice.json`, `events/dice-roll-sequence.json`

## Prerequisites

Before writing tests for this scenario, verify the command/event shapes by reading:

- `apps/client/src/types/bindings/generated/GameCommand.ts`
- `apps/client/src/types/bindings/generated/PublicEvent.ts`
- `apps/client/src/types/bindings/generated/PrivateEvent.ts`

## Setup

- **Game state**: `Setup` phase, sub-stage `RollingDice`
- **Mock WebSocket**: Connected, authenticated
- **User seated as**: East (dealer)
- **Players**: All 4 seated (humans or bots)

## Commands & Events (From Backend Bindings)

### Command: RollDice

```typescript
// GameCommand.ts - Exact shape from backend
{ RollDice: { player: "East" } }  // Seat is "East" | "South" | "West" | "North"

// WebSocket envelope (server protocol)
{ kind: "Command", payload: { command: { RollDice: { player: "East" } } } }
```

### Events: DiceRolled, WallBroken

```typescript
// PublicEvent.ts - Exact shapes from backend
{ DiceRolled: { roll: 7 } }  // roll is u8 (2-12), just the sum
{ WallBroken: { position: 7 } }  // position is usize, same value as roll

// WebSocket envelope
{ kind: "Event", payload: { event: { Public: { DiceRolled: { roll: 7 } } } } }
{ kind: "Event", payload: { event: { Public: { WallBroken: { position: 7 } } } } }
```

### Private Event: TilesDealt

```typescript
// PrivateEvent.ts - Sent only to each player
{ TilesDealt: { your_tiles: [0, 1, 5, 9, 12, ...] } }  // Array of Tile (numbers 0-36)

// WebSocket envelope
{ kind: "Event", payload: { event: { Private: { TilesDealt: { your_tiles: [0, 1, 5, 9, 12, ...] } } } } }
```

### Phase Transition

```typescript
// Backend transitions internally during setup:
// RollingDice -> BreakingWall -> Dealing -> OrganizingHands
// No public PhaseChanged event is emitted during this setup sequence.
```

## Test Flow

### Test 1: East rolls dice successfully

**Setup**: Game in `Setup(RollingDice)`, user is East

1. **Assert initial state**:
   - "Roll Dice" button is visible and enabled
   - Other players see "Waiting for East to roll dice..."

2. **Action**: User clicks "Roll Dice" button

3. **Assert command sent**:

   ```typescript
   expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
     kind: "Command",
     payload: { command: { RollDice: { player: "East" } } }
   }));
   ```

4. **Simulate server response**:

   ```typescript
   mockWs.triggerMessage({ kind: "Event", payload: { event: { Public: { DiceRolled: { roll: 7 } } } } });
   ```

5. **Assert UI update**:
   - Dice result "7" is displayed prominently
   - Dice animation plays

6. **Simulate wall break**:

   ```typescript
   mockWs.triggerMessage({ kind: "Event", payload: { event: { Public: { WallBroken: { position: 7 } } } } });
   ```

7. **Assert UI update**:
   - Wall shows visual break at position 7
   - Wall counter updates

8. **Simulate tiles dealt** (private to each player):

   ```typescript
   mockWs.triggerMessage({ kind: "Event", payload: { event: { Private: { TilesDealt: { your_tiles: [0, 1, 5, 9, 12, 18, 22, 27, 31, 33, 34, 35, 2] } } } } });
   ```

9. **Assert hand displayed**:
   - User's hand shows 13 tiles (or 14 if East after dealing complete)
   - Tiles are face-up and sorted

10. **Assert setup stage advanced**:
    - Game phase is now `Setup(OrganizingHands)`
    - "Roll Dice" button is no longer visible

### Test 2: Non-East player cannot roll

**Setup**: Game in `Setup(RollingDice)`, user is South

1. **Assert**:
   - "Roll Dice" button is NOT visible
   - Message shows "Waiting for East to roll dice..."

### Test 3: Button disabled after click (prevent double-submit)

**Setup**: Game in `Setup(RollingDice)`, user is East

1. **Action**: Click "Roll Dice" button
2. **Assert**: Button becomes disabled immediately
3. **Action**: Attempt to click again
4. **Assert**: Only ONE `RollDice` command was sent

### Test 4: Bot auto-roll behavior

**Setup**: Game in `Setup(RollingDice)`, East is a bot

1. **Assert**: No "Roll Dice" button visible to human players
2. **Assert**: Message shows "East (Bot) is rolling dice..."
3. **Simulate**: Backend emits the same event sequence as Test 1 (server-controlled bot)
4. **Continue**: Same event sequence as Test 1

## Success Criteria

- Roll Dice button visible only to East (human)
- Command sent with correct envelope shape: `{ kind: "Command", payload: { command: { RollDice: { player: "East" } } } }`
- UI displays dice sum from `DiceRolled.roll`
- UI shows wall break from `WallBroken.position`
- User receives tiles via `TilesDealt` private event
- Setup stage advances internally after `DiceRolled`, `WallBroken`, and `TilesDealt`
- No hallucinated fields (no `dice[]`, no `roller`, no `dealer`, no `HandsDealt`)

## Error Cases

### Server rejects roll (wrong player)

- **Simulate**: `{ kind: "Event", payload: { event: { Public: { CommandRejected: { player: "South", reason: "Only East can roll dice" } } } } }`
- **Assert**: Error toast displayed, game state unchanged

### Network timeout

- **When**: No response within 5 seconds
- **Assert**: Loading state shown, retry option available

---

**Note**: The backend sends only the dice sum, not individual dice values. If you want to display individual dice faces, derive them client-side (e.g., sum=7 could show [3,4] or [2,5]).
