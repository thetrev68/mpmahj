# useActionQueue Hook

## Purpose

Orchestrates sequential animations for game events. Ensures tile movements, Charleston passes, meld formations, and other animations complete in order without visual conflicts.

## User Stories

- US-001: Smooth tile drawing animations
- US-002: Charleston passing animations
- All game events requiring visual feedback

## API

```typescript
interface UseActionQueueReturn {
  /** Add an animation action to the queue */
  enqueue: (action: AnimationAction) => Promise<void>;

  /** Clear all pending animations */
  clear: () => void;

  /** Skip current animation and proceed to next */
  skip: () => void;

  /** Current queue length */
  queueLength: number;

  /** Whether an animation is currently playing */
  isAnimating: boolean;
}

interface AnimationAction {
  /** Unique identifier */
  id: string;

  /** Animation type */
  type: AnimationType;

  /** Animation data */
  data: any;

  /** Duration in milliseconds */
  duration: number;

  /** Whether this animation can be skipped */
  skippable?: boolean;
}

enum AnimationType {
  TileMove = 'TileMove', // Tile sliding (draw/discard)
  CharlestonPass = 'CharlestonPass', // Tile passing between players
  MeldForm = 'MeldForm', // Tiles moving to exposed area
  DiceRoll = 'DiceRoll', // Dice animation
  WinCelebration = 'WinCelebration', // Win effects
}

function useActionQueue(): UseActionQueueReturn;
```

## Behavior

### Queue Processing

- Actions execute sequentially (FIFO)
- Each action waits for previous to complete
- Resolves promise when animation finishes
- Auto-advances to next action

### Speed Integration

Uses `useAnimationSettings()` to respect user preferences:

- Speed multiplier applied to all durations
- If speed = "off", skip animations (instant state changes)

### Skipping

- User clicks/presses Escape → skip current animation
- Only if `skippable === true`
- Critical animations (Mahjong win) not skippable

## Implementation Notes

### Queue State

```typescript
const [queue, setQueue] = useState<AnimationAction[]>([]);
const [isAnimating, setIsAnimating] = useState(false);
const processingRef = useRef(false);
```

### Enqueue

```typescript
const enqueue = useCallback((action: AnimationAction) => {
  return new Promise<void>((resolve) => {
    setQueue((prev) => [...prev, { ...action, resolve }]);
  });
}, []);
```

### Process Queue

```typescript
useEffect(() => {
  if (processingRef.current || queue.length === 0) return;

  processingRef.current = true;
  const action = queue[0];
  setIsAnimating(true);

  const { speed } = useAnimationSettings.getState();
  const duration = speed === 'off' ? 0 : action.duration * SPEED_MULTIPLIERS[speed];

  executeAnimation(action, duration).then(() => {
    setQueue((prev) => prev.slice(1));
    setIsAnimating(false);
    processingRef.current = false;
    action.resolve?.();
  });
}, [queue]);
```

### Execute Animation

```typescript
const executeAnimation = (action: AnimationAction, duration: number): Promise<void> => {
  switch (action.type) {
    case 'TileMove':
      return animateTileMove(action.data, duration);
    case 'CharlestonPass':
      return animateCharlestonPass(action.data, duration);
    case 'MeldForm':
      return animateMeldFormation(action.data, duration);
    default:
      return Promise.resolve();
  }
};
```

## Example Usage

```typescript
import { useActionQueue } from '@/hooks/useActionQueue';

function GameBoard() {
  const { enqueue } = useActionQueue();

  useEffect(() => {
    const handleEvent = async (event: GameEvent) => {
      if (event.TileDiscarded) {
        await enqueue({
          id: crypto.randomUUID(),
          type: 'TileMove',
          data: { tile: event.tile, from: 'hand', to: 'discard' },
          duration: 300,
          skippable: true,
        });
      }
    };

    gameStore.subscribe(handleEvent);
  }, [enqueue]);

  return <div>...</div>;
}
```

## Edge Cases

1. **Rapid events:** Queue buffers, plays in order
2. **Speed changes mid-animation:** Apply to next animation
3. **Component unmount:** Clear queue, cancel current
4. **Animation disabled:** Skip immediately (duration = 0)

---

**Estimated Complexity**: Medium (~120 lines)
**Dependencies**: `useAnimationSettings` hook
**Phase**: Phase 1 - MVP Core
