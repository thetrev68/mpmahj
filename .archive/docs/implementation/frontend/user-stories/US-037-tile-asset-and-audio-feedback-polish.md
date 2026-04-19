# US-037: Tile Asset and Audio Feedback Polish

## Status

- State: Complete
- Priority: Medium
- Batch: C

## Problem

Non-joker tiles still show black outline artifacts, and tile selection lacks click sound feedback.

## Scope

- Update tile SVG assets to remove black stroke/outline artifacts from non-joker tiles.
- Add a tile-select click sound effect that fires when a tile transitions from unselected to selected.

## Acceptance Criteria

- AC-1: Non-joker tile SVGs render without a visible black stroke or outline artifact.
- AC-2: Selecting a tile (transitioning it to `state="selected"`) plays a click sound exactly once per selection interaction.
- AC-3: Audio respects the existing global mute/sound settings (i.e. the sound does not play when audio is muted).

## Edge Cases

- EC-1: Rapid multi-select (clicking several tiles quickly) does not stack or distort audio — play one sound per click, do not queue overlapping instances.
- EC-2: Clicking a tile with `state="disabled"` or no `onClick` handler does not trigger a sound.

## Primary Files (Expected)

- `apps/client/src/assets/tiles/*.svg` — remove `stroke` or `stroke-width` attributes from non-joker tile SVGs
- `apps/client/src/components/game/Tile.tsx` — call sound effect hook when tile transitions to selected state
- `apps/client/src/hooks/useSoundEffects.ts` — add `'tile-select'` sound key and its audio path

## Notes for Implementer

- **SVG artifact fix**: Open a representative non-joker SVG file and look for `stroke="black"` or `stroke-width` on root or `<path>` elements. Remove or set to `stroke="none"`. Joker tiles intentionally keep their outline styling.
- **`useSoundEffects.ts`**: The hook already exists with a `playSound(sound: SoundName)` API. Add `'tile-select'` to the `SoundName` union type and map it to an audio file path. If the audio file does not exist yet, create a short placeholder (or use an existing click sound file from `apps/client/src/assets/audio/` if present).
- **Where to call**: In `Tile.tsx`, the `onClick` prop is called when a tile is clicked. Add a `onPlaySelectSound?: () => void` prop, or accept the `useSoundEffects` instance directly — keep it simple. The parent (e.g. `PlayerRack`, `useTileSelection`) can pass the sound callback.
- **Avoiding stacked audio**: Use `Audio.currentTime = 0` before `play()` to restart rather than queue a new instance, or create a fresh `Audio` object each time for fire-and-forget.
- **Mute check**: `useSoundEffects.ts` already has a mute/sound-enabled guard — route tile-select through the same guard.

## Test Plan

- Update `Tile.test.tsx`: assert that clicking a tile with an `onPlaySelectSound` prop calls it; assert that clicking a disabled tile does not call it.
- Update `useSoundEffects.test.ts`: assert `'tile-select'` is a valid sound key and maps to an audio path.
- Manual verification: inspect a non-joker SVG in the browser to confirm no black outline is visible.

---

## Codex Implementation Summary

Implemented `US-037` end-to-end with TDD slices and committed.

### AC/EC Walkthrough

1. `AC-1` non-joker outline artifact fix: updated runtime tile assets (`*_clear.svg`, excluding joker) by setting the outer frame path to `fill="none"` so black frame artifacts are removed.
   - Files: [tiles folder](/c:/Repos/mpmahj/apps/client/src/assets/tiles)
2. `AC-2` play once on select transition: `Tile` now triggers `onPlaySelectSound` only when click/keyboard interaction returns a successful new selection (`onClick` returns `true`).
   - Files: [Tile.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/Tile.tsx), [PlayerRack.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/PlayerRack.tsx)
3. `AC-3` respects mute/sound settings: selection sound routes through `useSoundEffects` guard (`enabled`/`volume`).
   - File: [useSoundEffects.ts](/c:/Repos/mpmahj/apps/client/src/hooks/useSoundEffects.ts)
4. `EC-1` rapid multi-select overlap: `tile-select` reuses one `Audio` instance and resets `currentTime = 0` before play.
5. `EC-2` disabled/no-click no sound: guarded in `Tile` interaction path; tested.

### Test Updates

