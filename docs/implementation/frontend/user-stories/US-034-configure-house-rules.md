# US-034: Configure House Rules

## Story

**As a** player creating a game room
**I want** to configure house rules and game variations
**So that** the game follows my preferred NMJL variations and custom settings

## Acceptance Criteria

### AC-1: House Rules Panel in Room Creation

**Given** I am creating a new game room (US-029)
**When** the room creation form is displayed
**Then** a "House Rules" section is visible
**And** the section contains all configurable rule options
**And** default values are pre-filled (Standard NMJL rules)

### AC-2: Use Blanks Configuration

**Given** the house rules section is displayed
**When** I view the "Use Blanks" option
**Then** a checkbox is displayed with label: "Use Blanks (160 tiles instead of 152)"
**And** default is unchecked (false)
**And** a tooltip explains: "Include 8 blank tiles for additional variation (non-standard)"
**And** toggling changes tile count preview: "152 tiles" → "160 tiles"

### AC-3: Charleston Mode Configuration

**Given** the house rules section is displayed
**When** I view the "Charleston Mode" option
**Then** a dropdown is displayed with options:

- "Full Charleston (both required)" - default
- "First Charleston Only"
- "Optional Second Charleston"
  **And** a tooltip explains each mode:
- Full: First and Second Charleston are both mandatory
- First Only: Only First Charleston, skip Second
- Optional Second: Second Charleston requires unanimous vote

### AC-4: Dead Wall Size Configuration

**Given** the house rules section is displayed
**When** I view the "Dead Wall Size" option
**Then** a number input is displayed with range: 10-20
**And** default value is 14 (standard NMJL)
**And** a tooltip explains: "Tiles reserved and not drawn. Standard NMJL uses 14 tiles."
**And** validation prevents values outside range

### AC-5: Joker Pairs Configuration

**Given** the house rules section is displayed
**When** I view the "Allow Joker Pairs" option
**Then** a checkbox is displayed with label: "Allow Joker Pairs"
**And** default is unchecked (false, per official NMJL rules)
**And** a tooltip explains: "Allow pairs to contain jokers (non-standard variation)"
**And** a warning shows: "Note: Not allowed in official NMJL rules"

### AC-6: Scoring Multiplier Configuration

**Given** the house rules section is displayed
**When** I view the "Scoring Multiplier" option
**Then** a dropdown is displayed with options: 1x, 2x, 5x, 10x
**And** default is 1x (standard scoring)
**And** a tooltip explains: "Multiply all scores by this factor for higher stakes"
**And** preview shows example: "Winning hand (25 points) → 50 points at 2x"

### AC-7: Called Mahjong Payment Configuration

**Given** the house rules section is displayed
**When** I view the "Called Mahjong Payment" option
**Then** a dropdown is displayed with options:

- "Discarder Pays All" - default (standard NMJL)
- "Discarder Pays Double"
- "Equal Payment (all pay equally)"
  **And** a tooltip explains payment rules for called Mahjong

### AC-8: Preset Selector

**Given** the house rules section is displayed
**When** I view the "Rule Presets" dropdown at the top
**Then** preset options are displayed:

- "Standard NMJL" - default
- "Beginner Friendly"
- "Advanced/Tournament"
- "Custom"
  **And** selecting a preset auto-fills all rule options
  **And** any manual change switches preset to "Custom"

### AC-9: Standard NMJL Preset

**Given** I select "Standard NMJL" preset
**When** the preset is applied
**Then** the following rules are set:

- Use Blanks: false (152 tiles)
- Charleston Mode: Full
- Dead Wall Size: 14
- Allow Joker Pairs: false
- Scoring Multiplier: 1x
- Called Mahjong Payment: Discarder Pays All

### AC-10: Beginner Friendly Preset

**Given** I select "Beginner Friendly" preset
**When** the preset is applied
**Then** the following rules are set:

