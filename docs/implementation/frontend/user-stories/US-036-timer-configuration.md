# US-036: Timer Configuration

## Story

**As a** player creating a game room
**I want** to configure timer durations for different game phases
**So that** the game pace matches my preference and skill level

## Acceptance Criteria

### AC-1: Timer Settings Panel in Room Creation

**Given** I am creating a new game room (US-029)
**When** the room creation form is displayed
**Then** a "Timer Settings" section is visible
**And** the section contains all configurable timer options
**And** default values are pre-filled (Standard NMJL timing)

### AC-2: Charleston Pass Timer Configuration

**Given** the timer settings section is displayed
**When** I view the "Charleston Pass Timer" input
**Then** a number input is displayed with range: 30-300 seconds
**And** default value is 60 seconds (1 minute)
**And** a label shows: "Charleston Pass Timer (per stage)"
**And** helper text explains: "Time allowed to select 3 tiles for each Charleston pass"
**And** validation prevents values outside the range

### AC-3: Charleston Vote Timer Configuration

**Given** the timer settings section is displayed
**When** I view the "Charleston Vote Timer" input
**Then** a number input is displayed with range: 15-120 seconds
**And** default value is 30 seconds
**And** a label shows: "Charleston Vote Timer"
**And** helper text explains: "Time allowed to vote on Second Charleston or stop"
**And** validation prevents values outside the range

### AC-4: Call Window Timer Configuration

**Given** the timer settings section is displayed
**When** I view the "Call Window Timer" input
**Then** a number input is displayed with range: 5-30 seconds
**And** default value is 10 seconds
**And** a label shows: "Call Window (after discard)"
**And** helper text explains: "Time allowed to call Pung/Kong after a discard"
**And** validation prevents values outside the range

### AC-5: Turn Timer Configuration

**Given** the timer settings section is displayed
**When** I view the "Turn Timer" input
**Then** a number input is displayed with range: 30-300 seconds
**And** default value is 90 seconds (1.5 minutes)
**And** a label shows: "Turn Timer"
**And** helper text explains: "Time allowed to draw and discard during your turn"
**And** validation prevents values outside the range

### AC-6: Total Game Timer Configuration

**Given** the timer settings section is displayed
**When** I view the "Total Game Timer" input
**Then** a number input is displayed with range: 30-180 minutes (optional)
**And** default value is disabled/null (no time limit)
**And** a checkbox enables/disables the total game timer
**And** a label shows: "Total Game Timer (optional)"
**And** helper text explains: "Maximum time for entire game. Game ends when timer expires."

### AC-7: Timer Preset Selector

**Given** the timer settings section is displayed
**When** I view the "Timer Presets" dropdown at the top
**Then** preset options are displayed:

- "Standard" - 60/30/10/90 (Charleston/Vote/Call/Turn in seconds) - default
- "Relaxed" - 120/60/15/180 (double time for learning)
- "Blitz" - 30/15/5/45 (half time for fast-paced games)
- "No Timers" - ∞ (disabled, casual play)
- "Custom"

**And** selecting a preset auto-fills all timer values
**And** any manual change switches preset to "Custom"

### AC-8: Standard Preset

**Given** I select "Standard" preset
**When** the preset is applied
**Then** the following timers are set:

- Charleston Pass: 60 seconds
- Charleston Vote: 30 seconds
- Call Window: 10 seconds
- Turn Timer: 90 seconds
- Total Game Timer: Disabled

**And** these are the default NMJL tournament-style timings

### AC-9: Relaxed Preset

**Given** I select "Relaxed" preset
**When** the preset is applied
**Then** the following timers are set:

- Charleston Pass: 120 seconds (2 minutes)
- Charleston Vote: 60 seconds (1 minute)
- Call Window: 15 seconds
- Turn Timer: 180 seconds (3 minutes)
- Total Game Timer: 120 minutes (2 hours)

**And** this preset is ideal for learning and casual play

### AC-10: Blitz Preset

**Given** I select "Blitz" preset
**When** the preset is applied
**Then** the following timers are set:

- Charleston Pass: 30 seconds
- Charleston Vote: 15 seconds
- Call Window: 5 seconds
- Turn Timer: 45 seconds
- Total Game Timer: 45 minutes

**And** this preset creates fast-paced, competitive games

### AC-11: No Timers Preset

