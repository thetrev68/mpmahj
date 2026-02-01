# HouseRulesPanel

## Purpose

Settings panel for configuring house rules: Charleston options, joker rules, scoring modifiers, and optional variants. Used during room creation or game setup.

## User Stories

- US-034: House rules configuration
- US-029: Room creation with rules preset

## Props

```typescript
interface HouseRulesPanelProps {
  /** Current rules (from room or defaults) */
  rules: HouseRules;

  /** Callback when rules change */
  onChange: (rules: HouseRules) => void;

  /** Read-only mode (view rules, can't edit) */
  readOnly?: boolean;

  /** Preset selector */
  showPresets?: boolean;
}

interface HouseRules {
  // Charleston rules
  charleston_enabled: boolean;
  charleston_mandatory: boolean;
  second_charleston_vote: boolean;
  courtesy_pass_allowed: boolean;

  // Joker rules
  joker_pairs_allowed: boolean;
  single_joker_pairs_allowed: boolean;

  // Scoring
  jokerless_bonus: number; // Default: 10
  concealed_bonus: number; // Default: 10

  // Optional variants
  allow_undo: boolean;
  wall_game_ends_on_empty: boolean;
}
```

## Behavior

### Rule Categories

Organized into collapsible sections:

1. **Charleston Rules**: Enable/disable, voting, courtesy
2. **Joker Rules**: Pair restrictions, exchange rules
3. **Scoring Modifiers**: Bonuses for jokerless, concealed
4. **Game Variants**: Undo, wall end condition

### Presets

If `showPresets === true`:

- Dropdown with common rule sets:
  - "NMJL Standard" (default)
  - "Beginner Friendly" (no Charleston vote, longer timers)
  - "Expert" (all restrictions enabled)
  - "Custom" (user-defined)

### Validation

- Some rules conflict (e.g., Charleston disabled → no vote)
- Show warnings for conflicting selections
- Disable dependent options

### Read-Only Mode

When `readOnly === true`:

- Display rules as read-only cards
- No inputs, just labels and values
- Used in lobby to show room rules

## Visual Requirements

### Layout

```
┌──────────────────────────────────────┐
│ House Rules            [Preset: ▼]   │
│                                      │
│ ▶ Charleston Rules                   │
│   ☑ Charleston enabled               │
│   ☑ Mandatory first Charleston       │
│   ☑ Second Charleston vote           │
│   ☑ Courtesy pass allowed            │
│                                      │
│ ▶ Joker Rules                        │
│   ☐ Allow joker pairs                │
│   ☐ Allow single joker pairs         │
│                                      │
│ ▶ Scoring Bonuses                    │
│   Jokerless: [10] points             │
│   Concealed: [10] points             │
│                                      │
│ ▶ Game Variants                      │
│   ☑ Allow undo requests              │
│   ☑ End game on empty wall           │
└──────────────────────────────────────┘
```

### Collapsible Sections

- Click header to expand/collapse
- Show summary of enabled rules when collapsed

## Related Components

- **Used by**: `<CreateRoomForm>`, Settings screen
- **Uses**: shadcn/ui `<Checkbox>`, `<Input>`, `<Select>`, `<Accordion>`

## Implementation Notes

### Rule Defaults

```typescript
const DEFAULT_RULES: HouseRules = {
  charleston_enabled: true,
  charleston_mandatory: true,
  second_charleston_vote: true,
  courtesy_pass_allowed: true,
  joker_pairs_allowed: false,
  single_joker_pairs_allowed: false,
  jokerless_bonus: 10,
  concealed_bonus: 10,
  allow_undo: false,
  wall_game_ends_on_empty: true,
};
```

### Presets

```typescript
const RULE_PRESETS: Record<string, HouseRules> = {
  nmjl_standard: DEFAULT_RULES,
  beginner: {
    ...DEFAULT_RULES,
    second_charleston_vote: false,
    allow_undo: true,
  },
  expert: {
    ...DEFAULT_RULES,
    jokerless_bonus: 20,
    concealed_bonus: 20,
    allow_undo: false,
  },
};
```

### Validation

```typescript
function validateRules(rules: HouseRules): string[] {
  const warnings: string[] = [];

  if (!rules.charleston_enabled && rules.second_charleston_vote) {
    warnings.push('Second Charleston vote requires Charleston to be enabled');
  }

  if (rules.single_joker_pairs_allowed && !rules.joker_pairs_allowed) {
    warnings.push('Single joker pairs require joker pairs to be allowed');
  }

  return warnings;
}
```

### Server Integration

```typescript
// Send rules to backend when creating room
interface CreateRoomCommand {
  name: string;
  house_rules: HouseRules;
}

const handleCreateRoom = () => {
  sendCommand({
    CreateRoom: {
      name: roomName,
      house_rules: currentRules,
    },
  });
};
```

## Accessibility

**ARIA**:

- Accordion: `role="region"` with proper labels
- Checkboxes: `aria-label` for each rule
- Number inputs: `aria-label="Jokerless bonus points"`

**Keyboard**:

- Tab through all inputs
- Space toggles checkboxes
- Arrow keys in selects

## Example Usage

```tsx
// Room creation (editable)
<HouseRulesPanel
  rules={roomRules}
  onChange={setRoomRules}
  showPresets={true}
/>

// Room lobby (read-only)
<HouseRulesPanel
  rules={currentRoomRules}
  readOnly={true}
/>
```

## Edge Cases

1. **Invalid preset**: Fall back to default
2. **Conflicting rules**: Show warning, allow save anyway (server validates)
3. **Bonus values out of range**: Clamp to 0-50
4. **Mid-game changes**: Not allowed (rules locked after game starts)

## Testing Considerations

- Preset selection applies correct rules
- Rule changes trigger `onChange`
- Validation shows warnings
- Read-only mode disables inputs
- Conflicting rules highlighted

---

**Estimated Complexity**: Medium (~120 lines)
**Dependencies**: shadcn/ui Accordion, Checkbox, Input, Select
**Phase**: Phase 5 - Winning & Settings
