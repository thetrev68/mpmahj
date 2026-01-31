# CallDeclaration Component Specification

## Component Type

**Presentational Component**

## Purpose

Modal overlay for declaring major game actions: calling Mahjong (winning), initiating Charleston tile passes, and executing Joker exchanges. Provides visual confirmation and tile selection interface for critical game moments.

## Related User Stories

- US-014: Call Mahjong (declare winning hand)
- US-018: Charleston (pass tiles between players)
- US-040: Joker Exchange (swap joker for exposed tile)
- US-016: Expose Meld (confirm meld exposure)

## TypeScript Interface

```typescript
export interface CallDeclarationProps {
  /** Type of call being declared */
  callType: CallType;

  /** Whether modal is open */
  isOpen: boolean;

  /** Callback when call is confirmed */
  onConfirm: (data: CallData) => void;

  /** Callback when call is cancelled */
  onCancel: () => void;

  /** Player's current hand (for context) */
  playerHand: number[];

  /** Matched pattern (for Mahjong calls) */
  matchedPattern?: Pattern;

  /** Selected tiles for action */
  selectedTiles?: number[];

  /** Available melds (for Joker exchange) */
  exposedMelds?: Meld[];

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export type CallType = 'mahjong' | 'charleston-pass' | 'joker-exchange' | 'expose-meld';

export interface CallData {
  /** Type of call */
  type: CallType;

  /** Selected tiles for action */
  tiles: number[];

  /** Target meld (for joker exchange) */
  targetMeld?: number;

  /** Pattern matched (for Mahjong) */
  pattern?: string;
}

export interface Pattern {
  id: string;
  name: string;
  section: number;
  patternNumber: number;
  points: number;
  composition: string[];
}

export interface Meld {
  id: number;
  tiles: number[];
  type: 'pung' | 'kong' | 'quint' | 'sextet';
}
```

## Internal State

```typescript
interface CallDeclarationState {
  /** Currently selected tiles within modal */
  modalSelectedTiles: number[];

  /** Selected target meld (joker exchange) */
  selectedMeld: number | null;

  /** Confirmation step (for multi-step flows) */
  step: 'select' | 'confirm';
}
```

## State Management

**Internal useState** for modal-specific selections and step flow. Parent manages open/close state and final confirmation.

## Visual Design

### Modal Container

- **Backdrop**: Semi-transparent black (rgba(0, 0, 0, 0.6))
- **Modal**: Centered, white background
- **Width**: 600px (desktop), 90vw (mobile)
- **Border radius**: `var(--radius-lg)` (8px)
- **Shadow**: `var(--shadow-2xl)`
- **Animation**: Fade in + scale (200ms ease-out)

### Call-Specific Layouts

#### Mahjong Declaration

```
+---------------------------------------------------+
|  🎉 Mahjong! 🎉                            [X]   |
+---------------------------------------------------+
|  Pattern: 2-3 "Consecutive Run"                   |
|  Points: 35                                       |
|                                                   |
|  Your Hand:                                       |
|  [1B][2B][3B] [4C][5C][6C] [7D][8D][9D] [1F][1F]  |
|                                                   |
|  ✓ All tiles match pattern                       |
|  ✓ No tiles exposed (Concealed bonus)            |
|                                                   |
|  [Cancel]                      [Declare Mahjong!] |
+---------------------------------------------------+
```

#### Charleston Pass

```
+---------------------------------------------------+
|  Pass Tiles Right                          [X]   |
+---------------------------------------------------+
|  Select 3 tiles to pass to East player:          |
|                                                   |
|  Your Hand:                                       |
|  [Click tiles to select]                          |
|  [1B] [2B] [3B] [4C] [5C] [6C] [7D]...           |
|                                                   |
|  Selected (2/3):                                  |
|  [1B] [2B]                                        |
|                                                   |
|  [Cancel]                          [Pass Tiles →] |
+---------------------------------------------------+
```

#### Joker Exchange

