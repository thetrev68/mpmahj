# useKeyboardShortcuts Hook

## Purpose

Global keyboard shortcut system for game actions. Enables power users to play efficiently without mouse clicks.

## User Stories

- All user stories (enhances UX across entire game)
- Accessibility: Keyboard-only navigation

## API

```typescript
interface UseKeyboardShortcutsOptions {
  /** Enable/disable shortcuts globally */
  enabled?: boolean;

  /** Custom key bindings */
  bindings?: Partial<KeyBindings>;
}

interface KeyBindings {
  // Tile selection
  selectTile: string[]; // Default: ['1'-'9', 'a'-'n'] for tile positions
  deselectAll: string; // Default: 'Escape'

  // Actions
  drawTile: string; // Default: 'Space'
  discardSelected: string; // Default: 'Enter'
  callPung: string; // Default: 'p'
  callKong: string; // Default: 'k'
  pass: string; // Default: 'x'

  // Charleston
  confirmPass: string; // Default: 'c'
  voteYes: string; // Default: 'y'
  voteNo: string; // Default: 'n'

  // UI
  toggleHint: string; // Default: 'h'
  toggleHistory: string; // Default: 't'
  undo: string; // Default: 'Ctrl+z' or 'Cmd+z'
}

function useKeyboardShortcuts(options?: UseKeyboardShortcutsOptions): void;
```

## Behavior

### Context-Aware

Shortcuts only active when appropriate:

- **Drawing phase:** 'Space' draws tile
- **Discarding phase:** '1'-'9' select tiles, 'Enter' discards
- **Call window:** 'p'/'k'/'x' for Pung/Kong/Pass
- **Charleston:** 'c' confirms tile selection

### Input Field Detection

Disable shortcuts when:

- User typing in text input
- Modal dialog open
- Chat window focused

### Visual Feedback

- Show key hints on hover (e.g., button shows "Press D" on hover)
- Highlight shortcut keys in UI
- "Press ? for shortcuts" tooltip

## Implementation Notes

### Event Listener

```typescript
useEffect(() => {
  if (!enabled) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore if typing
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const key = e.key.toLowerCase();
    const gamePhase = useGameStore.getState().phase;

    // Context-specific handling
    if (gamePhase === 'Playing') {
      handlePlayingPhaseShortcuts(key, e);
    } else if (gamePhase === 'Charleston') {
      handleCharlestonShortcuts(key, e);
    }

    // Global shortcuts
    handleGlobalShortcuts(key, e);
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [enabled]);
```

### Phase-Specific Handlers

```typescript
const handlePlayingPhaseShortcuts = (key: string, e: KeyboardEvent) => {
  const subPhase = useGameStore.getState().playingSubPhase;

  if (subPhase === 'Drawing' && key === ' ') {
    e.preventDefault();
    sendCommand({ DrawTile: { player: currentSeat } });
  }

  if (subPhase === 'Discarding') {
    if (key === 'enter' && selectedTile) {
      sendCommand({ DiscardTile: { player: currentSeat, tile: selectedTile } });
    }

    // Number keys select tiles (1 = first tile, 2 = second, etc.)
    const num = parseInt(key);
    if (num >= 1 && num <= 14) {
      selectTileAtIndex(num - 1);
    }
  }

  if (subPhase === 'CallWindow') {
    if (key === 'p') sendCommand({ DeclareCallIntent: { player: currentSeat, intent: 'Meld' } });
    if (key === 'k') sendCommand({ DeclareCallIntent: { player: currentSeat, intent: 'Meld' } });
    if (key === 'x') sendCommand({ Pass: { player: currentSeat } });
  }
};
```

### Customization

```typescript
const saveBindings = (bindings: KeyBindings) => {
  localStorage.setItem('keyboard_shortcuts', JSON.stringify(bindings));
};

const loadBindings = (): KeyBindings => {
  const saved = localStorage.getItem('keyboard_shortcuts');
  return saved ? JSON.parse(saved) : DEFAULT_BINDINGS;
};
```

## Accessibility

- Shortcuts should complement, not replace, mouse interactions
- All shortcuts documented in help modal (press '?')
- Allow users to disable or customize bindings

## Example Usage

```typescript
function GameView() {
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);

  useKeyboardShortcuts({
    enabled: shortcutsEnabled,
    bindings: {
      drawTile: 'd',      // Custom: 'd' instead of 'Space'
      pass: 'Escape',     // Custom: 'Escape' instead of 'x'
    },
  });

  return <div>...</div>;
}
```

## Edge Cases

1. **Multiple shortcuts pressed:** Use most recent
2. **Shortcut conflicts:** Phase-specific takes precedence
3. **Disabled during animations:** Queue command, execute after
4. **Modal open:** Disable all game shortcuts

---

**Estimated Complexity**: Medium (~80 lines)
**Dependencies**: None
**Phase**: Phase 6 - Polish & Advanced (Optional)