**Given** I select "No Timers" preset
**When** the preset is applied
**Then** all individual timers are disabled (∞ / no limit)
**And** players can take as long as needed for each action
**And** only manual player actions advance the game
**And** this preset is ideal for teaching and relaxed casual games

### AC-12: Estimated Game Duration Preview

**Given** I configured timer settings
**When** I view the timer settings panel
**Then** a preview section shows estimated game duration
**And** calculation considers: Charleston phases, average turns, typical game length
**And** example: "Estimated game time: 25-35 minutes" for Standard preset
**And** the estimate updates when I change any timer value

### AC-13: Timers Displayed in Room List

**Given** I configured timers and created the room
**When** the room appears in the lobby room list (US-030)
**Then** timer configuration is summarized with badges:

- "Standard Timing" badge (if Standard preset)
- "Relaxed" badge (if Relaxed preset)
- "Blitz" badge (if Blitz preset)
- "No Timers" badge (if No Timers preset)
- "Custom" badge with key timers (if Custom)

**And** hovering shows full timer details

### AC-14: Timers Enforced During Gameplay

**Given** the game has started with configured timers
**When** gameplay progresses
**Then** timers are enforced:

- Charleston: player has N seconds to select tiles
- Vote: player has N seconds to vote
- Call Window: N seconds to call after discard
- Turn: player has N seconds to draw and discard
- Total Game: game ends when total time expires

**And** timer expiration triggers auto-actions (random selection, pass, timeout penalty)

## Technical Details

### Commands (Frontend → Backend)

Timer configuration is sent as part of the `CreateRoom` command (US-029):

```typescript
{
  CreateRoom: {
    player_id: string;
    config: {
      room_name: string;
      card_year: number;
      fill_with_bots: boolean;
      bot_difficulty: BotDifficulty;
      house_rules: HouseRules;
      timer_config: TimerConfig; // Full timer configuration
    }
  }
}
```

### TimerConfig Type Definition

```typescript
interface TimerConfig {
  // Individual phase timers (all in seconds)
  charleston_pass: number; // 30-300s, default: 60
  charleston_vote: number; // 15-120s, default: 30
  call_window: number; // 5-30s, default: 10
  turn_timer: number; // 30-300s, default: 90

  // Total game timer (optional, in minutes)
  total_game_timer: number | null; // 30-180 min or null (disabled)

  // Preset mode (for quick identification)
  mode: 'Standard' | 'Relaxed' | 'Blitz' | 'NoTimers' | 'Custom';
}
```

### Timer Preset Definitions

```typescript
const TIMER_PRESETS: Record<string, TimerConfig> = {
  Standard: {
    charleston_pass: 60,
    charleston_vote: 30,
    call_window: 10,
    turn_timer: 90,
    total_game_timer: null,
    mode: 'Standard',
  },
  Relaxed: {
    charleston_pass: 120,
    charleston_vote: 60,
    call_window: 15,
    turn_timer: 180,
    total_game_timer: 120, // 2 hours
    mode: 'Relaxed',
  },
  Blitz: {
    charleston_pass: 30,
    charleston_vote: 15,
    call_window: 5,
    turn_timer: 45,
    total_game_timer: 45, // 45 minutes
    mode: 'Blitz',
  },
  NoTimers: {
    charleston_pass: Infinity,
    charleston_vote: Infinity,
    call_window: Infinity,
    turn_timer: Infinity,
    total_game_timer: null,
    mode: 'NoTimers',
  },
};
```

### Estimated Game Duration Calculation

```typescript
// Estimate total game duration based on timer config
const estimateGameDuration = (config: TimerConfig): { min: number; max: number } => {
  if (config.mode === 'NoTimers') {
    return { min: 0, max: Infinity }; // Unknown
  }

  // Charleston: 6 stages (First Right/Across/Left, Second Left/Across/Right)
  const charlestonTime = config.charleston_pass * 6 + config.charleston_vote * 2;

  // Playing: estimate 30-50 turns per game (average)
  const minTurns = 30;
  const maxTurns = 50;
  const playingTimeMin = minTurns * (config.turn_timer + config.call_window * 0.5);
  const playingTimeMax = maxTurns * (config.turn_timer + config.call_window * 0.5);

  // Total in minutes
  const minMinutes = Math.ceil((charlestonTime + playingTimeMin) / 60);
  const maxMinutes = Math.ceil((charlestonTime + playingTimeMax) / 60);

  return { min: minMinutes, max: maxMinutes };
};
```

