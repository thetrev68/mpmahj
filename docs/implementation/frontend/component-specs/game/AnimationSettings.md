# AnimationSettings

## Purpose

Settings panel for controlling animation speed, enabling/disabling specific animations, and respecting accessibility preferences (reduced motion).

## User Stories

- US-035: Animation mode and speed configuration
- Accessibility: Respect `prefers-reduced-motion`

## Props

```typescript
interface AnimationSettingsProps {
  /** Current animation preferences */
  settings: AnimationPreferences;

  /** Callback when settings change */
  onChange: (settings: AnimationPreferences) => void;

  /** Show advanced options */
  showAdvanced?: boolean;
}

interface AnimationPreferences {
  /** Global animation speed multiplier */
  speed: 'off' | 'fast' | 'normal' | 'slow'; // Default: 'normal'

  /** Individual animation toggles */
  tile_movement: boolean; // Tile discard/draw animations
  charleston_pass: boolean; // Charleston tile passing
  meld_formation: boolean; // Exposing melds
  dice_roll: boolean; // Dice roll animation
  win_celebration: boolean; // Win celebration effects

  /** Accessibility */
  respect_reduced_motion: boolean; // Override if user sets prefers-reduced-motion
}
```

## Behavior

### Speed Control

- **Off**: No animations, instant state changes
- **Fast**: 0.5× normal duration (quick)
- **Normal**: 1.0× duration (default)
- **Slow**: 2.0× duration (deliberate)

### Individual Toggles

Each animation type can be independently enabled/disabled:

- Tile movement: Tiles slide when discarded/drawn
- Charleston pass: Visual passing between players
- Meld formation: Tiles move to exposed area
- Dice roll: 3D dice animation
- Win celebration: Confetti/sparkles

### Reduced Motion

If `prefers-reduced-motion` detected:

- Show banner: "Reduced motion detected"
- Suggest turning animations off
- `respect_reduced_motion` checkbox to override

### Live Preview

When adjusting speed:

- Show sample animation preview
- Helps user see speed difference

## Visual Requirements

### Layout

```text
┌──────────────────────────────────────┐
│ Animation Settings                   │
│                                      │
│ Speed: ◯ Off  ◯ Fast  ⦿ Normal      │
│        ◯ Slow                        │
│                                      │
│ Enable Animations:                   │
│ ☑ Tile movement                      │
│ ☑ Charleston passing                 │
│ ☑ Meld formation                     │
│ ☑ Dice roll                          │
│ ☑ Win celebration                    │
│                                      │
│ Accessibility:                       │
│ ☑ Respect reduced motion preference  │
│                                      │
│ [Preview Animation]                  │
└──────────────────────────────────────┘
```text

### Speed Multipliers

```typescript
const SPEED_MULTIPLIERS = {
  off: 0,
  fast: 0.5,
  normal: 1.0,
  slow: 2.0,
};
```text

## Related Components

- **Used by**: Settings screen, user preferences
- **Uses**: shadcn/ui `<RadioGroup>`, `<Checkbox>`, `<Button>`
- **Uses**: `useAnimationSettings` hook

## Implementation Notes

### Defaults

```typescript
const DEFAULT_ANIMATION_SETTINGS: AnimationPreferences = {
  speed: 'normal',
  tile_movement: true,
  charleston_pass: true,
  meld_formation: true,
  dice_roll: true,
  win_celebration: true,
  respect_reduced_motion: true,
};
```text

### Reduced Motion Detection

```typescript
useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (mediaQuery.matches && settings.respect_reduced_motion) {
    // Auto-suggest turning animations off
    setSettings((prev) => ({ ...prev, speed: 'off' }));
  }
}, [settings.respect_reduced_motion]);
```text

### Persistence

```typescript
// Save to localStorage
useEffect(() => {
  localStorage.setItem('animation_prefs', JSON.stringify(settings));
}, [settings]);

// Load on mount
useEffect(() => {
  const saved = localStorage.getItem('animation_prefs');
  if (saved) {
    setSettings(JSON.parse(saved));
  }
}, []);
```text

### Preview Animation

```typescript
const showPreview = () => {
  // Animate a sample tile
  const tile = document.querySelector('.preview-tile');
  const duration = 300 * SPEED_MULTIPLIERS[settings.speed];

  tile?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(100px)' }], {
    duration,
    easing: 'ease-out',
  });
};
```text

## Accessibility

**ARIA**:

- Radio group: `aria-label="Animation speed"`
- Checkboxes: `aria-label` for each toggle
- Preview button: `aria-label="Preview animation at current speed"`

**Keyboard**:

- Arrow keys navigate radio options
- Space toggles checkboxes
- Enter triggers preview

## Example Usage

```tsx
function SettingsScreen() {
  const { settings, updateSettings } = useAnimationSettings();

  return <AnimationSettings settings={settings} onChange={updateSettings} showAdvanced={true} />;
}
```text

## Edge Cases

1. **All animations off**: App still functions, no visual feedback lost
2. **Speed "off" but individual toggles on**: Speed takes precedence
3. **Reduced motion + slow speed**: Respect reduced motion
4. **Mid-animation setting change**: Complete current, apply to next

## Testing Considerations

- Speed setting persists
- Individual toggles work
- Reduced motion detection works
- Preview shows correct speed
- Settings sync with `useAnimationSettings` hook

---

**Estimated Complexity**: Simple (~90 lines)
**Dependencies**: shadcn/ui RadioGroup, Checkbox, `useAnimationSettings`
**Phase**: Phase 5 - Winning & Settings
````
