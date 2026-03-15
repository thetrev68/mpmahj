# US-057: Settings — Simplified Hints Switch + Audio Controls

## Status

- State: Completed
- Priority: Medium
- Batch: E
- Implementation Ready: No

## Problem

### S-1 — Hint Verbosity: Simplify to On/Off Switch

`HintSettingsSection` exposes four controls that add noise without adding value:

- A **Hint Verbosity** dropdown (`hint-verbosity-select`) offering Beginner / Intermediate / Expert /
  Disabled levels. Only the Intermediate path (short label, best discard only) is worth keeping.
- A **preview section** (`hint-preview-{Beginner,Intermediate,Expert,Disabled}` buttons plus
  `hint-preview-output`) that lets users audition each verbosity level but serves no practical purpose
  once the choice is collapsed to on/off.
- A **Hint Sound** sub-section (`hint-sound-enabled` checkbox, `hint-sound-type-select`,
  `hint-sound-test-button`) — a separate audio control that duplicates what the master Sound Effects
  setting (S-2) should own.
- A **Reset Hint Settings to Default** button (`hint-settings-reset-button`) whose only purpose is
  recovering from bad verbosity or sound choices that no longer exist.

The current `HintSettings` interface in `src/lib/hintSettings.ts` carries three fields
(`verbosity`, `sound_enabled`, `sound_type`) and a corresponding localStorage schema. All three are
removed by this story.

Additionally, US-056 deferred the theme cleanup of `HintSettingsSection`'s inner controls to this
story, because US-057 replaces them wholesale. The new implementation must use only Shadcn/ui
theme-aware primitives — no hardcoded slate/cyan palette overrides.

### S-2 — Settings Modal: Add Audio Controls

Audio settings exist only as a TODO and a vestigial placeholder panel. `useSoundEffects.ts` already
provides `setVolume` and `setEnabled` on the Sound Effects channel, but there is no settings surface
to expose or persist them. A Background Music channel does not yet exist in the hook.

The `sound-settings-placeholder` panel in `GameBoard.tsx` (testid `sound-settings-placeholder`,
lines 320–330) is the placeholder that G-7 / US-052 removes. US-057's job is to land the real
audio controls inside the Settings modal so there is a non-placeholder home for audio settings
before or alongside that removal.

The Settings modal (`hint-settings-dialog` in `PlayingPhaseOverlays.tsx`, lines 222–244) currently
renders only `HintSettingsSection` and `AnimationSettings`. US-057 adds a third section:
`AudioSettingsSection`.

## Scope

**In scope:**

- Replace `HintSettings` interface with a simplified `{ useHints: boolean }` shape and update
  `src/lib/hintSettings.ts` accordingly (new localStorage schema, migration fallback, updated
  type guards, updated defaults).
- Rebuild `HintSettingsSection.tsx` as a minimal component: one labeled **Use Hints** switch
  (Shadcn/ui `Switch`), no preview buttons, no sound sub-section, no reset button.
- Remove props `onReset` and `onTestSound` from `HintSettingsSectionProps`.
- Remove `HintSoundType` type from `hintSettings.ts` (no longer referenced).
- The new component must use only Shadcn/ui theme-aware primitives — no hardcoded
  dark-palette overrides.
- Simplify `HintPanel.tsx`: remove verbosity-branching logic and hard-code the intermediate
  render path. Do not relocate the panel — relocation is `US-055`.
- Remove the hint-request verbosity chooser from `hint-request-dialog` and hard-code outgoing
  hint requests to Intermediate when hints are enabled.
- Create `src/lib/audioSettings.ts`: persistent audio settings module mirroring the
  `hintSettings.ts` pattern. Stores: `soundEffectsEnabled: boolean`, `soundEffectsVolume: number`,
  `musicEnabled: boolean`, `musicVolume: number`. localStorage key: `'audio_settings'`.
- Create `AudioSettingsSection.tsx`: a new settings section component containing:
  - **Sound Effects** row — mute toggle (`Switch`) + volume slider (`Slider`), wired to
    `soundEffectsEnabled` / `soundEffectsVolume` from the persisted audio settings.
  - **Background Music** row — mute toggle (`Switch`) + volume slider (`Slider`), wired to
    `musicEnabled` / `musicVolume` from the persisted audio settings. These controls are fully
    rendered and persistent but have no live playback effect until background music
    infrastructure is added (see Notes for Implementer).
- Mount `AudioSettingsSection` in the Settings modal (`PlayingPhaseOverlays.tsx`) between
  `HintSettingsSection` and `AnimationSettings`.
- Introduce a single shared client-side source of truth for live sound settings before wiring the
  modal controls. The current codebase uses multiple independent `useSoundEffects` hook instances,
  so this story must first choose and implement one of these approaches:
  - a shared provider/store consumed by all sound-producing features, or
  - a single audio manager passed to all consumers that currently instantiate `useSoundEffects`
    independently.
- Wire Sound Effects controls to that shared live sound state and persist via `audioSettings.ts`.
- Update all call sites that passed the now-removed `HintSettings` fields (`sound_enabled`,
  `sound_type`, `verbosity`) — fix TypeScript errors at all consumers.
- Update all tests that reference removed testids or changed prop shapes.
- Write component tests for `HintSettingsSection` (new shape) and `AudioSettingsSection`.
- Write unit tests for `audioSettings.ts` (load/save/migration).

**Out of scope:**

- Background music playback infrastructure — no background music hook, audio element, or file
  loading. The `musicEnabled` / `musicVolume` settings are persisted but have no live audio effect
  in this story. Wiring to actual music playback is deferred to the TODO.md audio item.