### Events (Backend → Frontend)

Timer configuration is included in room state events:

```typescript
{
  kind: 'Public',
  event: {
    RoomCreated: {
      room_id: string;
      config: {
        timer_config: TimerConfig;
        // ... other config
      }
    }
  }
}
```

**Timer Events During Gameplay:**

```typescript
// Timer started for current phase
{
  kind: 'Public',
  event: {
    TimerStarted: {
      phase: "CharlestonPass" | "CharlestonVote" | "CallWindow" | "Turn" | "TotalGame";
      duration: number;  // seconds
      expires_at: number;  // timestamp
    }
  }
}

// Timer expired, auto-action triggered
{
  kind: 'Public',
  event: {
    TimerExpired: {
      phase: "CharlestonPass" | "CharlestonVote" | "CallWindow" | "Turn";
      player: Seat;
      auto_action: "RandomSelection" | "Pass" | "AutoDiscard";
    }
  }
}

// Total game timer expired
{
  kind: 'Public',
  event: {
    GameEndedByTimer: {
      reason: "TotalGameTimeExpired";
      final_scores: Record<Seat, number>;
    }
  }
}
```

### Backend References

- **Rust Code**: `crates/mahjong_core/src/timer.rs` - Timer management
- **Rust Code**: `crates/mahjong_server/src/network/timer.rs:handle_timer_expiration()` - Timer expiration logic
- **Rust Code**: `crates/mahjong_core/src/table/auto_actions.rs` - Auto-actions on timeout
- **Rust Code**: `crates/mahjong_server/src/network/room.rs:create_room_with_timers()` - Room creation with timers
- **Game Design Doc**: Section 8.3 (Timer Configuration), Section 8.4 (Timer Enforcement)

## Components Involved

### Container Components

- **`<CreateRoomForm>`** - Full room creation form (from US-029)
- **`<TimerConfigPanel>`** - Timer configuration section

### Presentational Components

- **`<TimerPresetSelector>`** - Preset dropdown
- **`<TimerInput>`** - Number input with validation for each timer
- **`<GameDurationPreview>`** - Estimated game time display
- **`<TimerSummary>`** - Summary display for room list
- **`<TimerDisplay>`** - In-game countdown timer (during gameplay)

### Hooks

- **`useTimerConfig()`** - Manages timer configuration state
- **`useTimerPresets()`** - Handles preset selection and application
- **`useGameTimer()`** - Manages in-game timer countdown (during gameplay)

## Component Specs

**Component Specification Files:**

- `component-specs/container/TimerConfigPanel.md`
- `component-specs/presentational/TimerPresetSelector.md`
- `component-specs/presentational/GameDurationPreview.md`
- `component-specs/presentational/TimerDisplay.md`
- `component-specs/hooks/useTimerConfig.md`

## Test Scenarios

**Test Scenario Files:**

- `tests/test-scenarios/timer-config-standard.md` - Standard preset
- `tests/test-scenarios/timer-config-relaxed.md` - Relaxed preset
- `tests/test-scenarios/timer-config-blitz.md` - Blitz preset
- `tests/test-scenarios/timer-config-custom.md` - Custom timer configuration
- `tests/test-scenarios/timer-enforcement.md` - Timers enforced during gameplay
- `tests/test-scenarios/timer-expiration.md` - Timer expiration and auto-actions

## Mock Data

### Fixtures

**Timer Configuration Fixtures:**

```json
// tests/fixtures/timers/standard.json
{
  "charleston_pass": 60,
  "charleston_vote": 30,
  "call_window": 10,
  "turn_timer": 90,
  "total_game_timer": null,
  "mode": "Standard"
}

// tests/fixtures/timers/relaxed.json
{
  "charleston_pass": 120,
  "charleston_vote": 60,
  "call_window": 15,
  "turn_timer": 180,
  "total_game_timer": 120,
  "mode": "Relaxed"
}

// tests/fixtures/timers/blitz.json
{
  "charleston_pass": 30,
  "charleston_vote": 15,
  "call_window": 5,
  "turn_timer": 45,
  "total_game_timer": 45,
  "mode": "Blitz"
}

// tests/fixtures/timers/no-timers.json
{
  "charleston_pass": null,
  "charleston_vote": null,
  "call_window": null,
  "turn_timer": null,
  "total_game_timer": null,
  "mode": "NoTimers"
}

// tests/fixtures/timers/custom.json
{
  "charleston_pass": 90,
  "charleston_vote": 45,
  "call_window": 12,
  "turn_timer": 120,
  "total_game_timer": 60,
  "mode": "Custom"
}
```

