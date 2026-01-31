# CharlestonTimer Component Specification

## 1. Component Overview

### Purpose

Display a countdown timer for Charleston phases with visual feedback, warnings at thresholds, and optional sound notifications.

### Category

Presentational Component - Core Game Elements

### User Stories

- US-002 to US-007: Charleston phases - All timed actions
- US-036: Timer Configuration - Customizable timer durations and visibility

### Design Principles

- **Clear Urgency**: Visual warnings as time runs low
- **Consistent Format**: MM:SS display format
- **Configurable**: Respects timer mode (visible/countdown/hidden)
- **Non-Intrusive**: Subtle animations, avoids distraction
- **Accessibility**: Screen reader announcements at thresholds

---

## 2. Visual Design

### Layout Modes

#### Standard Timer (Default)

```text
┌──────────────────────┐
│   Charleston Pass    │
│       01:30          │
│   ████████░░░░       │ ← Progress bar (60% filled)
└──────────────────────┘
Width: 200px, Height: 80px
```

#### Compact Timer

```text
┌────────────┐
│  Pass 1:30 │
└────────────┘
Width: 120px, Height: 36px
```

#### Warning State (<30s)

```text
┌──────────────────────┐
│   Charleston Pass    │
│       00:25          │  ← Amber text, pulsing
│   ████░░░░░░░░░░     │ ← Amber progress bar
└──────────────────────┘
```

#### Critical State (<10s)

```text
┌──────────────────────┐
│   Charleston Pass    │
│       00:07          │  ← Red text, fast pulse
│   ██░░░░░░░░░░░░     │ ← Red progress bar
└──────────────────────┘
```

### Timer States

#### Active (Time Remaining)

