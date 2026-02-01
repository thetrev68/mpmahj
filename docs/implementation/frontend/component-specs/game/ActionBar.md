# ActionBar

## Purpose

Bottom action panel that displays context-aware buttons for game actions (Discard, Pass, Call, Mahjong, etc.). Changes based on game phase and player's turn state. Primary interaction point for player decisions.

## User Stories

- US-002: Charleston pass action
- US-005: Charleston voting (Stop/Continue)
- US-009: Discard tile action
- US-011: Call window actions (Pung, Kong, Mahjong)
- US-016: Sort hand button
- US-022: Undo request

## Props

````typescript
interface ActionBarProps {
  // Game state
  gamePhase: GamePhase; // 'Charleston' | 'Playing' | 'CallWindow' | 'Voting'
  isMyTurn: boolean;

  // Available actions
  availableActions: GameAction[];

  // Current state
  selectedTiles?: number[]; // For Charleston/Discard
  callOptions?: CallOption[]; // For call window

  // Callbacks
  onAction: (action: GameAction) => void;
  onSort?: () => void;
}

type GamePhase = 'Charleston' | 'Playing' | 'CallWindow' | 'Voting';

type GameAction =
  | { type: 'charleston_pass'; tiles: number[] }
  | { type: 'charleston_vote'; vote: 'stop' | 'continue' }
  | { type: 'discard'; tileIndex: number }
  | { type: 'call'; callType: 'Pung' | 'Kong' | 'Mahjong' }
  | { type: 'pass_call' }
  | { type: 'sort_hand'; sortBy: 'suit' | 'value' }
  | { type: 'undo_request' };