```
+---------------------------------------------------+
|  Exchange Joker                            [X]   |
+---------------------------------------------------+
|  Replace joker in exposed meld:                   |
|                                                   |
|  Available Melds:                                 |
|  ○ [1B][2B][🃏] - Your Pung                      |
|  ○ [5C][5C][5C][🃏] - Opponent's Kong            |
|                                                   |
|  Your matching tile: [2B]                         |
|                                                   |
|  After exchange:                                  |
|  Meld: [1B][2B][2B]                              |
|  You receive: [🃏]                                |
|                                                   |
|  [Cancel]                        [Exchange Joker] |
+---------------------------------------------------+
```

### Header Section

- **Title**: Large, bold, centered
- **Icon**: Emoji or icon matching call type
- **Close button**: X in top-right corner
- **Color bar**: Top border in semantic color

### Content Section

- **Instructions**: Clear, concise text
- **Tile display**: Interactive hand view
- **Selection preview**: Show selected tiles
- **Validation messages**: Real-time feedback

### Footer Section

- **Cancel button**: Secondary, left-aligned
- **Confirm button**: Primary, right-aligned, disabled until valid
- **Button gap**: `var(--space-3)` (12px)

### Color Coding

#### Mahjong Call

- **Color**: `var(--color-success)` (#10b981) - Green
- **Icon**: 🎉 Trophy/celebration
- **Mood**: Celebratory, exciting

#### Charleston Pass

- **Color**: `var(--color-primary)` (#2563eb) - Blue
- **Icon**: → ← ↑ (directional arrows)
- **Mood**: Neutral, informative

#### Joker Exchange

- **Color**: `var(--color-warning)` (#f59e0b) - Amber/gold
- **Icon**: 🃏 Joker tile
- **Mood**: Strategic, cautionary

### Tile Selection

- **Selectable tiles**: Cursor pointer, hover effect
- **Selected tiles**: Blue border, slightly raised
- **Invalid tiles**: Greyed out, cursor not-allowed
- **Counter**: "Selected (2/3)" below hand

### Validation Messages

- **Valid**: Green checkmark + text
- **Invalid**: Red X + reason
- **Warning**: Yellow warning icon + text

## Accessibility

### ARIA Attributes

- `role="dialog"` for modal
- `aria-modal="true"` on modal
- `aria-labelledby` linking to modal title
- `aria-describedby` linking to instructions
- `aria-live="polite"` for validation messages
- `aria-disabled` on confirm button when invalid

### Keyboard Support

- **Escape**: Close modal (triggers onCancel)
- **Tab**: Navigate interactive elements
- **Shift+Tab**: Navigate backwards
- **Enter**: Confirm action (when valid)
- **Arrow keys**: Navigate tiles
- **Space**: Select/deselect tile

### Screen Reader Support

- Announce modal opening: "Mahjong declaration dialog opened"
- Announce tile selection: "Tile 1 Bam selected, 2 of 3 selected"
- Announce validation: "All tiles match pattern"
- Announce confirmation: "Mahjong declared"

### Visual Accessibility

- High contrast for all text
- Focus visible on interactive elements
- Error states with icons + text (not color alone)
- Touch targets min 44px

## Dependencies

### External

- React (hooks: `useState`, `useEffect`, `useCallback`)
- `clsx` for conditional class names
- `react-modal` or custom modal implementation

### Internal

- `@/components/ui/Modal` - Base modal component
- `@/components/ui/Button` - Action buttons
- `@/components/game/TileImage` - Tile rendering
- `@/components/game/TileGroup` - Hand display
- `@/components/game/PatternCard` - Pattern preview (Mahjong)
- `@/components/icons/` - Various icons
- `@/styles/callDeclaration.module.css` - Component styles

### Generated Types

- `@/types/bindings/generated/Command.ts` - Game commands
- `@/types/bindings/generated/Pattern.ts` - Pattern type
- `@/types/bindings/generated/Meld.ts` - Meld type

## Implementation Notes

### Modal Focus Management

```typescript
useEffect(() => {
  if (isOpen) {
    // Trap focus within modal
    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTab);
    return () => modal.removeEventListener('keydown', handleTab);
  }
}, [isOpen]);
```

### Tile Selection Validation

```typescript
const validateSelection = (
  selected: number[],
  callType: CallType
): { valid: boolean; message: string } => {
  switch (callType) {
    case 'charleston-pass':
      if (selected.length < 3) {
        return { valid: false, message: `Select ${3 - selected.length} more tile(s)` };
      }
      return { valid: true, message: '✓ Ready to pass' };

    case 'joker-exchange':
      if (selected.length !== 1) {
        return { valid: false, message: 'Select the tile to exchange' };
      }
      return { valid: true, message: '✓ Valid exchange' };

    default:
      return { valid: true, message: '' };
  }
};
```

### Mahjong Pattern Validation

```typescript
const validateMahjongHand = (hand: number[], pattern: Pattern): boolean => {
  // Call to pattern validation from game engine
  return validateHandAgainstPattern(hand, pattern);
};
```

### Charleston Direction Display

```typescript
const getPassDirection = (
  phase: CharlestonPhase
): {
  direction: string;
  arrow: string;
  targetSeat: Seat;
} => {
  const directions = {
    FirstRight: { direction: 'Right', arrow: '→', targetSeat: 'east' },
    FirstAcross: { direction: 'Across', arrow: '↑', targetSeat: 'north' },
    FirstLeft: { direction: 'Left', arrow: '←', targetSeat: 'west' },
  };

  return directions[phase];
};
```

## Test Scenarios

### Unit Tests

```typescript
describe('CallDeclaration', () => {
  it('renders correct content for Mahjong call', () => {
    // callType='mahjong' should show pattern info
  });

  it('renders correct content for Charleston', () => {
    // callType='charleston-pass' should show tile selection
  });

  it('handles tile selection', () => {
    // Clicking tiles should update selection
  });

  it('validates selection count', () => {
    // Charleston should require exactly 3 tiles
  });

  it('disables confirm when invalid', () => {
    // Confirm button disabled until valid selection
  });

  it('calls onConfirm with correct data', () => {
    // Confirming should pass selected tiles
  });

  it('calls onCancel on Escape', () => {
    // Escape key should trigger onCancel
  });

  it('traps focus within modal', () => {
    // Tab should cycle within modal
  });

  it('shows validation messages', () => {
    // Real-time feedback on selection
  });
});
```

### Integration Tests

```typescript
describe('CallDeclaration Integration', () => {
  it('integrates with game state', () => {
    // Modal reflects current game phase
  });

  it('validates pattern match for Mahjong', () => {
    // Mahjong call validates hand against pattern
  });

  it('updates game on confirmation', () => {
    // Confirmation triggers game state update
  });
});
```

### Visual Regression Tests

- All call types (Mahjong, Charleston, Joker exchange)
- Valid and invalid states
- Mobile and desktop layouts
- Tile selection states

## Usage Examples

### Mahjong Declaration

```tsx
import { CallDeclaration } from '@/components/game/CallDeclaration';

function GameView({ game }) {
  const [showMahjong, setShowMahjong] = useState(false);

  const handleMahjong = (data: CallData) => {
    declareWin(data.pattern);
    setShowMahjong(false);
  };

  return (
    <>
      <Button onClick={() => setShowMahjong(true)}>Call Mahjong</Button>

      <CallDeclaration
        callType="mahjong"
        isOpen={showMahjong}
        onConfirm={handleMahjong}
        onCancel={() => setShowMahjong(false)}
        playerHand={game.playerHand}
        matchedPattern={game.matchedPattern}
      />
    </>
  );
}
```

### Charleston Pass

```tsx
function CharlestonView({ game }) {
  const [showPass, setShowPass] = useState(false);

  const handlePass = (data: CallData) => {
    passTiles(data.tiles, game.charlestonPhase);
    setShowPass(false);
  };

  return (
    <CallDeclaration
      callType="charleston-pass"
      isOpen={showPass}
      onConfirm={handlePass}
      onCancel={() => setShowPass(false)}
      playerHand={game.playerHand}
    />
  );
}
```

### Joker Exchange

```tsx
function JokerExchangeModal({ isOpen, onClose, hand, melds }) {
  const handleExchange = (data: CallData) => {
    exchangeJoker(data.tiles[0], data.targetMeld);
    onClose();
  };

  return (
    <CallDeclaration
      callType="joker-exchange"
      isOpen={isOpen}
      onConfirm={handleExchange}
      onCancel={onClose}
      playerHand={hand}
      exposedMelds={melds}
    />
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.call-declaration {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.call-declaration__backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  animation: fade-in 200ms ease-out;
}

.call-declaration__modal {
  position: relative;
  width: 600px;
  max-width: 90vw;
  max-height: 90vh;
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2xl);
  overflow: hidden;
  animation: modal-enter 200ms ease-out;
}

/* Header */
.call-declaration__header {
  position: relative;
  padding: var(--space-6) var(--space-4) var(--space-4);
  text-align: center;
  border-bottom: 1px solid var(--color-border);
}

.call-declaration__header--mahjong {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, transparent 100%);
  border-top: 4px solid var(--color-success);
}

.call-declaration__header--charleston {
  border-top: 4px solid var(--color-primary);
}

.call-declaration__header--joker {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, transparent 100%);
  border-top: 4px solid var(--color-warning);
}

.call-declaration__title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
  margin: 0;
}

.call-declaration__close {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s ease;
}

.call-declaration__close:hover {
  background: var(--color-background-secondary);
}

/* Content */
.call-declaration__content {
  padding: var(--space-6);
  max-height: 60vh;
  overflow-y: auto;
}

.call-declaration__instructions {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-4);
}

.call-declaration__pattern-info {
  padding: var(--space-4);
  background: var(--color-background-secondary);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.call-declaration__pattern-name {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.call-declaration__pattern-points {
  font-size: var(--text-base);
  color: var(--color-primary);
  font-weight: var(--font-bold);
}

/* Tile display */
.call-declaration__hand {
  margin: var(--space-4) 0;
}

.call-declaration__selection-counter {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: var(--space-2);
}

.call-declaration__selected-tiles {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--color-primary-light);
  border-radius: var(--radius-md);
}

/* Validation */
.call-declaration__validation {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  margin-top: var(--space-4);
}

.call-declaration__validation--valid {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
}

.call-declaration__validation--invalid {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.call-declaration__validation-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* Footer */
.call-declaration__footer {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border);
  background: var(--color-background-secondary);
}

.call-declaration__cancel {
  /* Secondary button styles */
}

.call-declaration__confirm {
  /* Primary button styles */
}

.call-declaration__confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

@keyframes modal-enter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .call-declaration__modal {
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: none;
    border-radius: 0;
  }

  .call-declaration__content {
    max-height: none;
  }
}
```

## Future Enhancements

- [ ] Multi-step wizards for complex calls
- [ ] Undo last selection
- [ ] Tile sorting within modal
- [ ] Pattern suggestion (show alternatives)
- [ ] Animated tile movement preview
- [ ] Voice announcement of call
- [ ] Celebration animation on Mahjong
- [ ] History of previous calls in game
- [ ] Export call screenshot
- [ ] Tutorial tooltips for first-time users

## Notes

- Modal should trap focus and prevent background interaction
- Escape key always cancels, Enter confirms (when valid)
- Mahjong call should show pattern match validation
- Charleston shows directional arrows for pass target
- Joker exchange shows before/after meld state
- Tile selection within modal independent of main hand selection
- Validation feedback should be real-time, not on submit
- Confirm button disabled until valid selection
- Mobile layout should be fullscreen for better usability
- Color coding helps distinguish call types at a glance
- Celebration styling for Mahjong (most exciting moment!)
- Close button always visible in top-right
- Screen readers announce modal opening and validation state
- Consider animation performance on lower-end devices
- Body scroll should be locked when modal open
