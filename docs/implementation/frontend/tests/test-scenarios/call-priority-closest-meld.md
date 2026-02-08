# Test Scenario: Call Priority - Closest Meld Wins

## Setup (Arrange)

- Game state: `apps/client/src/test/fixtures/game-states/playing-call-window.json`
- Mock WebSocket: connected
- User seated as: South
- Discarder: East

## Steps (Act)

1. Receive `CallWindowOpened` with `tile=DOT_5`, `discarded_by=East`, `can_call=[South, West]`.
2. Receive `CallWindowProgress` with intents: South=Meld(Pung), West=Meld(Pung).
3. Receive `CallResolved` with `resolution=Meld(South)` and `tie_break.SeatOrder.contenders=[South, West]`.
4. Observe the call resolution overlay.

## Expected Outcome (Assert)

- Overlay is visible.
- Message reads: "South wins: Closest to discarder".
- Tie-break section lists contenders "South, West".
- Priority diagram shows Discarder East and priority order clockwise.
- All callers listed with their intents.

## Error Cases

- If tie-break metadata is missing, overlay still renders but omits tie-break section.

## References

- User Story: US-012
- Components: CallResolutionOverlay, PriorityDiagram
