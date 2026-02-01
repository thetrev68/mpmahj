# TimerConfigPanel

## Purpose

Configuration panel for game timer settings: Charleston duration, call window timeout, and vote deadline. Used during room creation or game preferences.

## User Stories

- US-036: Timer configuration (Charleston, call window, votes)
- US-029: Room creation with timer settings

## Props

```typescript
interface TimerConfigPanelProps {
  /** Current timer settings */
  config: TimerConfig;

  /** Callback when config changes */
  onChange: (config: TimerConfig) => void;

  /** Read-only mode (view settings, can't edit) */
  readOnly?: boolean;

  /** Show presets */
  showPresets?: boolean;
}

interface TimerConfig {
  /** Charleston phase timer (seconds) */
  charleston_seconds: number; // Default: 60, Range: 30-120

  /** Call window timeout (seconds) */
  call_window_seconds: number; // Default: 5, Range: 3-10

  /** Vote deadline (seconds) */
  vote_seconds: number; // Default: 15, Range: 10-30

  /** Turn timer (optional, 0 = disabled) */
  turn_seconds: number; // Default: 0, Range: 0, 30-120
}
```

## Behavior

### Timer Controls

Each timer has:

- Slider for duration
- Label with current value
- Min/max constraints
- Description of what timer controls

### Presets

If `showPresets === true`:

- **Fast**: Charleston 30s, Call 3s, Vote 10s
- **Normal**: Charleston 60s, Call 5s, Vote 15s (default)
- **Relaxed**: Charleston 90s, Call 8s, Vote 25s
- **Custom**: User-defined values

### Validation

- Min/max enforced on sliders
- Invalid values clamped to range
- Show warning if values unusually short/long

### Read-Only Mode

When `readOnly === true`:

- Display as labeled values
- No sliders, just text
- Used to show room timer settings

## Visual Requirements

### Layout

```
┌──────────────────────────────────────┐
│ Timer Settings         [Preset: ▼]   │
│                                      │
│ Charleston Timer:                    │
│ ├─────●─────────┤ 60 seconds        │
│ Time to select 3 tiles to pass       │
│                                      │
│ Call Window:                         │
│ ├─●─────────────┤ 5 seconds         │
│ Time to decide on Pung/Kong/Mahjong  │
│                                      │
│ Vote Timer:                          │
│ ├────●──────────┤ 15 seconds        │
│ Time to vote on second Charleston    │
│                                      │
│ Turn Timer: (Optional)               │
│ ├●──────────────┤ Off                │
│ Max time per turn (0 = disabled)     │
└──────────────────────────────────────┘
```

### Slider Styling

- Thumb shows current value
- Track shows valid range
- Marks at min/max/default

## Related Components

- **Used by**: `<CreateRoomForm>`, Settings screen
- **Uses**: shadcn/ui `<Slider>`, `<Select>`, `<Label>`

## Implementation Notes

### Defaults

```typescript
const DEFAULT_TIMER_CONFIG: TimerConfig = {
  charleston_seconds: 60,
  call_window_seconds: 5,
  vote_seconds: 15,
  turn_seconds: 0, // Disabled
};

const TIMER_RANGES = {
  charleston_seconds: { min: 30, max: 120, step: 5 },
  call_window_seconds: { min: 3, max: 10, step: 1 },
  vote_seconds: { min: 10, max: 30, step: 5 },
  turn_seconds: { min: 0, max: 120, step: 10 },
};
```

### Presets

```typescript
const TIMER_PRESETS: Record<string, TimerConfig> = {
  fast: {
    charleston_seconds: 30,
    call_window_seconds: 3,
    vote_seconds: 10,
    turn_seconds: 0,
  },
  normal: DEFAULT_TIMER_CONFIG,
  relaxed: {
    charleston_seconds: 90,
    call_window_seconds: 8,
    vote_seconds: 25,
    turn_seconds: 0,
  },
};
```

### Validation

```typescript
function validateTimerConfig(config: TimerConfig): TimerConfig {
  return {
    charleston_seconds: clamp(config.charleston_seconds, 30, 120),
    call_window_seconds: clamp(config.call_window_seconds, 3, 10),
    vote_seconds: clamp(config.vote_seconds, 10, 30),
    turn_seconds: clamp(config.turn_seconds, 0, 120),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

### Server Integration

```typescript
// Send to backend when creating room
interface CreateRoomCommand {
  name: string;
  timer_config: TimerConfig;
}

const handleCreateRoom = () => {
  sendCommand({
    CreateRoom: {
      name: roomName,
      timer_config: currentTimerConfig,
    },
  });
};
```

## Accessibility

**ARIA**:

- Sliders: `aria-label="Charleston timer duration"`
- Value display: `aria-live="polite"` for screen readers
- Presets: `aria-label="Timer presets"`

**Keyboard**:

- Arrow keys adjust slider values
- PageUp/PageDown for larger increments
- Home/End for min/max

## Example Usage

```tsx
// Room creation (editable)
<TimerConfigPanel
  config={timerConfig}
  onChange={setTimerConfig}
  showPresets={true}
/>

// Room lobby (read-only)
<TimerConfigPanel
  config={roomTimerConfig}
  readOnly={true}
/>
```

## Edge Cases

1. **Invalid values**: Clamp to valid range
2. **Preset selection**: Override all values
3. **Turn timer = 0**: Disabled, show "Off"
4. **Very short timers**: Warning that gameplay may be rushed

## Testing Considerations

- Preset selection applies correct values
- Sliders constrained to valid ranges
- Changes trigger `onChange`
- Read-only mode disables inputs
- Validation clamps invalid values

---

**Estimated Complexity**: Simple (~80 lines)
**Dependencies**: shadcn/ui Slider, Select, Label
**Phase**: Phase 5 - Winning & Settings
