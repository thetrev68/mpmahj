# US-037: Tile Asset and Audio Feedback Polish

## Status

- State: Not Started
- Priority: Medium
- Batch: C

## Problem

Non-joker tiles still show black outline artifacts, and tile selection lacks click sound feedback.

## Scope

- Update tile SVG assets to remove black outlines from non-joker tiles.
- Add tile-select click sound effect.

## Acceptance Criteria

- AC-1: Non-joker tiles render without black outline artifact.
- AC-2: Selecting a tile plays a click sound once per selection interaction.
- AC-3: Audio respects existing global sound settings/mute behavior.

## Edge Cases

- EC-1: Rapid multi-select does not stack distorted audio.
- EC-2: No sound triggered for disabled/non-interactive tiles.

## Primary Files (Expected)

- `apps/client/src/assets/tiles/*.svg`
- `apps/client/src/components/game/Tile.tsx`
- `apps/client/src/hooks/useSoundEffects.ts`

## Test Plan

- Add/update `Tile.test.tsx` for audio callback trigger behavior.
- Add/update `useSoundEffects.test.ts` for click effect path.
