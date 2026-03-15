# US-069: Audio Settings State Integrity and AudioContext Consolidation

## Status

- State: Proposed
- Priority: Critical
- Batch: F
- Implementation Ready: Yes

## Problem

### P-1 — Stale Closure Data Loss in Audio Settings Callbacks

`PlayingPhase.tsx` lines 228–256 define four audio settings callbacks
(`handleSoundEffectsEnabledChange`, `handleSoundEffectsVolumeChange`,
`handleMusicEnabledChange`, `handleMusicVolumeChange`). Each callback spreads the current
`audioSettings` state object and overrides one field:

```ts
const handleSoundEffectsEnabledChange = useCallback(
  (enabled: boolean) => {
    setSoundEffectsEnabled(enabled);
    persistAudioSettings({ ...audioSettings, soundEffectsEnabled: enabled });
  },
  [audioSettings, persistAudioSettings, setSoundEffectsEnabled]
);
```

When a user makes two rapid changes in the same React batch (e.g., drags the volume slider
then immediately toggles the enabled switch), the second callback captures a stale
`audioSettings` that does not include the first change. The second `persistAudioSettings` call
overwrites localStorage with stale data, silently reverting the first change.

**Reproduction:**

1. Open Settings modal.
2. Drag Sound Effects volume slider from 0.5 to 0.2.
3. Immediately (before React re-renders) toggle Sound Effects OFF.
4. Close and reopen Settings modal — volume is back at 0.5, not 0.2.

The root cause is that `useCallback` closures capture the state value at callback-creation
time. Even though `audioSettings` is in the dependency array, React batches state updates, so
the second callback fires with the pre-update value.

### P-2 — Multiple AudioContext Resource Leak

Each `useSoundEffects()` hook instance lazily creates its own `AudioContext` via the `useEffect`
at `useSoundEffects.ts:121–147`. The codebase has four independent hook instances:

1. `useGameEvents.ts:116` — game event side effects
2. `useHintSystem.ts:55` — hint arrival notification
3. `PlayerRack.tsx:107` — tile selection click sound
4. `PlayingPhase.tsx:89` — settings wiring

Each creates a separate `AudioContext` on first user interaction. `AudioContext` is a
heavyweight browser resource with per-page limits (Safari allows ~6). Four simultaneous
contexts waste resources and risk hitting the browser cap on low-powered devices.

US-057 correctly centralized `enabled`/`volume` state in a Zustand store
(`soundEffectsStore.ts`), but the `AudioContext` resource was not centralized.

## Scope

**In scope:**

- Fix the stale-closure bug by replacing `{ ...audioSettings, field: value }` spread pattern
  with functional state updaters that read the latest state at update time.
- Consolidate `AudioContext` creation into a single shared instance (either in
  `soundEffectsStore.ts` or a new `audioContextManager.ts` singleton).
- Update `useSoundEffects` hook to consume the shared `AudioContext` instead of creating its
  own.
- Remove the per-instance `AudioContext` creation `useEffect` and its cleanup from the hook.
- Update tests to reflect the single-context model.

**Out of scope:**

- Background music playback infrastructure (still deferred).
- Replacing synthesized beep tones with real audio files.
- Changing the `useSoundEffects` public API (`playSound`, `setVolume`, `setEnabled`).

## Acceptance Criteria

### P-1 — Stale Closure Fix

- AC-1: Rapid sequential changes to different audio settings fields (e.g., volume then enabled)
  within the same React render cycle are both persisted correctly to localStorage.
- AC-2: The `persistAudioSettings` call path uses a functional updater pattern
  (`setAudioSettings(prev => ...)`) so each change reads the latest state, not a captured
  closure value.
- AC-3: Unit test: change volume, then immediately change enabled in the same `act()` block —
  both changes survive in persisted settings.

### P-2 — AudioContext Consolidation

- AC-4: Only one `AudioContext` instance exists at any time, regardless of how many
  `useSoundEffects()` hook instances are active.
- AC-5: The shared `AudioContext` is lazily initialized on first user interaction (preserving
  browser autoplay policy compliance).
- AC-6: The shared `AudioContext` is properly closed when the last consumer unmounts or the app
  unloads.
- AC-7: All four existing `useSoundEffects()` call sites continue to function without API
  changes.
- AC-8: `useSoundEffects.test.ts` includes a test confirming that two concurrent hook instances
  share the same `AudioContext`.

## Edge Cases

- EC-1: If a user opens the settings modal, changes volume, closes the modal, reopens it, and
  toggles enabled — the previously saved volume must not revert.
- EC-2: If the browser rejects `AudioContext` creation (e.g., resource limit), `playSound`
  must not throw — it should silently no-op and log a warning.
- EC-3: SSR guard: `AudioContext` creation must not run when `window` is undefined.

## Primary Files (Expected)

- `apps/client/src/components/game/phases/PlayingPhase.tsx` — fix stale closure in audio
  callbacks
- `apps/client/src/hooks/useSoundEffects.ts` — remove per-instance AudioContext; consume
  shared instance
- `apps/client/src/lib/soundEffectsStore.ts` — optionally host the shared AudioContext ref
- `apps/client/src/hooks/useSoundEffects.test.ts` — add shared-context and stale-closure tests

## Notes for Implementer

### Stale closure fix pattern

Replace:

```ts
const handleSoundEffectsEnabledChange = useCallback(
  (enabled: boolean) => {
    setSoundEffectsEnabled(enabled);
    persistAudioSettings({ ...audioSettings, soundEffectsEnabled: enabled });
  },
  [audioSettings, persistAudioSettings, setSoundEffectsEnabled]
);
```

With:

```ts
const handleSoundEffectsEnabledChange = useCallback(
  (enabled: boolean) => {
    setSoundEffectsEnabled(enabled);
    setAudioSettings((prev) => {
      const next = { ...prev, soundEffectsEnabled: enabled };
      saveAudioSettings(next);
      return next;
    });
  },
  [setSoundEffectsEnabled]
);
```

This eliminates the `audioSettings` closure dependency entirely.

### localStorage QuotaExceededError

While fixing the persist path, wrap `localStorage.setItem` calls in `saveAudioSettings` and
`saveHintSettings` with `try/catch` for `QuotaExceededError`. Currently both functions call
`setItem` without error handling. On devices with full localStorage or strict-quota browsers,
this throws and silently fails to persist. The fix is trivial: catch and `console.warn`.

### AudioContext consolidation approach

The simplest approach: add an `audioContext` ref to `soundEffectsStore.ts` (or a standalone
module-level singleton). The `useSoundEffects` hook reads from this shared ref instead of
maintaining its own `audioContextRef`. Lazy initialization on first `playSound` call (inside
the user-interaction-gated path) ensures browser policy compliance.

## Test Plan

- `useSoundEffects.test.ts`:
  - Two concurrent hook instances share one AudioContext.
  - AudioContext is lazily created on first playSound call.
  - AudioContext creation failure does not throw.
- `PlayingPhase` or new `audioSettingsCallbacks.test.ts`:
  - Rapid volume + enabled change in same `act()` block: both persisted.
  - Rapid music enabled + music volume change: both persisted.

## Verification Commands

```bash
npx vitest run apps/client/src/hooks/useSoundEffects.test.ts
npx vitest run apps/client/src/components/game/phases/
npx tsc --noEmit
```