- Removal of `sound-settings-placeholder` from `GameBoard.tsx` — that deletion is owned by
  US-052 (G-7). This story adds real audio controls; US-052 removes the placeholder. If US-052
  has not landed, the implementer should confirm and remove the placeholder as part of this story
  (see dependency note below).
- HintPanel relocation to the right rail — covered by `US-055`.
- Any verbosity-level logic in the AI hint backend / Rust side — the server continues to receive
  an intermediate-level hint request; the client just no longer offers any other mode.
- Theme toggle UI or theme persistence — active theme is controlled by existing Tailwind/Shadcn
  setup; this story only builds new UI that inherits it correctly.
- Hint sound types (Chime / Ping / Bell) — the `HintSoundType` enum is removed. Any hint sound
  that currently plays falls under the Sound Effects master control after this story.
- Animation settings — `AnimationSettings.tsx` is not modified.

## Readiness Blockers

This story is not implementation-ready until the following are resolved:

1. Audio ownership is currently split across multiple independent `useSoundEffects` instances:
   `useGameEvents`, `useHintSystem`, and `PlayerRack` each create their own hook instance. The
   story cannot truthfully satisfy "live audio settings" until it first defines one shared runtime
   audio state model.
2. The hint request dialog still exposes a verbosity select in the current codebase. Because this
   story collapses hints to On/Off, the dialog must be simplified in this story as well. Deferring
   that removal would leave the old verbosity contract visible in the UI.
3. The client/server contract for hint settings changes must be explicit. When `useHints` changes:
   - `useHints: true` must map to `Intermediate`
   - `useHints: false` must map to `Disabled`
   - settings changes should continue to send `SetHintVerbosity` unless a separate server contract
     is introduced
4. If `US-052` has not landed, the placeholder settings button/panel in `GameBoard.tsx` must be
   resolved in this story. Do not ship both the placeholder and the real modal audio controls.

## Acceptance Criteria

### S-1 — Hints Section

- AC-1: The Hints section of the Settings modal renders exactly one interactive control: a
  **Use Hints** toggle switch with a visible label "Use Hints".
- AC-2: No element with `data-testid="hint-verbosity-select"` exists in the DOM when the modal
  is open.
- AC-3: No element with `data-testid` matching `hint-preview-{Beginner,Intermediate,Expert,Disabled}`
  exists in the DOM when the modal is open.
- AC-4: No element with `data-testid="hint-preview-output"` exists in the DOM when the modal
  is open.
- AC-5: No element with `data-testid="hint-sound-enabled"` exists in the DOM when the modal
  is open.
- AC-6: No element with `data-testid="hint-sound-type-select"` exists in the DOM when the modal
  is open.
- AC-7: No element with `data-testid="hint-sound-test-button"` exists in the DOM when the modal
  is open.
- AC-8: No element with `data-testid="hint-settings-reset-button"` exists in the DOM when the
  modal is open.
- AC-9: Toggling **Use Hints** off persists `useHints: false` to localStorage key `'hint_settings'`
  and toggles the switch back to off on the next modal open.
- AC-10: Toggling **Use Hints** on persists `useHints: true` to localStorage and toggles the
  switch back to on on the next modal open.
- AC-11: `HintSettingsSection` has no hardcoded dark-palette class overrides; the `Card` wrapper
  (if retained) inherits Shadcn/ui theme defaults. This resolves the deferred theming work from US-056.
- AC-12: When `useHints` is false, `HintPanel` is not rendered (or renders empty) during gameplay.
  When `useHints` is true, `HintPanel` renders using the intermediate format.
- AC-13: `HintPanel` no longer branches on verbosity level — it renders one fixed intermediate-style
  output. The component no longer branches on Beginner / Intermediate / Expert.
- AC-13a: `hint-request-dialog` no longer renders `hint-request-verbosity-select`; requesting a hint
  always submits `verbosity: 'Intermediate'` when `useHints` is true.
- AC-13b: When `useHints` changes, the client persists the boolean setting locally and sends the
  matching server verbosity (`Intermediate` when on, `Disabled` when off) via the existing
  `SetHintVerbosity` command path.

### S-2 — Audio Section

- AC-14: The Settings modal renders an **Audio** section containing two rows: **Sound Effects** and
  **Background Music**. Each row has a mute/enable toggle switch and a volume slider.
- AC-15: `data-testid="audio-settings-section"` exists in the DOM when the modal is open.
- AC-16: `data-testid="sound-effects-toggle"` and `data-testid="sound-effects-volume"` exist in the
  DOM within the audio section.
- AC-17: `data-testid="music-toggle"` and `data-testid="music-volume"` exist in the DOM within the
  audio section. These controls are enabled (not `disabled`), even though background music
  playback is not yet wired.
- AC-18: Adjusting the Sound Effects toggle updates `useSoundEffects.enabled` immediately
  for the shared live audio state (sounds stop / start playing in the active session) and persists
  to localStorage key `'audio_settings'`.
- AC-19: Adjusting the Sound Effects volume slider updates `useSoundEffects.volume` immediately
  for the shared live audio state and persists to localStorage.
- AC-20: Background Music toggle and volume slider changes are persisted to localStorage. They
  do not produce any audible effect in this story (no background music infrastructure yet).
- AC-21: On `GameBoard` mount, persisted audio settings are loaded from `'audio_settings'`
  localStorage and used as the initial values for the shared live sound-settings model.
  If no stored value exists, defaults are: Sound Effects enabled at volume 0.5; Music enabled
  at volume 0.5.