- Use Blanks: false
- Charleston Mode: First Only (simpler)
- Dead Wall Size: 14
- Allow Joker Pairs: true (more forgiving)
- Scoring Multiplier: 1x
- Called Mahjong Payment: Equal Payment (simpler math)
  **And** additional beginner settings may apply (from US-036: Relaxed timers)

### AC-11: Advanced/Tournament Preset

**Given** I select "Advanced/Tournament" preset
**When** the preset is applied
**Then** the following rules are set:

- Use Blanks: false
- Charleston Mode: Full
- Dead Wall Size: 14
- Allow Joker Pairs: false (strict NMJL)
- Scoring Multiplier: 2x (higher stakes)
- Called Mahjong Payment: Discarder Pays All
  **And** additional tournament settings may apply (from US-036: Standard/Blitz timers)

### AC-12: Rules Displayed in Room List

**Given** I configured house rules and created the room
**When** the room appears in the lobby room list (US-030)
**Then** house rules are summarized with icons:

- Blanks icon (if enabled)
- Charleston mode badge (Full/First/Optional)
- Joker pairs icon (if enabled)
- Multiplier badge (if >1x)
  **And** hovering shows full rule details

### AC-13: Rules Enforced During Gameplay

**Given** the game has started with configured house rules
**When** gameplay progresses
**Then** the rules are enforced by the backend:

- Use Blanks: 160 tiles dealt if enabled
- Charleston Mode: phases match configured mode
- Dead Wall Size: correct number of tiles reserved
- Joker Pairs: validation allows/disallows joker pairs
- Scoring Multiplier: all scores multiplied correctly
- Called Mahjong Payment: payments calculated per rule

## Technical Details

### Commands (Frontend → Backend)

House rules are sent as part of the `CreateRoom` command (US-029):

```typescript
{
  CreateRoom: {
    player_id: string;
    config: {
      room_name: string;
      card_year: number;
      fill_with_bots: boolean;
      bot_difficulty: BotDifficulty;
      house_rules: HouseRules; // Full house rules config
      timer_config: TimerConfig;
    }
  }
}
```text

### HouseRules Type Definition

```typescript
interface HouseRules {
  // Tile configuration
  use_blanks: boolean; // 160 tiles vs 152

  // Charleston configuration
  charleston_mode: 'Full' | 'FirstOnly' | 'OptionalSecond';

  // Gameplay configuration
  dead_wall_size: number; // 10-20, default: 14
  allow_joker_pairs: boolean; // Default: false (official NMJL)

  // Scoring configuration
  scoring_multiplier: 1 | 2 | 5 | 10; // Default: 1
  called_mahjong_payment: 'DiscarderPaysAll' | 'DiscarderPaysDouble' | 'EqualPayment';

  // Advanced rules (optional)
  wall_closure_enabled: boolean; // Default: false
  heavenly_hand_multiplier: number; // Default: 2 (self-draw East first turn)

  // Optional: Custom rules
  custom_rules?: {
    allow_undo: boolean; // From US-023
    hint_limit: number; // From US-027
  };
}
```text

### Preset Definitions

```typescript
const HOUSE_RULE_PRESETS: Record<string, HouseRules> = {
  StandardNMJL: {
    use_blanks: false,
    charleston_mode: 'Full',
    dead_wall_size: 14,
    allow_joker_pairs: false,
    scoring_multiplier: 1,
    called_mahjong_payment: 'DiscarderPaysAll',
    wall_closure_enabled: false,
    heavenly_hand_multiplier: 2,
  },
  BeginnerFriendly: {
    use_blanks: false,
    charleston_mode: 'FirstOnly',
    dead_wall_size: 14,
    allow_joker_pairs: true,
    scoring_multiplier: 1,
    called_mahjong_payment: 'EqualPayment',
    wall_closure_enabled: false,
    heavenly_hand_multiplier: 2,
  },
  AdvancedTournament: {
    use_blanks: false,
    charleston_mode: 'Full',
    dead_wall_size: 14,
    allow_joker_pairs: false,
    scoring_multiplier: 2,
    called_mahjong_payment: 'DiscarderPaysAll',
    wall_closure_enabled: true,
    heavenly_hand_multiplier: 3,
  },
};
```text

