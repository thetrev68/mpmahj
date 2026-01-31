# US-035: Animation Settings

## Story

**As a** player
**I want** to configure animation speed and behavior
**So that** the game matches my visual preferences and performance needs

## Acceptance Criteria

### AC-1: Animation Settings Panel in Settings

**Given** I am in the game settings menu
**When** I navigate to the "Display" or "Preferences" section
**Then** an "Animation Settings" section is visible
**And** all animation configuration options are displayed
**And** current settings are shown

### AC-2: Animation Mode Selector

**Given** the animation settings panel is displayed
**When** I view the "Animation Mode" dropdown
**Then** three options are available:

- "Full Animations" (default)
- "Instant" (skip all animations)
- "Reduced Motion" (minimal animations)

**And** a description explains each mode
**And** changing the mode applies immediately to the current view

### AC-3: Full Animations Mode

**Given** I select "Full Animations" mode
**When** animations play during gameplay
**Then** all animations are displayed at their default speeds:

- Dice roll: 500ms animation
- Wall break pivot: 300ms animation
- Tile draw/discard: 200ms animation
- Charleston tile pass: 400ms animation
- Mahjong confetti: 3 seconds

**And** sound effects play with animations
**And** transitions are smooth and polished

### AC-4: Instant Mode

**Given** I select "Instant" mode
**When** game events occur
**Then** all animations are skipped completely:

- Dice roll: instant result display
- Wall break: immediate gap appearance
- Tile movements: instant position updates
- Phase transitions: immediate state changes
- Mahjong celebration: no confetti animation

**And** sound effects still play (unless audio is disabled)
**And** the game progresses significantly faster

### AC-5: Reduced Motion Mode

**Given** I select "Reduced Motion" mode
**When** animations play
**Then** only essential animations are shown:

- Dice roll: instant (skip)
- Wall break: instant (skip)
- Tile draw/discard: simple fade (100ms)
- Charleston: instant tile updates
- Mahjong: simple badge display (no confetti)

**And** all slide/pivot/spin animations are replaced with fades
**And** the mode respects accessibility needs

### AC-6: Speed Multiplier Selector

**Given** the animation settings panel is displayed
**When** I view the "Animation Speed" dropdown
**Then** speed options are available:

- "Slow (0.5x)" - animations take twice as long
- "Normal (1x)" - default speed
- "Fast (2x)" - animations are twice as fast
- "Very Fast (3x)" - animations are three times as fast

**And** speed multiplier applies to all animation durations
**And** speed change applies immediately

### AC-7: Individual Animation Toggles

**Given** the animation settings panel is displayed
**When** I view the "Animation Details" section
**Then** individual toggle switches are available:

- "Confetti/Fireworks" (Mahjong celebration) - default: ON
- "Tile Animations" (draw, discard, pass) - default: ON
- "Transitions" (phase changes, panel slides) - default: ON
- "Effects" (glow, pulse, shake) - default: ON

**And** each toggle can be independently enabled/disabled
**And** toggles work in combination with mode and speed settings

### AC-8: System Preference Respect

**Given** my operating system has `prefers-reduced-motion` enabled
**When** I first open the game or settings
**Then** the game automatically sets "Reduced Motion" mode
**And** a toggle shows: "Respect system preference" (default: ON)
**And** if I disable the toggle, I can override with custom settings
**And** if enabled, system preference takes precedence

### AC-9: Settings Persistence

**Given** I configure animation settings (e.g., Fast speed, no confetti)
**When** I close the game and reopen it
**Then** my animation settings are restored from local storage
**And** settings apply immediately on game load
**And** settings persist across sessions and devices (if logged in)

### AC-10: Live Preview

**Given** the animation settings panel is displayed
**When** I change any animation setting
**Then** a preview animation plays immediately showing the effect:

- Mode change: shows sample tile animation at new mode
- Speed change: plays animation at new speed
- Toggle change: demonstrates the toggled animation

**And** the preview helps me understand the setting before applying

### AC-11: Performance Indicator

**Given** I am on a low-performance device
**When** the game detects slow performance (< 30 FPS)
**Then** a suggestion appears: "Reduce animations for better performance?"
**And** clicking "Yes" auto-applies "Instant" mode or "Fast (2x)" speed
**And** clicking "No" or "Dismiss" keeps current settings

## Technical Details

### AnimationSettings Type Definition

