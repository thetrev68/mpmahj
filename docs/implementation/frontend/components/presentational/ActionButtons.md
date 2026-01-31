# ActionButtons Component Specification

## Component Type

**Presentational Component**

## Purpose

Primary game action buttons for discarding tiles, exposing melds, passing tiles (Charleston), and calling Mahjong. Context-aware button states based on game phase and available actions.

## Related User Stories

- US-011: Draw Tile (discard action after drawing)
- US-012: Discard Tile (primary discard action)
- US-014: Call Mahjong (declare win)
- US-016: Expose Meld (call pung/kong/quint)
- US-018: Charleston (pass tiles during Charleston phases)
- US-040: Joker Exchange (special joker exchange action)

## TypeScript Interface

```typescript
export interface ActionButtonsProps {
  /** Current game phase */
  gamePhase: GamePhase;

  /** Available actions for current player */
  availableActions: GameAction[];

  /** Callback when action is triggered */
  onAction: (action: GameAction) => void;

  /** Selected tiles for actions requiring selection */
  selectedTiles?: number[];

  /** Display variant */
  variant?: 'full' | 'compact' | 'minimal';

  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical';

  /** Show keyboard shortcuts on buttons */
  showShortcuts?: boolean;

  /** Disable all buttons (e.g., waiting for opponent) */
  disabled?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export type GamePhase = 'charleston' | 'playing' | 'waiting' | 'ended';

export type GameAction =
  | 'discard'
  | 'expose-pung'
  | 'expose-kong'
  | 'expose-quint'
  | 'expose-sextet'
  | 'call-mahjong'
  | 'pass-right'
  | 'pass-across'
  | 'pass-left'
  | 'blind-pass'
  | 'joker-exchange'
  | 'decline';
```

## Internal State

```typescript
interface ActionButtonsState {
  /** Hovered action */
  hoveredAction: GameAction | null;

  /** Confirm dialog state for critical actions */
  showConfirm: GameAction | null;
}
```

## State Management

**Internal useState** for hover and confirmation states. Available actions and handlers managed by parent component.

## Visual Design

### Variant Styles

#### Full (Default)

- Large buttons (48px height)
- Icons + text labels
- Keyboard shortcuts visible
- Use for: Desktop main game view

#### Compact

- Medium buttons (40px height)
- Icons + abbreviated text
- Shortcuts on hover
- Use for: Tablet, reduced space

#### Minimal

- Small icon-only buttons (32px)
- Tooltips for labels
- No shortcuts shown
- Use for: Mobile, very limited space

### Button Styling

#### Primary Actions (Discard, Call Mahjong)