### Events (Backend → Frontend)

House rules are included in room state events:

```typescript
{
  kind: 'Public',
  event: {
    RoomCreated: {
      room_id: string;
      config: {
        house_rules: HouseRules;
        // ... other config
      }
    }
  }
}
```text

### Backend References

- **Rust Code**: `crates/mahjong_core/src/rules/house_rules.rs` - House rules definition
- **Rust Code**: `crates/mahjong_core/src/rules/validator.rs:validate_with_house_rules()` - Rule enforcement
- **Rust Code**: `crates/mahjong_core/src/scoring.rs:apply_multiplier()` - Scoring multiplier
- **Rust Code**: `crates/mahjong_server/src/network/room.rs:create_room_with_rules()` - Room creation with rules
- **Game Design Doc**: Section 8.1 (House Rules Configuration), Section 8.2 (Rule Enforcement)

## Components Involved

### Container Components

- **`<CreateRoomForm>`** - Full room creation form (from US-029)
- **`<HouseRulesPanel>`** - House rules configuration section

### Presentational Components

- **`<RulePresetSelector>`** - Preset dropdown
- **`<UseBlanksCheckbox>`** - Use Blanks toggle
- **`<CharlestonModeDropdown>`** - Charleston mode selector
- **`<DeadWallSizeInput>`** - Dead wall size number input
- **`<JokerPairsCheckbox>`** - Joker pairs toggle
- **`<ScoringMultiplierDropdown>`** - Scoring multiplier selector
- **`<CalledMahjongPaymentDropdown>`** - Payment rule selector
- **`<RuleTooltip>`** - Tooltip with rule explanations
- **`<HouseRulesSummary>`** - Summary display for room list

### Hooks

- **`useHouseRules()`** - Manages house rules state
- **`useRulePresets()`** - Handles preset selection and application

## Component Specs

**Component Specification Files:**

- `component-specs/container/HouseRulesPanel.md`
- `component-specs/presentational/RulePresetSelector.md`
- `component-specs/presentational/HouseRulesSummary.md`
- `component-specs/hooks/useHouseRules.md`

## Test Scenarios

**Test Scenario Files:**

- `tests/test-scenarios/house-rules-standard.md` - Standard NMJL preset
- `tests/test-scenarios/house-rules-beginner.md` - Beginner friendly preset
- `tests/test-scenarios/house-rules-custom.md` - Custom rule configuration
- `tests/test-scenarios/house-rules-enforcement.md` - Rules enforced during gameplay

## Mock Data

### Fixtures

**House Rules Fixtures:**

```json
// tests/fixtures/house-rules/standard-nmjl.json
{
  "preset": "StandardNMJL",
  "rules": {
    "use_blanks": false,
    "charleston_mode": "Full",
    "dead_wall_size": 14,
    "allow_joker_pairs": false,
    "scoring_multiplier": 1,
    "called_mahjong_payment": "DiscarderPaysAll",
    "wall_closure_enabled": false,
    "heavenly_hand_multiplier": 2
  }
}

// tests/fixtures/house-rules/beginner-friendly.json
{
  "preset": "BeginnerFriendly",
  "rules": {
    "use_blanks": false,
    "charleston_mode": "FirstOnly",
    "dead_wall_size": 14,
    "allow_joker_pairs": true,
    "scoring_multiplier": 1,
    "called_mahjong_payment": "EqualPayment",
    "wall_closure_enabled": false,
    "heavenly_hand_multiplier": 2
  }
}

// tests/fixtures/house-rules/advanced-tournament.json
{
  "preset": "AdvancedTournament",
  "rules": {
    "use_blanks": false,
    "charleston_mode": "Full",
    "dead_wall_size": 14,
    "allow_joker_pairs": false,
    "scoring_multiplier": 2,
    "called_mahjong_payment": "DiscarderPaysAll",
    "wall_closure_enabled": true,
    "heavenly_hand_multiplier": 3
  }
}

// tests/fixtures/house-rules/custom.json
{
  "preset": "Custom",
  "rules": {
    "use_blanks": true,
    "charleston_mode": "OptionalSecond",
    "dead_wall_size": 16,
    "allow_joker_pairs": true,
    "scoring_multiplier": 5,
    "called_mahjong_payment": "DiscarderPaysDouble",
    "wall_closure_enabled": false,
    "heavenly_hand_multiplier": 2
  }
}
```text