```typescript
interface AnimationSettings {
  // Primary mode
  mode: 'Full' | 'Instant' | 'Reduced';

  // Speed multiplier (applied to all animation durations)
  speed_multiplier: 0.5 | 1 | 2 | 3;

  // Individual toggles
  enable_confetti: boolean;
  enable_tile_animations: boolean;
  enable_transitions: boolean;
  enable_effects: boolean;

  // System integration
  respect_system_preference: boolean;

  // Auto-applied based on performance
  performance_mode: boolean;
}
```

### Default Settings

```typescript
const DEFAULT_ANIMATION_SETTINGS: AnimationSettings = {
  mode: 'Full',
  speed_multiplier: 1,
  enable_confetti: true,
  enable_tile_animations: true,
  enable_transitions: true,
  enable_effects: true,
  respect_system_preference: true,
  performance_mode: false,
};
```

### Animation Duration Calculation

```typescript
// Helper function to calculate animation duration based on settings
const getAnimationDuration = (baseDuration: number, settings: AnimationSettings): number => {
  // Instant mode: 0ms
  if (settings.mode === 'Instant') return 0;

  // Reduced motion: use minimal duration (ignore base duration)
  if (settings.mode === 'Reduced') return 100; // Fixed short fade

  // Full mode: apply speed multiplier
  return baseDuration / settings.speed_multiplier;
};

// Example usage
const diceRollDuration = getAnimationDuration(500, settings); // 500ms, 250ms, 167ms, or 0ms
const wallBreakDuration = getAnimationDuration(300, settings); // 300ms, 150ms, 100ms, or 0ms
```

### System Preference Detection

```typescript
// Detect system prefers-reduced-motion
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Apply on first load
if (prefersReducedMotion && settings.respect_system_preference) {
  settings.mode = 'Reduced';
}

// Listen for changes
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
  if (settings.respect_system_preference) {
    settings.mode = e.matches ? 'Reduced' : 'Full';
  }
});
```

### Local Storage Persistence

```typescript
// Save settings to local storage
const saveAnimationSettings = (settings: AnimationSettings) => {
  localStorage.setItem('animation_settings', JSON.stringify(settings));
};

// Load settings from local storage
const loadAnimationSettings = (): AnimationSettings => {
  const stored = localStorage.getItem('animation_settings');
  if (stored) {
    return { ...DEFAULT_ANIMATION_SETTINGS, ...JSON.parse(stored) };
  }
  return DEFAULT_ANIMATION_SETTINGS;
};
```

### Backend References

No backend commands for animation settings (client-side only).

**Related Code:**

- **Frontend**: `apps/client/src/animations/orchestrator.ts` - Animation timing logic
- **Frontend**: `apps/client/src/store/settingsStore.ts` - Settings state management
- **Frontend**: `apps/client/src/hooks/useAnimationSettings.ts` - Animation settings hook

## Components Involved

### Container Components

- **`<SettingsMenu>`** - Main settings menu
- **`<AnimationSettingsPanel>`** - Full animation configuration panel

### Presentational Components

- **`<AnimationModeSelector>`** - Mode dropdown (Full/Instant/Reduced)
- **`<AnimationSpeedSelector>`** - Speed multiplier dropdown
- **`<AnimationToggles>`** - Individual toggle switches
- **`<AnimationPreview>`** - Live preview of animation changes
- **`<PerformanceIndicator>`** - Performance suggestion notification

### Hooks

- **`useAnimationSettings()`** - Manages animation settings state
- **`useSystemPreference()`** - Detects and respects system preferences
- **`usePerformanceMonitor()`** - Monitors FPS and suggests optimizations

## Component Specs

**Component Specification Files:**

- `component-specs/container/AnimationSettingsPanel.md`
- `component-specs/presentational/AnimationModeSelector.md`
- `component-specs/presentational/AnimationPreview.md`
- `component-specs/hooks/useAnimationSettings.md`

## Test Scenarios

**Test Scenario Files:**

- `tests/test-scenarios/animation-full-mode.md` - Full animations mode
- `tests/test-scenarios/animation-instant-mode.md` - Instant mode (no animations)
- `tests/test-scenarios/animation-reduced-motion.md` - Reduced motion mode
- `tests/test-scenarios/animation-speed-multiplier.md` - Speed multiplier effects
- `tests/test-scenarios/animation-system-preference.md` - System preference respect

