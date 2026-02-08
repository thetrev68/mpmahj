# Test Scenario: Call Priority - Mahjong Wins

## Setup (Arrange)

- Game state: `apps/client/src/test/fixtures/game-states/playing-call-window.json`
- Mock WebSocket: connected
- User seated as: South
- Discarder: North

## Steps (Act)

1. Receive `CallWindowOpened` with `tile=DOT_5`, `discarded_by=North`, `can_call=[South, West]`.
2. Receive `CallWindowProgress` with intents: South=Mahjong, West=Meld(Pung).
3. Receive `CallResolved` with `resolution=Mahjong(South)` and `tie_break=null`.
4. Observe the call resolution overlay.

## Expected Outcome (Assert)

- Overlay is visible with title "Call Resolved".
- Message reads: "South wins: Mahjong beats Pung".
- Priority rules are displayed.
- Priority diagram shows Discarder North and priority order clockwise.
- All callers listed with their intents, South marked as winner.

## Error Cases

- If `resolution="NoCall"`, overlay does not show.

## References

- User Story: US-012
- Components: CallResolutionOverlay, PriorityDiagram
