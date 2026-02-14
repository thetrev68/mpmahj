# useTimer Hook

## Purpose

Manages countdown timers for Charleston phases, call windows, and vote deadlines. Syncs with server time and provides visual urgency feedback.

## User Stories

- US-002: Charleston timer (60s default)
- US-005: Charleston vote timer
- US-011: Call window timer (5s)
- US-036: Configurable timer settings

## API

```typescript
interface UseTimerOptions {
  /** Initial duration in seconds */
  duration: number;

  /** Auto-start on mount */
  autoStart?: boolean;

  /** Callback when timer expires */
  onExpire?: () => void;

  /** Callback on each second tick */
  onTick?: (secondsRemaining: number) => void;

  /** Server sync timestamp (optional) */
  serverEndTime?: Date;
}

interface UseTimerReturn {
  /** Current seconds remaining */
  secondsRemaining: number;

  /** Timer state */
  isRunning: boolean;
  isExpired: boolean;

  /** Progress (0.0 to 1.0) */
  progress: number;

  /** Urgency level for visual feedback */
  urgency: 'calm' | 'warning' | 'critical';

  /** Controls */
  start: () => void;
  pause: () => void;
  reset: () => void;
  restart: () => void;
}

function useTimer(options: UseTimerOptions): UseTimerReturn;
```

## Behavior

### Countdown Logic

- Starts at `duration` seconds
- Counts down to 0
- Calls `onTick` each second
- Calls `onExpire` when reaching 0
- Stops at 0 (doesn't go negative)

### Server Sync

If `serverEndTime` provided:

- Calculate remaining time from server timestamp
- Prevents client-side timer drift
- More reliable for critical timers (call window)

### Urgency Levels

Based on remaining time:

- **calm**: > 50% remaining (green)
- **warning**: 25-50% remaining (yellow)
- **critical**: < 25% remaining (red)

## Implementation Notes

### Basic Timer Implementation

```typescript
function useTimer({
  duration,
  autoStart = false,
  onExpire,
  onTick,
  serverEndTime,
}: UseTimerOptions): UseTimerReturn {
  const [secondsRemaining, setSecondsRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<number | null>(null);

  // Calculate remaining from server time if provided
  useEffect(() => {
    if (!serverEndTime) return;

    const now = new Date();
    const remaining = Math.max(0, (serverEndTime.getTime() - now.getTime()) / 1000);
    setSecondsRemaining(Math.ceil(remaining));
  }, [serverEndTime]);

  // Countdown interval
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        const next = Math.max(0, prev - 1);

        // Callbacks
        onTick?.(next);
        if (next === 0) {
          setIsRunning(false);
          onExpire?.();
        }

        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, onTick, onExpire]);

  // Urgency calculation
  const progress = secondsRemaining / duration;
  const urgency = progress > 0.5 ? 'calm' : progress > 0.25 ? 'warning' : 'critical';

  return {
    secondsRemaining,
    isRunning,
    isExpired: secondsRemaining === 0,
    progress,
    urgency,
    start: () => setIsRunning(true),
    pause: () => setIsRunning(false),
    reset: () => {
      setSecondsRemaining(duration);
      setIsRunning(false);
    },
    restart: () => {
      setSecondsRemaining(duration);
      setIsRunning(true);
    },
  };
}
```

### Server Time Sync

```typescript
// Backend sends end time for critical timers
interface TimerStartEvent {
  timer_type: 'charleston' | 'call_window' | 'vote';
  duration_ms: number;
  end_time: string; // ISO 8601 timestamp
}

const handleTimerStart = (event: TimerStartEvent) => {
  const endTime = new Date(event.end_time);
  const duration = event.duration_ms / 1000;

  setTimerConfig({
    duration,
    serverEndTime: endTime,
    autoStart: true,
  });
};
```

## Example Usage

### Charleston Timer

```typescript
function CharlestonPhase() {
  const timer = useTimer({
    duration: 60,
    autoStart: true,
    onExpire: () => {
      // Auto-submit selected tiles
      handleCharlestonPass();
    },
    onTick: (seconds) => {
      if (seconds === 10) {
        toast.warning('10 seconds remaining!');
      }
    },
  });

  return (
    <div>
      <CharlestonTimer
        secondsRemaining={timer.secondsRemaining}
        urgency={timer.urgency}
      />
    </div>
  );
}
```

### Call Window Timer

```typescript
function CallWindow({ serverEndTime }) {
  const timer = useTimer({
    duration: 5,
    serverEndTime, // Server sync for accuracy
    autoStart: true,
    onExpire: () => {
      // Auto-pass if no action taken
      handlePass();
    },
  });

  return (
    <CallWindowPanel
      secondsRemaining={timer.secondsRemaining}
      urgency={timer.urgency}
    />
  );
}
```

## Edge Cases

1. **Server time mismatch**: Client clock != server clock → use server time
2. **Timer expires mid-action**: Server is source of truth, client shows visual only
3. **Page visibility**: Pause when tab hidden (optional)
4. **Rapid restarts**: Clear previous interval before starting new

## Testing Considerations

- Timer counts down correctly
- Expires at 0 seconds
- `onExpire` callback fires
- `onTick` fires each second
- Server sync calculates remaining correctly
- Urgency levels match thresholds
- Start/pause/reset work correctly

---

**Estimated Complexity**: Simple (~70 lines)
**Dependencies**: None (native setInterval)
**Phase**: Phase 3 - Charleston

```text

```
