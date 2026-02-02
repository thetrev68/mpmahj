# Test Scenario: Call Priority - Turn Order Tie Break

**User Story**: US-012 (Call Priority Resolution)
**Component Specs**: CallWindow.md, IntentBuffering.md
**Fixtures**: `playing-call-window.json`, `call-window-sequence.json`
**Manual Test**: Manual Testing Checklist #12

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-call-window.json`
- **Mock WebSocket**: Connected
- **User seated as**: South
- **Current turn**: East (just discarded a callable tile)
- **Call window**: Open (5 seconds remaining)
- **Other players**:
  - **West**: Also able to call the same discard for Mahjong

## Steps (Act)

1. East discards a tile that completes both South and West hands.
2. South sends `DeclareCallIntent` with `intent: Mahjong`.
3. West sends `DeclareCallIntent` with `intent: Mahjong`.
4. Server resolves priority by turn order (right → across → left from discarder).

## Expected Outcome (Assert)

- `CallResolved` resolves Mahjong to the player closest counterclockwise from discarder.
- `AwaitingMahjongValidation` is sent to the winner.
- Losing player receives no validation prompt.

## Error Cases

- If a player sends intent after call window closes, server ignores it.

## Notes

- Ensure turn-order logic matches `call_resolution::resolve_calls()`.
