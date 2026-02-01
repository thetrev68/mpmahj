# useAnimationSettings Hook

## Purpose

Global hook for accessing and applying animation preferences across all components. Provides speed multipliers, feature toggles, and reduced motion detection.

## User Stories

- US-035: Animation mode and speed configuration
- Accessibility: Respect reduced motion preferences

## API

````typescript
interface UseAnimationSettingsReturn {
  /** Current animation preferences */
  settings: AnimationPreferences;

  /** Update preferences */
  updateSettings: (settings: Partial<AnimationPreferences>) => void;

  /** Get duration with speed multiplier applied */
  getDuration: (baseDuration: number) => number;

  /** Check if a specific animation is enabled */
  isEnabled: (animation: AnimationType) => boolean;

  /** Get speed multiplier (0, 0.5, 1.0, 2.0) */
  speedMultiplier: number;

  /** Whether reduced motion is active */
  reducedMotion: boolean;
}

interface AnimationPreferences {
  speed: 'off' | 'fast' | 'normal' | 'slow';
  tile_movement: boolean;
  charleston_pass: boolean;
  meld_formation: boolean;
  dice_roll: boolean;
  win_celebration: boolean;
  respect_reduced_motion: boolean;
}

type AnimationType =
  | 'tile_movement'
  | 'charleston_pass'
  | 'meld_formation'
  | 'dice_roll'
  | 'win_celebration';

function useAnimationSettings(): UseAnimationSettingsReturn;
```text

## Behavior

### Settings Persistence

- Load from `localStorage` on mount
- Save to `localStorage` on change
- Default to standard NMJL settings

### Speed Multiplier

- **Off**: 0 (instant, no animation)
- **Fast**: 0.5× (200ms base → 100ms)
- **Normal**: 1.0× (200ms base → 200ms)
- **Slow**: 2.0× (200ms base → 400ms)

### Reduced Motion Detection

- Check `prefers-reduced-motion` media query
- If enabled + `respect_reduced_motion` → force speed: 'off'
- User can override with `respect_reduced_motion: false`

## Implementation Notes

### Hook Implementation

```typescript
const SPEED_MULTIPLIERS = {
  off: 0,
  fast: 0.5,
  normal: 1.0,
  slow: 2.0,
};

function useAnimationSettings(): UseAnimationSettingsReturn {
  const [settings, setSettings] = useLocalStorage<AnimationPreferences>(
    'animation_prefs',
    DEFAULT_ANIMATION_SETTINGS
  );

  // Detect reduced motion preference
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reducedMotion = prefersReducedMotion && settings.respect_reduced_motion;

  // Calculate effective speed multiplier
  const speedMultiplier = reducedMotion ? 0 : SPEED_MULTIPLIERS[settings.speed];

  const getDuration = useCallback(
    (baseDuration: number) => {
      return baseDuration * speedMultiplier;
    },
    [speedMultiplier]
  );

  const isEnabled = useCallback(
    (animation: AnimationType) => {
      if (reducedMotion) return false;
      if (settings.speed === 'off') return false;
      return settings[animation];
    },
    [settings, reducedMotion]
  );

  const updateSettings = useCallback(
    (partial: Partial<AnimationPreferences>) => {
      setSettings((prev) => ({ ...prev, ...partial }));
    },
    [setSettings]
  );

  return {
    settings,
    updateSettings,
    getDuration,
    isEnabled,
    speedMultiplier,
    reducedMotion,
  };
}
```text

### Usage in Components

```typescript
function TileComponent({ tile, onDiscard }) {
  const { getDuration, isEnabled } = useAnimationSettings();

  const handleDiscard = () => {
    if (isEnabled('tile_movement')) {
      // Animate tile movement
      const duration = getDuration(300); // 300ms base

      tileRef.current?.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(100px)' },
      ], { duration });

      setTimeout(onDiscard, duration);
    } else {
      // Instant
      onDiscard();
    }
  };

  return <div ref={tileRef} onClick={handleDiscard}>...</div>;
}
```text

### CSS Custom Properties

Optionally expose as CSS variables:

```typescript
useEffect(() => {
  document.documentElement.style.setProperty('--animation-speed', speedMultiplier.toString());
}, [speedMultiplier]);
```text

Then in CSS:

```css
.tile-animation {
  transition-duration: calc(300ms * var(--animation-speed));
}
```text

## Example Usage

### Component Example

```typescript
function CharlestonPassAnimation() {
  const { getDuration, isEnabled } = useAnimationSettings();

  if (!isEnabled('charleston_pass')) {
    // Skip animation, instant state update
    return null;
  }

  return (
    <PassAnimationLayer
      durationMs={getDuration(1000)} // 1s base, adjusted by speed
      onComplete={handlePassComplete}
    />
  );
}
```text

### Settings Panel Example

```typescript
function SettingsScreen() {
  const { settings, updateSettings } = useAnimationSettings();

  return (
    <AnimationSettings
      settings={settings}
      onChange={updateSettings}
    />
  );
}
```text

## Edge Cases

1. **Invalid speed value**: Fall back to 'normal'
2. **localStorage unavailable**: Use in-memory state
3. **Reduced motion toggle**: Immediate effect on all animations
4. **Speed change mid-animation**: Applies to next animation

## Testing Considerations

- Settings persist to localStorage
- Speed multiplier calculated correctly
- `getDuration()` applies multiplier
- `isEnabled()` respects toggles and reduced motion
- Reduced motion detection works
- Settings update triggers re-render

---

**Estimated Complexity**: Simple (~60 lines)
**Dependencies**: `useLocalStorage`, `useMediaQuery`
**Phase**: Phase 5 - Winning & Settings
````