- Updated: [Tile.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/Tile.test.tsx)
- Updated: [useSoundEffects.test.ts](/c:/Repos/mpmahj/apps/client/src/hooks/useSoundEffects.test.ts)
- Test file count touched for this story: `2`

### Other Added/Updated

- Added placeholder asset: [tile-select.wav](/c:/Repos/mpmahj/apps/client/src/assets/audio/tile-select.wav)
- Minor type alignment: [PlayingPhasePresentation.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx)

### Verification Run

- `npx vitest run` ✅
- `npx tsc --noEmit` ✅
- `npx prettier --write .` ✅
- `npm run check:all` ✅

### Deferred Items

- No generated binding changes under `src/types/bindings/generated/`
- No edits to non-runtime tile asset set (`*.svg` without `_clear`)
- Unrelated existing file remains unstaged: `docs/implementation/frontend/user-stories/US-040-animation-policy-simplification.md`

### Commit

- `85c0c07`
- `feat(game): US-037 tile asset and audio feedback polish`

---

## Claude Validation

## Evaluation: US-037 — Tile Asset and Audio Feedback Polish

### AC-1: SVG Artifact Fix — PASS

The outer frame `path68` in the non-joker `_clear.svg` files now has `fill="none"` and no `stroke` attributes. A grep confirms no `stroke="black"` or `stroke-width` remains in `1B_clear.svg`. The approach (hiding the frame via `fill="none"` rather than adding a `stroke="none"`) is correct for these SVGs since the artifact was a filled rectangle, not a stroked one. Jokers are explicitly excluded per the deferred items note.

### AC-2: Play Once on Selection Transition — PASS with minor note

`Tile.tsx:89-92` — `onPlaySelectSound` fires only when `onClick` returns `true`, which maps to `result?.status === 'selected'` in `PlayerRack.tsx:107`. This means:

- Deselection → `handleTileClick` returns `false` → no sound. ✅
- Failed click (e.g. max reached) → `result?.status !== 'selected'` → no sound. ✅

**Minor note**: Ghost tiles in charleston mode have a redundant outer `div onClick` (line 183) that also calls `handleTileClick` directly, creating a double-click-handler. The sound path is still gated correctly through the `Tile` component, but the outer `div` click is a pre-existing structural oddity not introduced by this story.

### AC-3: Respects Mute/Sound Settings — PASS

`useSoundEffects.ts:132` guards `if (!enabled || volume === 0) return;` before any audio playback. The `PlayerRack` calls `useSoundEffects()` at `PlayerRack.tsx:90` and routes `tile-select` through that instance.

### EC-1: Rapid Multi-Select Overlap — PASS

`useSoundEffects.ts:137-148` reuses one `Audio` instance per sound key and resets `currentTime = 0` before `play()`. The test at `useSoundEffects.test.ts:189-231` explicitly verifies only one `Audio` constructor is called on two rapid plays, and `currentTime` is reset.

### EC-2: Disabled/No-Click No Sound — PASS

`Tile.tsx:87-88` returns early when `!isClickable` or (`isDisabled && !allowDisabledClick`), so neither `onClick` nor `onPlaySelectSound` can fire.

### Test Coverage

| Spec requirement                             | Test location                   | Status |
| -------------------------------------------- | ------------------------------- | ------ |
| `onPlaySelectSound` called on selection      | Tile.test.tsx:279-291           | ✅     |
| `onPlaySelectSound` not called when disabled | Tile.test.tsx:293-310           | ✅     |
| `'tile-select'` is valid SoundEffect type    | useSoundEffects.test.ts:162-183 | ✅     |
| `'tile-select'` maps to audio path           | useSoundEffects.test.ts:185-187 | ✅     |
| EC-1 overlap: reuse + reset                  | useSoundEffects.test.ts:189-231 | ✅     |
| Mute guard                                   | useSoundEffects.test.ts:233-253 | ✅     |

**Gap**: No test asserts that `onPlaySelectSound` is NOT called when `onClick` returns `false` (only the disabled case is tested). The gap is low risk since the logic is a simple boolean guard, but the Test Plan's AC-2 criterion ("once per selection") could be tighter.

### Overall: COMPLETE

All ACs and ECs are faithfully implemented and tested. No blocking defects found. The ghost-tile double-handler and the missing "onClick returns false → no sound" test are minor observations, not failures.