- AC-22: The Audio section uses only Shadcn/ui theme-aware primitives; no hardcoded dark-palette
  overrides.

### Migration and Data Integrity

- AC-23: If `'hint_settings'` in localStorage contains the old schema (with `verbosity` field),
  `loadHintSettings` migrates it: `verbosity === 'Disabled'` maps to `useHints: false`;
  any other verbosity maps to `useHints: true`. The old keys are discarded.
- AC-24: If `'hint_settings'` is absent or unparseable, `loadHintSettings` returns
  `{ useHints: true }` (default on).
- AC-25: If `'audio_settings'` is absent or unparseable, `loadAudioSettings` returns the
  default: `{ soundEffectsEnabled: true, soundEffectsVolume: 0.5, musicEnabled: true, musicVolume: 0.5 }`.

## Edge Cases

- EC-1: Modal opened, **Use Hints** toggled, modal closed, page reloaded — the switch must
  reflect the persisted value on next open.
- EC-2: Modal opened, Sound Effects volume slider moved, modal closed without any other
  interaction — the new volume must be active and persisted. The previous in-session volume
  must not re-appear.
- EC-3: SSR / `window === undefined` — `loadHintSettings` and `loadAudioSettings` must return
  defaults without throwing, mirroring the existing `hintSettings.ts` SSR guard.
- EC-4: Old localStorage data from a pre-US-057 session must not cause a console error or
  crash — the migration fallback in `loadHintSettings` must silently handle any shape that was
  valid under the old schema.
- EC-5: If the Sound Effects toggle is turned off in the modal, sounds must stop immediately
  in the current session (the shared live sound state must update without requiring a page reload).
- EC-6: `HintPanel` must not flash or render hint content when `useHints` is false, including
  during transitions between Drawing and Discarding sub-stages.
- EC-7: If US-052 has not yet landed, `sound-settings-placeholder` is still present in
  `GameBoard.tsx`. In that case, confirm with the implementer whether to remove it as part of
  this story or treat it as a separate cleanup PR. Do not leave both the placeholder and the
  new Audio section rendering simultaneously.

## Primary Files (Expected)

- `apps/client/src/lib/hintSettings.ts` — replace `HintSettings` interface and all associated
  types (`HintSoundType`, `HintVerbosity` usage), update defaults, add migration logic, update
  `loadHintSettings` / `saveHintSettings`
- `apps/client/src/lib/audioSettings.ts` — create; new persistent audio settings module
  mirroring `hintSettings.ts` pattern
- `apps/client/src/lib/audioSettings.test.ts` — create; unit tests for load/save/migration
- `apps/client/src/components/game/HintSettingsSection.tsx` — rebuild to render only the
  Use Hints switch; remove all verbosity, preview, sound, and reset UI; remove `onReset` and
  `onTestSound` props; use only Shadcn/ui theme-aware classes
- `apps/client/src/components/game/HintSettingsSection.test.tsx` — update to reflect new
  props and single-switch shape; assert removed testids are absent
- `apps/client/src/components/game/AudioSettingsSection.tsx` — create; new component
- `apps/client/src/components/game/AudioSettingsSection.test.tsx` — create; new test file
- `apps/client/src/components/game/HintPanel.tsx` — remove verbosity-branching; hard-code
  intermediate render path
- `apps/client/src/components/game/HintPanel.test.tsx` — update to assert intermediate-only
  render
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx` — add
  `AudioSettingsSection` to Settings modal; update `HintSettingsSection` call site to remove
  `onReset` and `onTestSound` props; remove `hint-settings-status` paragraph if it was
  specific to hint sound test results; simplify `hint-request-dialog` to remove the verbosity
  selector
- `apps/client/src/components/game/GameBoard.tsx` — if `US-052` has not landed, remove the legacy
  `board-settings-button` / `sound-settings-placeholder` surface as part of this story so the new
  modal remains the sole settings home
- Shared audio state owner (new or existing file to be chosen during implementation) — introduce
  the single runtime source of truth required to drive live `useSoundEffects` settings consistently
- Any other file that imports `HintSettings`, `HintSoundType`, or verbosity-specific fields —
  fix TypeScript errors at all consumers

## Notes for Implementer

### Settings source of truth and persistence model

Both hint and audio settings follow the same pattern:

1. A `src/lib/<domain>Settings.ts` module owns the localStorage schema, key constant, default
   values, type guards, and load/save functions.
2. The owning component (`GameBoard`) loads settings on mount and passes live setter callbacks
   into the modal.
3. The modal section component calls the setter and the persist function together on each change.
4. On next mount, the stored value is read back and used as the initial state.

There is no React context, Zustand store, or server persistence for these settings — localStorage
is the sole source of truth. This is consistent with `hintSettings.ts` and `AnimationSettings`.

Exception for this story: localStorage alone is not sufficient for live audio controls because the
current codebase has multiple independent `useSoundEffects` instances. Before wiring the modal,
introduce a single shared in-memory source of truth for sound settings and make the UI write both:
shared live state + localStorage persistence.

### New `HintSettings` schema

```ts
// src/lib/hintSettings.ts (after US-057)
export interface HintSettings {
  useHints: boolean;
}

