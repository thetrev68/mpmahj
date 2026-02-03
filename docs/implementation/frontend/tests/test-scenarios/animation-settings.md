# Test Scenario: Animation Settings

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-035 - Animation Settings
**Component Specs**: SettingsPanel.md, AnimationSettingsDialog.md
**Fixtures**: `lobby-empty.json`, `animation-settings-sequence.json`
**Manual Test**: Manual Testing Checklist #35

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/lobby-empty.json`
- **Mock WebSocket**: Connected
- **User**: Logged in as "Player1"
- **Current screen**: Lobby (main menu)
- **Animation settings**: Default settings
- **Settings panel**: Closed (hidden by default)

## Steps (Act)

### Step 1: User opens settings panel

- User clicks "Settings" button in toolbar
- Settings panel slides in from right side of screen
- UI shows settings panel with:
  - Header: "Settings"
  - Sections: "Game", "Hints", "Animations", "Audio"
  - "Close" button

### Step 2: User navigates to Animations section

- User clicks "Animations" section
- Settings panel shows animation-related settings:
  - **Enable Animations**: [✓] (checkbox)
  - **Animation Speed**: [Normal ▼] (dropdown)
  - **Tile Draw Animation**: [✓] (checkbox)
  - **Tile Discard Animation**: [✓] (checkbox)
  - **Meld Expose Animation**: [✓] (checkbox)
  - **Joker Exchange Animation**: [✓] (checkbox)
  - **Mahjong Win Animation**: [✓] (checkbox)

### Step 3: User disables all animations

- User unchecks "Enable Animations"
- "Enable Animations" updates: [ ]
- All individual animation checkboxes become disabled (grayed out)

### Step 4: User re-enables animations

- User checks "Enable Animations"
- "Enable Animations" updates: [✓]
- All individual animation checkboxes become enabled

### Step 5: User changes animation speed

- User clicks "Animation Speed" dropdown
- Dropdown options appear:
  - **Slow** - Animations play at 0.5x speed
  - **Normal** - Animations play at 1.0x speed (default)
  - **Fast** - Animations play at 1.5x speed
  - **Instant** - Animations are skipped (instant transitions)
- User selects "Fast"
- "Animation Speed" updates: "Fast"

### Step 6: User configures individual animations

- User unchecks "Tile Draw Animation"
- "Tile Draw Animation" updates: [ ]

- User unchecks "Tile Discard Animation"
- "Tile Discard Animation" updates: [ ]

- User checks "Meld Expose Animation"
- "Meld Expose Animation" updates: [✓]

- User checks "Joker Exchange Animation"
- "Joker Exchange Animation" updates: [✓]

- User checks "Mahjong Win Animation"
- "Mahjong Win Animation" updates: [✓]

### Step 7: User saves animation settings

- User clicks "Save" button
- WebSocket sends `UpdateSettings` command:
  - `animation_settings: { enable_animations: true, animation_speed: "Fast", tile_draw_animation: false, tile_discard_animation: false, meld_expose_animation: true, joker_exchange_animation: true, mahjong_win_animation: true }`
- Settings panel shows spinner: "Saving..."

### Step 8: Server saves settings

- Server validates animation settings
- Server saves settings to user profile
- WebSocket receives `SettingsUpdated` event:
  - `settings: { ... }` (same as sent)
- Settings panel closes with success animation
- UI shows toast: "Animation settings saved!"

### Step 9: User joins a game to test animations

- User clicks "Create Room" button
- User configures room settings and creates room
- User waits for other players to join
- Game starts

### Step 10: User observes animations in game

- User draws a tile
  - Expected: No animation (Tile Draw Animation disabled)
  - Actual: Tile appears instantly in hand

- User discards a tile
  - Expected: No animation (Tile Discard Animation disabled)
  - Actual: Tile disappears instantly from hand, appears in discard pile

- Another player calls a meld
  - Expected: Animation plays (Meld Expose Animation enabled)
  - Actual: Meld appears with animation

- User exchanges a Joker
  - Expected: Animation plays (Joker Exchange Animation enabled)
  - Actual: Joker exchange animation plays

- User declares Mahjong
  - Expected: Animation plays (Mahjong Win Animation enabled)
  - Actual: Mahjong win animation plays

### Step 11: User changes animation speed to Instant

- User clicks "Settings" button
- Settings panel slides in
- User navigates to Animations section
- User clicks "Animation Speed" dropdown
- User selects "Instant"
- "Animation Speed" updates: "Instant"
- User clicks "Save" button
- WebSocket sends `UpdateSettings` command
- Settings panel closes

### Step 12: User observes instant animations

- User draws a tile
  - Expected: Instant (no animation)
  - Actual: Tile appears instantly

- User discards a tile
  - Expected: Instant (no animation)
  - Actual: Tile disappears instantly

- Another player calls a meld
  - Expected: Instant (no animation)
  - Actual: Meld appears instantly

## Expected Outcome (Assert)

- ✅ Settings panel opened and closed correctly
- ✅ User configured all animation settings (enable/disable, speed, individual animations)
- ✅ Animation settings were saved successfully
- ✅ Animations behaved correctly in game based on settings
- ✅ Animation speed changes affected animation playback
- ✅ WebSocket command/event sequence correct (UpdateSettings → SettingsUpdated)

## Error Cases

### Saving invalid animation settings

- **When**: User configures invalid animation speed (shouldn't happen due to UI validation)
- **Expected**: Server validates and rejects
- **Assert**:
  - WebSocket receives `SettingsError` event:
    - `reason: "Invalid animation speed"`
  - Settings panel shows error: "Invalid animation speed - please select a valid option"

### WebSocket disconnect during save

- **When**: Connection lost after clicking "Save" but before receiving confirmation
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**:
  - On reconnect, client checks if settings were saved
  - If saved: shows updated settings
  - If not saved: shows previous settings

### Disabling animations during game

- **When**: User changes animation settings while game is in progress
- **Expected**: Settings apply immediately to next animation
- **Assert**:
  - Current animation completes (if in progress)
  - Next animation uses new settings

### Animation performance issues

- **When**: User selects "Slow" animation speed on low-end device
- **Expected**: Animations may lag or stutter
- **Assert**:
  - Client may show warning: "Animations may be slow on this device. Consider increasing animation speed."
  - User can change to "Fast" or "Instant"

## Animation Settings

### Global Settings

| Setting | Description | Default |
|---------|-------------|----------|
| Enable Animations | Master toggle for all animations | ✓ |
| Animation Speed | Global speed multiplier for all animations | Normal |

### Animation Speed Options

| Speed | Multiplier | Description |
|-------|-------------|-------------|
| Slow | 0.5x | Animations play at half speed |
| Normal | 1.0x | Animations play at normal speed |
| Fast | 1.5x | Animations play at 1.5x speed |
| Instant | N/A | Animations are skipped (instant transitions) |

### Individual Animations

| Animation | Description | Default |
|-----------|-------------|----------|
| Tile Draw Animation | Animation when drawing tile from wall | ✓ |
| Tile Discard Animation | Animation when discarding tile | ✓ |
| Meld Expose Animation | Animation when exposing meld | ✓ |
| Joker Exchange Animation | Animation when exchanging Joker | ✓ |
| Mahjong Win Animation | Animation when declaring Mahjong | ✓ |

## Cross-References

### Related Scenarios

- `drawing-discarding.md` - Tile draw and discard animations
- `calling-pung-kong-quint-sextet.md` - Meld expose animations
- `joker-exchange-single.md` - Joker exchange animations
- `mahjong-self-draw.md` - Mahjong win animations

### Related Components

- [SettingsPanel](../../component/specs/game/SettingsPanel.md)
- [AnimationSettingsDialog](../../component/specs/game/AnimationSettingsDialog.md)
- [GameTable](../../component/specs/game/GameTable.md)

### Backend References

- Commands: `mahjong_core::command::UpdateSettings`
- Events: `mahjong_core::event::SettingsUpdated`, `SettingsError`
- State: `GameState::settings` (user settings including animation_settings)
- Logic: `mahjong_client::settings::apply_animation_settings()`

### Accessibility Notes

- "Settings" button announced: "Open settings"
- Settings panel announced: "Settings panel opened"
- Animations section announced: "Animations settings section"
- "Enable Animations" checkbox announced: "Enable animations, checked"
- "Animation Speed" dropdown announced: "Animation speed, Normal selected. Options: Slow, Normal, Fast, Instant"
- "Tile Draw Animation" checkbox announced: "Tile draw animation, checked"
- "Tile Discard Animation" checkbox announced: "Tile discard animation, checked"
- "Meld Expose Animation" checkbox announced: "Meld expose animation, checked"
- "Joker Exchange Animation" checkbox announced: "Joker exchange animation, checked"
- "Mahjong Win Animation" checkbox announced: "Mahjong win animation, checked"
- "Save" button announced: "Save animation settings"
- Settings saved toast announced: "Animation settings saved"
