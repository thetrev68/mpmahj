# Test Scenario: Call Priority - Closest Mahjong Wins

## Setup (Arrange)

- Game state: `apps/client/src/test/fixtures/game-states/playing-call-window.json`
- Mock WebSocket: connected
- User seated as: South
- Discarder: East

## Steps (Act)

1. Receive `CallWindowOpened` with `tile=DOT_5`, `discarded_by=East`, `can_call=[South, North]`.
2. Receive `CallWindowProgress` with intents: South=Mahjong, North=Mahjong.
3. Receive `CallResolved` with `resolution=Mahjong(South)` and `tie_break.SeatOrder.contenders=[South, North]`.
4. Observe the call resolution overlay.

## Expected Outcome (Assert)

- Overlay is visible.
- Message reads: "South wins: Both Mahjong, South is closer".
- Tie-break section lists contenders "South, North".
- Priority diagram shows Discarder East and priority order clockwise.
- All callers listed as Mahjong.

## Error Cases

- If more than two Mahjong callers are present, message uses "Multiple Mahjong calls".

## References

- User Story: US-012
- Components: CallResolutionOverlay, PriorityDiagram
