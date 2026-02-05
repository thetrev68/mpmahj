# Tile Component Test Summary

## Test File Location

`c:\Repos\mpmahj\apps\client\src\components\game\Tile.test.tsx`

## Test Status

**RED PHASE** - All tests are currently failing because the Tile component does not exist yet.

## Test Coverage Summary

### Priority P0 Tests (Critical) - 18 Tests

**Rendering (4 tests):**

- ✓ Renders tile with correct image based on tile index
- ✓ Renders different tile indices correctly
- ✓ Renders face-down tiles correctly
- ✓ Defaults to face-up when faceUp prop is not provided

**States (6 tests):**

- ✓ Renders default state correctly
- ✓ Applies selected state styling (raised 12px, gold border)
- ✓ Applies disabled state styling (opacity 0.5, grayed out, cursor: not-allowed)
- ✓ Applies highlighted state styling (pulsing animation)
- ✓ Applies dimmed state styling (semi-transparent)
- ✓ Defaults to default state when state prop is not provided

**Size Variants (4 tests):**

- ✓ Applies small size variant (32px × 46px)
- ✓ Applies medium size variant (63px × 90px, default)
- ✓ Applies large size variant
- ✓ Defaults to medium size when size prop is not provided

**Rotation (3 tests):**

- ✓ Applies rotation for exposed melds (90° clockwise)
- ✓ Does not rotate when rotated prop is false
- ✓ Does not rotate by default

**Interaction (5 tests):**

- ✓ Calls onClick when clicked and clickable
- ✓ Does not trigger onClick when disabled
- ✓ Does not trigger onClick when onClick is not provided
- ✓ Is clickable when onClick is provided (role="button", cursor: pointer)
- ✓ Is not clickable when onClick is not provided

### Priority P1 Tests (High Priority) - 17 Tests

**Hover Effects (3 tests):**

- ✓ Shows lift and shadow on hover when clickable
- ✓ Does not show hover effect when disabled
- ✓ Triggers onHover callback when hovered

**Accessibility (14 tests):**

- ✓ Has correct ARIA label for Bam tile
- ✓ Has correct ARIA label for Joker
- ✓ Has correct ARIA label for Dragon tile
- ✓ Uses custom ARIA label when provided
- ✓ Sets aria-pressed="true" when selected
- ✓ Does not set aria-pressed when not selected
- ✓ Sets aria-disabled="true" when disabled
- ✓ Is keyboard focusable (tabindex="0") when clickable
- ✓ Is not keyboard focusable (tabindex="-1") when disabled
- ✓ Is not keyboard focusable when not clickable
- ✓ Triggers click on Enter key press
- ✓ Triggers click on Space key press
- ✓ Does not trigger click on other key presses
- ✓ Shows visible focus ring when focused

### Priority P2 Tests (Medium Priority) - 3 Tests

**Animations (2 tests):**

- ✓ Shows pulsing animation for newly drawn tile
- ✓ State changes animate smoothly (0.2s transition)

**Performance (1 test):**

- ✓ Component is memoized to prevent unnecessary re-renders

### Priority P3 Tests (Edge Cases) - 7 Tests

**Edge Cases (7 tests):**

- ✓ Handles invalid tile index gracefully (shows error state)
- ✓ Handles negative tile index gracefully (shows error state)
- ✓ Handles rapid state changes
- ✓ Handles combined states (selected + rotated)
- ✓ Uses custom testId when provided
- ✓ Handles null or undefined onClick gracefully
- ✓ Component is memoized to prevent unnecessary re-renders

### Integration Tests - 2 Tests

- ✓ Renders multiple tiles with different props simultaneously
- ✓ Works correctly with face-down and rotated together

## Total Test Count: 47 Tests

## Expected Component Interface

