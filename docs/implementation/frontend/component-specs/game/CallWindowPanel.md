# CallWindowPanel

## Purpose

Displays available call actions (Pung/Kong/Mahjong/Pass) during the call window. Presents enabled options with timer urgency and tile preview. Critical for turn flow and meld formation.

## User Stories

- US-011: Call window actions (5-second decision window)
- US-012: Call priority resolution (multiple callers)
- US-013: Exposed melds (call results)

## Props

```typescript
interface CallWindowPanelProps {
  /** Whether call window is currently open */
  isOpen: boolean;

  /** TurnStage::CallWindow data */
  turnStage: TurnStage & {
    CallWindow: {
      tile: Tile;
      discarded_by: Seat;
      can_act: Seat[];
      pending_intents: CallIntent[];
      timer: number;
    };
  };

  /** Countdown timer (seconds) */
  secondsRemaining: number;

  /** Call suggestions (optional, from HintData.call_opportunities) */
  callOpportunities?: CallOpportunity[];

  /** Callbacks */
  onDeclareIntent: (intent: CallIntentKind) => void;
  onPass: () => void;
}
```

## Behavior

### Call Window Lifecycle

1. **Opens** when another player discards and you can call
2. Server sends `CallWindowOpened` event
3. **5-second timer** counts down
4. Player clicks action or timer expires → auto-Pass
5. **Closes** on action or timeout

### Option Rendering

- Show buttons: Mahjong, Meld, Pass
- **Enabled** options: Based on server `can_act` and local seat
- **Disabled** options: Grayed out, tooltip explains why
- **Pass**: Always enabled, default action
- **Meld intent** requires a `Meld` payload built from hand + discard (server validates)

### Timer Urgency

- **5-4s**: Green, calm
- **3-2s**: Yellow, warning pulse
- **1-0s**: Red, urgent pulse (faster)
- **0s**: Auto-pass, panel closes

### Tile Preview

- On hover over call button → show tiles that would be used (if `callOpportunities` provided)
- Preview appears below buttons
- Shows: discard + matching tiles from hand

### Keyboard Shortcuts

- **M**: Mahjong (if enabled)
- **C**: Meld intent (if enabled)
- **Space / Escape**: Pass

## Visual Requirements

### Layout

```text
┌────────────────────────────────────────────┐
│ Call Window                      ⏱ 3s     │
│ [Meld] [Mahjong]                 [Pass]   │
│                                            │
│ Preview: [tile] [tile] [tile] (on hover)  │
└────────────────────────────────────────────┘
```

- Header: Title left, timer right
- Buttons: Call actions left, Pass right
- Preview: Below buttons (conditional)

### Button Styles

- **Enabled**: Primary blue, hover lift
- **Disabled**: Gray, 50% opacity, cursor: not-allowed
- **Pass**: Secondary gray, always enabled
- **Urgent (low timer)**: Red pulsing border

### Timer States

```typescript
function getTimerColor(seconds: number): string {
  if (seconds >= 3) return 'text-green-600';
  if (seconds >= 1) return 'text-yellow-600';
  return 'text-red-600 animate-pulse';
}
```

## Related Components

- **Used by**: `<GameBoard>` (overlay), `<ActionBar>`
- **Uses**: shadcn/ui `<Dialog>`, `<Button>`, `<Badge>`
- **Uses**: `<Tile>` for preview

## Implementation Notes

### Server Event Integration

```typescript
// Backend event arrives via useGameSocket
// Use TurnStage::CallWindow from GamePhase::Playing to render.
```

### Call Action Handler

```typescript
const handleCall = useCallback(
  (intent: CallIntentKind) => {
    // Send command to server (server validates)
    sendCommand({
      DeclareCallIntent: {
        player: mySeat,
        intent,
      },
    });
  },
  [sendCommand, mySeat]
);
```

### Auto-Pass Timeout

```typescript
useEffect(() => {
  if (!isOpen || secondsRemaining > 0) return;

  // Timer expired → auto-pass
  const timeout = setTimeout(() => {
    onPass();
  }, 100); // Small delay for visual feedback

  return () => clearTimeout(timeout);
}, [isOpen, secondsRemaining, onPass]);
```

### Tile Preview Logic

```typescript
function getPreviewTiles(opportunity: CallOpportunity, discard: Tile): Tile[] {
  return [opportunity.tile, discard];
}
```

## Accessibility

**ARIA**:

- Dialog: `role="dialog"` `aria-labelledby="call-window-title"`
- Timer: `aria-live="polite"` `aria-label="{seconds} seconds remaining"`
- Buttons: `aria-disabled="true"` for disabled options

**Keyboard**:

- Focus trap within dialog
- Tab cycles through enabled buttons
- Escape closes (triggers Pass)

**Screen Reader**:

- Announce on open: "Call window opened, {seconds} seconds to decide"
- Announce timer: "3 seconds", "2 seconds", "1 second"
- Announce actions: "Pung available", "Kong disabled: need 3 tiles"

## Example Usage

```tsx
<CallWindowPanel
  isOpen={callWindowState.isOpen}
  options={callWindowState.options}
  secondsRemaining={callWindowState.secondsRemaining}
  discardedTile={callWindowState.discard}
  onCall={handleCallAction}
  onPass={handlePass}
  autoPassTimeout={5000}
/>
```

## Edge Cases

1. **Multiple players call**: Server resolves priority, panel may close before action
2. **Network lag**: Button disabled after click to prevent double-call
3. **Timer desync**: Server is source of truth, client timer is visual only
4. **Priority lost**: Server rejects call → show toast, restore game state
5. **Window closes mid-hover**: Preview disappears gracefully

## Testing Considerations

- Timer counts down correctly (5 → 0)
- Auto-pass triggers at 0 seconds
- Disabled buttons show tooltip
- Enabled buttons trigger `onCall`
- Keyboard shortcuts work
- Preview shows on hover
- Urgent styling at low time
- Focus trap works correctly

---

**Estimated Complexity**: Medium (~120-140 lines)
**Dependencies**: `<Tile>`, `useGameSocket`, shadcn/ui Dialog
**Phase**: Phase 2 - Basic Gameplay (High Priority)