interface CallOption {
  type: 'Pung' | 'Kong' | 'Mahjong';
  tiles: TileData[]; // Tiles that would form the meld
  enabled: boolean; // Based on game rules
}
```text

## Behavior

### Charleston Phase

Buttons:

- **Pass** - Confirm selected 3 tiles, pass to next player
  - Disabled if < 3 tiles selected
  - Enabled when exactly 3 tiles selected (not jokers)
- **Sort Hand** - Toggle sort mode (suit/value)
  - Always enabled

### Charleston Voting Phase

Buttons:

- **Stop Charleston** - Vote to stop after first Charleston
- **Continue Charleston** - Vote for second Charleston
- Timer countdown shows vote deadline

### Playing Phase (My Turn)

Buttons:

- **Discard** - Discard selected tile
  - Disabled if no tile selected
  - Enabled when 1 tile selected
- **Sort Hand** - Toggle sort mode
  - Always enabled
- **Mahjong** - Declare win (if valid)
  - Enabled only if hand is complete (validated by backend)

### Call Window Phase (Not My Turn)

Buttons:

- **Pung** - Claim discard for Pung
  - Enabled if player has 2 matching tiles
- **Kong** - Claim discard for Kong
  - Enabled if player has 3 matching tiles
- **Mahjong** - Claim discard to win
  - Enabled if discard completes player's hand
- **Pass** - Let discard go to next player
  - Always enabled, default after timeout

Timer: 5-second countdown for call decision

### Disabled State (Not My Turn, No Calls)

Show minimal UI:

- **Sort Hand** only
- Grayed out with "Wait for your turn" message

## Visual Requirements

### Layout

```text
┌─────────────────────────────────────────────────────────┐
│  [Sort] [Info Text]         [Primary Action] [Secondary]│
└─────────────────────────────────────────────────────────┘
```text

- Left: Utility buttons (Sort, Undo)
- Center: Status text ("Select 3 tiles", "Your turn", etc.)
- Right: Primary action buttons (Discard, Pass, Call, etc.)

### Button Styles

- **Primary action**: Large, blue button (Discard, Pass, Mahjong)
- **Call actions**: Medium, green buttons (Pung, Kong)
- **Utility**: Small, gray buttons (Sort, Pass Call)
- **Destructive**: Red button (Stop Charleston)

### States

- **Enabled**: Full color, clickable
- **Disabled**: 50% opacity, cursor: not-allowed
- **Hovered**: Slight elevation, brighter color
- **Pressed**: Scale down 95%

### Animations

- Button state changes: Smooth 150ms transition
- Appearance/disappearance: Fade in/out 200ms
- Primary button pulse: Subtle glow when ready

### Timer Display

When a timer is active (Charleston, Call Window):

- Circular progress bar around action button
- Countdown number (seconds remaining)
- Color shift: green → yellow → red as time runs out

## Related Components

- **Used by**: `<GameBoard>` (fixed bottom position)
- **Uses**: shadcn/ui `<Button>` component
- **Uses**: shadcn/ui `<Badge>` for status text
- **Uses**: `<Timer>` component for countdowns

## Implementation Notes

### Action Validation

```typescript
function getAvailableActions(
  gamePhase: GamePhase,
  isMyTurn: boolean,
  selectedTiles: number[],
  callOptions: CallOption[]
): GameAction[] {
  const actions: GameAction[] = [];

  if (gamePhase === 'Charleston') {
    if (selectedTiles.length === 3) {
      actions.push({ type: 'charleston_pass', tiles: selectedTiles });
    }
  } else if (gamePhase === 'Playing' && isMyTurn) {
    if (selectedTiles.length === 1) {
      actions.push({ type: 'discard', tileIndex: selectedTiles[0] });
    }
    // Check if Mahjong is possible (backend validates)
  } else if (gamePhase === 'CallWindow') {
    actions.push(
      ...callOptions
        .filter((c) => c.enabled)
        .map((c) => ({
          type: 'call',
          callType: c.type,
        }))
    );
    actions.push({ type: 'pass_call' });
  }

  // Sort always available
  actions.push({ type: 'sort_hand', sortBy: 'suit' });

  return actions;
}
```text

### Button Rendering

```typescript
function renderActionButtons(availableActions: GameAction[], onAction: (action: GameAction) => void) {
  return (
    <>
      {availableActions.map(action => (
        <Button
          key={action.type}
          onClick={() => onAction(action)}
          disabled={!action.enabled}
          variant={getButtonVariant(action.type)}
        >
          {getButtonLabel(action.type)}
        </Button>
      ))}
    </>
  );
}
```text

### Keyboard Shortcuts

- **D**: Discard selected tile
- **P**: Pass (Charleston or Call)
- **M**: Declare Mahjong
- **S**: Sort hand
- **1-3**: Quick select call type (Pung=1, Kong=2, Mahjong=3)

Implemented via `useKeyboardShortcuts()` hook.

### Performance

- Memoize action list calculation
- Debounce rapid button clicks (prevent double-submit)
- Optimistic UI: Show loading state after action sent

### Accessibility

- ARIA label: "Game action bar"
- ARIA live region for status text: "Select 3 tiles to pass"
- Keyboard focus on primary action button when phase changes
- Clear focus indicators (blue outline)

## Testing Considerations

- Verify correct buttons shown for each phase
- Test button enable/disable logic
- Validate timer countdown behavior
- Test keyboard shortcuts
- Edge case: Multiple available calls (priority)
- Edge case: Timer expires (auto-default action)
- Edge case: Network lag (prevent duplicate actions)

## Example Usage

```tsx
// Charleston phase
<ActionBar
  gamePhase="Charleston"
  isMyTurn={true}
  availableActions={['charleston_pass', 'sort_hand']}
  selectedTiles={[2, 5, 8]}
  onAction={handleAction}
  onSort={handleSort}
/>

// Playing phase (my turn)
<ActionBar
  gamePhase="Playing"
  isMyTurn={true}
  availableActions={['discard', 'sort_hand']}
  selectedTiles={[13]}
  onAction={handleAction}
/>

// Call window (not my turn)
<ActionBar
  gamePhase="CallWindow"
  isMyTurn={false}
  availableActions={['call', 'pass_call']}
  callOptions={[
    { type: 'Pung', tiles: [...], enabled: true },
    { type: 'Mahjong', tiles: [...], enabled: false }
  ]}
  onAction={handleCallAction}
/>
```text

## Edge Cases

1. **Multiple calls available**: Show all enabled options, let player choose
2. **Mahjong false positive**: Backend validates, show error if invalid
3. **Timer expires mid-selection**: Auto-select default action (Pass)
4. **Network timeout**: Show loading spinner, disable buttons
5. **Undo during action**: Cancel pending action, restore previous state

---

**Estimated Complexity**: Medium (~100-120 lines implementation)
**Dependencies**: shadcn/ui `<Button>`, `<Timer>` component
**Phase**: Phase 1 - MVP Core
````