## Mock Data

### Fixtures

**Animation Settings Fixtures:**

```json
// tests/fixtures/settings/animation-full.json
{
  "mode": "Full",
  "speed_multiplier": 1,
  "enable_confetti": true,
  "enable_tile_animations": true,
  "enable_transitions": true,
  "enable_effects": true,
  "respect_system_preference": true,
  "performance_mode": false
}

// tests/fixtures/settings/animation-instant.json
{
  "mode": "Instant",
  "speed_multiplier": 1,
  "enable_confetti": false,
  "enable_tile_animations": false,
  "enable_transitions": false,
  "enable_effects": false,
  "respect_system_preference": false,
  "performance_mode": false
}

// tests/fixtures/settings/animation-reduced.json
{
  "mode": "Reduced",
  "speed_multiplier": 1,
  "enable_confetti": false,
  "enable_tile_animations": true,
  "enable_transitions": true,
  "enable_effects": false,
  "respect_system_preference": true,
  "performance_mode": false
}

// tests/fixtures/settings/animation-fast.json
{
  "mode": "Full",
  "speed_multiplier": 3,
  "enable_confetti": true,
  "enable_tile_animations": true,
  "enable_transitions": true,
  "enable_effects": true,
  "respect_system_preference": false,
  "performance_mode": true
}
```

## Edge Cases

### EC-1: Instant Mode Still Plays Sounds

**Given** I enable "Instant" mode
**When** game events occur (dice roll, tile discard, Mahjong)
**Then** animations are skipped (0ms duration)
**And** sound effects still play (unless audio is disabled)
**And** the game feels responsive without visual delays

### EC-2: Speed Multiplier Affects All Animations

**Given** I set speed multiplier to 3x (Very Fast)
**When** any animation plays
**Then** all durations are divided by 3:

- Dice roll: 500ms / 3 = 167ms
- Wall break: 300ms / 3 = 100ms
- Tile discard: 200ms / 3 = 67ms

**And** the entire game progresses 3x faster visually

### EC-3: Individual Toggle Overrides Mode

**Given** I select "Full Animations" mode
**And** I disable "Confetti/Fireworks" toggle
**When** I declare Mahjong
**Then** all animations play (tiles, transitions)
**But** confetti/fireworks are skipped
**And** the toggle setting takes precedence for that specific animation

### EC-4: System Preference Changes Mid-Session

**Given** I have "Respect system preference" enabled
**And** I am playing with "Full Animations" mode
**When** I enable `prefers-reduced-motion` in my OS settings
**Then** the game detects the change (via media query listener)
**And** automatically switches to "Reduced Motion" mode
**And** a notification shows: "Animation mode changed to Reduced (system preference)"

### EC-5: Performance Mode Auto-Applies Settings

**Given** the game detects poor performance (< 30 FPS)
**When** the performance indicator suggestion appears
**And** I click "Yes, reduce animations"
**Then** `performance_mode` is set to true
**And** either "Instant" mode or "Fast (3x)" speed is applied
**And** individual toggles may be disabled (confetti, effects)

### EC-6: Settings Conflict Resolution

**Given** I have "Instant" mode selected
**When** I enable "Tile Animations" toggle
**Then** the toggle is ignored (mode takes precedence)
**And** a note shows: "Individual toggles are disabled in Instant mode"
**Alternative**: Allow toggles to override mode partially

## Related User Stories

- **US-001: Roll Dice & Break Wall** - Referenced instant animation mode
- **US-036: Timer Configuration** - Related settings for game pacing
- **US-029: Create Room** - Room creator can suggest animation settings

## Accessibility Considerations

### Keyboard Navigation

**Focus Management:**

- Tab key navigates through all settings inputs
- Arrow keys navigate dropdown options
- Space key toggles checkboxes
- Enter key applies settings

**Shortcuts:**

- No specific shortcuts for safety

### Screen Reader

**Announcements:**

- Mode selector: "Animation mode. Full animations selected."
- Speed selector: "Animation speed. Normal 1x selected."
- Confetti toggle: "Confetti and fireworks. Enabled."
- System preference toggle: "Respect system preference. Enabled."
- Preview: "Playing preview animation at Fast 2x speed."

**ARIA Labels:**