## Edge Cases

### EC-1: Invalid Timer Range

**Given** I enter a charleston pass timer of 350 seconds (above maximum 300)
**When** I try to create the room
**Then** validation error shows: "Charleston pass timer must be between 30 and 300 seconds"
**And** the create room button is disabled until corrected

### EC-2: Custom Timer Changes Preset to Custom

**Given** I select "Standard" preset
**When** I manually change turn timer from 90 to 120 seconds
**Then** the preset dropdown automatically switches to "Custom"
**And** all other Standard preset timers remain unchanged
**And** the timer I changed persists

### EC-3: No Timers Mode Disables All Inputs

**Given** I select "No Timers" preset
**When** the preset is applied
**Then** all timer inputs are disabled (grayed out)
**And** all timer values show "∞" or "No limit"
**And** I cannot manually edit timer values unless I switch to a different preset

### EC-4: Total Game Timer Optional

**Given** I am configuring timers
**When** I view the total game timer input
**Then** a checkbox controls whether it's enabled
**And** if unchecked, the number input is disabled
**And** if checked, I can enter a value (30-180 minutes)
**And** default is unchecked (no total game limit)

### EC-5: Blitz Mode Warning

**Given** I select "Blitz" preset
**When** the preset is applied
**Then** a warning message displays: "Blitz mode has very short timers. Ensure all players are experienced."
**And** the warning has an icon and stands out visually
**And** I can proceed or change to a different preset

### EC-6: Estimated Duration Updates in Real-Time

**Given** I am configuring timers
**When** I change any timer value (e.g., turn timer from 90 to 120)
**Then** the estimated game duration preview updates immediately
**And** example: "Estimated: 25-35 min" → "Estimated: 30-45 min"

## Related User Stories

- **US-029: Create Room** - Timers are configured during room creation
- **US-030: Join Room** - Timers displayed in room details
- **US-034: Configure House Rules** - Related configuration for game customization
- **US-035: Animation Settings** - Related settings for game pacing (animations vs timers)

## Accessibility Considerations

### Keyboard Navigation

**Focus Management:**

- Tab key navigates through all timer inputs
- Arrow keys increment/decrement number values
- Number inputs accept direct typing
- Space key toggles total game timer checkbox

**Shortcuts:**

- No specific shortcuts (standard form navigation)

### Screen Reader

**Announcements:**

- Preset selector: "Timer presets. Standard selected."
- Charleston pass: "Charleston pass timer. Number input. Current value: 60 seconds. Range: 30 to 300."
- Call window: "Call window timer. Number input. Current value: 10 seconds. Range: 5 to 30."
- Total game timer: "Total game timer checkbox. Unchecked. Optional."
- Duration preview: "Estimated game duration: 25 to 35 minutes."

**ARIA Labels:**

- `aria-label="Select timer preset"` on preset dropdown
- `aria-describedby="charleston-pass-helper"` on timer inputs
- `aria-live="polite"` on duration preview
- `role="group"` on timer config panel

### Visual

**High Contrast:**

- Clear labels for all inputs
- Validation errors in red with icons
- Preset badges with distinct colors
- Duration preview has visible border

**Motion:**

- Form transitions respect animation settings
- No unnecessary animations in config panel

## Priority

**MEDIUM** - Important for customization and game pacing; affects user experience

## Story Points / Complexity

**2** - Low-Medium Complexity

**Justification:**

- Multiple number inputs with validation
- Preset system with auto-fill logic
- Duration estimation calculation
- Integration with room creation flow
- Backend enforcement during gameplay (separate implementation)

**Complexity Factors:**

- 4-5 individual timer configurations
- 4 presets with different timer combinations
- Preset switching and custom timer detection
- Validation logic (ranges for each timer)
- Estimated duration calculation

## Definition of Done

### Core Functionality

- [ ] Timer config panel visible in room creation form
- [ ] All timer inputs displayed with correct defaults
- [ ] Charleston pass timer input (30-300s, default: 60)
- [ ] Charleston vote timer input (15-120s, default: 30)
- [ ] Call window timer input (5-30s, default: 10)
- [ ] Turn timer input (30-300s, default: 90)
- [ ] Total game timer input (optional, 30-180 min)
- [ ] Total game timer checkbox (enable/disable)

