# Test Scenarios

Step-by-step test scripts that map user stories to executable test code. Each scenario describes the Arrange-Act-Assert flow for testing a specific feature.

## Format

Each scenario follows this structure:

```markdown
# Test Scenario: [Feature Name]

## Setup (Arrange)

- Game state: [fixture file]
- Mock WebSocket: connected/disconnected
- User seated as: [seat]
- Additional setup steps

## Steps (Act)

1. [Action step]
2. [Action step]
3. [Assertion checkpoint]
4. [Continue...]

## Expected Outcome (Assert)

- [Expected result 1]
- [Expected result 2]
- [Expected final state]

## Error Cases

- [Edge case 1]: [Expected behavior]
- [Edge case 2]: [Expected behavior]
```

## Naming Convention

`[feature]-[variant].md`

Examples:

- `charleston-standard.md`
- `charleston-blind-pass.md`
- `calling-priority-mahjong.md`
- `joker-exchange-multiple.md`

## How These Map to Tests

### Integration Test Example

```typescript
// Based on: tests/test-scenarios/charleston-standard.md
import charlestonState from '@/tests/fixtures/game-states/charleston-first-right.json';

describe('Charleston Standard Pass (Scenario)', () => {
  test('user selects 3 tiles and passes right', async () => {
    // ARRANGE (from scenario Setup section)
    const { mockWs } = setupMockWebSocket();
    const { applySnapshot } = useGameStore.getState();
    applySnapshot(charlestonState);

    const { user } = render(<GameTable />);

    // ACT (from scenario Steps section)
    // Step 1: Wait for Charleston tracker
    await waitFor(() => {
      expect(screen.getByText(/FirstRight/i)).toBeInTheDocument();
    });

    // Step 2: Select 3 tiles
    const tiles = screen.getAllByRole('button', { name: /tile/i });
    await user.click(tiles[0]);
    await user.click(tiles[1]);
    await user.click(tiles[2]);

    // Step 3: Click Pass Tiles
    await user.click(screen.getByRole('button', { name: /Pass Tiles/i }));

    // Step 4: Verify command sent
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'Command',
        payload: { command: { PassTiles: { /* ... */ } } }
      })
    );

    // ASSERT (from scenario Expected Outcome section)
    // ... continue with assertions
  });
});
```

## Index of Scenarios

### Room Setup & Session Management

- [x] `create-room.md` - Create room (server envelope flow)
- [x] `join-room.md` - Join room (server envelope flow)
- [x] `leave-game.md` - Leave game gracefully
- [x] `forfeit-game.md` - Forfeit and accept loss

### Game Start

- [x] `roll-dice-break-wall.md` - Roll dice and break wall

### Charleston

- [x] `charleston-standard.md` - First Right (standard 3-tile pass)
- [x] `charleston-first-across.md` - First Across pass
- [x] `charleston-blind-pass.md` - First Left (blind pass)
- [x] `charleston-voting.md` - Vote to continue/stop
- [x] `charleston-second-charleston.md` - Optional second Charleston
- [x] `charleston-courtesy-pass.md` - Courtesy pass negotiation
- [x] `charleston-iou.md` - IOU edge case (all blind pass)

### Main Gameplay - Core Turn Flow

- [x] `drawing-discarding.md` - Standard turn flow
- [x] `call-window-intent-buffering.md` - Call window and intent buffering
- [x] `calling-priority-mahjong.md` - Mahjong beats meld
- [x] `calling-priority-turn-order.md` - Turn order breaks ties

### Main Gameplay - Special Actions

- [x] `calling-pung-kong-quint-sextet.md` - Calling melds
- [x] `joker-exchange-single.md` - Single Joker exchange
- [x] `joker-exchange-multiple.md` - Multiple exchanges in one turn
- [x] `meld-upgrade.md` - Pung → Kong → Quint upgrade
- [x] `wall-closure-rule.md` - Dead wall rule enforcement

### Win Conditions

- [x] `mahjong-self-draw.md` - Self-drawn winning tile
- [x] `mahjong-called.md` - Called discard for win
- [x] `mahjong-invalid.md` - Invalid declaration → Dead hand
- [x] `dead-hand-tile-count.md` - Wrong tile count → Dead hand
- [x] `wall-game.md` - Wall exhausted → Draw

### History & Undo

- [x] `undo-solo.md` - Immediate undo
- [x] `undo-voting.md` - Multiplayer undo vote
- [x] `view-move-history.md` - View move history
- [x] `history-jump.md` - Jump to previous move
- [x] `history-resume.md` - Resume from history point

### AI Hints

- [x] `request-hints-ai-analysis.md` - Request AI hints
- [x] `adjust-hint-verbosity.md` - Adjust hint verbosity

### Error/Edge Cases

- [x] `disconnect-reconnect.md` - Network recovery
- [x] `timer-expiry.md` - Auto-action on timeout

## Relationship to Other Docs

```text
User Story → Test Scenario → Component Spec → Actual Test
    ↓             ↓               ↓              ↓
  (WHAT)       (HOW TEST)     (HOW BUILD)   (EXECUTABLE)
```

Example flow:

1. **US-002** defines: "User passes 3 tiles right"
2. **charleston-standard.md** defines: Test steps to verify US-002
3. **TileSelectionPanel.md** defines: Component that implements tile selection
4. **CharlestonFlow.test.tsx** executes: Actual test code

## Cross-References

Each scenario should reference:

- **User Story**: Which US-XXX this tests
- **Component Specs**: Which components are involved
- **Fixtures**: Which fixture files to use
- **Manual Test**: Corresponding checklist in `user-testing-plan.md`