## Edge Cases

### EC-1: Invalid Dead Wall Size

**Given** I enter a dead wall size of 5 (below minimum 10)
**When** I try to create the room
**Then** validation error shows: "Dead wall size must be between 10 and 20"
**And** the create room button is disabled until corrected

### EC-2: Custom Rule Changes Preset to Custom

**Given** I select "Standard NMJL" preset
**When** I manually toggle "Allow Joker Pairs" to true
**Then** the preset dropdown automatically switches to "Custom"
**And** all other Standard NMJL rules remain unchanged
**And** the rule I changed (joker pairs) persists

### EC-3: Use Blanks with Card Year Compatibility

**Given** I select card year 2017
**And** I enable "Use Blanks"
**When** the room is created
**Then** the backend validates that blanks are supported for this card year
**And** if not supported, an error shows: "Blanks are not available for card year 2017"
**Note**: This depends on backend data; assume all years support blanks for now

### EC-4: Scoring Multiplier Preview

**Given** I set scoring multiplier to 5x
**When** I view the multiplier dropdown
**Then** a preview shows example scores: "Winning hand (25 pts) → 125 pts at 5x"
**And** the preview updates when I change the multiplier

### EC-5: Conflicting Rules Warning

**Given** I enable "Allow Joker Pairs"
**And** I select "Standard NMJL" from presets (which disables joker pairs)
**When** the preset is applied
**Then** a confirmation dialog shows: "Applying this preset will reset your custom rules. Continue?"
**And** if I confirm, joker pairs is disabled (preset overrides)
**And** if I cancel, my custom settings remain

## Related User Stories

- **US-029: Create Room** - House rules are configured during room creation
- **US-030: Join Room** - House rules displayed in room details
- **US-036: Timer Configuration** - Timer settings are separate but related configuration

## Accessibility Considerations

### Keyboard Navigation

**Focus Management:**

- Tab key navigates through all house rule inputs
- Arrow keys navigate dropdown options
- Space key toggles checkboxes
- Number inputs accept direct typing

**Shortcuts:**

- No specific shortcuts (standard form navigation)

### Screen Reader

**Announcements:**

- Preset selector: "Rule presets. Standard NMJL selected."
- Use Blanks: "Use blanks checkbox. Unchecked. 152 tiles."
- Charleston Mode: "Charleston mode dropdown. Full Charleston selected."
- Dead Wall Size: "Dead wall size. Number input. Current value: 14."
- Joker Pairs: "Allow joker pairs checkbox. Unchecked. Official NMJL rules."
- Scoring Multiplier: "Scoring multiplier dropdown. 1x selected. Standard scoring."

**ARIA Labels:**

- `aria-label="Select rule preset"` on preset dropdown
- `aria-describedby="use-blanks-tooltip"` on blanks checkbox
- `role="group"` on house rules panel
- `aria-live="polite"` on validation messages

### Visual

**High Contrast:**

- Clear labels for all inputs
- Tooltips with high-contrast background
- Validation errors in red with icons
- Preset badges with distinct colors

**Motion:**

- Tooltip appearance respects `prefers-reduced-motion`
- Form transitions are smooth or instant based on settings

## Priority

**HIGH** - Important for customization and flexibility; affects core gameplay

## Story Points / Complexity

**5** - Medium-High Complexity

**Justification:**

- Multiple input types (checkboxes, dropdowns, number inputs)
- Preset system with auto-fill logic
- Validation for conflicting or invalid rules
- Integration with room creation flow
- Backend enforcement during gameplay

