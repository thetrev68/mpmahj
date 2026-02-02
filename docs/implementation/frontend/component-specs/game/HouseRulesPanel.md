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
  ruleset: Ruleset; // card_year, timer_mode, blank_exchange_enabled, call_window_seconds, charleston_timer_seconds
  analysis_enabled: boolean;
  concealed_bonus_enabled: boolean;
  dealer_bonus_enabled: boolean;
}
```text

## Behavior

### Rule Categories

Organized into collapsible sections:

1. **Ruleset**: card year, timers, blank exchange, timer visibility
2. **Analysis**: always-on analysis enabled
3. **Bonuses**: concealed/dealer bonus toggles

### Preset Selection

If `showPresets === true`:

- Dropdown with common rule sets (card year + timer mode + blank exchange)

### Rule Validation

- Validate only the fields that exist in `Ruleset`/`HouseRules`

### Read-Only Mode

When `readOnly === true`:

- Display rules as read-only cards
- No inputs, just labels and values
- Used in lobby to show room rules

## Visual Requirements

### Layout

```text
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
```text

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
  ruleset: {
    card_year: 2025,
    timer_mode: 'Visible',
    blank_exchange_enabled: false,
    call_window_seconds: 5,
    charleston_timer_seconds: 60,
  },
  analysis_enabled: true,
  concealed_bonus_enabled: false,
  dealer_bonus_enabled: false,
};
```text

### Presets

```typescript
const RULE_PRESETS: Record<string, HouseRules> = {
  nmjl_standard: DEFAULT_RULES,
  fast_visible: {
    ...DEFAULT_RULES,
    ruleset: {
      ...DEFAULT_RULES.ruleset,
      call_window_seconds: 3,
      charleston_timer_seconds: 45,
    },
  },
};
```text

### Validation

```typescript
function validateRules(rules: HouseRules): string[] {
  const warnings: string[] = [];
  return warnings;
}
```text

### Server Integration

```typescript
// Send rules to backend when creating room
// House rules are part of the game state snapshot after room creation.
```text

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
```text

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
```
