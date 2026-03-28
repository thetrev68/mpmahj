# Audio Assets

This directory holds frontend sound-effect files served at `/assets/audio/*`.

## Current behavior

- `tile-select.wav` is already wired and used directly.
- All other sound effects currently fall back to synthesized tones in
  [useSoundEffects.ts](C:/Repos/mpmahj/apps/client/src/hooks/useSoundEffects.ts)
  until a file path is added to `SOUND_EFFECT_AUDIO_PATHS`.

## Supported sound effect keys

These are the sound names the frontend can play today:

- `tile-select`
- `tile-draw`
- `tile-discard`
- `tile-call`
- `tile-place`
- `charleston-pass`
- `mahjong`
- `mahjong-win`
- `game-draw`
- `dead-hand-penalty`
- `undo-whoosh`
- `wall-break`
- `dice-roll`

## Recommended filenames

Use `.wav` unless there is a strong reason to prefer `.mp3`.

- `tile-select.wav`
- `tile-draw.wav`
- `tile-discard.wav`
- `tile-call.wav`
- `tile-place.wav`
- `charleston-pass.wav`
- `mahjong.wav`
- `mahjong-win.wav`
- `game-draw.wav`
- `dead-hand-penalty.wav`
- `undo-whoosh.wav`
- `wall-break.wav`
- `dice-roll.wav`

## Wiring new files

1. Add the file to this directory.
2. Add the matching entry to `SOUND_EFFECT_AUDIO_PATHS` in
   [useSoundEffects.ts](C:/Repos/mpmahj/apps/client/src/hooks/useSoundEffects.ts).
3. Keep the filename aligned with the sound key unless there is a deliberate reason not to.

Example:

```ts
export const SOUND_EFFECT_AUDIO_PATHS: Partial<Record<SoundEffect, string>> = {
  'tile-select': '/assets/audio/tile-select.wav',
  'tile-draw': '/assets/audio/tile-draw.wav',
};
```