export const DEFAULT_HINT_SETTINGS: HintSettings = { useHints: true };
const HINT_SETTINGS_STORAGE_KEY = 'hint_settings';
```

Migration from old schema (if `verbosity` key is found):

```ts
// inside loadHintSettings
const parsed = JSON.parse(raw);
if ('verbosity' in parsed) {
  // old schema — migrate
  return { useHints: parsed.verbosity !== 'Disabled' };
}
```

Server contract after migration:

- Persisted `useHints: true` means the client uses and sends `Intermediate`.
- Persisted `useHints: false` means the client uses and sends `Disabled`.
- The dialog no longer lets the user choose another verbosity level.

### Hint sound fate — folded into Sound Effects

The `hint-sound-enabled` checkbox and `hint-sound-type-select` are removed. Any sound that
previously played as a hint notification (`useSoundEffects.playSound('mahjong')` or similar)
continues to play via the existing `useSoundEffects` hook. Users control its volume via the
Sound Effects master slider in the Audio section. There is no per-hint-type sound selection.

This is the complete answer to the promotion note: **hint sound fully folds into the Sound
Effects master control; it does not disappear.**

### `AudioSettingsSection` prop contract

```ts
interface AudioSettingsSectionProps {
  soundEffectsEnabled: boolean;
  soundEffectsVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
  onSoundEffectsEnabledChange: (enabled: boolean) => void;
  onSoundEffectsVolumeChange: (volume: number) => void;
  onMusicEnabledChange: (enabled: boolean) => void;
  onMusicVolumeChange: (volume: number) => void;
}
```

Callbacks in `GameBoard` or the phase container:

```ts
const handleSoundEffectsEnabledChange = (enabled: boolean) => {
  liveAudio.setSoundEffectsEnabled(enabled);
  saveAudioSettings({ ...audioSettings, soundEffectsEnabled: enabled });
};
```

Replace `GameBoard` in the example above with whatever shared owner is chosen for the runtime audio
state. Do not implement this story by updating only one isolated `useSoundEffects` hook instance.

Background Music callbacks save to localStorage but have no live effect this story.

### Background music dependency note

`useSoundEffects.ts` has no background music channel. Background Music controls are rendered
and persisted but produce no audio. The relevant TODO.md item ("Replace beep-tone sound
placeholders with real audio files") is the prerequisite for wiring background music playback.
The settings persistence landed in this story enables that future wiring to simply read the
stored volume/enabled state on mount.

### Dependency on US-052 (G-7)

US-052 removes the `sound-settings-placeholder` panel, its `showSoundSettings` state, and the
`board-settings-button` toggle from `GameBoard.tsx`. US-057 adds real audio controls to the
Settings modal. These two stories can land in either order, but:

- If US-052 has landed: the placeholder is already gone; proceed normally.
- If US-052 has **not** landed: the placeholder is still in `GameBoard.tsx` (lines 320–330) and
  `board-settings-button` still toggles it. Do not ship US-057 without resolving this — having
  both the placeholder and the new Audio section active simultaneously is confusing. Either
  coordinate with the US-052 implementation to remove the placeholder, or remove it as part of
  this PR and note the dependency resolution in the PR description.

### US-056 theme debt resolved by this story

US-056 deferred color cleanup of `HintSettingsSection`'s inner controls (verbosity select,
preview buttons, preview output, sound checkbox, sound select, test button, reset button)
because US-057 would replace them. This story resolves that deferral: the rebuilt
`HintSettingsSection` must contain no hardcoded `bg-slate-*`, `text-slate-*`, `border-slate-*`,
or `bg-cyan-*` class names. Use only Shadcn/ui token classes (`bg-card`, `text-foreground`,
`text-muted-foreground`, `border`, etc.).

The US-056 theme fix for the `Card` wrapper's three overrides (`border-slate-700 bg-slate-950/80
text-slate-100`) is also superseded by the rebuild — no separate theming pass is needed on the
old `Card` wrapper.

### Props cleanup propagation

Removing `onReset` and `onTestSound` from `HintSettingsSectionProps` will cause TypeScript
errors at the `PlayingPhaseOverlays.tsx` call site. Fix that call site — do not leave silently
ignored props in place. Check whether `handleResetHintSettings` and `handleTestHintSound` in
`hintSystem` (wherever that object is assembled) become dead code after prop removal; remove
them if so.

### `HintPanel` verbosity simplification

Currently `HintPanel.tsx` likely branches on `verbosity` to decide how much hint content to
render. After `US-057`, always render the intermediate path. Do not change the component's
positioning or container — that is `US-055`.

This story does not move or restyle the panel. It only removes the user-facing verbosity choice and
aligns the request/display path to a single client-selected verbosity.

### Slider component availability

Check whether `@/components/ui/slider` exists in the project's Shadcn/ui setup before
implementing volume sliders. If it does not exist, add it via the Shadcn CLI
(`npx shadcn-ui@latest add slider`) rather than writing a custom range input.

## Test Plan

- `audioSettings.test.ts` (new):
  - `loadAudioSettings` returns defaults when localStorage is empty.
  - `loadAudioSettings` returns defaults when localStorage value is unparseable JSON.
  - `loadAudioSettings` returns stored values when valid schema is present.
  - `saveAudioSettings` writes the correct JSON to `'audio_settings'`.
  - SSR guard: no-op and no throw when `window` is undefined.
- `HintSettingsSection.test.tsx` (update):
  - Assert `data-testid="use-hints-toggle"` (or the Switch control's testid) is present.
  - Assert `hint-verbosity-select` is absent.
  - Assert `hint-preview-Beginner`, `hint-preview-Intermediate`, `hint-preview-Expert`,
    `hint-preview-Disabled` are all absent.
  - Assert `hint-preview-output` is absent.
  - Assert `hint-sound-enabled` is absent.
  - Assert `hint-sound-type-select` is absent.
  - Assert `hint-sound-test-button` is absent.
  - Assert `hint-settings-reset-button` is absent.
  - Assert no hardcoded `bg-slate-*` or `bg-cyan-*` class on the root element.
  - Assert toggling the switch calls `onChange` with `{ useHints: true }` and `{ useHints: false }`.
- `PlayingPhaseOverlays.test.tsx` (update):
  - Assert `hint-request-verbosity-select` is absent.
  - Assert requesting analysis still works through `hint-request-dialog` with no verbosity picker.
- `AudioSettingsSection.test.tsx` (new):
  - Assert `audio-settings-section` is present.
  - Assert `sound-effects-toggle`, `sound-effects-volume`, `music-toggle`, `music-volume` are
    present.
  - Assert toggling `sound-effects-toggle` calls `onSoundEffectsEnabledChange` with the new value.
  - Assert moving `sound-effects-volume` slider calls `onSoundEffectsVolumeChange`.
  - Assert toggling `music-toggle` calls `onMusicEnabledChange`.
  - Assert no hardcoded dark-palette class on the section root.
- `HintPanel.test.tsx` (update):
  - Assert intermediate-format recommendation text is rendered when a hint is present.
  - Assert panel is absent (or empty) when `useHints` is false.
- Integration tests — update any test that:
  - Passes `onReset` or `onTestSound` to `HintSettingsSection`.
  - Asserts `hint-verbosity-select`, `hint-request-verbosity-select`, preview buttons, or sound
    controls in the settings modal.
  - Passes `verbosity`, `sound_enabled`, or `sound_type` fields in a `HintSettings` fixture.
- Shared-audio-state tests (new or updated, depending on implementation approach):
  - Assert a Sound Effects toggle change updates every live consumer that previously relied on its
    own `useSoundEffects` instance.
- `hintSettings.ts` unit tests (update or add):
  - Migration: old schema with `verbosity: 'Disabled'` → `{ useHints: false }`.
  - Migration: old schema with `verbosity: 'Intermediate'` → `{ useHints: true }`.
  - New schema round-trip: save then load returns same value.

## Verification Commands

```bash
npx vitest run apps/client/src/lib/audioSettings.test.ts
npx vitest run apps/client/src/components/game/HintSettingsSection.test.tsx
npx vitest run apps/client/src/components/game/AudioSettingsSection.test.tsx
npx vitest run apps/client/src/components/game/HintPanel.test.tsx
npx vitest run apps/client/src/features/game/
npx tsc --noEmit
npx prettier --write \
  apps/client/src/lib/hintSettings.ts \
  apps/client/src/lib/audioSettings.ts \
  apps/client/src/components/game/HintSettingsSection.tsx \
  apps/client/src/components/game/AudioSettingsSection.tsx \
  apps/client/src/components/game/HintPanel.tsx \
  apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx \
  apps/client/src/components/game/GameBoard.tsx \
  docs/implementation/frontend/user-stories/US-057-settings-simplified-hints-switch-and-audio-controls.md \
  docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md
