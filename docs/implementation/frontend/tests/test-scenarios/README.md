# Test Scenarios

Step-by-step test scripts that map user stories to executable test code. Each scenario describes the Arrange-Act-Assert flow for testing a specific feature.

## Format

Each scenario follows this structure:

`````markdown
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

````

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

### Charleston

- [x] `charleston-standard.md` - Standard 3-tile pass (Right/Across/Left)
- [x] `charleston-blind-pass.md` - Blind passing tiles
- [x] `charleston-voting.md` - Vote to continue/stop
- [x] `charleston-courtesy-pass.md` - Courtesy pass negotiation
- [x] `charleston-iou.md` - IOU edge case (all blind pass)

### Main Gameplay

- [x] `drawing-discarding.md` - Standard turn flow
- [x] `calling-priority-mahjong.md` - Mahjong beats meld
- [ ] `calling-priority-turn-order.md` - Turn order breaks ties
- [x] `joker-exchange-single.md` - Single Joker exchange
- [ ] `joker-exchange-multiple.md` - Multiple exchanges in one turn
- [ ] `meld-upgrade.md` - Pung → Kong → Quint

### Win Conditions

- [ ] `mahjong-self-draw.md` - Self-drawn winning tile
- [x] `mahjong-called.md` - Called discard for win
- [ ] `mahjong-invalid.md` - Invalid declaration → Dead hand

### Advanced Features

- [ ] `undo-solo.md` - Immediate undo
- [ ] `undo-voting.md` - Multiplayer undo vote
- [ ] `history-jump.md` - Jump to previous move
- [ ] `history-resume.md` - Resume from history point

### Error/Edge Cases

- [x] `dead-hand-tile-count.md` - Wrong tile count → Dead hand
- [x] `wall-game.md` - Wall exhausted → Draw
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