```typescript
interface TileProps {
  /** Tile index (0-36) from bindings */
  tile: Tile;

  /** Visual state */
  state?: 'default' | 'selected' | 'disabled' | 'highlighted' | 'dimmed';

  /** Whether tile shows face or back */
  faceUp?: boolean; // default: true

  /** Click handler */
  onClick?: (tile: Tile) => void;

  /** Hover handler for tooltips */
  onHover?: (tile: Tile) => void;

  /** Size variant */
  size?: 'small' | 'medium' | 'large'; // default: 'medium'

  /** Rotation for exposed melds */
  rotated?: boolean;

  /** Accessibility label override */
  ariaLabel?: string;

  /** Test ID */
  testId?: string;
}
```

## CSS Class Requirements

Based on the tests, the component should apply these CSS classes:

- `.tile-face-down` - Face-down tiles
- `.tile-default` - Default state
- `.tile-selected` - Selected state
- `.tile-disabled` - Disabled state
- `.tile-highlighted` - Highlighted state
- `.tile-dimmed` - Dimmed state
- `.tile-small` - Small size variant
- `.tile-medium` - Medium size variant
- `.tile-large` - Large size variant
- `.tile-rotated` - Rotated tiles
- `.tile-hover` - Hover state
- `.tile-focus` - Focus state
- `.tile-error` - Error/invalid state

## CSS Style Requirements

**Small Size:**

- Width: 32px
- Height: 46px

**Medium Size (Default):**

- Width: 63px
- Height: 90px

**Selected State:**

- Transform: translateY(-12px)
- Border color: #ffd700 (gold)
- Box shadow: 0 8px 16px rgba(255, 215, 0, 0.5)

**Disabled State:**

- Opacity: 0.5
- Filter: grayscale(50%)
- Cursor: not-allowed

**Highlighted State:**

- Animation: pulse 1.5s infinite

**Dimmed State:**

- Opacity: ~0.6

**Rotated State:**

- Transform: rotate(90deg)

**Hover State:**

- Transform: translateY(-8px)
- Box shadow: 0 6px 12px rgba(0,0,0,0.3)

**Transitions:**

- All properties: 0.2s ease

## ARIA Attributes Required

- `role="button"` - When clickable
- `aria-label` - Tile name (e.g., "3 Bam (2)", "Joker (35)", "Red Dragon (32)")
- `aria-pressed` - "true" when selected, "false" otherwise
- `aria-disabled` - "true" when disabled
- `tabindex` - "0" when clickable, "-1" when disabled, not set when not clickable

## Keyboard Support Required

- Enter key: Trigger onClick
- Space key: Trigger onClick
- Tab: Focus management
- Visible focus ring

## Tile Index to Name Mapping

The component will need a utility function to convert tile indices to names:

- 0-8: Bams (1-9)
- 9-17: Cracks (1-9)
- 18-26: Dots (1-9)
- 27-30: Winds (East, South, West, North)
- 31-33: Dragons (Green, Red, White/Soap)
- 34: Flower
- 35: Joker
- 36: Blank

Example labels:

- Tile 2 → "3 Bam (2)"
- Tile 35 → "Joker (35)"
- Tile 32 → "Red Dragon (32)"

## Dependencies

The component uses:

- `TileImage` component (mocked in tests) - renders the tile graphic
- Test utilities from `@/test/test-utils`
- Type definitions from `@/types/bindings`

## Next Steps

1. Implement the Tile component at `c:\Repos\mpmahj\apps\client\src\components\game\Tile.tsx`
2. Create tile utility functions (tileToString, etc.)
3. Implement CSS styles (using Tailwind or CSS modules)
4. Run tests to verify: `npm run test:run src/components/game/Tile.test.tsx`
5. Iterate until all tests pass (GREEN phase)
6. Refactor for code quality (REFACTOR phase)

## Running the Tests

```bash
# Run all Tile tests
npm run test:run src/components/game/Tile.test.tsx

# Run in watch mode
npm run test -- src/components/game/Tile.test.tsx

# Run with coverage
npm run test:coverage -- src/components/game/Tile.test.tsx
```

## Test Quality Notes

- All tests follow Arrange-Act-Assert pattern
- Tests are independent and can run in any order
- Tests use meaningful descriptions
- Edge cases are thoroughly covered
- Accessibility is tested comprehensively
- Performance considerations are included
- Integration scenarios are validated