**Complexity Factors:**

- 7+ individual rule configurations
- 3 presets with different rule combinations
- Preset switching and custom rule detection
- Validation logic (dead wall range, compatibility)
- Summary display in room list with icons

## Definition of Done

### Core Functionality

- [ ] House rules panel visible in room creation form
- [ ] All rule options displayed with correct defaults
- [ ] Use Blanks checkbox (default: false)
- [ ] Charleston Mode dropdown (default: Full)
- [ ] Dead Wall Size number input (default: 14, range: 10-20)
- [ ] Allow Joker Pairs checkbox (default: false)
- [ ] Scoring Multiplier dropdown (default: 1x)
- [ ] Called Mahjong Payment dropdown (default: Discarder Pays All)

### Preset System

- [ ] Rule Presets dropdown with 3+ presets
- [ ] Standard NMJL preset applies correct rules
- [ ] Beginner Friendly preset applies correct rules
- [ ] Advanced/Tournament preset applies correct rules
- [ ] Manual rule change switches preset to "Custom"
- [ ] Preset change confirmation for custom rules

### Validation

- [ ] Dead wall size validates range (10-20)
- [ ] Invalid values show error messages
- [ ] Create room button disabled if validation fails
- [ ] All inputs have tooltips explaining the rule

### Room Integration

- [ ] House rules sent with CreateRoom command
- [ ] House rules included in RoomCreated event
- [ ] House rules displayed in room list (US-030)
- [ ] House rules shown in room details before joining
- [ ] House rules summary uses icons for quick recognition

### Gameplay Enforcement

- [ ] Use Blanks: 160 tiles dealt if enabled
- [ ] Charleston Mode: phases match configuration
- [ ] Dead Wall Size: correct tiles reserved
- [ ] Joker Pairs: validation enforced
- [ ] Scoring Multiplier: scores calculated correctly
- [ ] Called Mahjong Payment: payments per rule

### Testing

- [ ] Unit tests pass for HouseRulesPanel
- [ ] Integration test passes (create room → rules applied)
- [ ] E2E test passes (configure → create → join → play → verify enforcement)
- [ ] Preset tests pass (all 3 presets apply correctly)
- [ ] Validation tests pass (invalid inputs rejected)

### Accessibility

- [ ] Keyboard navigation works (Tab, Space, Arrow keys)
- [ ] Screen reader announces all inputs and values
- [ ] ARIA labels on all form elements
- [ ] Tooltips are accessible
- [ ] High contrast mode supported

### Documentation & Quality

- [ ] Component specs created (HouseRulesPanel, RulePresetSelector)
- [ ] Test scenarios documented (house-rules-\*.md files)
- [ ] Mock data fixtures created (house rules JSON)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

### User Testing

- [ ] Manually tested all 3 presets
- [ ] Tested custom rule configurations
- [ ] Verified rules are enforced during gameplay
- [ ] Confirmed rule summary displays correctly in room list

## Notes for Implementers

### House Rules Panel Component

```typescript
const HouseRulesPanel: React.FC = () => {
  const [preset, setPreset] = useState<string>('StandardNMJL');
  const [rules, setRules] = useState<HouseRules>(HOUSE_RULE_PRESETS.StandardNMJL);

  const handlePresetChange = (newPreset: string) => {
    if (preset === 'Custom') {
      // Confirm before overwriting custom rules
      if (!confirm('Applying this preset will reset your custom rules. Continue?')) {
        return;
      }
    }
    setPreset(newPreset);
    setRules(HOUSE_RULE_PRESETS[newPreset]);
  };

  const handleRuleChange = (ruleName: keyof HouseRules, value: any) => {
    setRules((prev) => ({ ...prev, [ruleName]: value }));
    if (preset !== 'Custom') {
      setPreset('Custom'); // Auto-switch to custom
    }
  };

  return (
    <Box className="house-rules-panel">
      <Typography variant="h6">House Rules</Typography>

      <RulePresetSelector value={preset} onChange={handlePresetChange} />

      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={rules.use_blanks}
              onChange={(e) => handleRuleChange('use_blanks', e.target.checked)}
            />
          }
          label="Use Blanks (160 tiles)"
        />
        <Tooltip title="Include 8 blank tiles for additional variation (non-standard)">
          <InfoIcon fontSize="small" />
        </Tooltip>
      </FormGroup>

      {/* More rule inputs... */}
    </Box>
  );
};
```text

