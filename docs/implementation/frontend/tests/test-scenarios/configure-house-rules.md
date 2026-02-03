# Test Scenario: Configure House Rules

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-034 - Configure House Rules
**Component Specs**: SettingsPanel.md, HouseRulesDialog.md, RoomSettings.md
**Fixtures**: `lobby-empty.json`, `house-rules-sequence.json`
**Manual Test**: Manual Testing Checklist #34

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/lobby-empty.json`
- **Mock WebSocket**: Connected
- **User**: Logged in as "Player1"
- **Current screen**: Lobby (main menu)
- **House Rules**: Default settings
- **Settings panel**: Closed (hidden by default)

## Steps (Act)

### Step 1: User opens settings panel

- User clicks "Settings" button in toolbar
- Settings panel slides in from right side of screen
- UI shows settings panel with:
  - Header: "Settings"
  - Sections: "Game", "Hints", "Animations", "Audio"
  - "Close" button

### Step 2: User navigates to Game section

- User clicks "Game" section
- Settings panel shows game-related settings:
  - **House Rules**: [Configure...] (button)
  - **Default Game Mode**: [Standard ▼] (dropdown)
  - **Default Timer Settings**: [Configure...] (button)

### Step 3: User opens House Rules dialog

- User clicks "House Rules" button
- House Rules dialog slides in from center of screen
- UI shows House Rules dialog with:
  - **Header**: "House Rules"
  - **Categories**:
    - **Charleston Rules**
    - **Meld Rules**
    - **Joker Rules**
    - **Undo Rules**
    - **Pattern Rules**
  - **Buttons**: "Save", "Reset to Default", "Cancel"

### Step 4: User configures Charleston Rules

- User clicks "Charleston Rules" section
- Section expands to show:
  - [✓] Allow First Charleston (always enabled)
  - [✓] Allow Second Charleston (optional)
  - [✓] Allow Courtesy Pass (optional)
  - [ ] Blind Pass Required (optional)
  - [ ] IOU Detection Enabled (optional)

- User unchecks "Allow Second Charleston"
- "Allow Second Charleston" updates: [ ]

- User checks "Blind Pass Required"
- "Blind Pass Required" updates: [✓]

### Step 5: User configures Meld Rules

- User clicks "Meld Rules" section
- Section expands to show:
  - [✓] Allow Pung Calls
  - [✓] Allow Kong Calls
  - [✓] Allow Quint Calls
  - [✓] Allow Sextet Calls
  - [✓] Allow Meld Upgrades (Pung → Kong → Quint)
  - [ ] Allow Multiple Melds per Turn (optional)

- User unchecks "Allow Sextet Calls"
- "Allow Sextet Calls" updates: [ ]

- User checks "Allow Multiple Melds per Turn"
- "Allow Multiple Melds per Turn" updates: [✓]

### Step 6: User configures Joker Rules

- User clicks "Joker Rules" section
- Section expands to show:
  - [✓] Allow Joker Exchanges
  - [✓] Allow Joker in Pairs (optional)
  - [ ] Allow Multiple Joker Exchanges per Turn (optional)
  - [✓] Joker Substitution Rules: Standard (dropdown)
    - Options: Standard, Strict, Permissive

- User checks "Allow Multiple Joker Exchanges per Turn"
- "Allow Multiple Joker Exchanges per Turn" updates: [✓]

- User clicks "Joker Substitution Rules" dropdown
- User selects "Strict"
- "Joker Substitution Rules" updates: "Strict"

### Step 7: User configures Undo Rules

- User clicks "Undo Rules" section
- Section expands to show:
  - [✓] Allow Smart Undo (Practice mode only)
  - [ ] Allow Smart Undo (Multiplayer)
  - [✓] Undo Voting Required (Multiplayer)
  - [ ] Unlimited Undos (Practice mode)
  - [✓] Max Undos: [3 ▼] (dropdown)
    - Options: 1, 3, 5, Unlimited

- User checks "Allow Smart Undo (Multiplayer)"
- "Allow Smart Undo (Multiplayer)" updates: [✓]

- User clicks "Max Undos" dropdown
- User selects "5"
- "Max Undos" updates: "5"

### Step 8: User configures Pattern Rules

- User clicks "Pattern Rules" section
- Section expands to show:
  - [✓] Allow Standard Patterns (2025 NMJL)
  - [ ] Allow Custom Patterns
  - [ ] Allow Legacy Patterns (pre-2025)
  - [✓] Pattern Validation: Strict (dropdown)
    - Options: Strict, Moderate, Permissive

- User checks "Allow Custom Patterns"
- "Allow Custom Patterns" updates: [✓]

- User clicks "Pattern Validation" dropdown
- User selects "Moderate"
- "Pattern Validation" updates: "Moderate"

### Step 9: User saves house rules

- User clicks "Save" button
- WebSocket sends `UpdateHouseRules` command:
  - `charleston_rules: { allow_first_charleston: true, allow_second_charleston: false, allow_courtesy_pass: true, blind_pass_required: true, iou_detection_enabled: false }`
  - `meld_rules: { allow_pung_calls: true, allow_kong_calls: true, allow_quint_calls: true, allow_sextet_calls: false, allow_meld_upgrades: true, allow_multiple_melds_per_turn: true }`
  - `joker_rules: { allow_joker_exchanges: true, allow_joker_in_pairs: true, allow_multiple_joker_exchanges_per_turn: true, joker_substitution_rules: "Strict" }`
  - `undo_rules: { allow_smart_undo_practice: true, allow_smart_undo_multiplayer: true, undo_voting_required: true, unlimited_undos_practice: false, max_undos: 5 }`
  - `pattern_rules: { allow_standard_patterns: true, allow_custom_patterns: true, allow_legacy_patterns: false, pattern_validation: "Moderate" }`
- House Rules dialog shows spinner: "Saving..."

### Step 10: Server saves house rules

- Server validates house rules
- Server saves rules to user profile
- WebSocket receives `HouseRulesUpdated` event:
  - `rules: { ... }` (same as sent)
- House Rules dialog closes with success animation
- UI shows toast: "House rules saved!"

### Step 11: User creates room with custom house rules

- User clicks "Create Room" button
- Create Room dialog slides in
- User configures room settings:
  - Room Name: "Custom Rules Game"
  - Max Players: 4
  - Game Mode: Standard
  - House Rules: [Use My Rules] (button)
- User clicks "Use My Rules" button
- Create Room dialog shows house rules summary:
  - Charleston: No Second Charleston, Blind Pass Required
  - Melds: No Sextet, Multiple Melds per Turn
  - Jokers: Multiple Exchanges, Strict Substitution
  - Undo: Multiplayer Allowed, Max 5 Undos
  - Patterns: Custom Allowed, Moderate Validation
- User clicks "Create Room" button
- WebSocket sends `CreateRoom` command with custom house rules
- Room created with custom rules

### Step 12: User resets house rules to default

- User clicks "Settings" button
- Settings panel slides in
- User clicks "House Rules" button
- House Rules dialog slides in
- User clicks "Reset to Default" button
- Confirmation dialog appears: "Reset all house rules to default?"
- User clicks "Confirm"
- House Rules dialog resets all settings to default values
- User clicks "Save" button
- WebSocket sends `UpdateHouseRules` command with default rules
- House Rules dialog closes

## Expected Outcome (Assert)

- ✅ Settings panel opened and closed correctly
- ✅ House Rules dialog opened and closed correctly
- ✅ User configured all house rule categories (Charleston, Meld, Joker, Undo, Pattern)
- ✅ House rules were saved successfully
- ✅ User created room with custom house rules
- ✅ User reset house rules to default
- ✅ WebSocket command/event sequence correct (UpdateHouseRules → HouseRulesUpdated)

## Error Cases

### Saving invalid house rules

- **When**: User configures invalid combination of rules (shouldn't happen due to UI validation)
- **Expected**: Server validates and rejects
- **Assert**:
  - WebSocket receives `HouseRulesError` event:
    - `reason: "Invalid rule combination"`
  - House Rules dialog shows error: "Invalid rule combination - please adjust"

### WebSocket disconnect during save

- **When**: Connection lost after clicking "Save" but before receiving confirmation
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**:
  - On reconnect, client checks if rules were saved
  - If saved: shows updated rules
  - If not saved: shows previous rules

### Resetting to default with unsaved changes

- **When**: User has unsaved changes and clicks "Reset to Default"
- **Expected**: Confirmation dialog warns about losing changes
- **Assert**:
  - Confirmation dialog: "You have unsaved changes. Reset to default will lose these changes. Continue?"
  - User can cancel or confirm

### Creating room with conflicting rules

- **When**: User creates room with rules that conflict with game mode
- **Expected**: Server validates and rejects
- **Assert**:
  - WebSocket receives `RoomCreationFailed` event:
    - `reason: "House rules conflict with game mode"`
  - Create Room dialog shows error: "House rules conflict with selected game mode"

## House Rules Categories

### Charleston Rules

| Rule | Description | Default |
|------|-------------|----------|
| Allow First Charleston | First Charleston always allowed | ✓ |
| Allow Second Charleston | Optional Second Charleston pass | ✓ |
| Allow Courtesy Pass | Optional courtesy pass after Charleston | ✓ |
| Blind Pass Required | Players must blind pass on First Left |  |
| IOU Detection Enabled | Detect IOU edge case (all blind pass) | ✓ |

### Meld Rules

| Rule | Description | Default |
|------|-------------|----------|
| Allow Pung Calls | Players can call Pung | ✓ |
| Allow Kong Calls | Players can call Kong | ✓ |
| Allow Quint Calls | Players can call Quint | ✓ |
| Allow Sextet Calls | Players can call Sextet | ✓ |
| Allow Meld Upgrades | Pung → Kong → Quint upgrades | ✓ |
| Allow Multiple Melds per Turn | Call multiple melds in one turn |  |

### Joker Rules

| Rule | Description | Default |
|------|-------------|----------|
| Allow Joker Exchanges | Players can exchange Jokers from exposed melds | ✓ |
| Allow Joker in Pairs | Jokers can be used in Pairs | ✓ |
| Allow Multiple Joker Exchanges per Turn | Exchange multiple Jokers in one turn |  |
| Joker Substitution Rules | How Jokers can substitute tiles | Standard |

### Undo Rules

| Rule | Description | Default |
|------|-------------|----------|
| Allow Smart Undo (Practice) | Undo moves in practice mode | ✓ |
| Allow Smart Undo (Multiplayer) | Undo moves in multiplayer games |  |
| Undo Voting Required | Multiplayer undo requires vote | ✓ |
| Unlimited Undos (Practice) | No limit on undos in practice |  |
| Max Undos | Maximum number of undos allowed | 3 |

### Pattern Rules

| Rule | Description | Default |
|------|-------------|----------|
| Allow Standard Patterns | 2025 NMJL patterns | ✓ |
| Allow Custom Patterns | User-defined patterns |  |
| Allow Legacy Patterns | Pre-2025 patterns |  |
| Pattern Validation | How strictly to validate patterns | Strict |

## Cross-References

### Related Scenarios

- `create-room.md` - Create room with house rules
- `undo-solo.md` - Smart undo (solo mode)
- `undo-voting.md` - Smart undo (multiplayer voting)

### Related Components

- [SettingsPanel](../../component/specs/game/SettingsPanel.md)
- [HouseRulesDialog](../../component/specs/game/HouseRulesDialog.md)
- [RoomSettings](../../component/specs/lobby/RoomSettings.md)

### Backend References

- Commands: `mahjong_core::command::UpdateHouseRules`, `CreateRoom`
- Events: `mahjong_core::event::HouseRulesUpdated`, `HouseRulesError`
- State: `GameState::settings` (user settings including house_rules)
- Logic: `mahjong_server::rules::validate_house_rules()`, `apply_house_rules()`

### Accessibility Notes

- "Settings" button announced: "Open settings"
- Settings panel announced: "Settings panel opened"
- "House Rules" button announced: "Configure house rules"
- House Rules dialog announced: "House rules dialog opened"
- Charleston Rules section announced: "Charleston Rules section expanded. Allow First Charleston, checked. Allow Second Charleston, unchecked. Allow Courtesy Pass, checked. Blind Pass Required, checked. IOU Detection Enabled, unchecked."
- Meld Rules section announced: "Meld Rules section expanded. Allow Pung Calls, checked. Allow Kong Calls, checked. Allow Quint Calls, checked. Allow Sextet Calls, unchecked. Allow Meld Upgrades, checked. Allow Multiple Melds per Turn, checked."
- Joker Rules section announced: "Joker Rules section expanded. Allow Joker Exchanges, checked. Allow Joker in Pairs, checked. Allow Multiple Joker Exchanges per Turn, checked. Joker Substitution Rules, Strict selected."
- Undo Rules section announced: "Undo Rules section expanded. Allow Smart Undo Practice, checked. Allow Smart Undo Multiplayer, checked. Undo Voting Required, checked. Unlimited Undos Practice, unchecked. Max Undos, 5 selected."
- Pattern Rules section announced: "Pattern Rules section expanded. Allow Standard Patterns, checked. Allow Custom Patterns, checked. Allow Legacy Patterns, unchecked. Pattern Validation, Moderate selected."
- "Save" button announced: "Save house rules"
- "Reset to Default" button announced: "Reset house rules to default"
- "Cancel" button announced: "Cancel, discard changes"