- Text: Gray-900 (#111827)
- Progress bar: Blue (#2563EB)
- Background: White with light border
- No animation (steady display)

#### Warning (<30s remaining)

- Text: Amber-600 (#D97706), pulsing slow
- Progress bar: Amber-500 (#F59E0B)
- Border: Amber-300 (#FCD34D)
- Pulse: 2s cycle (opacity 1.0 → 0.7 → 1.0)

#### Critical (<10s remaining)

- Text: Red-600 (#DC2626), pulsing fast
- Progress bar: Red-500 (#EF4444)
- Border: Red-300 (#FCA5A5)
- Pulse: 0.8s cycle (opacity 1.0 → 0.5 → 1.0)
- Optional: Beep sound every second (if sound enabled)

#### Expired (0:00)

- Text: Red-700 (#B91C1C), "TIME UP!"
- Progress bar: Empty (0% filled)
- Border: Red-500 solid 2px
- Background: Red-50 (#FEF2F2)

#### Hidden Mode

- Component not rendered (display: none)

### Progress Bar

```text
┌────────────────────────┐
│ ████████████████░░░░░░ │ ← 67% filled
└────────────────────────┘
Height: 6px
Border-radius: 3px
Background: Gray-200 (#E5E7EB)
Fill: Blue-600 (#2563EB), smooth transition
```

### Typography

- **Label**: 12px, medium, gray-600, uppercase ("CHARLESTON PASS")
- **Timer**: 32px, bold, monospace font, color varies by state
- **Compact**: 14px, medium, monospace

### Color Scheme

```css
Active State:
  Timer Text:  #111827 (Gray-900)
  Progress:    #2563EB (Blue-600)
  Border:      #E5E7EB (Gray-200)
  Background:  #FFFFFF (White)

Warning State (<30s):
  Timer Text:  #D97706 (Amber-600)
  Progress:    #F59E0B (Amber-500)
  Border:      #FCD34D (Amber-300)
  Background:  #FFFBEB (Amber-50)

Critical State (<10s):
  Timer Text:  #DC2626 (Red-600)
  Progress:    #EF4444 (Red-500)
  Border:      #FCA5A5 (Red-300)
  Background:  #FEF2F2 (Red-50)

Expired:
  Timer Text:  #B91C1C (Red-700)
  Progress:    #D1D5DB (Gray-300, empty)
  Border:      #EF4444 (Red-500)
  Background:  #FEF2F2 (Red-50)
```

---

## 3. Props Interface

```typescript
import { TimerMode } from '@/types/bindings/generated';

export interface CharlestonTimerProps {
  /** Total duration in seconds */
  duration: number;

  /** Remaining time in seconds */
  remaining: number;

  /** Phase label (e.g., "Charleston Pass", "Vote") */
  label: string;

  /** Timer visibility mode */
  mode?: TimerMode; // 'Visible' | 'Countdown' | 'Hidden'

  /** Layout size */
  size?: 'standard' | 'compact';

  /** Warning threshold in seconds (default: 30) */
  warningThreshold?: number;

  /** Critical threshold in seconds (default: 10) */
  criticalThreshold?: number;

  /** Whether to play sound alerts */
  soundEnabled?: boolean;

  /** Callback when timer expires */
  onExpire?: () => void;

  /** Optional CSS classes */
  className?: string;
}

/** Timer state enum */
export enum TimerState {
  Active = 'active',
  Warning = 'warning',
  Critical = 'critical',
  Expired = 'expired',
}

/** Format seconds to MM:SS */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Calculate timer state based on remaining time */
export function getTimerState(
  remaining: number,
  warningThreshold: number,
  criticalThreshold: number
): TimerState {
  if (remaining <= 0) return TimerState.Expired;
  if (remaining <= criticalThreshold) return TimerState.Critical;
  if (remaining <= warningThreshold) return TimerState.Warning;
  return TimerState.Active;
}

/** Calculate progress percentage */
export function getProgress(remaining: number, duration: number): number {
  return Math.max(0, Math.min(100, (remaining / duration) * 100));
}
```

---

## 4. Component Variants

### 1. Standard Active Timer

```tsx
<CharlestonTimer
  duration={90}
  remaining={60}
  label="Charleston Pass"
  mode="Visible"
  size="standard"
/>
```

**Visual**: Blue progress bar (67%), timer shows "01:00", no warnings

### 2. Warning State

```tsx
<CharlestonTimer
  duration={90}
  remaining={25}
  label="Charleston Pass"
  mode="Visible"
  size="standard"
  warningThreshold={30}
/>
```

**Visual**: Amber progress bar (28%), timer shows "00:25", pulsing amber text

### 3. Critical State

```tsx
<CharlestonTimer
  duration={90}
  remaining={7}
  label="Vote Charleston"
  mode="Visible"
  size="standard"
  criticalThreshold={10}
  soundEnabled={true}
/>
```

**Visual**: Red progress bar (8%), timer shows "00:07", fast red pulse, beep sound

### 4. Expired Timer

```tsx
<CharlestonTimer
  duration={90}
  remaining={0}
  label="Charleston Pass"
  mode="Visible"
  size="standard"
  onExpire={() => console.log('Time expired!')}
/>
```

**Visual**: Red background, "TIME UP!" text, empty progress bar, onExpire callback triggered

### 5. Compact Mode

```tsx
<CharlestonTimer duration={60} remaining={45} label="Pass" mode="Visible" size="compact" />
```

**Visual**: Small format "Pass 0:45", reduced height, no progress bar

### 6. Countdown Mode (No Initial Display)

```tsx
<CharlestonTimer
  duration={90}
  remaining={85}
  label="Charleston Pass"
  mode="Countdown"
  size="standard"
/>
```

**Visual**: Timer hidden until warning threshold (<30s), then appears as warning/critical

### 7. Hidden Mode

```tsx
<CharlestonTimer
  duration={90}
  remaining={50}
  label="Charleston Pass"
  mode="Hidden"
  size="standard"
/>
```

**Visual**: Component not rendered (null)

---

## 5. Behavior & Interaction

### Timer Updates

#### Real-Time Countdown

```typescript
useEffect(() => {
  // Timer updates from server events, not client-side countdown
  // Client only displays remaining time from server
  const handleTimerUpdate = (event: PublicEvent) => {
    if (event.type === 'TimerUpdated') {
      setRemaining(event.remaining);
    }
  };

  socket.on('event', handleTimerUpdate);
  return () => socket.off('event', handleTimerUpdate);
}, []);
```

**Important**: Timer counts down on server, not client. Client receives periodic updates to prevent drift.

#### State Transitions

```typescript
useEffect(() => {
  const newState = getTimerState(remaining, warningThreshold, criticalThreshold);

  if (newState !== prevState) {
    // State changed: active → warning → critical → expired
    if (newState === TimerState.Expired && onExpire) {
      onExpire();
    }

    if (newState === TimerState.Warning) {
      announceToScreenReader('Warning: 30 seconds remaining');
    }

    if (newState === TimerState.Critical) {
      announceToScreenReader('Critical: 10 seconds remaining');
      if (soundEnabled) {
        playWarningSound();
      }
    }
  }
}, [remaining]);
```

### Visual Animations

#### Pulse Animation (Warning/Critical)

```css
@keyframes timerPulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.02);
  }
}

.timer-warning {
  animation: timerPulse 2s ease-in-out infinite;
}

.timer-critical {
  animation: timerPulse 0.8s ease-in-out infinite;
}
```

#### Progress Bar Fill

```css
.progress-fill {
  transition: width 1s linear; /* Smooth countdown */
  will-change: width;
}
```

### Sound Alerts

#### Critical State Beep (Every Second <10s)

```typescript
const playBeep = useCallback(() => {
  if (!soundEnabled) return;

  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = 800; // 800 Hz beep
  gainNode.gain.value = 0.3; // 30% volume

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.1); // 100ms beep
}, [soundEnabled]);

useEffect(() => {
  if (timerState === TimerState.Critical && soundEnabled) {
    const interval = setInterval(playBeep, 1000);
    return () => clearInterval(interval);
  }
}, [timerState, soundEnabled]);
```

### Timer Modes

#### Visible Mode

- Always displays timer
- Shows all states (active/warning/critical/expired)
- Full visual feedback

#### Countdown Mode

- Hidden until warning threshold (<30s by default)
- Appears with warning/critical states
- Used for less urgent timers

#### Hidden Mode

- Component returns null
- No visual display
- Used when timer is disabled or in practice mode

---

## 6. Accessibility

### ARIA Attributes

```tsx
<div
  role="timer"
  aria-label={`${label} timer: ${formatTime(remaining)} remaining`}
  aria-live={timerState === TimerState.Critical ? 'assertive' : 'polite'}
  aria-atomic="true"
  className="charleston-timer"
>
  {/* Timer content */}
</div>
```

### Screen Reader Announcements

#### State Changes

```text
Active → Warning:
"Warning: 30 seconds remaining for Charleston Pass"

Warning → Critical:
"Critical: 10 seconds remaining for Charleston Pass"

Critical → Expired:
"Time expired for Charleston Pass"
```

#### Interval Announcements (Critical State)

```text
Every 5 seconds in critical state:
"5 seconds remaining"
"3 seconds remaining"
"1 second remaining"
```

### Visual Indicators Beyond Color

- **Warning**: Pulsing animation + amber border (not just color)
- **Critical**: Fast pulse + red border (not just color)
- **Expired**: "TIME UP!" text + border (not just color)
- **Progress bar**: Percentage calculated from width, not just color

### Keyboard Navigation

- Timer is not focusable (informational only)
- No interactive elements

---

## 7. Responsive Design

### Breakpoints

#### Desktop (≥768px)

- Standard size: 200px × 80px
- Full label visible
- Progress bar 6px height
- Timer text 32px

#### Tablet (640px - 767px)

- Standard size: 180px × 70px
- Full label visible
- Progress bar 5px height
- Timer text 28px

#### Mobile (<640px)

- Force compact size: 120px × 36px
- Abbreviated label ("Pass" instead of "Charleston Pass")
- No progress bar (too small)
- Timer text 14px

### Font Scaling

- Use `rem` units for all text
- Respect user font size preferences
- Ensure timer remains readable at 200% zoom (WCAG 2.1)

---

## 8. Integration Points

### Parent Components

#### CharlestonPanel

```tsx
<CharlestonPanel>
  <CharlestonTracker currentStage={stage} />

  <CharlestonTimer
    duration={charlestonDuration}
    remaining={remainingTime}
    label={getCharlestonLabel(stage)}
    mode={timerMode}
    size="standard"
    soundEnabled={userSettings.soundEnabled}
    onExpire={handleTimerExpire}
  />

  {/* Charleston tile selection */}
</CharlestonPanel>
```

#### GameHeader (Compact)

```tsx
<GameHeader>
  {gamePhase === 'Charleston' && (
    <CharlestonTimer
      duration={charlestonDuration}
      remaining={remainingTime}
      label="Charleston"
      mode={timerMode}
      size="compact"
      soundEnabled={false}
    />
  )}
</GameHeader>
```

### State Management

#### Zustand Store (gameStore)

```typescript
interface GameState {
  timerMode: TimerMode;
  charlestonTimer: {
    duration: number;
    remaining: number;
    startedAt: number; // Unix timestamp
  } | null;
}

// Selectors
const useTimerMode = () => useGameStore((state) => state.timerMode);
const useCharlestonTimer = () => useGameStore((state) => state.charlestonTimer);
```

### Event Handlers

#### Timer Started

```typescript
useEffect(() => {
  const handleEvent = (event: PublicEvent) => {
    if (event.type === 'CharlestonTimerStarted') {
      setCharlestonTimer({
        duration: event.duration,
        remaining: event.duration,
        startedAt: Date.now(),
      });
    }
  };

  socket.on('event', handleEvent);
  return () => socket.off('event', handleEvent);
}, []);
```

#### Timer Update (Server Sync)

```typescript
useEffect(() => {
  const handleEvent = (event: PublicEvent) => {
    if (event.type === 'TimerUpdated') {
      setRemainingTime(event.remaining);
    }
  };

  socket.on('event', handleEvent);
  return () => socket.off('event', handleEvent);
}, []);
```

#### Timer Expired

```typescript
const handleExpire = useCallback(() => {
  // Auto-submit action or show warning
  if (autoSubmitOnExpire) {
    submitCharlestonPass();
  } else {
    showToast('Time expired! Please complete your action.', 'warning');
  }
}, [autoSubmitOnExpire]);
```

### User Stories Integration

#### US-002 to US-007: Charleston Phases

- Display timer for each Charleston stage
- Update label based on current stage ("Pass Right", "Vote", etc.)
- Trigger warnings as time runs low

#### US-036: Timer Configuration

- Respect TimerMode from house rules
- Use configured durations (30s, 60s, 90s, etc.)
- Show/hide based on mode setting

---

## 9. Error Handling

### Missing Data

#### Invalid Duration

```typescript
if (duration <= 0) {
  console.error('Invalid timer duration:', duration);
  return null;
}
```

#### Negative Remaining Time

```typescript
const safeRemaining = Math.max(0, remaining);
```

#### No Label Provided

```typescript
const displayLabel = label || 'Timer';
```

### Edge Cases

#### Remaining > Duration

```typescript
// Server error, remaining should never exceed duration
if (remaining > duration) {
  console.warn('Remaining time exceeds duration', { remaining, duration });
  setRemaining(duration);
}
```

#### Timer Mode Changes Mid-Countdown

```typescript
useEffect(() => {
  if (mode === 'Hidden') {
    // Stop sound alerts immediately
    stopAllSounds();
  }
}, [mode]);
```

#### Expired with Remaining Time

```typescript
// Handle edge case where server sends 0 but client hasn't updated
if (remaining === 0 && !hasExpired) {
  setHasExpired(true);
  onExpire?.();
}
```

### Warnings

#### Client-Server Time Drift

```typescript
// Log warning if client countdown drifts >2s from server
if (Math.abs(clientRemaining - serverRemaining) > 2) {
  console.warn('Timer drift detected, syncing with server');
  setRemaining(serverRemaining);
}
```

---

## 10. Testing Requirements

### Unit Tests

#### Rendering Tests

```typescript
describe('CharlestonTimer', () => {
  it('renders timer with correct format', () => {
    render(
      <CharlestonTimer
        duration={90}
        remaining={65}
        label="Charleston Pass"
        mode="Visible"
      />
    );

    expect(screen.getByText('01:05')).toBeInTheDocument();
    expect(screen.getByText('Charleston Pass')).toBeInTheDocument();
  });

  it('shows progress bar with correct percentage', () => {
    const { container } = render(
      <CharlestonTimer
        duration={100}
        remaining={60}
        label="Pass"
        mode="Visible"
      />
    );

    const progressBar = container.querySelector('.progress-fill');
    expect(progressBar).toHaveStyle({ width: '60%' });
  });

  it('formats time correctly', () => {
    expect(formatTime(90)).toBe('01:30');
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(125)).toBe('02:05');
  });
});
```

#### State Tests

```typescript
describe('CharlestonTimer - States', () => {
  it('shows warning state when below warning threshold', () => {
    const { container } = render(
      <CharlestonTimer
        duration={90}
        remaining={25}
        label="Pass"
        mode="Visible"
        warningThreshold={30}
      />
    );

    expect(container.firstChild).toHaveClass('timer-warning');
  });

  it('shows critical state when below critical threshold', () => {
    const { container } = render(
      <CharlestonTimer
        duration={90}
        remaining={7}
        label="Pass"
        mode="Visible"
        criticalThreshold={10}
      />
    );

    expect(container.firstChild).toHaveClass('timer-critical');
  });

  it('shows expired state when time is 0', () => {
    render(
      <CharlestonTimer
        duration={90}
        remaining={0}
        label="Pass"
        mode="Visible"
      />
    );

    expect(screen.getByText(/TIME UP!/i)).toBeInTheDocument();
  });

  it('returns null in hidden mode', () => {
    const { container } = render(
      <CharlestonTimer
        duration={90}
        remaining={60}
        label="Pass"
        mode="Hidden"
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
```

#### Interaction Tests

```typescript
describe('CharlestonTimer - Interactions', () => {
  it('calls onExpire when timer reaches 0', () => {
    const handleExpire = vi.fn();
    const { rerender } = render(
      <CharlestonTimer
        duration={90}
        remaining={1}
        label="Pass"
        mode="Visible"
        onExpire={handleExpire}
      />
    );

    rerender(
      <CharlestonTimer
        duration={90}
        remaining={0}
        label="Pass"
        mode="Visible"
        onExpire={handleExpire}
      />
    );

    expect(handleExpire).toHaveBeenCalledTimes(1);
  });

  it('plays sound in critical state when enabled', () => {
    const playSoundSpy = vi.spyOn(global, 'AudioContext');

    render(
      <CharlestonTimer
        duration={90}
        remaining={5}
        label="Pass"
        mode="Visible"
        soundEnabled={true}
      />
    );

    // Wait for beep interval
    vi.advanceTimersByTime(1000);
    expect(playSoundSpy).toHaveBeenCalled();
  });
});
```

### Integration Tests

#### Server Sync

```typescript
describe('CharlestonTimer - Server Integration', () => {
  it('updates remaining time from server events', () => {
    const mockSocket = createMockSocket();
    render(
      <CharlestonTimer
        duration={90}
        remaining={60}
        label="Pass"
        mode="Visible"
      />
    );

    expect(screen.getByText('01:00')).toBeInTheDocument();

    // Simulate server update
    act(() => {
      mockSocket.emit('event', {
        type: 'TimerUpdated',
        remaining: 45,
      });
    });

    expect(screen.getByText('00:45')).toBeInTheDocument();
  });
});
```

### Visual Regression Tests

#### Snapshot Tests

```typescript
describe('CharlestonTimer - Visual Snapshots', () => {
  it('matches snapshot for active state', () => {
    const { container } = render(
      <CharlestonTimer
        duration={90}
        remaining={60}
        label="Charleston Pass"
        mode="Visible"
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for warning state', () => {
    const { container } = render(
      <CharlestonTimer
        duration={90}
        remaining={25}
        label="Charleston Pass"
        mode="Visible"
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for critical state', () => {
    const { container } = render(
      <CharlestonTimer
        duration={90}
        remaining={7}
        label="Charleston Pass"
        mode="Visible"
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for expired state', () => {
    const { container } = render(
      <CharlestonTimer
        duration={90}
        remaining={0}
        label="Charleston Pass"
        mode="Visible"
      />
    );
    expect(container).toMatchSnapshot();
  });
});
```

### Accessibility Tests

```typescript
describe('CharlestonTimer - Accessibility', () => {
  it('has correct ARIA attributes', () => {
    render(
      <CharlestonTimer
        duration={90}
        remaining={60}
        label="Charleston Pass"
        mode="Visible"
      />
    );

    const timer = screen.getByRole('timer');
    expect(timer).toHaveAttribute('aria-label', expect.stringContaining('01:00 remaining'));
    expect(timer).toHaveAttribute('aria-live', 'polite');
  });

  it('uses assertive aria-live in critical state', () => {
    render(
      <CharlestonTimer
        duration={90}
        remaining={7}
        label="Pass"
        mode="Visible"
      />
    );

    const timer = screen.getByRole('timer');
    expect(timer).toHaveAttribute('aria-live', 'assertive');
  });

  it('passes axe accessibility tests', async () => {
    const { container } = render(
      <CharlestonTimer
        duration={90}
        remaining={60}
        label="Charleston Pass"
        mode="Visible"
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

---

## 11. Performance Considerations

### Memoization

```typescript
export const CharlestonTimer = React.memo<CharlestonTimerProps>(
  ({ duration, remaining, label, mode, ...props }) => {
    // Component logic
  },
  (prevProps, nextProps) => {
    return (
      prevProps.duration === nextProps.duration &&
      prevProps.remaining === nextProps.remaining &&
      prevProps.label === nextProps.label &&
      prevProps.mode === nextProps.mode &&
      prevProps.soundEnabled === nextProps.soundEnabled
    );
  }
);
```

### Animation Optimization

#### CSS Animations (GPU-Accelerated)

```css
.timer-warning,
.timer-critical {
  animation: timerPulse 2s ease-in-out infinite;
  will-change: opacity, transform;
}

.progress-fill {
  transition: width 1s linear;
  will-change: width;
}
```

#### Conditional Animations

```typescript
// Only animate in warning/critical states
const timerClassName = useMemo(() => {
  return clsx(styles.timer, {
    [styles.warning]: timerState === TimerState.Warning,
    [styles.critical]: timerState === TimerState.Critical,
    [styles.expired]: timerState === TimerState.Expired,
  });
}, [timerState]);
```

### Sound Management

#### Audio Context Reuse

```typescript
// Reuse AudioContext instead of creating new instances
const audioContextRef = useRef<AudioContext | null>(null);

const getAudioContext = () => {
  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContext();
  }
  return audioContextRef.current;
};

// Cleanup on unmount
useEffect(() => {
  return () => {
    audioContextRef.current?.close();
  };
}, []);
```

#### Debounce Sound Alerts

```typescript
// Prevent rapid-fire beeps if timer updates quickly
const debouncedBeep = useMemo(
  () => debounce(playBeep, 900, { leading: true, trailing: false }),
  []
);
```

### Bundle Size

#### Conditional Imports

```typescript
// Only load sound utilities if sound enabled
const { playBeep } = soundEnabled ? await import('./soundUtils') : { playBeep: () => {} };
```

---

## 12. Implementation Notes

### File Structure

```text
src/components/presentational/CharlestonTimer/
├── CharlestonTimer.tsx          # Main component
├── CharlestonTimer.module.css   # Scoped styles
├── CharlestonTimer.test.tsx     # Unit tests
├── utils.ts                     # formatTime, getTimerState, etc.
├── soundUtils.ts                # Audio playback functions
└── index.ts                     # Re-export
```

### Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@axe-core/react": "^4.8.0",
    "vitest": "^1.0.0"
  }
}
```

### Utils File

```typescript
// utils.ts
export enum TimerState {
  Active = 'active',
  Warning = 'warning',
  Critical = 'critical',
  Expired = 'expired',
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getTimerState(
  remaining: number,
  warningThreshold: number,
  criticalThreshold: number
): TimerState {
  if (remaining <= 0) return TimerState.Expired;
  if (remaining <= criticalThreshold) return TimerState.Critical;
  if (remaining <= warningThreshold) return TimerState.Warning;
  return TimerState.Active;
}

export function getProgress(remaining: number, duration: number): number {
  return Math.max(0, Math.min(100, (remaining / duration) * 100));
}
```

### Sound Utils File

```typescript
// soundUtils.ts
let audioContext: AudioContext | null = null;

export function playBeep(frequency: number = 800, duration: number = 100) {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  gainNode.gain.value = 0.3;

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration / 1000);
}

export function cleanup() {
  audioContext?.close();
  audioContext = null;
}
```

### CSS Module

```css
/* CharlestonTimer.module.css */

.timer {
  background-color: white;
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  padding: 12px 16px;
  text-align: center;
  transition:
    background-color 300ms ease,
    border-color 300ms ease;
}

.timer.standard {
  width: 200px;
  min-height: 80px;
}

.timer.compact {
  width: 120px;
  height: 36px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.label {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  color: var(--gray-600);
  margin-bottom: 4px;
}

.time {
  font-size: 32px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  color: var(--gray-900);
  line-height: 1;
}

.time.compact {
  font-size: 14px;
}

.progressBar {
  width: 100%;
  height: 6px;
  background-color: var(--gray-200);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 8px;
}

.progressFill {
  height: 100%;
  background-color: var(--blue-600);
  transition:
    width 1s linear,
    background-color 300ms ease;
  will-change: width;
}

/* Warning state */
.timer.warning {
  background-color: var(--amber-50);
  border-color: var(--amber-300);
  animation: timerPulse 2s ease-in-out infinite;
}

.timer.warning .time {
  color: var(--amber-600);
}

.timer.warning .progressFill {
  background-color: var(--amber-500);
}

/* Critical state */
.timer.critical {
  background-color: var(--red-50);
  border-color: var(--red-300);
  animation: timerPulse 0.8s ease-in-out infinite;
}

.timer.critical .time {
  color: var(--red-600);
}

.timer.critical .progressFill {
  background-color: var(--red-500);
}

/* Expired state */
.timer.expired {
  background-color: var(--red-50);
  border: 2px solid var(--red-500);
}

.timer.expired .time {
  color: var(--red-700);
  font-size: 24px;
}

@keyframes timerPulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.02);
  }
}

/* Responsive */
@media (max-width: 640px) {
  .timer.standard {
    width: 120px;
    min-height: 36px;
    padding: 6px 10px;
  }

  .time {
    font-size: 18px;
  }

  .progressBar {
    display: none; /* Hide on mobile */
  }
}
```

### Implementation Example

```typescript
// CharlestonTimer.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { TimerMode } from '@/types/bindings/generated';
import { formatTime, getTimerState, getProgress, TimerState } from './utils';
import { playBeep, cleanup } from './soundUtils';
import styles from './CharlestonTimer.module.css';

export interface CharlestonTimerProps {
  duration: number;
  remaining: number;
  label: string;
  mode?: TimerMode;
  size?: 'standard' | 'compact';
  warningThreshold?: number;
  criticalThreshold?: number;
  soundEnabled?: boolean;
  onExpire?: () => void;
  className?: string;
}

export const CharlestonTimer = React.memo<CharlestonTimerProps>(
  ({
    duration,
    remaining,
    label,
    mode = 'Visible',
    size = 'standard',
    warningThreshold = 30,
    criticalThreshold = 10,
    soundEnabled = false,
    onExpire,
    className,
  }) => {
    const [hasExpired, setHasExpired] = useState(false);
    const prevRemainingRef = useRef(remaining);

    const safeRemaining = Math.max(0, remaining);
    const timerState = getTimerState(safeRemaining, warningThreshold, criticalThreshold);
    const progress = getProgress(safeRemaining, duration);
    const formattedTime = formatTime(safeRemaining);

    // Handle expiration
    useEffect(() => {
      if (safeRemaining === 0 && prevRemainingRef.current > 0 && !hasExpired) {
        setHasExpired(true);
        onExpire?.();
      }
      prevRemainingRef.current = safeRemaining;
    }, [safeRemaining, hasExpired, onExpire]);

    // Sound alerts in critical state
    useEffect(() => {
      if (timerState === TimerState.Critical && soundEnabled) {
        const interval = setInterval(() => {
          playBeep();
        }, 1000);

        return () => clearInterval(interval);
      }
    }, [timerState, soundEnabled]);

    // Cleanup audio context on unmount
    useEffect(() => {
      return () => cleanup();
    }, []);

    // Hidden mode
    if (mode === 'Hidden') {
      return null;
    }

    // Countdown mode: only show when in warning/critical
    if (mode === 'Countdown' && timerState === TimerState.Active) {
      return null;
    }

    const ariaLabel = `${label} timer: ${formattedTime} remaining`;
    const ariaLive = timerState === TimerState.Critical ? 'assertive' : 'polite';

    if (size === 'compact') {
      return (
        <div
          role="timer"
          aria-label={ariaLabel}
          aria-live={ariaLive}
          className={clsx(
            styles.timer,
            styles.compact,
            styles[timerState],
            className
          )}
        >
          <span className={styles.label}>{label}</span>
          <span className={clsx(styles.time, styles.compact)}>
            {safeRemaining === 0 ? 'TIME UP!' : formattedTime}
          </span>
        </div>
      );
    }

    return (
      <div
        role="timer"
        aria-label={ariaLabel}
        aria-live={ariaLive}
        aria-atomic="true"
        className={clsx(
          styles.timer,
          styles.standard,
          styles[timerState],
          className
        )}
      >
        <div className={styles.label}>{label}</div>
        <div className={styles.time}>
          {safeRemaining === 0 ? 'TIME UP!' : formattedTime}
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    );
  }
);

CharlestonTimer.displayName = 'CharlestonTimer';
```

### Browser Support

- **Modern browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **CSS Features**: CSS Animations, CSS Variables, Flexbox
- **JavaScript**: ES2020+, Web Audio API (for sound)

### Accessibility Checklist

- [ ] ARIA role="timer" present
- [ ] aria-live updates (polite for active, assertive for critical)
- [ ] aria-label describes current state
- [ ] Progress bar has role="progressbar" with aria-value\* attributes
- [ ] Visual indicators beyond color (text, borders, animations)
- [ ] Screen reader announcements at state changes
- [ ] Passes axe-core audit
- [ ] Readable at 200% zoom
