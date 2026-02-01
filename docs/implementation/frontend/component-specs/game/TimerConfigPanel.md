# TimerConfigPanel

## Purpose

Configuration panel for game timer settings: Charleston duration, call window timeout, and vote deadline. Used during room creation or game preferences.

## User Stories

- US-036: Timer configuration (Charleston, call window, votes)
- US-029: Room creation with timer settings

## Props

````typescript
interface TimerConfigPanelProps {
  /** Current timer settings (from Ruleset) */
  ruleset: Ruleset;

  /** Callback when config changes */
  onChange: (ruleset: Ruleset) => void;

  /** Read-only mode (view settings, can't edit) */
  readOnly?: boolean;

  /** Show presets */
  showPresets?: boolean;
}
```text

## Behavior

### Timer Controls

Each timer has:

- Slider for duration
- Label with current value
- Min/max constraints
- Description of what timer controls

### Preset Selection

If `showPresets === true`:

- **Fast**: Charleston 45s, Call 3s
- **Normal**: Charleston 60s, Call 5s (default)
- **Relaxed**: Charleston 90s, Call 8s
- **Custom**: User-defined values

### Timer Validation

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

```text
┌──────────────────────────────────────┐
│ Timer Settings         [Preset: ▼]   │
│                                      │
│ Charleston Timer:                    │
│ ├─────●─────────┤ 60 seconds        │
│ Time to select tiles to pass         │
│                                      │
│ Call Window:                         │
│ ├─●─────────────┤ 5 seconds         │
│ Time to decide on call               │
│                                      │
│ Timer Visibility:                    │
│ [Visible ▼]                           │
└──────────────────────────────────────┘
```text

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
const TIMER_RANGES = {
  charleston_timer_seconds: { min: 30, max: 120, step: 5 },
  call_window_seconds: { min: 3, max: 10, step: 1 },
};
```text

### Presets

```typescript
const TIMER_PRESETS: Record<string, Ruleset> = {
  fast: {
    card_year: 2025,
    timer_mode: 'Visible',
    blank_exchange_enabled: false,
    call_window_seconds: 3,
    charleston_timer_seconds: 45,
  },
  normal: {
    card_year: 2025,
    timer_mode: 'Visible',
    blank_exchange_enabled: false,
    call_window_seconds: 5,
    charleston_timer_seconds: 60,
  },
  relaxed: {
    card_year: 2025,
    timer_mode: 'Visible',
    blank_exchange_enabled: false,
    call_window_seconds: 8,
    charleston_timer_seconds: 90,
  },
};
```text

### Validation

```typescript
function validateRuleset(ruleset: Ruleset): Ruleset {
  return {
    ...ruleset,
    charleston_timer_seconds: clamp(ruleset.charleston_timer_seconds, 30, 120),
    call_window_seconds: clamp(ruleset.call_window_seconds, 3, 10),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```text

### Server Integration

```typescript
// Send to backend when creating room
// Timer configuration is part of Ruleset in the room state.
```text

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
```text

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
````