- `aria-label="Select animation mode"` on mode dropdown
- `aria-label="Animation speed multiplier"` on speed dropdown
- `aria-describedby="confetti-description"` on toggles
- `aria-live="polite"` on preview area

### Visual

**High Contrast:**

- Clear labels for all settings
- Toggle switches have distinct on/off states
- Preview area has visible border
- Performance indicator uses warning colors

**Motion:**

- Settings panel respects its own reduced motion setting
- Preview animations can be disabled

## Priority

**MEDIUM** - Improves user experience and accessibility; not blocking core functionality

## Story Points / Complexity

**2** - Low-Medium Complexity

**Justification:**

- Settings panel: straightforward UI
- Mode/speed logic: simple duration calculation
- System preference: standard media query API
- Local storage: standard persistence

**Complexity Factors:**

- Multiple animation types to configure
- Speed multiplier math for all animations
- System preference detection and listening
- Performance monitoring (optional)

## Definition of Done

### Core Functionality

- [ ] Animation settings panel in settings menu
- [ ] Animation mode dropdown (Full/Instant/Reduced)
- [ ] Animation speed dropdown (0.5x/1x/2x/3x)
- [ ] Individual toggles (confetti, tiles, transitions, effects)
- [ ] "Respect system preference" toggle
- [ ] All settings apply immediately

### Mode Behavior

- [ ] Full mode: all animations at default speeds
- [ ] Instant mode: all animations skipped (0ms)
- [ ] Reduced mode: minimal animations (fades only)
- [ ] Sound effects play in all modes (unless audio disabled)

### Speed Multiplier

- [ ] 0.5x: animations take 2x longer
- [ ] 1x: normal speed
- [ ] 2x: animations 2x faster
- [ ] 3x: animations 3x faster
- [ ] Speed applies to all animation durations

### Individual Toggles

- [ ] Confetti toggle controls celebration animations
- [ ] Tile animations toggle controls draw/discard/pass animations
- [ ] Transitions toggle controls phase/panel transitions
- [ ] Effects toggle controls glow/pulse/shake effects
- [ ] Toggles work independently

### System Integration

- [ ] Detect `prefers-reduced-motion` on load
- [ ] Apply Reduced mode if system preference is set
- [ ] Listen for system preference changes
- [ ] "Respect system preference" toggle works
- [ ] Override system preference when toggle is disabled

### Persistence

- [ ] Settings saved to local storage on change
- [ ] Settings loaded from local storage on app start
- [ ] Settings persist across sessions
- [ ] Default settings used if no saved settings found

### Preview and Feedback

- [ ] Live preview plays when settings change
- [ ] Preview demonstrates the selected mode/speed
- [ ] Performance indicator suggests optimizations
- [ ] Settings changes are instant (no reload required)

### Testing

- [ ] Unit tests pass for AnimationSettingsPanel
- [ ] Integration test passes (change settings → animations update)
- [ ] E2E test passes (configure → save → reload → verify persistence)
- [ ] System preference tests pass (media query detection)
- [ ] Speed multiplier tests pass (duration calculations)

### Accessibility

- [ ] Keyboard navigation works (Tab, Arrow keys, Space)
- [ ] Screen reader announces all settings
- [ ] ARIA labels on all interactive elements
- [ ] Focus management correct
- [ ] High contrast mode supported

### Documentation & Quality

- [ ] Component specs created (AnimationSettingsPanel)
- [ ] Test scenarios documented (animation-\*.md files)
- [ ] Mock data fixtures created (settings JSON)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

### User Testing

- [ ] Manually tested all 3 modes (Full, Instant, Reduced)
- [ ] Tested all speed multipliers (0.5x to 3x)
- [ ] Verified system preference detection works
- [ ] Confirmed settings persist across sessions

## Notes for Implementers

### Animation Settings Hook

```typescript
// useAnimationSettings hook
export const useAnimationSettings = () => {
  const [settings, setSettings] = useState<AnimationSettings>(() => loadAnimationSettings());

  // Save to local storage on change
  useEffect(() => {
    saveAnimationSettings(settings);
  }, [settings]);

  // Listen for system preference changes
  useEffect(() => {
    if (!settings.respect_system_preference) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSettings((prev) => ({
        ...prev,
        mode: e.matches ? 'Reduced' : 'Full',
      }));
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.respect_system_preference]);

  const updateSetting = <K extends keyof AnimationSettings>(
    key: K,
    value: AnimationSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return { settings, updateSetting };
};
```

