# Test Scenario: Charleston Standard Pass (First Right)

**User Story**: US-002 - Charleston First Right
**Fixtures**: `game-states/charleston-first-right.json`, `events/charleston-pass-sequence.json`

## Prerequisites

Before writing tests for this scenario, verify the command/event shapes by reading:

- `apps/client/src/types/bindings/generated/GameCommand.ts`
- `apps/client/src/types/bindings/generated/PublicEvent.ts`
- `apps/client/src/types/bindings/generated/PrivateEvent.ts`

## Setup

- **Game state**: `Charleston` phase, stage `FirstRight`
- **Mock WebSocket**: Connected, authenticated
- **User seated as**: East
- **Player hand**: 13 tiles (received via `TilesDealt`)
- **Time remaining**: Timer started via `CharlestonTimerStarted`

## Commands & Events (From Backend Bindings)

### Command: PassTiles

```typescript
// GameCommand.ts - Exact shape from backend
{
  PassTiles: {
    player: "East",           // Seat
    tiles: [0, 15, 33],       // Vec<Tile> - exactly 3 tile indices
    blind_pass_count: null    // Option<u8> - null for standard pass, 1-3 for blind pass
  }
}
```

**Important**: No `stage` field in the command. The server knows the current stage.

### Public Events

```typescript
// PublicEvent.ts - Broadcast to all players
{ CharlestonPhaseChanged: { stage: "FirstRight" } }

{ CharlestonTimerStarted: {
    stage: "FirstRight",
    duration: 60,              // seconds
    started_at_ms: 1706634000000,  // epoch ms
    timer_mode: "Standard"     // or "Hidden"
}}

{ PlayerReadyForPass: { player: "East" } }  // When a player submits their tiles

{ TilesPassing: { direction: "Right" } }    // When all players ready, tiles exchanging

{ CharlestonPhaseChanged: { stage: "FirstAcross" } }  // Next stage
```

### Private Events

```typescript
// PrivateEvent.ts - Sent only to specific player
{ TilesPassed: {
    player: "East",
    tiles: [0, 15, 33]  // Confirmation of tiles you passed
}}

{ TilesReceived: {
    player: "East",
    tiles: [5, 22, 28],      // New tiles received
    from: "West"             // Option<Seat> - who sent them (null on blind pass)
}}
```

## Test Flow

### Test 1: Complete First Right pass

**Setup**: Charleston stage is FirstRight, user has 13 tiles

1. **Assert initial state**:
   - Charleston tracker shows "First Right" with arrow pointing right
   - Timer counting down from 60 seconds
   - "Pass Tiles" button is visible but disabled
   - Selection counter shows "0/3 selected"

2. **Action**: Click tile at index 0 (e.g., 1 Bam)

3. **Assert**:
   - Tile is visually selected (raised, highlighted)
   - Counter shows "1/3 selected"
   - Button still disabled

4. **Action**: Click tile at index 5 (e.g., 6 Crack)

5. **Assert**: Counter shows "2/3 selected", button disabled

6. **Action**: Click tile at index 10 (e.g., 2 Dot)

7. **Assert**:
   - Counter shows "3/3 selected"
   - "Pass Tiles" button becomes enabled

8. **Action**: Click "Pass Tiles" button

9. **Assert command sent**:

   ```typescript
   expect(mockWs.lastSentCommand).toEqual({
     PassTiles: {
       player: 'East',
       tiles: [
         /* the 3 tile indices */
       ],
       blind_pass_count: null,
     },
   });
   ```

10. **Assert UI state**:
    - Button shows loading/disabled state
    - Hand becomes non-interactive
    - Message: "Waiting for other players..."

11. **Simulate server acknowledgment**:

    ```typescript
    mockWs.simulatePrivateEvent({
      TilesPassed: { player: 'East', tiles: [0, 5, 10] },
    });
    ```

12. **Assert**: Selected tiles animate out, hand shows 10 tiles temporarily

13. **Simulate other players ready**:

    ```typescript
    mockWs.simulatePublicEvent({ PlayerReadyForPass: { player: 'South' } });
    mockWs.simulatePublicEvent({ PlayerReadyForPass: { player: 'West' } });
    mockWs.simulatePublicEvent({ PlayerReadyForPass: { player: 'North' } });
    ```

14. **Assert**: Progress indicator shows "4/4 players ready"

15. **Simulate tiles passing**:

    ```typescript
    mockWs.simulatePublicEvent({ TilesPassing: { direction: 'Right' } });
    ```

16. **Assert**: Pass animation plays (arrows showing tiles moving right)

17. **Simulate tiles received**:

    ```typescript
    mockWs.simulatePrivateEvent({
      TilesReceived: { player: 'East', tiles: [22, 28, 31], from: 'West' },
    });
    ```

18. **Assert**:
    - 3 new tiles animate into hand
    - Hand shows 13 tiles again
    - New tiles briefly highlighted

19. **Simulate phase advance**:

    ```typescript
    mockWs.simulatePublicEvent({ CharlestonPhaseChanged: { stage: 'FirstAcross' } });
    ```

20. **Assert**:
    - Charleston tracker updates to "First Across"
    - Timer resets
    - Selection cleared, button disabled again

### Test 2: Jokers cannot be selected

**Setup**: User's hand includes a Joker (tile index 35)

1. **Action**: Click on Joker tile
2. **Assert**:
   - Joker is NOT selected
   - Joker has visual disabled indicator (dimmed, strike-through)
   - Tooltip: "Jokers cannot be passed"
   - Selection count unchanged

### Test 3: Cannot select more than 3 tiles

**Setup**: User has selected 3 tiles

1. **Action**: Click on a 4th unselected tile
2. **Assert**:
   - 4th tile is NOT selected
   - Selection remains at 3
   - Tooltip: "Maximum 3 tiles can be selected"

### Test 4: Deselection works

**Setup**: User has selected 3 tiles

1. **Action**: Click on one of the selected tiles
2. **Assert**:
   - Tile is deselected
   - Counter shows "2/3 selected"
   - Button becomes disabled

### Test 5: Double-submit prevention

1. **Action**: Click "Pass Tiles" with 3 selected
2. **Action**: Rapidly click button again
3. **Assert**: Only ONE `PassTiles` command sent

## Success Criteria

- Command uses correct shape: `{ PassTiles: { player, tiles, blind_pass_count } }`
- No `stage` field in command (server tracks this)
- Jokers blocked from selection
- Selection limited to exactly 3 tiles
- Events match backend types exactly
- Phase advances via `CharlestonPhaseChanged`

## Error Cases

### Timer expiry

- **When**: Timer reaches 0 before submission
- **Backend behavior**: Server auto-selects 3 random non-Joker tiles
- **Frontend receives**: `TilesPassed` event with server-selected tiles
- **Assert**: UI shows "Time expired - auto-passed"

### Network error on pass

- **When**: Command fails to send
- **Assert**: Error toast, retry option, tiles remain selected

---

**Note**: The `TilesPassed` and `TilesReceived` are PRIVATE events - only you receive them. Other players see only `PlayerReadyForPass` (public).
