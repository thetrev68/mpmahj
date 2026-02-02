# useTileSelection Hook

## Purpose

Manages tile selection logic for Charleston phase and discarding. Handles max selection limits, disabled tiles (Jokers), selection/deselection, and blocking when max reached.

## User Stories

- **US-002, US-003, US-004**: Charleston passes (3-tile selection with Joker blocking)
- **US-010**: Discarding a tile (1-tile selection)
- **US-014**: Joker exchange (1 Joker selection)

## API

```typescript
interface UseTileSelectionOptions {
  /** Maximum tiles that can be selected */
  maxSelection: number; // 3 for Charleston, 1 for discard

  /** Tiles that cannot be selected */
  disabledTiles?: (number | string)[];

  /** Initial selection */
  initialSelection?: (number | string)[];

  /** Callback when selection changes */
  onSelectionChange?: (selected: (number | string)[]) => void;

  /** Auto-clear selection after action */
  autoClear?: boolean; // default: false
}

interface UseTileSelectionReturn {
  /** Currently selected tiles */
  selectedTiles: (number | string)[];

  /** Toggle a tile's selection */
  toggleTile: (tile: number | string) => void;

  /** Check if a tile can be selected */
  canSelect: (tile: number | string) => boolean;

  /** Check if a tile is selected */
  isSelected: (tile: number | string) => boolean;

  /** Clear all selections */
  clearSelection: () => void;

  /** Select specific tiles (for programmatic selection) */
  selectTiles: (tiles: (number | string)[]) => void;

  /** Selection state */
  selectionCount: number;
  isMaxReached: boolean;
}

function useTileSelection(options: UseTileSelectionOptions): UseTileSelectionReturn;
```text

## Behavior

**Selection Logic**:

1. User clicks a tile → calls `toggleTile(tile)`
2. If tile is selected → deselect it
3. If tile is not selected:
   - Check `canSelect(tile)` (not disabled, max not reached)
   - If can select → add to selection
   - If max reached → block and show tooltip

**Max Selection**:

- When `selectedTiles.length === maxSelection`:
  - `isMaxReached = true`
  - `canSelect()` returns `false` for all unselected tiles
  - Clicking unselected tile shows: "No more than X tiles may be selected"

**Disabled Tiles**:

- Tiles in `disabledTiles` array cannot be selected
- `canSelect(tile)` returns `false`
- Clicking disabled tile shows tooltip (e.g., "Jokers cannot be passed")

**Auto-clear**:

- If `autoClear={true}`, selection clears after `onSelectionChange` callback

## Implementation Notes

**State Management**:

```typescript
const [selectedTiles, setSelectedTiles] = useState<(number | string)[]>(
  options.initialSelection || []
);
```text

**Toggle Logic**:

```typescript
const toggleTile = useCallback(
  (tile: number | string) => {
    if (isSelected(tile)) {
      // Deselect
      setSelectedTiles((prev) => prev.filter((t) => t !== tile));
    } else if (canSelect(tile)) {
      // Select
      setSelectedTiles((prev) => [...prev, tile]);
    } else {
      // Show tooltip/feedback for why can't select
      showSelectionBlockedFeedback(tile);
    }
  },
  [canSelect, isSelected]
);
```text

**Disabled Check**:

```typescript
const canSelect = useCallback(
  (tile: number | string) => {
    // Already selected tiles can always be toggled (to deselect)
    if (isSelected(tile)) return true;

    // Check if disabled
    if (disabledTiles?.includes(tile)) return false;

    // Check if max reached
    if (selectedTiles.length >= maxSelection) return false;

    return true;
  },
  [disabledTiles, selectedTiles, maxSelection]
);
```text

**Callback Trigger**:

```typescript
useEffect(() => {
  onSelectionChange?.(selectedTiles);

  if (autoClear && selectedTiles.length === maxSelection) {
    // Clear after a brief delay (allow UI to show selection)
    setTimeout(() => clearSelection(), 300);
  }
}, [selectedTiles, onSelectionChange, autoClear]);
```text

## Example Usage

### Charleston 3-Tile Selection

```typescript
import { useTileSelection } from '@/hooks/useTileSelection';

function CharlestonPassPanel({ hand }: { hand: Tile[] }) {
  const {
    selectedTiles,
    toggleTile,
    canSelect,
    isSelected,
    selectionCount,
    isMaxReached,
  } = useTileSelection({
    maxSelection: 3,
    disabledTiles: hand.filter(tile => tile === 'Joker'),
    onSelectionChange: (selected) => {
      console.log('Selected tiles:', selected);
    },
  });

  const handlePassTiles = () => {
    if (selectedTiles.length === 3) {
      sendCommand({ PassTiles: { tiles: selectedTiles } });
    }
  };

  return (
    <div>
      <p>Selected: {selectionCount}/3</p>
      <div className="hand">
        {hand.map(tile => (
          <Tile
            key={tile}
            tile={tile}
            onClick={() => toggleTile(tile)}
            state={
              isSelected(tile) ? 'selected' :
              !canSelect(tile) ? 'disabled' :
              'default'
            }
          />
        ))}
      </div>
      <Button onClick={handlePassTiles} disabled={selectionCount !== 3}>
        Pass Tiles
      </Button>
    </div>
  );
}
```text

### Single Tile Discard

```typescript
function DiscardPanel({ hand }: { hand: Tile[] }) {
  const { selectedTiles, toggleTile, isSelected } = useTileSelection({
    maxSelection: 1,
    autoClear: true,
    onSelectionChange: ([tile]) => {
      if (tile) {
        sendCommand({ Discard: { tile } });
      }
    },
  });

  return (
    <div className="hand">
      {hand.map(tile => (
        <Tile
          key={tile}
          tile={tile}
          onClick={() => toggleTile(tile)}
          state={isSelected(tile) ? 'selected' : 'default'}
        />
      ))}
    </div>
  );
}
```text

## Edge Cases

**Rapid Clicking**:

- Debounce `toggleTile` calls (50ms) to prevent double-toggles

**Tile Removal**:

- If a selected tile is removed from hand (e.g., server update), auto-deselect it

**Disabled Changes**:

- If `disabledTiles` changes mid-selection, auto-deselect any newly disabled tiles

**Max Selection Change**:

- If `maxSelection` changes from 3 → 1, keep first tile, deselect others

---

**Spec version**: 1.0
**Lines**: ~130
```
