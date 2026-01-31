# DiceRoller Component Specification

## Component Type

**Presentational Component** (with internal animation state)

## Purpose

Displays animated dice rolling for wall breaking and dealer selection. Provides visual feedback during the game setup phase with 3D-style dice animations, sound effects, and result announcement.

## Related User Stories

- US-001: Roll Dice to Break Wall
- US-002: Automatic Game Start

## TypeScript Interface

```typescript
export interface DiceRollerProps {
  /** Current dice values (null when not rolled) */
  dice: [number, number] | null;

  /** Whether the dice are currently rolling */
  isRolling: boolean;

  /** Whether the current player can initiate a roll */
  canRoll: boolean;

  /** Callback when roll button is clicked */
  onRoll: () => void;

  /** Animation duration in milliseconds */
  animationDuration?: number;

  /** Whether to play sound effects */
  enableSound?: boolean;

  /** Size variant for different contexts */
  size?: 'small' | 'medium' | 'large';

  /** Which seat is rolling (for context message) */
  rollingSeat?: 'East' | 'South' | 'West' | 'North' | null;

  /** Optional message to display above dice */
  message?: string;

  /** Additional CSS classes */
  className?: string;
}
```

## Internal State

```typescript
interface DiceRollerState {
  /** Current frame of animation (for rapid value cycling) */
  animationFrame: number;

  /** Display values during animation (rapid cycling) */
  displayValues: [number, number];

  /** Whether animation is complete */
  animationComplete: boolean;

  /** Sound effect playback status */
  soundPlaying: boolean;
}
```

## Visual Design

### Dice Appearance

