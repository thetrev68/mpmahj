# US-028: Adjust Hint Verbosity

## Story

**As a** player
**I want** to configure my default hint verbosity level in settings
**So that** hints automatically display at my preferred detail level (Brief, Detailed, or Expert) without selecting each time

## Acceptance Criteria

### AC-1: Settings Panel Access

**Given** I am in the game lobby or during a game
**When** I open the Settings menu
**Then** a "Hints" section appears with hint configuration options
**And** the section shows current hint settings

### AC-2: Verbosity Level Selection

**Given** the Settings panel is open
**When** I view the "Hint Verbosity" dropdown
**Then** three options are available: "Brief", "Detailed", "Expert"
**And** the current selection is highlighted
**And** each option has a description:

- **Brief**: "Quick suggestion (1-2 sentences)"
- **Detailed**: "Pattern analysis with alternatives (paragraph)"
- **Expert**: "Comprehensive evaluation with probabilities (full report)"

### AC-3: Change Verbosity Setting

**Given** my current verbosity is "Brief"
**When** I select "Expert" from the dropdown
**Then** the setting immediately updates to "Expert"
**And** a confirmation message appears: "Hint verbosity set to Expert"
**And** the setting is saved to local storage or user profile

### AC-4: Preview Examples

**Given** the Settings panel is open
**When** I hover over or click "Preview" next to each verbosity level
**Then** an example hint appears showing what that level looks like:

- **Brief Preview**: "Discard 7 Bamboo. Keeps options for Consecutive Run."
- **Detailed Preview**: Full paragraph with pattern list
- **Expert Preview**: Complete analysis with EV and probabilities

### AC-5: Default Verbosity Applied

**Given** I set my default verbosity to "Detailed"
**When** I request a hint during a game (US-027)
**Then** the verbosity selector defaults to "Detailed" (pre-selected)
**And** I can still change it for that specific hint request if desired

### AC-6: Verbosity Persistence

**Given** I set my verbosity to "Expert" and close settings
**When** I exit the game and return later
**Then** my hint verbosity setting is still "Expert"
**And** the setting persists across sessions (local storage)

### AC-7: Sound Settings for Hints

**Given** the Settings panel is open
**When** I view hint audio options
**Then** I can toggle:

- **Hint Sound**: On/Off (default: On)
- **Sound Type**: Chime / Ping / Bell
  **And** a "Test" button plays the selected sound

### AC-8: Reset to Defaults

**Given** I have customized hint settings
**When** I click "Reset Hint Settings to Default"
**Then** a confirmation dialog appears: "Reset to default hint settings?"
**And** after confirming:

- Verbosity: "Brief"
- Sound: On
- All settings restored to defaults

## Technical Details

### Settings Storage

````typescript
interface HintSettings {
  verbosity: 'Brief' | 'Detailed' | 'Expert';
  sound_enabled: boolean;
  sound_type: 'Chime' | 'Ping' | 'Bell';
}

// Stored in local storage
localStorage.setItem('hint_settings', JSON.stringify(hintSettings));
```text

### Backend References

No backend commands needed - settings are client-side preferences that affect `RequestHint` command parameters (US-027).

## Components Involved

- **`<SettingsPanel>`** - Main settings UI
- **`<HintSettingsSection>`** - Hint configuration section
- **`<VerbosityDropdown>`** - Select verbosity level
- **`<HintPreview>`** - Show example for each level
- **`<SoundSelector>`** - Choose hint sound

**Component Specs:**

- `component-specs/presentational/SettingsPanel.md`
- `component-specs/presentational/HintSettingsSection.md` (NEW)
- `component-specs/presentational/HintPreview.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/hint-verbosity-change.md`** - Change default verbosity
- **`tests/test-scenarios/hint-verbosity-persistence.md`** - Verify settings persist
- **`tests/test-scenarios/hint-preview.md`** - Preview each verbosity level

## Edge Cases

### EC-1: First-Time User

**Given** I am a new user with no saved hint settings
**When** I open settings
**Then** verbosity defaults to "Brief"
**And** sound defaults to "On"

### EC-2: Invalid Setting in Storage

**Given** local storage contains invalid verbosity
**When** settings load
**Then** defaults to "Brief"
**And** warning logged

## Related User Stories

- **US-027**: Request Hints - Uses verbosity setting

## Accessibility Considerations

### Keyboard

- **Tab**: Navigate options
- **Arrow Keys**: Change selection
- **Enter**: Confirm

### Screen Reader

- "Hint verbosity: Brief. Quick suggestion format."
- "Hint verbosity changed to Expert."

## Priority

**LOW** - Configuration option

## Story Points

**2** - Low complexity

## Definition of Done

- [ ] Settings panel has "Hints" section
- [ ] Verbosity dropdown
- [ ] Preview for each level
- [ ] Saved to local storage
- [ ] Default applied in requests
- [ ] Persists across sessions
- [ ] Sound settings
- [ ] Reset button
- [ ] Tests pass

## Notes

Simple local storage management, no backend integration needed.

```text

```text
````
