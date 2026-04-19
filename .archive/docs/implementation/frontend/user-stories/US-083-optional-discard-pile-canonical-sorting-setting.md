# US-083: Optional Discard-Pile Canonical Sorting Setting

## Status

- State: Completed
- Priority: Medium
- Batch: L
- Implementation Ready: Yes

## Problem

Some players want the discard pile grouped for scan speed, while others rely on chronological
order to track table history. The current client supports only chronological discard rendering.

The product direction is not to force one preference. Discard sorting should be optional, live in
Settings, and persist across sessions.

## Scope

**In scope:**

- Add an optional setting in the Playing-phase settings modal to enable canonical discard-pile
  sorting.
- Persist the discard-sorting preference in local storage with the rest of the game settings.
- When discard sorting is disabled, preserve current discard chronology behavior.
- When discard sorting is enabled, display the discard pile using the canonical comparator defined
  by `US-082`.
- Re-sort the discard pile after every new discard when the setting is enabled.
- Preserve existing discard render metadata and highlight behavior while changing only the display
  order.
- Apply the selected discard-sort preference during reconnect/remount and history playback.

**Out of scope:**

- Defining the canonical comparator itself. That is owned by `US-082`.
- Player-rack sorting behavior.
- Rack group-spacing behavior.
- Rewriting discard highlight semantics unless needed to preserve current behavior under visual
  resort.
- Reordering server history or mutating the underlying discard array contract.

## Acceptance Criteria

- AC-1: By default, the discard pile continues to render in chronological order.
- AC-2: The settings modal exposes a persisted toggle for discard-pile auto-sort.
- AC-3: When the discard-sort setting is enabled, the discard pile re-sorts after every new
  discard using the canonical comparator from `US-082`.
- AC-4: When the discard-sort setting is disabled, the discard pile preserves chronological order
  after every new discard.
- AC-5: Reconnect/remount restores the stored discard-sort preference.
- AC-6: History playback/read-only rendering follows the selected discard-sort preference for
  discard presentation.
- AC-7: Existing discard highlight and metadata behavior remains correct under both chronological
  and sorted display modes.

## Edge Cases

- EC-1: Enabling discard sorting after discards already exist immediately re-renders the current
  pile in canonical order.
- EC-2: Disabling discard sorting after it was enabled returns the discard pile to chronological
  rendering rather than leaving it stuck in grouped order.
- EC-3: Empty discard pile behaves identically regardless of setting value.
- EC-4: Duplicate discard values still preserve the component's expected highlight behavior under
  sorted display.
- EC-5: Historical/read-only rendering follows the setting without mutating the underlying move
  history order.

## Primary Files (Expected)

- `apps/client/src/components/game/DiscardPool.tsx`
- `apps/client/src/components/game/HintSettingsSection.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx`
- `apps/client/src/lib/hintSettings.ts`
- `apps/client/src/components/game/DiscardPool.test.tsx`
- `apps/client/src/components/game/HintSettingsSection.test.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.test.tsx`
- `apps/client/src/lib/hintSettings.test.ts`

## Notes for Implementer

This story assumes `US-082` has already established the canonical tile comparator. Reuse that
comparator rather than redefining discard-specific ordering logic.

Discard sorting must remain optional because chronological scan remains valuable to some players.
The recommended default for this story is `off` so the existing discard behavior remains the
baseline unless the player explicitly opts into grouped discard viewing.

If the existing `HintSettings` model becomes too awkward once a discard-sort preference is added,
it is acceptable to rename/split the underlying settings model as long as the visible behavior and
the current settings modal UX remain coherent. Do not regress the existing hints/audio/animation
controls.

## Test Plan

- Update `DiscardPool.test.tsx`:
  - assert chronological order remains when discard sorting is off
  - assert canonical sorted order appears when discard sorting is on
  - assert re-sort occurs after each appended discard when enabled
- Update settings tests:
  - settings modal renders discard-sort toggle
  - toggle changes persisted settings
  - stored setting restores on reload
- Add or update gameplay integration tests under `apps/client/src/features/game/`:
  - discard pile respects settings toggle
  - reconnect/remount restores the selected presentation mode
  - history playback respects the selected presentation mode

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/DiscardPool.test.tsx apps/client/src/components/game/HintSettingsSection.test.tsx apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.test.tsx apps/client/src/lib/hintSettings.test.ts
npx vitest run apps/client/src/features/game/
npx tsc --noEmit
npx prettier --write docs/implementation/frontend/user-stories/US-083-optional-discard-pile-canonical-sorting-setting.md docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md
```
