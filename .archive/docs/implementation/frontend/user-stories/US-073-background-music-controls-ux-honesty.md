# US-073: Background Music Controls UX Honesty

## Status

- State: Implemented
- Priority: Medium
- Batch: I
- Implementation Ready: Yes

## Problem

US-057 added Background Music toggle and volume slider to the Audio section of the Settings
modal. Both controls are fully interactive — they accept input, persist to localStorage, and
give no indication that they have no effect. Background music playback infrastructure does not
exist (no audio element, no music files, no music hook). A user who toggles "Background Music"
on and adjusts the volume will reasonably believe music should be playing and conclude the app
is broken when nothing happens.

The US-057 spec explicitly deferred music playback: "Background Music controls are fully
rendered and persistent but have no live playback effect until background music infrastructure
is added." However, no UX mitigation was specified for the interim period. The controls look
identical to the working Sound Effects controls, creating a false expectation.

## Scope

**In scope:**

- Add a visual indicator to the Background Music row in `AudioSettingsSection` communicating
  that music playback is not yet available (e.g., "(Coming soon)" label, or a subtle badge).
- Alternatively, disable the music controls with a tooltip explaining music is not yet
  available, while preserving the persisted settings for future use.
- Ensure the chosen approach does not require changes when music infrastructure is added later
  (the indicator should be easy to remove).

**Out of scope:**

- Implementing background music playback.
- Loading or playing any music files.
- Changing the `AudioSettings` interface or persistence model.
- Removing the music controls entirely (they serve as forward-compatible persistence).

## Acceptance Criteria

- AC-1: The Background Music row in the Settings modal has a visible indicator (text, badge,
  or tooltip) communicating that music playback is not yet available.
- AC-2: The indicator does not prevent the controls from persisting settings to localStorage
  (settings are still saved for future use).
- AC-3: The Sound Effects row has no such indicator (it is fully functional).
- AC-4: The indicator is implemented in a way that is trivially removable (a single prop or
  condition) when music infrastructure lands.
- AC-5: `AudioSettingsSection.test.tsx` asserts the indicator is present.

## Edge Cases

- EC-1: If the controls are disabled rather than annotated, the persisted values must still
  load correctly on next modal open (disabled controls show the saved value, not defaults).

## Primary Files (Expected)

- `apps/client/src/components/game/AudioSettingsSection.tsx` — add indicator
- `apps/client/src/components/game/AudioSettingsSection.test.tsx` — assert indicator

## Notes for Implementer

Simplest approach: add `(Coming soon)` text after the "Background Music" label:

```tsx
<Label htmlFor="music-toggle">
  Background Music <span className="text-xs text-muted-foreground">(Coming soon)</span>
</Label>
```

This requires no prop changes, no conditional logic, and is a one-line removal when music
lands.

## Test Plan

- `AudioSettingsSection.test.tsx`:
  - Assert "Coming soon" text (or equivalent indicator) is visible in the music row.
  - Assert no such text in the sound effects row.
  - Assert music toggle and slider still fire their onChange callbacks.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/AudioSettingsSection.test.tsx
npx tsc --noEmit
```

## Implementation Summary

- **State**: Complete
- **Date**: 2026-03-20

### Changes

- **`AudioSettingsSection.tsx`**: Added `(Coming soon)` span inside the Background Music label,
  styled with `text-xs text-muted-foreground`. No props, interface, or persistence changes.
- **`AudioSettingsSection.test.tsx`**: Added test asserting "(Coming soon)" text is present in
  the music row and absent from the Sound Effects row. Existing callback tests already cover
  AC-2 (controls still fire onChange).

### AC Walkthrough

| AC   | Status | Evidence                                                                        |
| ---- | ------ | ------------------------------------------------------------------------------- |
| AC-1 | Done   | "(Coming soon)" span rendered in Background Music label                         |
| AC-2 | Done   | No persistence changes; toggle/slider callbacks unchanged (existing tests pass) |
| AC-3 | Done   | Sound Effects label has no indicator (new test asserts this)                    |
| AC-4 | Done   | Single `<span>` removal when music lands — no props or conditions involved      |
| AC-5 | Done   | New test in `AudioSettingsSection.test.tsx`                                     |

### Test Summary

- **File**: `AudioSettingsSection.test.tsx` — 4 tests, all passing
- **tsc**: Clean, no errors
