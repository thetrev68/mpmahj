# DiceOverlay Component Specification

## 1. Overview

The `<DiceOverlay>` component displays an animated dice roll overlay at the start of each game round. It shows two six-sided dice tumbling in 3D, reveals the result, and determines which player breaks the wall and where. This component provides visual feedback for the random game initialization and creates anticipation through animation.

**Component Type**: Presentational  
**Complexity**: Medium-High  
**Related Components**: `<Wall>`, `<GameBoard>`, `<PlayerSeatIndicator>`

## 2. TypeScript Interface

```typescript
export interface DiceOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;

  /** Dice roll result (2-12) */
  result?: number;

  /** Seat of the player who rolled (East at game start) */
  roller: 'east' | 'south' | 'west' | 'north';

  /** Individual die values [die1, die2] for accurate display */
  dice?: [number, number];

  /** Animation state for controlling playback */
  animationState?: 'idle' | 'rolling' | 'revealing' | 'complete';

  /** Duration of the rolling animation in milliseconds */
  rollDuration?: number;

  /** Duration of the reveal pause in milliseconds */
  revealDuration?: number;

  /** Callback when animation completes */
  onComplete?: () => void;

  /** Callback when overlay is dismissed by user (optional) */
  onDismiss?: () => void;

  /** Whether to show "Skip" button during animation */
  allowSkip?: boolean;

  /** Whether to show wall break calculation explanation */
  showBreakCalculation?: boolean;

  /** Wall break position (1-144, clockwise from East) */
  breakPosition?: number;

  /** Additional CSS classes */
  className?: string;

  /** Test ID for component testing */
  testId?: string;
}
```

## 3. Component Behavior

### 3.1 Animation Sequence

The overlay follows a multi-stage animation:

1. **Fade In** (300ms)
   - Overlay backdrop fades in with semi-transparent background
   - Dice appear in center of screen
   - Text: "Rolling dice..."

2. **Rolling** (1500ms default, configurable)
   - Two dice tumble with 3D rotation animation
   - Rotation: random axis tumbling (X, Y, Z all rotating)
   - Sound effect: dice rattling (optional)
   - Each die rotates independently at different speeds

3. **Revealing** (800ms)
   - Dice settle to final positions
   - Values become clearly visible
   - Text: "East rolled: [result]" (e.g., "East rolled: 7")
   - Sound effect: dice landing

4. **Result Display** (2000ms or until dismissed)
   - Show dice result prominently
   - Optionally show wall break calculation
   - Display break position indicator
   - Text: "Breaking wall at position [X]" (if showBreakCalculation)
   - Show "Continue" button or auto-dismiss

5. **Fade Out** (300ms)
   - Overlay fades out
   - Trigger onComplete callback
   - Remove from DOM

### 3.2 Dice Rendering

Each die is rendered as a 3D cube with six faces:

```text
Face 1: ● (single dot, center)
Face 2: ●   ● (two dots, diagonal)
Face 3: ●   ● (three dots, diagonal with center)
        ●
Face 4: ●● (four dots, corners)
        ●●
Face 5: ●● (five dots, four corners + center)
        ●
        ●●
Face 6: ●●● (six dots, two columns of three)
        ●●●
```

Dice use CSS 3D transforms (`transform-style: preserve-3d`) for realistic rotation.

### 3.3 Roll Calculation Display

If `showBreakCalculation` is true, display the logic:

```text
East rolled: 7
East counts 7 clockwise → South wall
Die 1 (3) + Die 2 (4) = 7 tiles from right end
Breaking wall at position 7 (South wall, 7th tile)
```

### 3.4 Skip Functionality

If `allowSkip` is true:

- Show "Skip" button in top-right corner
- Clicking skips to final result immediately
- Preserves result accuracy (doesn't change random outcome)
- Useful for experienced players or testing

### 3.5 Responsive Behavior

| Viewport | Dice Size | Text Size | Animation Speed |
| -------- | --------- | --------- | --------------- |
| Desktop  | 80×80px   | 24px      | 100%            |
| Tablet   | 60×60px   | 20px      | 100%            |
| Mobile   | 48×48px   | 16px      | 80% (faster)    |

On mobile, reduce animation complexity (2D rotation instead of 3D) for performance.

## 4. Accessibility

### ARIA Attributes

```html
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dice-overlay-title"
  aria-describedby="dice-overlay-description"
  aria-live="polite"
>
  <h2 id="dice-overlay-title">Rolling Dice</h2>
  <div id="dice-overlay-description">Determining wall break position. Result: {result}</div>
</div>
```

### Screen Reader Support

Announce key stages:

- "Rolling dice to determine wall break"
- "East rolled 7"
- "Breaking wall at position 7 on the South wall"
- "Press Escape or click Continue to proceed"

### Keyboard Navigation

- **Escape**: Dismiss overlay (if animation complete)
- **Enter/Space**: Trigger continue button
- **Tab**: Navigate to Skip/Continue buttons

### Focus Management

- Trap focus within overlay while visible
- Focus "Continue" button when animation completes
- Restore focus to game board when dismissed

### Reduced Motion

If `prefers-reduced-motion: reduce`:

- Skip rolling animation, show result immediately
- Fade in/out transitions only (no rotation)
- Static dice with final values

## 5. Usage Examples

### Example 1: Basic Dice Roll

```tsx
import { DiceOverlay } from '@/components/presentational/DiceOverlay';
import { useState } from 'react';

function GameStart() {
  const [showDice, setShowDice] = useState(true);
  const [result] = useState([3, 4]); // Die 1: 3, Die 2: 4

  return (
    <>
      <DiceOverlay
        visible={showDice}
        dice={result}
        result={result[0] + result[1]}
        roller="east"
        onComplete={() => setShowDice(false)}
      />
      {!showDice && <GameBoard />}
    </>
  );
}
```

### Example 2: With Wall Break Calculation

```tsx
import { DiceOverlay } from '@/components/presentational/DiceOverlay';

function GameStartWithDetails() {
  const [visible, setVisible] = useState(true);

  return (
    <DiceOverlay
      visible={visible}
      dice={[5, 6]}
      result={11}
      roller="east"
      showBreakCalculation={true}
      breakPosition={11}
      onComplete={() => setVisible(false)}
    />
  );
}
```

### Example 3: Skippable Animation

```tsx
import { DiceOverlay } from '@/components/presentational/DiceOverlay';

function FastGameStart() {
  const [visible, setVisible] = useState(true);

  const handleSkip = () => {
    // Skip to result immediately
    setVisible(false);
  };

  return (
    <DiceOverlay
      visible={visible}
      dice={[2, 4]}
      result={6}
      roller="east"
      allowSkip={true}
      onDismiss={handleSkip}
      onComplete={() => setVisible(false)}
    />
  );
}
```

### Example 4: Custom Animation Duration

```tsx
import { DiceOverlay } from '@/components/presentational/DiceOverlay';

function QuickGameStart() {
  return (
    <DiceOverlay
      visible={true}
      dice={[1, 1]}
      result={2}
      roller="east"
      rollDuration={800} // Faster roll
      revealDuration={500} // Quicker reveal
      onComplete={() => console.log('Dice animation complete')}
    />
  );
}
```

### Example 5: Animation State Control

```tsx
import { DiceOverlay } from '@/components/presentational/DiceOverlay';
import { useState, useEffect } from 'react';

function ControlledDiceAnimation() {
  const [state, setState] = useState<'idle' | 'rolling' | 'revealing' | 'complete'>('idle');
  const [visible, setVisible] = useState(false);

  const startRoll = () => {
    setVisible(true);
    setState('rolling');
  };

  useEffect(() => {
    if (state === 'rolling') {
      setTimeout(() => setState('revealing'), 1500);
    } else if (state === 'revealing') {
      setTimeout(() => setState('complete'), 800);
    }
  }, [state]);

  return (
    <>
      <button onClick={startRoll}>Roll Dice</button>
      <DiceOverlay
        visible={visible}
        dice={[3, 5]}
        result={8}
        roller="east"
        animationState={state}
        onComplete={() => {
          setVisible(false);
          setState('idle');
        }}
      />
    </>
  );
}
```

## 6. Visual Design

### Color Scheme

```css
/* Overlay backdrop */
--dice-overlay-backdrop: rgba(0, 0, 0, 0.7);

/* Dice colors */
--dice-bg: hsl(0, 0%, 95%); /* Off-white */
--dice-dots: hsl(0, 0%, 10%); /* Near-black */
--dice-shadow: rgba(0, 0, 0, 0.3);
--dice-edge: hsl(0, 0%, 80%); /* Light gray edges */

/* Text colors */
--dice-text-primary: hsl(0, 0%, 100%);
--dice-text-secondary: hsl(0, 0%, 80%);

/* Accent colors */
--dice-accent: var(--color-primary);
--dice-highlight: hsl(45, 100%, 50%); /* Gold for result */
```

### Typography

```css
--dice-title-font: 'Roboto', sans-serif;
--dice-title-size: 32px;
--dice-title-weight: 700;

--dice-result-font: 'Roboto', monospace;
--dice-result-size: 48px;
--dice-result-weight: 900;

--dice-description-font: 'Roboto', sans-serif;
--dice-description-size: 16px;
--dice-description-weight: 400;
```

### Layout

```text
┌──────────────────────────────────────────┐
│                                  [Skip] │
│                                          │
│         Rolling dice...                  │
│                                          │
│        ┌───┐    ┌───┐                   │
│        │ ● │    │●●●│                   │  ← Dice (tumbling)
│        │   │    │●●●│                   │
│        └───┘    └───┘                   │
│                                          │
│                                          │
└──────────────────────────────────────────┘

After settling:

┌──────────────────────────────────────────┐
│                                          │
│         East rolled: 7                   │
│                                          │
│        ┌───┐    ┌───┐                   │
│        │  ●│    │●●●│                   │  ← Final dice
│        │ ● │    │ ● │                   │
│        │●  │    │●●●│                   │
│        └───┘    └───┘                   │
│                                          │
│    Breaking wall at position 7           │
│                                          │
│           [Continue] ─────────────       │
└──────────────────────────────────────────┘
```

### Dice 3D Structure

Each die is a 3D cube with 6 faces:

```css
.die {
  width: 80px;
  height: 80px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 1.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);
}

.die-face {
  position: absolute;
  width: 80px;
  height: 80px;
  background: var(--dice-bg);
  border: 2px solid var(--dice-edge);
  border-radius: 8px;
  display: grid;
  grid-template: repeat(3, 1fr) / repeat(3, 1fr);
  padding: 8px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.die-face-1 {
  transform: rotateY(0deg) translateZ(40px);
}
.die-face-2 {
  transform: rotateY(90deg) translateZ(40px);
}
.die-face-3 {
  transform: rotateY(180deg) translateZ(40px);
}
.die-face-4 {
  transform: rotateY(-90deg) translateZ(40px);
}
.die-face-5 {
  transform: rotateX(90deg) translateZ(40px);
}
.die-face-6 {
  transform: rotateX(-90deg) translateZ(40px);
}

.die-dot {
  width: 12px;
  height: 12px;
  background: var(--dice-dots);
  border-radius: 50%;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
}
```

## 7. Responsive Design

### Breakpoints

| Breakpoint | Dice Size | Title Size | Result Size | Animation Speed |
| ---------- | --------- | ---------- | ----------- | --------------- |
| Desktop    | 80×80px   | 32px       | 48px        | 1.0x            |
| Tablet     | 60×60px   | 24px       | 36px        | 1.0x            |
| Mobile     | 48×48px   | 20px       | 28px        | 0.8x (faster)   |

### Mobile Optimizations

- Use 2D rotation (no 3D perspective) for better performance
- Reduce animation frames (30fps instead of 60fps)
- Simplify dice dot rendering (flat circles, no shadows)
- Larger tap targets for Skip/Continue buttons (min 44×44px)

### Orientation

- Portrait: Vertical layout, dice stacked
- Landscape: Horizontal layout, dice side-by-side

## 8. Performance Considerations

### Animation Optimization

- Use CSS `transform` and `opacity` for GPU acceleration
- Avoid layout thrashing (no `width`/`height` changes during animation)
- Use `will-change: transform` on dice elements
- Preload dice face images/SVGs before animation starts

### Memory Management

- Remove overlay from DOM after fade-out
- Clean up animation timers in `useEffect` cleanup
- Release event listeners when component unmounts

### Rendering Strategy

```tsx
// Lazy render dice faces only when visible
{visible && (
  <DiceOverlay ... />
)}
```

### 3D Performance

For devices with low GPU power:

- Fallback to 2D rotation (detect via `window.matchMedia('(prefers-reduced-motion)')` or performance checks)
- Reduce die face count (show only top face during roll)
- Use sprite sheet instead of 3D CSS

## 9. Testing Requirements

### Unit Tests

```typescript
describe('DiceOverlay Component', () => {
  test('renders when visible is true', () => {
    render(<DiceOverlay visible={true} roller="east" />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('does not render when visible is false', () => {
    render(<DiceOverlay visible={false} roller="east" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('displays correct dice result', () => {
    render(<DiceOverlay visible={true} dice={[3, 4]} result={7} roller="east" />);
    expect(screen.getByText(/rolled: 7/i)).toBeInTheDocument();
  });

  test('calls onComplete when animation finishes', async () => {
    const handleComplete = jest.fn();
    render(
      <DiceOverlay
        visible={true}
        dice={[2, 5]}
        result={7}
        roller="east"
        onComplete={handleComplete}
        rollDuration={100}
        revealDuration={100}
      />
    );

    await waitFor(() => expect(handleComplete).toHaveBeenCalled(), { timeout: 500 });
  });

  test('shows Skip button when allowSkip is true', () => {
    render(<DiceOverlay visible={true} roller="east" allowSkip={true} />);
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
  });

  test('calls onDismiss when Skip button is clicked', () => {
    const handleDismiss = jest.fn();
    render(
      <DiceOverlay visible={true} roller="east" allowSkip={true} onDismiss={handleDismiss} />
    );
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(handleDismiss).toHaveBeenCalled();
  });

  test('displays wall break calculation when showBreakCalculation is true', () => {
    render(
      <DiceOverlay
        visible={true}
        dice={[5, 6]}
        result={11}
        roller="east"
        showBreakCalculation={true}
        breakPosition={11}
      />
    );
    expect(screen.getByText(/breaking wall at position 11/i)).toBeInTheDocument();
  });

  test('announces result to screen readers', () => {
    render(<DiceOverlay visible={true} dice={[3, 3]} result={6} roller="east" />);
    const description = screen.getByText(/east rolled 6/i);
    expect(description).toBeInTheDocument();
  });

  test('handles Escape key to dismiss', () => {
    const handleComplete = jest.fn();
    render(
      <DiceOverlay
        visible={true}
        dice={[1, 1]}
        result={2}
        roller="east"
        onComplete={handleComplete}
        animationState="complete"
      />
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(handleComplete).toHaveBeenCalled();
  });

  test('cycles through animation states correctly', async () => {
    const { rerender } = render(
      <DiceOverlay visible={true} dice={[2, 4]} roller="east" animationState="rolling" />
    );
    expect(screen.getByText(/rolling/i)).toBeInTheDocument();

    rerender(
      <DiceOverlay visible={true} dice={[2, 4]} roller="east" animationState="revealing" />
    );
    await waitFor(() => expect(screen.getByText(/rolled: 6/i)).toBeInTheDocument());

    rerender(
      <DiceOverlay visible={true} dice={[2, 4]} roller="east" animationState="complete" />
    );
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  test('respects reduced motion preference', () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const { container } = render(
      <DiceOverlay visible={true} dice={[3, 4]} roller="east" />
    );
    expect(container.querySelector('.dice-no-animation')).toBeInTheDocument();
  });

  test('renders dice with correct number of dots', () => {
    const { container } = render(
      <DiceOverlay visible={true} dice={[5, 3]} roller="east" animationState="complete" />
    );
    const dice = container.querySelectorAll('.die');
    expect(dice[0].querySelectorAll('.die-dot')).toHaveLength(5);
    expect(dice[1].querySelectorAll('.die-dot')).toHaveLength(3);
  });
});
```

### Integration Tests

```typescript
describe('DiceOverlay Integration', () => {
  test('integrates with game start flow', async () => {
    const { container } = render(<GameStartFlow />);

    // Wait for dice overlay to appear
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    // Wait for animation to complete
    await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

    // Click continue
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Overlay should disappear
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Game board should be visible
    expect(container.querySelector('.game-board')).toBeInTheDocument();
  });

  test('wall break position is correctly calculated and displayed', () => {
    const rollResult = { east: [5, 6], total: 11 };
    render(<DiceOverlay visible={true} dice={rollResult.east} result={rollResult.total} roller="east" showBreakCalculation={true} breakPosition={11} />);

    expect(screen.getByText(/breaking wall at position 11/i)).toBeInTheDocument();
  });
});
```

### Visual Regression Tests

Use Storybook for visual states:

```typescript
export default {
  title: 'Components/DiceOverlay',
  component: DiceOverlay,
};

export const Rolling = () => (
  <DiceOverlay visible={true} roller="east" animationState="rolling" />
);

export const Revealing = () => (
  <DiceOverlay visible={true} dice={[3, 4]} result={7} roller="east" animationState="revealing" />
);

export const Complete = () => (
  <DiceOverlay
    visible={true}
    dice={[5, 6]}
    result={11}
    roller="east"
    animationState="complete"
    showBreakCalculation={true}
    breakPosition={11}
  />
);

export const WithSkip = () => (
  <DiceOverlay visible={true} roller="east" allowSkip={true} animationState="rolling" />
);
```

## 10. Implementation Notes

### Animation State Machine

```typescript
type AnimationState = 'idle' | 'rolling' | 'revealing' | 'complete';

const [state, setState] = useState<AnimationState>('idle');

useEffect(() => {
  if (!visible) {
    setState('idle');
    return;
  }

  setState('rolling');
  const rollTimer = setTimeout(() => setState('revealing'), rollDuration);
  const revealTimer = setTimeout(() => setState('complete'), rollDuration + revealDuration);

  return () => {
    clearTimeout(rollTimer);
    clearTimeout(revealTimer);
  };
}, [visible, rollDuration, revealDuration]);
```

### Dice Rotation Logic

```typescript
// Generate random rotation angles for tumbling effect
const getRandomRotation = () => ({
  x: Math.random() * 720 + 360, // 1-3 full rotations
  y: Math.random() * 720 + 360,
  z: Math.random() * 720 + 360,
});

// Calculate final rotation to show correct face
const getFinalRotation = (value: number) => {
  const rotations = {
    1: { x: 0, y: 0, z: 0 },
    2: { x: 0, y: 90, z: 0 },
    3: { x: 0, y: 180, z: 0 },
    4: { x: 0, y: -90, z: 0 },
    5: { x: 90, y: 0, z: 0 },
    6: { x: -90, y: 0, z: 0 },
  };
  return rotations[value as keyof typeof rotations];
};
```

### Accessibility Announcements

```typescript
useEffect(() => {
  if (state === 'revealing' && result) {
    announceToScreenReader(`${roller} rolled ${result}`);
  }
  if (state === 'complete' && showBreakCalculation && breakPosition) {
    announceToScreenReader(`Breaking wall at position ${breakPosition}`);
  }
}, [state, roller, result, showBreakCalculation, breakPosition]);
```

## 11. CSS Module (DiceOverlay.module.css)

```css
/* Overlay backdrop */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--dice-overlay-backdrop);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fade-in 300ms ease-out;
}

.overlay-exit {
  animation: fade-out 300ms ease-in;
}

/* Skip button */
.skip-button {
  position: absolute;
  top: 24px;
  right: 24px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  color: var(--dice-text-primary);
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 200ms ease;
}

.skip-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Title and text */
.title {
  font-family: var(--dice-title-font);
  font-size: var(--dice-title-size);
  font-weight: var(--dice-title-weight);
  color: var(--dice-text-primary);
  margin-bottom: 32px;
  text-align: center;
}

.result-text {
  font-family: var(--dice-result-font);
  font-size: var(--dice-result-size);
  font-weight: var(--dice-result-weight);
  color: var(--dice-highlight);
  margin: 24px 0;
  text-align: center;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.description {
  font-family: var(--dice-description-font);
  font-size: var(--dice-description-size);
  font-weight: var(--dice-description-weight);
  color: var(--dice-text-secondary);
  margin-top: 16px;
  text-align: center;
  max-width: 600px;
  line-height: 1.5;
}

/* Dice container */
.dice-container {
  display: flex;
  gap: 40px;
  perspective: 1000px;
  margin: 32px 0;
}

/* Single die */
.die {
  width: 80px;
  height: 80px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 1.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);
}

.die-rolling {
  animation: tumble 1.5s ease-in-out infinite;
}

/* Die face */
.die-face {
  position: absolute;
  width: 80px;
  height: 80px;
  background: var(--dice-bg);
  border: 2px solid var(--dice-edge);
  border-radius: 8px;
  display: grid;
  grid-template: repeat(3, 1fr) / repeat(3, 1fr);
  padding: 8px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.die-face-1 {
  transform: rotateY(0deg) translateZ(40px);
}
.die-face-2 {
  transform: rotateY(90deg) translateZ(40px);
}
.die-face-3 {
  transform: rotateY(180deg) translateZ(40px);
}
.die-face-4 {
  transform: rotateY(-90deg) translateZ(40px);
}
.die-face-5 {
  transform: rotateX(90deg) translateZ(40px);
}
.die-face-6 {
  transform: rotateX(-90deg) translateZ(40px);
}

/* Die dot */
.die-dot {
  width: 12px;
  height: 12px;
  background: var(--dice-dots);
  border-radius: 50%;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Dot positioning for each face */
.face-1 .die-dot:nth-child(1) {
  grid-area: 2 / 2;
}

.face-2 .die-dot:nth-child(1) {
  grid-area: 1 / 1;
}
.face-2 .die-dot:nth-child(2) {
  grid-area: 3 / 3;
}

.face-3 .die-dot:nth-child(1) {
  grid-area: 1 / 1;
}
.face-3 .die-dot:nth-child(2) {
  grid-area: 2 / 2;
}
.face-3 .die-dot:nth-child(3) {
  grid-area: 3 / 3;
}

.face-4 .die-dot:nth-child(1) {
  grid-area: 1 / 1;
}
.face-4 .die-dot:nth-child(2) {
  grid-area: 1 / 3;
}
.face-4 .die-dot:nth-child(3) {
  grid-area: 3 / 1;
}
.face-4 .die-dot:nth-child(4) {
  grid-area: 3 / 3;
}

.face-5 .die-dot:nth-child(1) {
  grid-area: 1 / 1;
}
.face-5 .die-dot:nth-child(2) {
  grid-area: 1 / 3;
}
.face-5 .die-dot:nth-child(3) {
  grid-area: 2 / 2;
}
.face-5 .die-dot:nth-child(4) {
  grid-area: 3 / 1;
}
.face-5 .die-dot:nth-child(5) {
  grid-area: 3 / 3;
}

.face-6 .die-dot:nth-child(1) {
  grid-area: 1 / 1;
}
.face-6 .die-dot:nth-child(2) {
  grid-area: 1 / 3;
}
.face-6 .die-dot:nth-child(3) {
  grid-area: 2 / 1;
}
.face-6 .die-dot:nth-child(4) {
  grid-area: 2 / 3;
}
.face-6 .die-dot:nth-child(5) {
  grid-area: 3 / 1;
}
.face-6 .die-dot:nth-child(6) {
  grid-area: 3 / 3;
}

/* Continue button */
.continue-button {
  margin-top: 32px;
  padding: 12px 32px;
  background: var(--dice-accent);
  color: var(--color-white);
  border: none;
  border-radius: var(--radius-md);
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms ease;
}

.continue-button:hover {
  background: var(--color-primary-dark);
  transform: scale(1.05);
}

.continue-button:focus-visible {
  outline: 2px solid var(--color-white);
  outline-offset: 4px;
}

/* Animations */
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes tumble {
  0% {
    transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg);
  }
  25% {
    transform: rotateX(180deg) rotateY(90deg) rotateZ(45deg);
  }
  50% {
    transform: rotateX(360deg) rotateY(180deg) rotateZ(90deg);
  }
  75% {
    transform: rotateX(540deg) rotateY(270deg) rotateZ(135deg);
  }
  100% {
    transform: rotateX(720deg) rotateY(360deg) rotateZ(180deg);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .overlay {
    animation: none;
  }

  .die-rolling {
    animation: none;
  }

  .die {
    transition: none;
  }
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .die {
    width: 48px;
    height: 48px;
  }

  .die-face {
    width: 48px;
    height: 48px;
  }

  .die-dot {
    width: 8px;
    height: 8px;
  }

  .title {
    font-size: 20px;
  }

  .result-text {
    font-size: 28px;
  }

  .description {
    font-size: 14px;
  }

  .dice-container {
    gap: 24px;
  }
}
```

## 12. Dependencies

### Required Packages

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "classnames": "^2.3.2"
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0"
  }
}
```

### Optional Sound Effects

If implementing sound:

- Use Web Audio API for dice rattle and landing sounds
- Respect user's sound preferences
- Provide mute option

---

**Status**: Draft  
**Last Updated**: 2026-01-31  
**Related Specs**: `Wall.md`, `GameBoard.md`, `PlayerSeatIndicator.md`