### Preset System

- [ ] Timer presets dropdown with 4+ presets
- [ ] Standard preset applies correct timers
- [ ] Relaxed preset applies correct timers
- [ ] Blitz preset applies correct timers
- [ ] No Timers preset disables all timers
- [ ] Manual timer change switches preset to "Custom"
- [ ] Preset change confirmation for custom timers

### Validation

- [ ] All timer inputs validate ranges
- [ ] Invalid values show error messages
- [ ] Create room button disabled if validation fails
- [ ] All inputs have helper text explaining the timer

### Duration Preview

- [ ] Estimated game duration displayed
- [ ] Duration calculation considers all timers
- [ ] Duration updates when timers change
- [ ] Format: "Estimated: X-Y minutes"

### Room Integration

- [ ] Timers sent with CreateRoom command
- [ ] Timers included in RoomCreated event
- [ ] Timers displayed in room list (US-030)
- [ ] Timers shown in room details before joining
- [ ] Timer summary uses badges for quick recognition

### Gameplay Enforcement (Backend)

- [ ] Charleston pass timer enforced
- [ ] Charleston vote timer enforced
- [ ] Call window timer enforced
- [ ] Turn timer enforced
- [ ] Total game timer enforced (if enabled)
- [ ] Timer expiration triggers auto-actions

### Testing

- [ ] Unit tests pass for TimerConfigPanel
- [ ] Integration test passes (create room → timers applied)
- [ ] E2E test passes (configure → create → join → play → verify enforcement)
- [ ] Preset tests pass (all 4 presets apply correctly)
- [ ] Validation tests pass (invalid inputs rejected)
- [ ] Duration estimation tests pass (calculation accuracy)

### Accessibility

- [ ] Keyboard navigation works (Tab, Arrow keys)
- [ ] Screen reader announces all inputs and values
- [ ] ARIA labels on all form elements
- [ ] Helper text is accessible
- [ ] High contrast mode supported

### Documentation & Quality

- [ ] Component specs created (TimerConfigPanel, TimerPresetSelector)
- [ ] Test scenarios documented (timer-config-\*.md files)
- [ ] Mock data fixtures created (timer JSON)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

### User Testing

- [ ] Manually tested all 4 presets
- [ ] Tested custom timer configurations
- [ ] Verified timers are enforced during gameplay
- [ ] Confirmed timer summary displays correctly in room list
- [ ] Tested timer expiration and auto-actions

## Notes for Implementers

### Timer Config Panel Component

```typescript
const TimerConfigPanel: React.FC = () => {
  const [preset, setPreset] = useState<string>('Standard');
  const [timers, setTimers] = useState<TimerConfig>(TIMER_PRESETS.Standard);
  const [totalGameEnabled, setTotalGameEnabled] = useState(false);

  const handlePresetChange = (newPreset: string) => {
    if (preset === 'Custom') {
      if (!confirm('Applying this preset will reset your custom timers. Continue?')) {
        return;
      }
    }
    setPreset(newPreset);
    setTimers(TIMER_PRESETS[newPreset]);
  };

  const handleTimerChange = (timerName: keyof TimerConfig, value: number) => {
    setTimers((prev) => ({ ...prev, [timerName]: value }));
    if (preset !== 'Custom') {
      setPreset('Custom');
    }
  };

  const estimatedDuration = estimateGameDuration(timers);

  return (
    <Box className="timer-config-panel">
      <Typography variant="h6">Timer Settings</Typography>

      <TimerPresetSelector value={preset} onChange={handlePresetChange} />

      <TextField
        label="Charleston Pass Timer (seconds)"
        type="number"
        value={timers.charleston_pass}
        onChange={(e) => handleTimerChange('charleston_pass', Number(e.target.value))}
        inputProps={{ min: 30, max: 300 }}
        helperText="Time allowed to select 3 tiles (30-300s)"
        disabled={preset === 'NoTimers'}
        fullWidth
      />

      {/* More timer inputs... */}

      <FormControlLabel
        control={
          <Checkbox
            checked={totalGameEnabled}
            onChange={(e) => {
              setTotalGameEnabled(e.target.checked);
              if (!e.target.checked) {
                handleTimerChange('total_game_timer', null);
              }
            }}
          />
        }
        label="Enable total game timer"
      />

      {totalGameEnabled && (
        <TextField
          label="Total Game Timer (minutes)"
          type="number"
          value={timers.total_game_timer || 60}
          onChange={(e) => handleTimerChange('total_game_timer', Number(e.target.value))}
          inputProps={{ min: 30, max: 180 }}
          helperText="Maximum time for entire game (30-180 min)"
          fullWidth
        />
      )}

      <GameDurationPreview
        min={estimatedDuration.min}
        max={estimatedDuration.max}
      />
    </Box>
  );
};
```

