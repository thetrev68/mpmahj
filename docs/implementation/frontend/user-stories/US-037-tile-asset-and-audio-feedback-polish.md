# US-037: Tile Asset and Audio Feedback Polish

## Status

- State: Not Started
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
