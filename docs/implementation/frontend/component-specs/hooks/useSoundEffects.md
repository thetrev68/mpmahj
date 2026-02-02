# useSoundEffects Hook

## Purpose

Manages game sound effects playback for tile actions, Charleston passes, calls, and wins. Respects user volume and mute preferences.

## User Stories

- US-001: Dice roll sound
- US-002: Charleston pass sound
- US-010: Tile discard sound
- US-011: Call sounds (Pung, Kong, Mahjong)
- US-018: Win celebration sound

## API

```typescript
interface UseSoundEffectsReturn {
  /** Play a sound effect by name */
  play: (sound: SoundEffect) => void;

  /** Volume control (0.0 to 1.0) */
  volume: number;
  setVolume: (volume: number) => void;

  /** Mute toggle */
  isMuted: boolean;
  toggleMute: () => void;

  /** Preload all sounds */
  preload: () => Promise<void>;
}

type SoundEffect =
  | 'tile_discard'
  | 'tile_draw'
  | 'charleston_pass'
  | 'call_pung'
  | 'call_kong'
  | 'call_mahjong'
  | 'dice_roll'
  | 'win_celebration'
  | 'button_click'
  | 'error';

function useSoundEffects(): UseSoundEffectsReturn;
```

## Behavior

### Sound Playback

- Sounds play immediately when `play(sound)` called
- Respects `volume` setting (0.0-1.0)
- No-op if `isMuted === true`
- Overlapping sounds allowed (polyphonic)

### Volume Persistence

- Save volume preference to `localStorage`
- Load on hook initialization
- Default: 0.7 (70%)

### Preloading

- Call `preload()` on app mount
- Loads all audio files into memory
- Prevents delays on first play

## Implementation Notes

### Audio Files

Store in `public/sounds/`:

```text
sounds/
  ├── tile_discard.mp3
  ├── tile_draw.mp3
  ├── charleston_pass.mp3
  ├── call_pung.mp3
  ├── call_kong.mp3
  ├── call_mahjong.mp3
  ├── dice_roll.mp3
  ├── win_celebration.mp3
  ├── button_click.mp3
  └── error.mp3
```

### Hook Implementation

```typescript
const SOUND_FILES: Record<SoundEffect, string> = {
  tile_discard: '/sounds/tile_discard.mp3',
  tile_draw: '/sounds/tile_draw.mp3',
  charleston_pass: '/sounds/charleston_pass.mp3',
  call_pung: '/sounds/call_pung.mp3',
  call_kong: '/sounds/call_kong.mp3',
  call_mahjong: '/sounds/call_mahjong.mp3',
  dice_roll: '/sounds/dice_roll.mp3',
  win_celebration: '/sounds/win_celebration.mp3',
  button_click: '/sounds/button_click.mp3',
  error: '/sounds/error.mp3',
};

function useSoundEffects(): UseSoundEffectsReturn {
  const [volume, setVolume] = useLocalStorage('sound_volume', 0.7);
  const [isMuted, setIsMuted] = useLocalStorage('sound_muted', false);
  const audioCache = useRef<Map<SoundEffect, HTMLAudioElement>>(new Map());

  const play = useCallback(
    (sound: SoundEffect) => {
      if (isMuted) return;

      const audio = audioCache.current.get(sound);
      if (!audio) return;

      audio.volume = volume;
      audio.currentTime = 0; // Restart if already playing
      audio.play().catch((err) => {
        console.warn(`Failed to play sound: ${sound}`, err);
      });
    },
    [volume, isMuted]
  );

  const preload = useCallback(async () => {
    Object.entries(SOUND_FILES).forEach(([sound, path]) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audioCache.current.set(sound as SoundEffect, audio);
    });
  }, []);

  useEffect(() => {
    preload();
  }, [preload]);

  return {
    play,
    volume,
    setVolume,
    isMuted,
    toggleMute: () => setIsMuted((prev) => !prev),
    preload,
  };
}
```

### Event Integration

Listen for backend events and play sounds:

```typescript
function GameBoard() {
  const { play } = useSoundEffects();

  useEffect(() => {
    const unsubscribe = gameStore.subscribe((event: Event) => {
      if (event.Public?.TileDiscarded) play('tile_discard');
      if (event.Private?.TileDrawnPrivate) play('tile_draw');
      if (event.Public?.CallResolved) play('call_pung');
      if (event.Public?.PhaseChanged && 'Scoring' in event.Public.PhaseChanged.phase)
        play('win_celebration');
    });

    return () => unsubscribe();
  }, [play]);
}
```

## Accessibility

**Respect User Preferences**:

- Check `prefers-reduced-motion` → auto-mute if set
- Provide mute toggle in UI
- Volume slider accessible via keyboard

**ARIA**:

- Volume slider: `aria-label="Sound volume"`
- Mute button: `aria-label="Mute sounds"` `aria-pressed="{isMuted}"`

## Example Usage

```typescript
function App() {
  const { play, volume, setVolume, isMuted, toggleMute } = useSoundEffects();

  return (
    <div>
      {/* Settings */}
      <Button onClick={toggleMute}>
        {isMuted ? 'Unmute' : 'Mute'}
      </Button>

      <Slider
        value={[volume * 100]}
        onValueChange={([v]) => setVolume(v / 100)}
        aria-label="Sound volume"
      />

      {/* Game actions */}
      <Button onClick={() => play('button_click')}>
        Click Me
      </Button>
    </div>
  );
}
```

## Edge Cases

1. **Audio not supported**: Gracefully fail, no errors
2. **Sound file missing**: Log warning, continue
3. **Autoplay blocked**: User must interact first (browser policy)
4. **Multiple rapid plays**: Audio restarts, doesn't stack

## Testing Considerations

- `play()` calls audio.play()
- Muted sounds don't play
- Volume setting persists
- Preload loads all files
- Missing file doesn't crash

---

**Estimated Complexity**: Simple (~80 lines)
**Dependencies**: None (native Audio API)
**Phase**: Phase 2 - Basic Gameplay

```text

```
