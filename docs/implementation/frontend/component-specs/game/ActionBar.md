# ActionBar

## Purpose

Bottom action panel that displays context-aware buttons for game actions (Discard, Pass, Call, Mahjong, etc.). Changes based on server-driven phase and turn state. Primary interaction point for player decisions.

## User Stories

- US-002: Charleston pass action
- US-005: Charleston voting (Stop/Continue)
- US-009: Discard tile action
- US-011: Call window actions (Pung, Kong, Mahjong)
- US-016: Sort hand button
- US-022: Undo request

## Props

```typescript
interface ActionBarProps {
  // Server-driven game state
  phase: GamePhase;
  turnStage?: TurnStage; // When phase is Playing
  mySeat: Seat;

  // Current selection state
  selectedIndices?: number[]; // Indices in hand array

  // Optional call suggestions (from HintData.call_opportunities)
  callOpportunities?: CallOpportunity[];

  // Callbacks
  onCommand: (command: GameCommand) => void;
  onSort?: () => void; // UI-only sorting
}
```

## Behavior

### Charleston Phase

Buttons:

- **Pass** - Confirm selected tiles, send `PassTiles`
  - Disabled if selection count is invalid for the current `CharlestonStage`
  - Blind pass counts are included when stage allows blind pass
- **Sort Hand** - Toggle sort mode (suit/value)
  - Always enabled

### Charleston Voting Phase

Buttons:

- **Stop Charleston** - `VoteCharleston` with `Stop`
- **Continue Charleston** - `VoteCharleston` with `Continue`
- Timer countdown shows vote deadline

### Playing Phase (My Turn)

Buttons:

- **Discard** - `DiscardTile` for selected hand index
  - Disabled if no tile selected
  - Enabled when 1 tile selected
- **Sort Hand** - Toggle sort mode
  - Always enabled
- **Mahjong** - `DeclareMahjong` (server validates)

### Call Window Phase (Not My Turn)

Buttons:

- **Mahjong** - `DeclareCallIntent` with `Mahjong` intent (if allowed)
- **Meld** - `DeclareCallIntent` with `Meld` intent (if allowed)
- **Pass** - `Pass` (always enabled)

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
```

- Left: Utility buttons (Sort, Undo)
- Center: Status text ("Select 3 tiles", "Your turn", etc.)
- Right: Primary action buttons (Discard, Pass, Call, etc.)

### Button Styles

- **Primary action**: Large, blue button (Discard, Pass, Mahjong)
- **Call actions**: Medium, green buttons (Meld, Mahjong)
- **Utility**: Small, gray buttons (Sort)
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
- **Uses**: shadcn/ui `<Button>` and `<Badge>`
- **Uses**: `<CharlestonTimer>` / `<TurnIndicator>` for countdowns

## Implementation Notes

### Action Validation

```typescript
Action availability is derived from `GamePhase` + `TurnStage` + selection count.
Do not validate hand legality client-side; only enable/disable UI affordances.
```

### Button Rendering

```typescript
function renderActionButtons(actions: Array<GameCommand | { kind: 'sort_hand' }>, onAction: (action: GameCommand | { kind: 'sort_hand' }) => void) {
  return (
    <>
      {actions.map(action => (
        <Button
          key={'kind' in action ? action.kind : Object.keys(action)[0]}
          onClick={() => onAction(action)}
          disabled={false}
          variant={getButtonVariant('kind' in action ? action.kind : Object.keys(action)[0])}
        >
          {getButtonLabel('kind' in action ? action.kind : Object.keys(action)[0])}
        </Button>
      ))}
    </>
  );
}
```

### Keyboard Shortcuts

- **D**: Discard selected tile
- **P**: Pass (Charleston or Call)
- **M**: Declare Mahjong intent (CallWindow)
- **S**: Sort hand

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
  phase={snapshot.phase}
  turnStage={'Playing' in snapshot.phase ? snapshot.phase.Playing : undefined}
  mySeat={snapshot.your_seat}
  selectedIndices={[2, 5, 8]}
  onCommand={handleCommand}
  onSort={handleSort}
/>

// Playing phase (my turn)
<ActionBar
  phase={snapshot.phase}
  turnStage={'Playing' in snapshot.phase ? snapshot.phase.Playing : undefined}
  mySeat={snapshot.your_seat}
  selectedIndices={[13]}
  onCommand={handleCommand}
/>

// Call window (not my turn)
<ActionBar
  phase={snapshot.phase}
  turnStage={'Playing' in snapshot.phase ? snapshot.phase.Playing : undefined}
  mySeat={snapshot.your_seat}
  callOpportunities={hint?.call_opportunities}
  onCommand={handleCommand}
/>
```

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