```

## Codex Implementation Summary

- Implementation date: 2026-03-14
- Commit hash: `e944a9d`
- Files changed:
  - `apps/client/src/lib/hintSettings.ts`
  - `apps/client/src/lib/hintSettings.test.ts`
  - `apps/client/src/lib/audioSettings.ts`
  - `apps/client/src/lib/audioSettings.test.ts`
  - `apps/client/src/lib/soundEffectsStore.ts`
  - `apps/client/src/hooks/useSoundEffects.ts`
  - `apps/client/src/hooks/useSoundEffects.test.ts`
  - `apps/client/src/hooks/useHintSystem.ts`
  - `apps/client/src/hooks/useHintSystem.test.ts`
  - `apps/client/src/components/game/HintSettingsSection.tsx`
  - `apps/client/src/components/game/HintSettingsSection.test.tsx`
  - `apps/client/src/components/game/AudioSettingsSection.tsx`
  - `apps/client/src/components/game/AudioSettingsSection.test.tsx`
  - `apps/client/src/components/game/HintPanel.tsx`
  - `apps/client/src/components/game/HintPanel.test.tsx`
  - `apps/client/src/components/game/RightRailHintSection.tsx`
  - `apps/client/src/components/game/RightRailHintSection.test.tsx`
  - `apps/client/src/components/game/phases/PlayingPhase.tsx`
  - `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx`
  - `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.test.tsx`
  - `apps/client/src/components/game/phases/playing-phase/usePlayingPhaseViewState.ts`
  - `apps/client/src/features/game/HintRightRail.integration.test.tsx`
- Readiness-blocker resolution summary:
  - Replaced the old `HintSettings` schema with `{ useHints: boolean }` plus old-schema migration.
  - Removed the hint request verbosity selector and fixed the client/server mapping to `Intermediate` when enabled and `Disabled` when disabled.
  - Added a shared live sound-effects state via `soundEffectsStore`, and updated `useSoundEffects` consumers to read/write the same runtime state.
  - Confirmed `US-052` placeholder removal was already landed in the current branch, so no additional `GameBoard` cleanup was required.
- AC/EC coverage summary:
  - Hints settings modal now renders a single `Use Hints` switch with persisted boolean settings.
  - Hint request flow always uses `Intermediate`, and disabling hints clears active hint UI.
  - Hint panel now renders a single intermediate-style path.
  - Audio settings modal now includes sound-effects and background-music controls, with persistence for both and live sound-effects updates.
  - Shared sound-effects changes propagate across live hook consumers in-session.
- Test/verification summary:
  - Passed:
    - `npx vitest run apps/client/src/lib/audioSettings.test.ts`
    - `npx vitest run apps/client/src/lib/hintSettings.test.ts`
    - `npx vitest run apps/client/src/components/game/HintSettingsSection.test.tsx`
    - `npx vitest run apps/client/src/components/game/AudioSettingsSection.test.tsx`
    - `npx vitest run apps/client/src/components/game/HintPanel.test.tsx`
    - `npx vitest run apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.test.tsx`
    - `npx vitest run apps/client/src/hooks/useHintSystem.test.ts`
    - `npx vitest run apps/client/src/hooks/useSoundEffects.test.ts`
    - `npx tsc --noEmit`
    - `cargo fmt --all`
    - `cargo check --workspace`
    - `cargo test --workspace`
    - `cargo clippy --all-targets --all-features`
  - Broader validation:
    - `npx vitest run apps/client/src/features/game/` still fails only in the existing discard-pool layout assertions already called out in story context.
    - `npm run check:all` still fails only because that same full Vitest suite includes the three existing discard-pool layout failures.
- Known follow-ups or deferred items:
  - Background music playback remains deferred; only persistence/UI landed here.
  - The post-commit implementation summary was appended after commit creation and is not included in commit `e944a9d` because the commit was not amended.

## Claude Code Review — 2026-03-14

Each source file listed in the prompt was read directly. Verdicts are based on code quotes, not test pass/fail results.

---

### AC-1 — Exactly one interactive control: "Use Hints" switch

`HintSettingsSection.tsx:11–26`:

```tsx
<Card className="space-y-4 p-4" data-testid="hint-settings-section">
  <h3 className="text-lg font-semibold">Hints</h3>
  <div className="flex items-center justify-between gap-4">
    <Label htmlFor="use-hints-toggle">Use Hints</Label>
    <Switch … data-testid="use-hints-toggle" />
  </div>