- **Background**: `var(--color-primary)` (#2563eb)
- **Text**: White
- **Hover**: Darker blue (#1d4ed8)
- **Size**: Larger (56px height for full variant)
- **Icon**: Prominent, 24px

#### Secondary Actions (Expose, Pass)

- **Background**: `var(--color-background)` (#ffffff)
- **Border**: 2px solid `var(--color-border)` (#d1d5db)
- **Text**: `var(--color-text-primary)` (#111827)
- **Hover**: `var(--color-background-secondary)` (#f3f4f6)
- **Size**: Standard (48px height)

#### Destructive Actions (Decline, Cancel)

- **Background**: `var(--color-background)`
- **Border**: 2px solid `var(--color-error)` (#ef4444)
- **Text**: `var(--color-error)`
- **Hover**: Light red background
- **Size**: Standard

#### Disabled State

- **Opacity**: 0.5
- **Cursor**: not-allowed
- **Tooltip**: "Cannot perform action" with reason

### Action-Specific Styling

#### Discard

- **Icon**: Tile with X or discard pile
- **Color**: Primary blue
- **Shortcut**: D
- **Label**: "Discard" or "Discard Tile"

#### Call Mahjong

- **Icon**: Trophy or celebration
- **Color**: Success green (`var(--color-success)`)
- **Shortcut**: M
- **Label**: "Mahjong!" (emphatic)
- **Animation**: Pulsing glow when available

#### Expose Meld (Pung/Kong/Quint/Sextet)

- **Icon**: Grouped tiles
- **Color**: Primary blue
- **Shortcut**: E
- **Label**: "Expose Pung/Kong/etc."
- **Submenu**: Show meld type options

#### Pass (Charleston)

- **Icon**: Arrow pointing direction (→/←/↑)
- **Color**: Seat color for target direction
- **Shortcut**: P
- **Label**: "Pass Right/Across/Left"

#### Blind Pass

- **Icon**: Covered tiles with arrow
- **Color**: Purple/magenta
- **Shortcut**: B
- **Label**: "Blind Pass"

#### Joker Exchange

- **Icon**: Joker tile with swap arrows
- **Color**: Gold/amber
- **Shortcut**: J
- **Label**: "Exchange Joker"

#### Decline

- **Icon**: X or cancel
- **Color**: Error red
- **Shortcut**: Escape
- **Label**: "Decline" or "Skip"

### Keyboard Shortcuts Display

- **Badge**: Small rounded pill
- **Background**: rgba(0, 0, 0, 0.1)
- **Font**: Monospace, bold
- **Position**: Right side of button text
- **Example**: `<kbd>D</kbd>`

### Confirmation Dialogs

- **Trigger**: Critical actions (Call Mahjong, large tile passes)
- **Style**: Modal overlay with action preview
- **Buttons**: "Confirm" (primary) + "Cancel" (secondary)
- **Content**: Show tiles involved, action consequence

## Accessibility

### ARIA Attributes

- `role="group"` for button group container
- `aria-label="Game actions"` for container
- `aria-disabled="true"` for disabled buttons
- `aria-keyshortcuts` on each button (e.g., `aria-keyshortcuts="d"`)
- `aria-describedby` linking to action tooltips

### Keyboard Support

- **D**: Discard selected tile
- **M**: Call Mahjong
- **E**: Expose meld (opens submenu)
- **P**: Pass tiles (Charleston)
- **B**: Blind pass
- **J**: Joker exchange
- **Escape**: Decline/cancel
- **Tab**: Navigate between buttons
- **Enter/Space**: Activate focused button

### Screen Reader Support

- Announce available actions: "3 actions available"
- Announce button labels with shortcuts: "Discard, keyboard shortcut D"
- Announce disabled state: "Discard disabled, select a tile first"
- Announce confirmation dialogs

### Visual Accessibility

- High contrast for all button states
- Icons + text labels (redundant coding)
- Focus visible (ring)
- Touch targets min 44px height

## Dependencies

### External

- React (hooks: `useState`, `useCallback`, `useEffect`)
- `clsx` for conditional class names

### Internal

- `@/components/ui/Button` - Base button component
- `@/components/ui/Modal` - Confirmation dialogs
- `@/components/ui/Tooltip` - Action tooltips
- `@/components/icons/` - Action icons
- `@/hooks/useKeyboardShortcuts` - Keyboard handler
- `@/styles/actionButtons.module.css` - Component styles

### Generated Types

- `@/types/bindings/generated/Command.ts` - Game commands from Rust
- `@/types/bindings/generated/GamePhase.ts` - Game phase enum

## Implementation Notes

### Action Availability Logic

```typescript
const isActionAvailable = (action: GameAction, context: GameContext): boolean => {
  switch (action) {
    case 'discard':
      return context.selectedTiles.length === 1 && context.gamePhase === 'playing';

    case 'call-mahjong':
      return context.canWin && context.selectedTiles.length === 0;

    case 'expose-pung':
      return context.canExposePung && context.selectedTiles.length === 2;

    case 'pass-right':
      return context.gamePhase === 'charleston' && context.charlestonPhase === 'FirstRight';

    default:
      return false;
  }
};
```

### Keyboard Shortcut Handler

```typescript
const handleKeyPress = useCallback(
  (event: KeyboardEvent) => {
    if (disabled) return;

    const action = keyToAction[event.key.toLowerCase()];
    if (action && availableActions.includes(action)) {
      event.preventDefault();
      onAction(action);
    }
  },
  [disabled, availableActions, onAction]
);

useEffect(() => {
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [handleKeyPress]);
```

### Confirmation Flow

```typescript
const handleAction = (action: GameAction) => {
  if (requiresConfirmation(action)) {
    setShowConfirm(action);
  } else {
    onAction(action);
  }
};

const requiresConfirmation = (action: GameAction): boolean => {
  return action === 'call-mahjong' || action === 'blind-pass';
};
```

### Dynamic Button Rendering

```typescript
const buttonConfigs: Record<GameAction, ButtonConfig> = {
  'discard': {
    icon: <DiscardIcon />,
    label: 'Discard',
    shortcut: 'D',
    variant: 'primary',
  },
  'call-mahjong': {
    icon: <TrophyIcon />,
    label: 'Mahjong!',
    shortcut: 'M',
    variant: 'success',
  },
  // ... more actions
};

return availableActions.map(action => {
  const config = buttonConfigs[action];
  return (
    <Button
      key={action}
      onClick={() => handleAction(action)}
      disabled={!isActionEnabled(action)}
      variant={config.variant}
      {...config}
    />
  );
});
```

## Test Scenarios

### Unit Tests

```typescript
describe('ActionButtons', () => {
  it('renders available actions only', () => {
    // Only actions in availableActions should render
  });

  it('disables all buttons when disabled prop true', () => {
    // All buttons should be disabled
  });

  it('handles discard action', () => {
    // Clicking Discard should call onAction('discard')
  });

  it('shows confirmation for Mahjong', () => {
    // Call Mahjong should show confirmation dialog
  });

  it('handles keyboard shortcuts', () => {
    // Pressing 'D' should trigger discard
  });

  it('shows keyboard shortcuts when showShortcuts=true', () => {
    // Shortcuts should be visible
  });

  it('applies variant styles', () => {
    // variant='compact' should use compact sizing
  });

  it('disables actions when context invalid', () => {
    // Discard disabled when no tile selected
  });

  it('shows tooltips on hover', () => {
    // Hovering button should show action tooltip
  });
});
```

### Integration Tests

```typescript
describe('ActionButtons Integration', () => {
  it('integrates with game phase changes', () => {
    // Buttons update when game phase changes
  });

  it('integrates with tile selection', () => {
    // Discard enables when tile selected
  });

  it('integrates with win detection', () => {
    // Call Mahjong enables when player can win
  });
});
```

### Visual Regression Tests

- All variants (full, compact, minimal)
- All orientations (horizontal, vertical)
- All action combinations
- Disabled states
- Confirmation dialogs
- Keyboard shortcut badges

## Usage Examples

### Full Game View

```tsx
import { ActionButtons } from '@/components/game/ActionButtons';

function GameView({ game, selectedTiles, onAction }) {
  const availableActions = calculateAvailableActions(game, selectedTiles);

  return (
    <div className="game-actions">
      <ActionButtons
        gamePhase={game.phase}
        availableActions={availableActions}
        onAction={onAction}
        selectedTiles={selectedTiles}
        variant="full"
        showShortcuts
      />
    </div>
  );
}
```

### Charleston Phase

```tsx
function CharlestonView({ game, selectedTiles, onPass }) {
  const passActions = ['pass-right', 'pass-across', 'pass-left'];

  return (
    <ActionButtons
      gamePhase="charleston"
      availableActions={passActions}
      onAction={onPass}
      selectedTiles={selectedTiles}
      orientation="horizontal"
    />
  );
}
```

### Mobile Compact View

```tsx
function MobileGameActions({ availableActions, onAction }) {
  return (
    <ActionButtons
      gamePhase="playing"
      availableActions={availableActions}
      onAction={onAction}
      variant="minimal"
      orientation="horizontal"
      showShortcuts={false}
    />
  );
}
```

### With Confirmation Dialog

```tsx
function ActionButtonsWithConfirm() {
  const [showConfirm, setShowConfirm] = useState<GameAction | null>(null);

  const handleAction = (action: GameAction) => {
    if (action === 'call-mahjong') {
      setShowConfirm(action);
    } else {
      executeAction(action);
    }
  };

  return (
    <>
      <ActionButtons availableActions={['discard', 'call-mahjong']} onAction={handleAction} />

      {showConfirm && (
        <ConfirmMahjongDialog
          onConfirm={() => {
            executeAction(showConfirm);
            setShowConfirm(null);
          }}
          onCancel={() => setShowConfirm(null)}
        />
      )}
    </>
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.action-buttons {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.action-buttons--horizontal {
  flex-direction: row;
  justify-content: center;
}

.action-buttons--vertical {
  flex-direction: column;
  align-items: stretch;
}

.action-buttons--disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* Action button base */
.action-button {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--font-semibold);
  transition: all 0.2s ease;
}

/* Variants */
.action-button--full {
  height: 48px;
  padding: 0 var(--space-4);
  font-size: var(--text-base);
}

.action-button--compact {
  height: 40px;
  padding: 0 var(--space-3);
  font-size: var(--text-sm);
}

.action-button--minimal {
  height: 32px;
  width: 32px;
  padding: 0;
  justify-content: center;
}

/* Action types */
.action-button--discard {
  background: var(--color-primary);
  color: white;
  height: 56px; /* Larger for primary action */
}

.action-button--discard:hover:not(:disabled) {
  background: #1d4ed8;
}

.action-button--mahjong {
  background: var(--color-success);
  color: white;
  animation: pulse-mahjong 2s ease-in-out infinite;
}

.action-button--mahjong:hover:not(:disabled) {
  background: #059669;
}

.action-button--expose {
  background: var(--color-background);
  border: 2px solid var(--color-primary);
  color: var(--color-primary);
}

.action-button--pass {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  color: var(--color-text-primary);
}

.action-button--decline {
  background: var(--color-background);
  border: 2px solid var(--color-error);
  color: var(--color-error);
}

/* Button icon */
.action-button__icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.action-button--full .action-button__icon {
  width: 24px;
  height: 24px;
}

.action-button--minimal .action-button__icon {
  width: 16px;
  height: 16px;
}

/* Button label */
.action-button__label {
  flex: 1;
  text-align: left;
}

.action-button--minimal .action-button__label {
  display: none; /* Icon only */
}

/* Keyboard shortcut badge */
.action-button__shortcut {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 20px;
  padding: 0 var(--space-1);
  background: rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
}

/* Disabled state */
.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Focus state */
.action-button:focus {
  outline: none;
  box-shadow: var(--shadow-focus);
}

/* Animations */
@keyframes pulse-mahjong {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .action-buttons--horizontal {
    flex-wrap: wrap;
  }

  .action-button--full {
    flex: 1 1 calc(50% - var(--space-2));
  }
}

@media (max-width: 480px) {
  .action-buttons {
    padding: var(--space-2);
    gap: var(--space-2);
  }

  .action-button--full {
    height: 40px;
    font-size: var(--text-sm);
  }
}
```

## Future Enhancements

- [ ] Action history/undo preview
- [ ] Visual feedback animations (tile flying to discard pile)
- [ ] Voice commands for actions
- [ ] Customizable keyboard shortcuts
- [ ] Action tooltips with tile previews
- [ ] Quick action gestures (swipe to discard)
- [ ] Action cooldown indicators
- [ ] Contextual action suggestions (AI hints)
- [ ] Multi-step action flows (expose submenu)
- [ ] Action macros (quick pass all 3 tiles)

## Notes

- Only available actions should be rendered (hide unavailable)
- Discard requires exactly 1 selected tile
- Expose actions require correct number of matching tiles
- Call Mahjong should always show confirmation to prevent accidents
- Keyboard shortcuts critical for power users
- Button order: Primary (Discard/Mahjong) → Secondary (Expose/Pass) → Destructive (Decline)
- Mobile users rely on touch, desktop users on keyboard
- Charleston phase shows pass directions with directional arrows
- Joker exchange is special case, only available with exposed melds
- Blind pass allows selecting 0-2 tiles (not full 3)
- Animation on Call Mahjong draws attention to winning opportunity
- Tooltips should explain why action is disabled ("Select 2 matching tiles to expose pung")
- Consider haptic feedback on mobile for action confirmation
- Action buttons should be sticky/fixed position during game (always accessible)
- Orientation adjusts based on available screen space
- Full variant best for desktop, minimal for mobile portrait