- **3D Cube Rendering**: CSS 3D transforms creating cube with 6 faces
- **Pip Display**: Traditional dots (1-6) on each face
- **Materials**:
  - Base color: Ivory white (#FFFFF0)
  - Pips: Deep red (#8B0000) for contrast
  - Shadow: Soft drop shadow for depth
  - Border: Subtle rounded edges

### Size Variants

- **small**: 40x40px dice (for compact layouts, history view)
- **medium**: 60x60px dice (default, main game view)
- **large**: 80x80px dice (for emphasis during setup phase)

### Animation Sequence

1. **Pre-roll State** (dice=null, canRoll=true)
   - Show "Roll Dice" button
   - Dice show last result or placeholder dots
   - Button pulses with gentle glow

2. **Rolling Animation** (isRolling=true)
   - Button disabled, shows "Rolling..."
   - Dice rotate rapidly through all faces (60fps)
   - Random face shown each frame for 1-2 seconds
   - Blur effect during rapid rotation
   - "Rolling" sound effect (continuous rattle)

3. **Settling Animation** (transition to result)
   - Dice slow rotation over 300ms
   - Final values lock in with bounce effect
   - "Clack" sound effect on settle
   - Highlight glow around final result

4. **Result Display** (dice=[4,2], isRolling=false)
   - Dice show final values
   - Total displayed below dice: "6 (4 + 2)"
   - Message updated: "East rolls 6. Breaking wall at position 6."
   - Result visible for 2 seconds before auto-advancing

### Accessibility

#### ARIA Attributes

- `role="group"` for dice container
- `aria-label="Dice: {value1} and {value2}, total {sum}"` when rolled
- `aria-live="polite"` for result announcements
- `aria-busy={isRolling}` during animation

#### Button Accessibility

- `role="button"` for roll trigger
- `aria-label="Roll dice to break wall"`
- `aria-disabled={!canRoll}` when not player's turn
- `tabIndex={0}` for keyboard focus

#### Screen Reader Announcements

- On roll start: "Rolling dice..."
- On roll complete: "Rolled {value1} and {value2}, total {sum}"
- When not player's turn: "Waiting for {seat} to roll dice"

#### Keyboard Support

- `Space` or `Enter`: Trigger roll (when canRoll=true)
- `Escape`: Dismiss result message (if auto-advance is paused)

### Sound Effects

#### Audio Files Required

- `dice-roll.mp3`: Continuous rolling sound (looped during animation)
- `dice-settle.mp3`: Final clack/impact sound
- Volume: 40% of master volume by default
- Fallback: Graceful degradation if audio unavailable

#### Sound Timing

- Start rolling sound immediately on roll trigger
- Fade out rolling sound over last 200ms
- Play settle sound at animation completion
- Stop all sounds if component unmounts mid-animation

## Dependencies

### External

- React (hooks: `useState`, `useEffect`, `useRef`, `useCallback`)
- `clsx` for conditional class names
- `framer-motion` or CSS animations for 3D transforms

### Internal

- `@/hooks/useSound` - Sound effect playback
- `@/hooks/useAnimationFrame` - 60fps animation loop
- `@/components/ui/Button` - Roll button component
- `@/styles/dice.module.css` - 3D cube styles

### Generated Types

- None (uses primitive types)

## Implementation Notes

### Animation Strategy

```typescript
// Use requestAnimationFrame for smooth 60fps cycling
useEffect(() => {
  if (!isRolling) return;

  let frameId: number;
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;

    if (elapsed < animationDuration) {
      // Rapid random values during roll
      setDisplayValues([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]);
      frameId = requestAnimationFrame(animate);
    } else {
      // Show final values with settle animation
      setDisplayValues(dice!);
      setAnimationComplete(true);
    }
  };

  frameId = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(frameId);
}, [isRolling, dice, animationDuration]);
```

### 3D Cube Construction

```css
/* Each die is a 3D cube with 6 faces */
.die {
  transform-style: preserve-3d;
  animation: spin 0.5s ease-out;
}

.face {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 2px solid #ccc;
  border-radius: 8px;
  background: #fffff0;
}

/* Face positioning (example for face-1) */
.face-1 {
  transform: rotateY(0deg) translateZ(30px);
}
.face-2 {
  transform: rotateY(90deg) translateZ(30px);
}
.face-3 {
  transform: rotateX(90deg) translateZ(30px);
}
.face-4 {
  transform: rotateX(-90deg) translateZ(30px);
}
.face-5 {
  transform: rotateY(-90deg) translateZ(30px);
}
.face-6 {
  transform: rotateY(180deg) translateZ(30px);
}
```

### Performance Optimizations

1. **RAF Throttling**: Limit display updates to 60fps max
2. **CSS Animations**: Use GPU-accelerated transforms
3. **Sound Preloading**: Load audio files on component mount
4. **Memoization**: Memoize pip rendering for each face
5. **Conditional Rendering**: Don't render hidden faces

### Error Handling

- Invalid dice values (< 1 or > 6): Clamp to valid range, log warning
- Missing audio files: Disable sound, show visual-only animation
- Animation interruption: Cleanup RAF and audio on unmount
- Rapid state changes: Debounce roll requests (500ms cooldown)

## Test Scenarios

### Unit Tests

```typescript
describe('DiceRoller', () => {
  it('renders null state before first roll', () => {
    // dice=null should show placeholder
  });

  it('enables roll button when canRoll=true', () => {
    // canRoll=true, button should be clickable
  });

  it('disables roll button when canRoll=false', () => {
    // canRoll=false, button should be disabled
  });

  it('calls onRoll when button is clicked', () => {
    // Click should trigger callback
  });

  it('shows rolling animation when isRolling=true', () => {
    // Should display rapid value changes
  });

  it('displays final values after animation completes', () => {
    // dice=[3,5] should show 3 and 5
  });

  it('calculates and displays total correctly', () => {
    // dice=[4,2] should show "Total: 6"
  });

  it('applies size variant classes', () => {
    // size='large' should apply correct styles
  });

  it('respects enableSound prop', () => {
    // enableSound=false should not play audio
  });

  it('displays custom message when provided', () => {
    // message prop should render above dice
  });
});
```

### Integration Tests

```typescript
describe('DiceRoller Integration', () => {
  it('completes full animation cycle', async () => {
    // isRolling=true → wait for animationDuration → verify final state
  });

  it('plays sound effects during animation', () => {
    // useSound hook should be called with correct files
  });

  it('prevents multiple simultaneous rolls', () => {
    // Clicking during animation should be ignored
  });

  it('supports keyboard activation', () => {
    // Enter/Space should trigger onRoll
  });

  it('announces results to screen readers', () => {
    // aria-live region should update
  });

  it('cleans up animation on unmount', () => {
    // RAF and audio should be cancelled
  });
});
```

### Visual Regression Tests

- Dice rendering for all values (1-6 on each die)
- Animation frames captured at intervals
- Different size variants
- Button states (enabled, disabled, rolling)

## Usage Examples

### Game Setup Phase

```tsx
import { DiceRoller } from '@/components/game/DiceRoller';

function SetupPhase() {
  const { dice, isRolling, currentSeat, rollDice } = useGameState();
  const isEast = currentSeat === 'East';

  return (
    <div className="setup-container">
      <h2>Break the Wall</h2>
      <DiceRoller
        dice={dice}
        isRolling={isRolling}
        canRoll={isEast}
        onRoll={rollDice}
        rollingSeat={isEast ? 'East' : null}
        message={isEast ? 'Roll dice to break the wall' : 'Waiting for East to roll dice'}
        size="large"
        enableSound={settings.soundEnabled}
      />
    </div>
  );
}
```

### Compact History View

```tsx
function MoveHistoryEntry({ move }: { move: MoveAction }) {
  if (move.action !== 'RollDice') return null;

  return (
    <div className="history-entry">
      <DiceRoller
        dice={move.diceResult}
        isRolling={false}
        canRoll={false}
        onRoll={() => {}}
        size="small"
        enableSound={false}
        message={`${move.seat} rolled ${move.diceResult[0] + move.diceResult[1]}`}
      />
    </div>
  );
}
```

### Practice Mode with Manual Control

```tsx
function PracticeDiceRoller() {
  const [manualValues, setManualValues] = useState<[number, number]>([1, 1]);

  return (
    <div className="practice-controls">
      <DiceRoller
        dice={manualValues}
        isRolling={false}
        canRoll={true}
        onRoll={() =>
          setManualValues([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1])
        }
        size="medium"
        message="Practice Mode: Click to reroll"
      />

      {/* Manual value selectors for testing */}
      <div className="manual-controls">
        <label>
          Die 1:
          <input
            type="range"
            min="1"
            max="6"
            value={manualValues[0]}
            onChange={(e) => setManualValues([+e.target.value, manualValues[1]])}
          />
        </label>
        <label>
          Die 2:
          <input
            type="range"
            min="1"
            max="6"
            value={manualValues[1]}
            onChange={(e) => setManualValues([manualValues[0], +e.target.value])}
          />
        </label>
      </div>
    </div>
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.dice-area {
  display: flex;
  gap: 1rem;
  perspective: 1000px; /* For 3D effect */
}

.die {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.3s ease-out;
}

.die--rolling {
  animation: spin 0.5s linear infinite;
  filter: blur(2px);
}

.die--settled {
  animation: bounce 0.3s ease-out;
}

@keyframes spin {
  from {
    transform: rotateX(0) rotateY(0);
  }
  to {
    transform: rotateX(360deg) rotateY(360deg);
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.result {
  font-size: 1.25rem;
  font-weight: bold;
  color: var(--text-primary);
}

.message {
  font-size: 1rem;
  color: var(--text-secondary);
  text-align: center;
}
```

## Future Enhancements

- [ ] Physics-based dice rolling (use physics engine)
- [ ] Customizable dice skins (different colors, materials)
- [ ] Network latency compensation for multiplayer
- [ ] Replay speed controls (fast-forward through animation)
- [ ] Particle effects on dice settle
- [ ] Dice trail/motion blur during rolling
- [ ] Haptic feedback on mobile devices
- [ ] Multiple dice roll animations (charleston phases)

## Notes

- Animation must complete even if props change mid-roll (use internal state)
- Consider reducing animation duration for practice mode (faster iteration)
- Sound effects should respect system audio settings (no auto-play on mobile)
- Dice values from backend are 1-indexed (1-6), not 0-indexed
- Component should handle rapid consecutive rolls gracefully (debounce)
- For accessibility, prefer reduced-motion media query for users with vestibular disorders

```text

```