### Validation Logic

```typescript
const validateTimerConfig = (config: TimerConfig): ValidationResult => {
  const errors: string[] = [];

  // Charleston pass: 30-300s
  if (config.charleston_pass < 30 || config.charleston_pass > 300) {
    errors.push('Charleston pass timer must be between 30 and 300 seconds');
  }

  // Charleston vote: 15-120s
  if (config.charleston_vote < 15 || config.charleston_vote > 120) {
    errors.push('Charleston vote timer must be between 15 and 120 seconds');
  }

  // Call window: 5-30s
  if (config.call_window < 5 || config.call_window > 30) {
    errors.push('Call window timer must be between 5 and 30 seconds');
  }

  // Turn timer: 30-300s
  if (config.turn_timer < 30 || config.turn_timer > 300) {
    errors.push('Turn timer must be between 30 and 300 seconds');
  }

  // Total game timer: 30-180 min (if enabled)
  if (config.total_game_timer !== null) {
    if (config.total_game_timer < 30 || config.total_game_timer > 180) {
      errors.push('Total game timer must be between 30 and 180 minutes');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
```

### Game Duration Preview Component

```typescript
const GameDurationPreview: React.FC<{ min: number; max: number }> = ({ min, max }) => {
  if (min === 0 && max === Infinity) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No timers enabled. Game duration depends on player pace.
      </Alert>
    );
  }

  return (
    <Alert severity="info" sx={{ mt: 2 }}>
      <Typography variant="body2">
        Estimated game duration: <strong>{min}-{max} minutes</strong>
      </Typography>
      <Typography variant="caption">
        Based on typical game flow. Actual time may vary.
      </Typography>
    </Alert>
  );
};
```

### Timer Summary for Room List

```typescript
const TimerSummary: React.FC<{ config: TimerConfig }> = ({ config }) => {
  const getBadge = () => {
    switch (config.mode) {
      case 'Standard':
        return <Chip label="Standard Timing" size="small" />;
      case 'Relaxed':
        return <Chip label="Relaxed" size="small" color="success" />;
      case 'Blitz':
        return <Chip label="Blitz" size="small" color="error" />;
      case 'NoTimers':
        return <Chip label="No Timers" size="small" color="default" />;
      case 'Custom':
        return (
          <Tooltip title={`Turn: ${config.turn_timer}s, Call: ${config.call_window}s`}>
            <Chip label="Custom Timers" size="small" color="primary" />
          </Tooltip>
        );
    }
  };

  return <Box className="timer-summary">{getBadge()}</Box>;
};
```

### Backend Timer Enforcement (Reference)

```rust
// crates/mahjong_core/src/timer.rs (pseudo-code)
pub struct PhaseTimer {
    phase: TimerPhase,
    duration: Duration,
    started_at: Instant,
}

impl PhaseTimer {
    pub fn has_expired(&self) -> bool {
        self.started_at.elapsed() >= self.duration
    }

    pub fn remaining(&self) -> Duration {
        self.duration.saturating_sub(self.started_at.elapsed())
    }
}

// Auto-action on timer expiration
pub fn handle_timer_expiration(table: &mut Table, phase: TimerPhase) -> Result<(), GameError> {
    match phase {
        TimerPhase::CharlestonPass => {
            // Auto-select random 3 tiles
            let tiles = table.current_player_hand().choose_random_tiles(3);
            table.pass_charleston_tiles(tiles)?;
        }
        TimerPhase::CallWindow => {
            // Pass (no call)
            table.resolve_call_window_timeout()?;
        }
        TimerPhase::Turn => {
            // Auto-discard random tile
            let tile = table.current_player_hand().choose_random_tile();
            table.discard_tile(tile)?;
        }
        TimerPhase::TotalGame => {
            // End game, calculate final scores
            table.end_game_by_timer()?;
        }
        _ => {}
    }
    Ok(())
}
```

This comprehensive timer configuration system provides flexibility for different play styles and skill levels.