</Card>
```

One switch, label text "Use Hints", nothing else. **PASS**

### AC-2 — No `hint-verbosity-select`

`HintSettingsSection.tsx` contains no such element; test asserts absence at line 17. **PASS**

### AC-3 — No `hint-preview-{Beginner,Intermediate,Expert,Disabled}`

None present in rebuilt component; test asserts all four absent at lines 19–22. **PASS**

### AC-4 — No `hint-preview-output`

Not present; test asserts absent at line 23. **PASS**

### AC-5 — No `hint-sound-enabled`

Not present; test asserts absent at line 24. **PASS**

### AC-6 — No `hint-sound-type-select`

Not present; test asserts absent at line 25. **PASS**

### AC-7 — No `hint-sound-test-button`

Not present; test asserts absent at line 26. **PASS**

### AC-8 — No `hint-settings-reset-button`

Not present; test asserts absent at line 27 in the test. **PASS**

### AC-9 / AC-10 — Toggle persists to localStorage

`HintSettingsSection.tsx:20`: `onCheckedChange={(checked) => onChange({ useHints: checked })}`.
`useHintSystem.ts:83–86`:

```ts
const handleHintSettingsChange = useCallback((nextSettings: HintSettings) => {
  setHintSettings(nextSettings);
  saveHintSettings(nextSettings);   // persists immediately
```

`saveHintSettings` writes to `'hint_settings'` key (`hintSettings.ts:44–46`). Tests assert `onChange` called with both `true` and `false` shapes. **PASS**

### AC-11 — No hardcoded dark-palette overrides in HintSettingsSection

`HintSettingsSection.tsx` uses only `Card`, `Label`, `Switch` with `space-y-4 p-4` and `text-lg font-semibold`. No `bg-slate-*`, `text-slate-*`, `border-slate-*`, or `bg-cyan-*` classes anywhere in the file. Test asserts `section.className` does not match the pattern. **PASS**

> US-056 carryover confirmed resolved: `text-slate-300` on the "Preview each verbosity level" paragraph and `text-slate-400` on `option.description` divs are gone because those elements were replaced wholesale. No separate theming pass was needed.

### AC-12 — HintPanel not rendered when `useHints` is false

`RightRailHintSection.tsx:29–34`:

```ts
const hintsDisabled = !hintSettings.useHints;
if (hintsDisabled) {
  body = <p … data-testid="hints-off-notice">Hints are off.</p>;
```

`HintPanel` is rendered only in the `else if (currentHint)` branch (line 79). `handleHintSettingsChange` calls `setCurrentHint(null)` when `!nextSettings.useHints` (`useHintSystem.ts:88–94`), so `currentHint` is always null when hints are off, making the `HintPanel` branch unreachable. **PASS**

### AC-13 — HintPanel renders single fixed intermediate-style output

`HintPanel.tsx` has no verbosity parameter and no branching logic. It renders a fixed layout: recommended discard, tile scores (top 5), utility scores (top 5). No `Beginner`/`Expert` paths exist. **PASS**

### AC-13a — `hint-request-dialog` has no `hint-request-verbosity-select`

`PlayingPhaseOverlays.tsx:150–167`: the dialog contains only a `<Button data-testid="request-analysis-button">`. No verbosity select. **PASS**

### AC-13b — `useHints` change sends matching `SetHintVerbosity` command

`useHintSystem.ts:96–103`:

```ts
sendCommand({
  SetHintVerbosity: {
    player: gameState.your_seat,
    verbosity: nextSettings.useHints ? ACTIVE_HINT_VERBOSITY : 'Disabled',
  },
});
```

`ACTIVE_HINT_VERBOSITY = 'Intermediate'` (line 11). Maps `true → Intermediate`, `false → Disabled`. **PASS**

### AC-14 — Settings modal renders Audio section with two rows, each with toggle + slider

`PlayingPhaseOverlays.tsx:182–191` mounts `<AudioSettingsSection …/>` between `HintSettingsSection` and `AnimationSettings`. `AudioSettingsSection.tsx:31–71` renders Sound Effects (toggle + Slider) and Background Music (toggle + Slider). **PASS**

### AC-15 — `data-testid="audio-settings-section"`

`AudioSettingsSection.tsx:28`: `<Card … data-testid="audio-settings-section">`. **PASS**

### AC-16 — `sound-effects-toggle` and `sound-effects-volume` exist

`AudioSettingsSection.tsx:38`: `data-testid="sound-effects-toggle"`. Line 48: `data-testid="sound-effects-volume"`. **PASS**

### AC-17 — `music-toggle` and `music-volume` exist, not disabled

`AudioSettingsSection.tsx:59`: `data-testid="music-toggle"`. Line 69: `data-testid="music-volume"`. Neither `Switch` nor `Slider` has a `disabled` prop. **PASS**

### AC-18 — Sound Effects toggle updates shared live audio state immediately and persists

`PlayingPhase.tsx:224–230`:

```ts
const handleSoundEffectsEnabledChange = useCallback((enabled: boolean) => {
  setSoundEffectsEnabled(enabled);   // writes to useSoundEffectsStore
  persistAudioSettings({ ...audioSettings, soundEffectsEnabled: enabled });
}, …);
```

`useSoundEffects.ts:97–100` reads `enabled` and `volume` from `useSoundEffectsStore`, so all hook instances share the same runtime state. `playSound` checks `if (!enabled …) return` immediately. **PASS**

### AC-19 — Sound Effects volume slider updates shared live state and persists

`PlayingPhase.tsx:232–238`:

```ts
const handleSoundEffectsVolumeChange = useCallback((volume: number) => {
  setSoundEffectsVolume(volume);
  persistAudioSettings({ ...audioSettings, soundEffectsVolume: volume });
}, …);
```

Store is updated and settings persisted on each change. **PASS**

### AC-20 — Background Music controls persist, no live effect

`PlayingPhase.tsx:240–252`: `handleMusicEnabledChange` and `handleMusicVolumeChange` call only `persistAudioSettings`; no call to any live audio API. **PASS**

### AC-21 — Persisted audio settings loaded on mount as initial values for shared live state

`PlayingPhase.tsx:87`: `useState<AudioSettings>(() => loadAudioSettings())`.
Lines 209–217:

```ts
useEffect(() => {
  setSoundEffectsEnabled(audioSettings.soundEffectsEnabled);
  setSoundEffectsVolume(audioSettings.soundEffectsVolume);
}, [audioSettings.soundEffectsEnabled, audioSettings.soundEffectsVolume, …]);
```

`soundEffectsStore.ts:4` also initializes the Zustand store from `loadAudioSettings()` at module load. Defaults per spec: `soundEffectsEnabled: true`, `soundEffectsVolume: 0.5`, `musicEnabled: true`, `musicVolume: 0.5` (`audioSettings.ts:10–15`). **PASS**

### AC-22 — Audio section uses only theme-aware primitives

`AudioSettingsSection.tsx` imports only `Card`, `Label`, `Slider`, `Switch` from Shadcn/ui. Utility classes are `space-y-4 p-4`, `text-lg font-semibold`, `space-y-2`, `flex items-center justify-between gap-4`. No `bg-slate-*`, `text-slate-*`, `border-slate-*`, or `bg-cyan-*`. Test asserts `section.className` does not match the pattern. **PASS**

### AC-23 — Migration of old `verbosity` schema

`hintSettings.ts:28–35`:

```ts
if ('verbosity' in parsed && typeof (parsed as {verbosity?: unknown}).verbosity === 'string') {
  return { useHints: (parsed as {verbosity: string}).verbosity !== 'Disabled' };
}
```

`hintSettings.test.ts` tests `verbosity: 'Disabled'` → `{ useHints: false }` and `verbosity: 'Intermediate'` → `{ useHints: true }`. **PASS**

### AC-24 — Defaults when absent or unparseable

`hintSettings.ts:23`: `if (!raw) return DEFAULT_HINT_SETTINGS;`. Lines 37–39: `catch { return DEFAULT_HINT_SETTINGS; }`. `DEFAULT_HINT_SETTINGS = { useHints: true }` (line 7–9). **PASS**

### AC-25 — Audio defaults when absent or unparseable

`audioSettings.ts:38–39`: `if (!raw) return DEFAULT_AUDIO_SETTINGS;`. Lines 42–44: `catch { return DEFAULT_AUDIO_SETTINGS; }`. `DEFAULT_AUDIO_SETTINGS = { soundEffectsEnabled: true, soundEffectsVolume: 0.5, musicEnabled: true, musicVolume: 0.5 }` (lines 10–15). **PASS**

### EC-1 — Persisted value survives modal close/page reload

`handleHintSettingsChange` calls `saveHintSettings` on every toggle; `loadHintSettings` is the lazy initializer for `hintSettings` state. Round-trip is immediate and verified by `hintSettings.test.ts`. **PASS**

### EC-2 — Volume change persists without other interaction

`handleSoundEffectsVolumeChange` calls `persistAudioSettings` immediately on every slider value change. **PASS**

### EC-3 — SSR guard

`hintSettings.ts:20`: `if (typeof window === 'undefined') return DEFAULT_HINT_SETTINGS;`.
`audioSettings.ts:36`: same guard. Both `loadAudioSettings` and `saveAudioSettings` guard identically. Tested in both test files. **PASS**

### EC-4 — Old localStorage data no crash

Migration branch handles any shape with a `verbosity` string key. `catch` block returns defaults for unparseable JSON. Test exercises the full old schema (`verbosity`, `sound_enabled`, `sound_type`) without error. **PASS**

### EC-5 — Sound stops immediately when toggle turned off

`handleSoundEffectsEnabledChange` calls `setSoundEffectsEnabled(false)` which writes to the Zustand store. All `useSoundEffects` instances read `enabled` from the store. `playSound` at line 151 of `useSoundEffects.ts`: `if (!enabled || volume === 0) return;` — sounds halt on the next call in the same session. **PASS**

### EC-6 — HintPanel does not flash when `useHints` is false

`handleHintSettingsChange` sets `currentHint(null)` synchronously when disabling hints. `RightRailHintSection` renders the "Hints are off." path unconditionally when `hintsDisabled`, before any `currentHint` check. **PASS**

### EC-7 — `sound-settings-placeholder` not present alongside new Audio section

Grep of `GameBoard.tsx` for `sound-settings-placeholder`, `board-settings-button`, and `showSoundSettings` returned no matches. The placeholder was already removed (Codex summary notes US-052 landed). **PASS**

---

### Non-AC Observations

1. `hint-settings-status` paragraph (`PlayingPhaseOverlays.tsx:194–198`) uses `text-cyan-300` — a hardcoded dark-palette colour. This element is outside `HintSettingsSection` and `AudioSettingsSection`, so it does not violate AC-11 or AC-22 as written. The spec also allowed its retention when used for non-sound-test purposes (it now shows "Hints enabled / Hints disabled" messages). Worth noting for a future theme pass.

2. `HintPanel.tsx:25` retains `border-cyan-400/50 bg-slate-950/95 text-slate-100` — hardcoded dark-palette classes. The spec scope explicitly deferred HintPanel repositioning and restyling to US-055, and US-057's HintPanel requirement (AC-13) covers only verbosity-branching removal. No AC violation.

3. `RightRailHintSection.tsx` uses hardcoded `text-slate-*` classes throughout. Not in AC-11 or AC-22 scope; this component was newly created by Codex as part of the US-055 right-rail placement. A theme pass for this component is a future follow-up.

4. `usePlayingPhaseViewState.ts` `overlaysHintSystem` memo does not include audio settings fields. They are merged in at the `PlayingPhase.tsx` call site (lines 314–320) via object spread. This is a workable pattern but means the view-state hook's return type is incomplete for the overlays contract. No functional defect.

---

### Summary Table

| AC/EC | Verdict | Notes |
|-------|---------|-------|
| AC-1 | PASS | Single "Use Hints" Switch with label |
| AC-2 | PASS | `hint-verbosity-select` absent |
| AC-3 | PASS | All preview testids absent |
| AC-4 | PASS | `hint-preview-output` absent |
| AC-5 | PASS | `hint-sound-enabled` absent |
| AC-6 | PASS | `hint-sound-type-select` absent |
| AC-7 | PASS | `hint-sound-test-button` absent |
| AC-8 | PASS | `hint-settings-reset-button` absent |
| AC-9 | PASS | Persists `useHints: false` |
| AC-10 | PASS | Persists `useHints: true` |
| AC-11 | PASS | No slate/cyan overrides in HintSettingsSection |
| AC-12 | PASS | HintPanel not rendered when `useHints` is false |
| AC-13 | PASS | No verbosity branching in HintPanel |
| AC-13a | PASS | No `hint-request-verbosity-select` in dialog |
| AC-13b | PASS | `SetHintVerbosity` sends Intermediate/Disabled |
| AC-14 | PASS | Audio section with two rows rendered |
| AC-15 | PASS | `audio-settings-section` testid present |
| AC-16 | PASS | `sound-effects-toggle` and `sound-effects-volume` present |
| AC-17 | PASS | `music-toggle` and `music-volume` present, not disabled |
| AC-18 | PASS | Toggle updates store + persists immediately |
| AC-19 | PASS | Slider updates store + persists immediately |
| AC-20 | PASS | Music controls persist only, no live audio |
| AC-21 | PASS | Loaded from localStorage on mount; defaults correct |
| AC-22 | PASS | No hardcoded dark-palette classes in AudioSettingsSection |
| AC-23 | PASS | Old verbosity schema migrated correctly |
| AC-24 | PASS | Absent/unparseable → `{ useHints: true }` |
| AC-25 | PASS | Absent/unparseable → default audio settings |
| EC-1 | PASS | Persists across modal close/reload |
| EC-2 | PASS | Volume persists without other interaction |
| EC-3 | PASS | SSR guards in both modules |
| EC-4 | PASS | Old schema no crash, migration handles any valid old shape |
| EC-5 | PASS | Sound stops immediately via shared store |
| EC-6 | PASS | No HintPanel flash when hints disabled |
| EC-7 | PASS | Placeholder removed; only new Audio section active |

### Overall Verdict: PASS

All 25 acceptance criteria and 7 edge cases pass. Three hardcoded dark-palette classes remain in out-of-scope components (`HintPanel`, `RightRailHintSection`, `hint-settings-status` paragraph); none violate a specific AC. The US-056 theme carryover is fully resolved by the wholesale rebuild of `HintSettingsSection`.