### Animation Duration Helper

```typescript
// Get effective animation duration based on settings
export const getEffectiveDuration = (
  animationType: 'dice' | 'wall' | 'tile' | 'transition' | 'confetti',
  settings: AnimationSettings
): number => {
  // Base durations (milliseconds)
  const baseDurations = {
    dice: 500,
    wall: 300,
    tile: 200,
    transition: 250,
    confetti: 3000,
  };

  const baseDuration = baseDurations[animationType];

  // Instant mode: skip all animations
  if (settings.mode === 'Instant') return 0;

  // Reduced mode: minimal animations
  if (settings.mode === 'Reduced') {
    if (animationType === 'confetti') return 0; // Skip confetti
    return 100; // Short fade for everything else
  }

  // Check individual toggles
  if (animationType === 'confetti' && !settings.enable_confetti) return 0;
  if (animationType === 'tile' && !settings.enable_tile_animations) return 0;
  if (animationType === 'transition' && !settings.enable_transitions) return 0;

  // Full mode: apply speed multiplier
  return baseDuration / settings.speed_multiplier;
};
```

### Animation Settings Panel Component

```typescript
const AnimationSettingsPanel: React.FC = () => {
  const { settings, updateSetting } = useAnimationSettings();

  return (
    <Box className="animation-settings-panel">
      <Typography variant="h6">Animation Settings</Typography>

      {/* Mode selector */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Animation Mode</InputLabel>
        <Select
          value={settings.mode}
          onChange={(e) => updateSetting('mode', e.target.value as AnimationMode)}
        >
          <MenuItem value="Full">Full Animations</MenuItem>
          <MenuItem value="Instant">Instant (No Animations)</MenuItem>
          <MenuItem value="Reduced">Reduced Motion</MenuItem>
        </Select>
      </FormControl>

      {/* Speed selector */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Animation Speed</InputLabel>
        <Select
          value={settings.speed_multiplier}
          onChange={(e) => updateSetting('speed_multiplier', Number(e.target.value))}
          disabled={settings.mode === 'Instant'}
        >
          <MenuItem value={0.5}>Slow (0.5x)</MenuItem>
          <MenuItem value={1}>Normal (1x)</MenuItem>
          <MenuItem value={2}>Fast (2x)</MenuItem>
          <MenuItem value={3}>Very Fast (3x)</MenuItem>
        </Select>
      </FormControl>

      {/* Individual toggles */}
      <Typography variant="subtitle2" sx={{ mt: 2 }}>
        Animation Details
      </Typography>
      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={settings.enable_confetti}
              onChange={(e) => updateSetting('enable_confetti', e.target.checked)}
            />
          }
          label="Confetti/Fireworks (Mahjong celebration)"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.enable_tile_animations}
              onChange={(e) => updateSetting('enable_tile_animations', e.target.checked)}
            />
          }
          label="Tile Animations (draw, discard, pass)"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.enable_transitions}
              onChange={(e) => updateSetting('enable_transitions', e.target.checked)}
            />
          }
          label="Transitions (phase changes, panels)"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.enable_effects}
              onChange={(e) => updateSetting('enable_effects', e.target.checked)}
            />
          }
          label="Effects (glow, pulse, shake)"
        />
      </FormGroup>

      {/* System preference */}
      <FormControlLabel
        control={
          <Switch
            checked={settings.respect_system_preference}
            onChange={(e) => updateSetting('respect_system_preference', e.target.checked)}
          />
        }
        label="Respect system motion preference"
      />

      {/* Preview */}
      <AnimationPreview settings={settings} />
    </Box>
  );
};
```

### Performance Monitor (Optional)

```typescript
// usePerformanceMonitor hook
export const usePerformanceMonitor = () => {
  const [fps, setFps] = useState(60);
  const [showSuggestion, setShowSuggestion] = useState(false);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();

    const measureFps = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        const currentFps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        setFps(currentFps);
        frameCount = 0;
        lastTime = currentTime;

        // Suggest optimization if FPS is consistently low
        if (currentFps < 30) {
          setShowSuggestion(true);
        }
      }

      requestAnimationFrame(measureFps);
    };

    const rafId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return { fps, showSuggestion, dismissSuggestion: () => setShowSuggestion(false) };
};
```

This comprehensive animation configuration system balances customization with accessibility.

```text

```