### Preset Application Logic

```typescript
const applyPreset = (presetName: string): HouseRules => {
  const preset = HOUSE_RULE_PRESETS[presetName];
  if (!preset) {
    console.warn(`Unknown preset: ${presetName}. Falling back to StandardNMJL.`);
    return HOUSE_RULE_PRESETS.StandardNMJL;
  }
  return { ...preset }; // Clone to avoid mutations
};
```text

### Validation Logic

```typescript
const validateHouseRules = (rules: HouseRules): ValidationResult => {
  const errors: string[] = [];

  // Dead wall size range
  if (rules.dead_wall_size < 10 || rules.dead_wall_size > 20) {
    errors.push('Dead wall size must be between 10 and 20');
  }

  // Scoring multiplier must be positive
  if (![1, 2, 5, 10].includes(rules.scoring_multiplier)) {
    errors.push('Invalid scoring multiplier');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
```text

### House Rules Summary for Room List

```typescript
const HouseRulesSummary: React.FC<{ rules: HouseRules }> = ({ rules }) => {
  return (
    <Box className="house-rules-summary">
      {rules.use_blanks && (
        <Tooltip title="Use Blanks (160 tiles)">
          <Chip icon={<TileIcon />} label="Blanks" size="small" />
        </Tooltip>
      )}
      {rules.charleston_mode === 'FirstOnly' && (
        <Chip label="First Charleston Only" size="small" />
      )}
      {rules.allow_joker_pairs && (
        <Tooltip title="Joker pairs allowed">
          <Chip icon={<JokerIcon />} label="Joker Pairs" size="small" />
        </Tooltip>
      )}
      {rules.scoring_multiplier > 1 && (
        <Chip label={`${rules.scoring_multiplier}x Scoring`} size="small" color="primary" />
      )}
    </Box>
  );
};
```text

### Backend Enforcement (Reference)

The backend must enforce house rules throughout the game:

```rust
// crates/mahjong_core/src/rules/validator.rs (pseudo-code)
pub fn validate_hand_with_house_rules(
    hand: &Hand,
    pattern: &Pattern,
    house_rules: &HouseRules
) -> bool {
    // Check joker pairs
    if !house_rules.allow_joker_pairs && hand.has_joker_pair(pattern) {
        return false;
    }

    // Standard validation
    validate_hand(hand, pattern)
}

// crates/mahjong_core/src/scoring.rs
pub fn calculate_final_score(
    base_score: i32,
    house_rules: &HouseRules
) -> i32 {
    base_score * house_rules.scoring_multiplier
}
```text

### Testing House Rules Enforcement

```typescript
// tests/integration/house-rules-enforcement.test.ts
test('joker pairs are allowed when house rule is enabled', async () => {
  const houseRules: HouseRules = {
    ...HOUSE_RULE_PRESETS.StandardNMJL,
    allow_joker_pairs: true,
  };

  const game = await createGameWithRules(houseRules);

  // Create a hand with joker pair
  const hand = [
    { Joker: {} },
    { Joker: {} }, // Pair with jokers
    { Bamboo: 1 },
    { Bamboo: 2 },
    { Bamboo: 3 },
    // ... rest of hand
  ];

  // Attempt to declare Mahjong
  const result = await declareMahjong(hand);

  // Should succeed because joker pairs are allowed
  expect(result.success).toBe(true);
});
```text

This comprehensive configuration system provides flexibility while maintaining usability through presets.

```text

```text
```
