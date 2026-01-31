# Component Specification Style Guide

## Purpose

This guide ensures consistency when documenting the 153 components needed for the American Mahjong frontend. It defines structure, terminology, design system references, and documentation standards.

---

## Design System Foundation

All component specifications MUST reference the established design system from [`docs/archive/frontend-design-reference/11-ui-ux-design.md`](../../archive/frontend-design-reference/11-ui-ux-design.md).

### Color Usage

**Always use CSS custom property names, never hardcoded values:**

```typescript
// ✅ CORRECT - References design system
className="bg-surface hover:bg-surface-hover border-border"
style={{ color: 'var(--color-text-primary)' }}

// ❌ WRONG - Hardcoded values
className="bg-gray-100"
style={{ color: '#111827' }}
```

#### Color Categories

##### Brand Colors

- `--color-primary`: Primary actions, CTAs (#2563eb)
- `--color-secondary`: Secondary actions (#7c3aed)
- `--color-accent`: Success, highlights (#059669)

##### Tile Suit Colors

- `--color-bam`: Bamboo tiles (#10b981)
- `--color-crak`: Character tiles (#ef4444)
- `--color-dot`: Dot/Circle tiles (#3b82f6)
- `--color-wind`: Wind tiles (#6b7280)
- `--color-dragon`: Dragon tiles (matches suit colors)
- `--color-flower`: Flower tiles (#ec4899)
- `--color-joker`: Joker tiles (#a855f7)

##### Semantic Colors

- `--color-success`: #10b981
- `--color-warning`: #f59e0b
- `--color-error`: #ef4444
- `--color-info`: #3b82f6

##### Game State Colors

- `--color-my-turn`: Your turn highlight (#dcfce7)
- `--color-opponent-turn`: Opponent turn (#fef3c7)
- `--color-charleston`: Charleston phase (#ddd6fe)
- `--color-call-window`: Call window active (#fecaca)
- `--color-win`: Win highlight (#fef9c3)

### Typography

**Type Scale** (use rem units):

- `--text-xs`: 0.75rem (12px) - Tiny labels
- `--text-sm`: 0.875rem (14px) - Body small, captions
- `--text-base`: 1rem (16px) - Body text (default)
- `--text-lg`: 1.125rem (18px) - Emphasized text
- `--text-xl`: 1.25rem (20px) - Subheadings
- `--text-2xl`: 1.5rem (24px) - Headings
- `--text-3xl`: 1.875rem (30px) - Large headings

**Font Weights**:

- `--font-normal`: 400 - Body text
- `--font-medium`: 500 - Slightly emphasized
- `--font-semibold`: 600 - Headings, important text
- `--font-bold`: 700 - Strong emphasis

### Spacing

**Base unit: 4px (0.25rem)** - All spacing MUST be multiples of 4px:

- `--space-1`: 0.25rem (4px)
- `--space-2`: 0.5rem (8px)
- `--space-3`: 0.75rem (12px)
- `--space-4`: 1rem (16px) - Most common
- `--space-6`: 1.5rem (24px)
- `--space-8`: 2rem (32px)
- `--space-12`: 3rem (48px)

### Border Radius

- `--radius-sm`: 0.125rem (2px) - Subtle
- `--radius-md`: 0.375rem (6px) - Default
- `--radius-lg`: 0.5rem (8px) - Cards
- `--radius-xl`: 0.75rem (12px) - Modals
- `--radius-2xl`: 1rem (16px) - Large containers

### Shadows

- `--shadow-sm`: Subtle elevation
- `--shadow-md`: Cards, dropdowns (default)
- `--shadow-lg`: Modals, popovers
- `--shadow-xl`: Major elevation
- `--shadow-2xl`: Maximum depth

### Tile Dimensions

**Responsive sizing** based on viewport:

- Mobile: 48×64px (3×4rem)
- Tablet (768px+): 56×72px (3.5×4.5rem)
- Desktop (1024px+): 64×80px (4×5rem)
- Large Desktop (1280px+): 72×88px (4.5×5.5rem)

Reference as CSS custom properties in component specs:

```css
width: var(--tile-width);
height: var(--tile-height);
gap: var(--tile-gap);
```

---

## Tile Asset Reference

**Location**: `apps/client/public/assets/tiles/`

**Format**: SVG (scalable, with red corner numbers)

### Naming Convention

All tiles follow Wikimedia/Japanese mahjong naming:

**Numbered Tiles**:

- Dots: `Mahjong_1p.svg` through `Mahjong_9p.svg`
- Bams: `Mahjong_1s.svg` through `Mahjong_9s.svg`
- Craks: `Mahjong_1m.svg` through `Mahjong_9m.svg`

**Winds**:

- `Mahjong_E.svg`, `Mahjong_S.svg`, `Mahjong_W.svg`, `Mahjong_N.svg`

**Dragons**:

- Red: `Mahjong_R.svg`
- Green: `Mahjong_H.svg` (Hatsu/發)
- White: `Mahjong_T.svg` (Soap/白)

**Special**:

- Joker: `U+1F02A_MJjoker.svg`
- Flower: `Mahjong_F_Winter.svg`

### Tile Index Mapping

Components should use **tile indices 0-41** (Rust backend format):

- **0-8**: Bams (1-9)
- **9-17**: Craks (1-9)
- **18-26**: Dots (1-9)
- **27-30**: Winds (E, S, W, N)
- **31-33**: Dragons (Red, Green, White)
- **34**: Flower
- **35-40**: Reserved (future expansion)
- **41**: Joker

**Helper function** for asset path mapping:

```typescript
function getTileAssetPath(tileIndex: number): string {
  const suits = ['s', 'm', 'p']; // Bams, Craks, Dots

  if (tileIndex < 27) {
    const suit = suits[Math.floor(tileIndex / 9)];
    const rank = (tileIndex % 9) + 1;
    return `/assets/tiles/Mahjong_${rank}${suit}.svg`;
  }

  const specials = ['E', 'S', 'W', 'N', 'R', 'H', 'T', 'F_Winter'];
  if (tileIndex < 35) {
    return `/assets/tiles/Mahjong_${specials[tileIndex - 27]}.svg`;
  }

  if (tileIndex === 41) {
    return `/assets/tiles/U+1F02A_MJjoker.svg`;
  }

  return '/assets/tiles/placeholder.svg'; // Fallback
}
```

---

## Component Specification Structure

Every component spec MUST follow this structure (see `TileImage.md` and `DiceRoller.md` as examples):

### 1. Header

```markdown
# ComponentName Component Specification

## Component Type

**[Presentational | Container | Integration | Hook | Utility]**

## Purpose

One-sentence description of what the component does.

## Related User Stories

- US-XXX: Story title
- US-YYY: Another story
```

### 2. TypeScript Interface

```markdown
## TypeScript Interface

\`\`\`typescript
export interface ComponentNameProps {
/\*_ JSDoc comment for each prop _/
propName: PropType;

/\*_ Optional props marked with ? _/
optionalProp?: PropType;

/\*_ Callbacks always prefixed with 'on' _/
onClick?: (param: Type) => void;

/\*_ Boolean props prefixed with 'is', 'has', 'can', 'should' _/
isActive?: boolean;
hasError?: boolean;
canEdit?: boolean;
}
\`\`\`
```

**Naming conventions**:

- Event handlers: `onEventName` (onClick, onHover, onSubmit)
- Boolean props: `isState`, `hasCondition`, `canAction`, `shouldBehavior`
- Data props: descriptive nouns (tile, dice, hand, meld)
- Style props: `size`, `variant`, `className`, `style`

### 3. State Management (if applicable)

```markdown
## Internal State

\`\`\`typescript
interface ComponentNameState {
/\*_ Document internal state if component is stateful _/
stateProperty: Type;
}
\`\`\`

## State Management

**[Stateless | Internal useState | Context Consumer | Zustand/Redux]**
```

### 4. Visual Design

```markdown
## Visual Design

### Size Variants (if applicable)

- **small**: Specific dimensions with use case
- **medium**: Default size
- **large**: Larger size with use case

### Display States

Document all visual states with transitions:

1. **state-name**: Description and visual characteristics
2. **another-state**: Description

### Visual Effects

- Hover: Describe animation (duration, easing)
- Active/Focus: Keyboard and click states
- Loading: Skeleton or spinner behavior
- Error: Visual feedback

### Animation Timing

- Micro-interactions: 100-200ms
- State transitions: 200-300ms
- Page transitions: 300-500ms
- Complex animations: 500-1000ms

Use easing functions:

- `ease-in-out`: Most transitions
- `ease-out`: Entry animations
- `ease-in`: Exit animations
```

**Required details**:

- Exact pixel/rem dimensions for each size variant
- CSS properties for each state (transform, opacity, color, shadow)
- Animation durations with easing functions
- Responsive behavior breakpoints

### 5. Accessibility

```markdown
## Accessibility

### ARIA Attributes

- `role`: Component role (button, group, listbox, etc.)
- `aria-label`: Descriptive label when text isn't visible
- `aria-labelledby`: Reference to visible label element
- `aria-describedby`: Reference to help/error text
- `aria-pressed`: For toggle buttons
- `aria-disabled`: For disabled states
- `aria-live`: For dynamic content (polite | assertive)
- `aria-busy`: During loading states
- `tabIndex`: Keyboard focus management

### Keyboard Support

Document all keyboard interactions:

- `Tab`: Focus navigation
- `Enter`/`Space`: Activation
- `Escape`: Dismiss/cancel
- Arrow keys: Navigation (if applicable)
- `Home`/`End`: Jump to extremes (if applicable)

### Screen Reader Announcements

Document what screen readers should announce:

- On mount: Initial state
- On interaction: Action feedback
- On state change: Updated information
- On error: Clear error messages

### Focus Management

- Visible focus indicator (2px outline, offset 2px)
- Focus trap for modals
- Restore focus after dismissal
```

**Accessibility is non-negotiable**:

- Every interactive component MUST support keyboard navigation
- ARIA attributes MUST match component behavior
- Screen reader announcements MUST be clear and concise
- Focus indicators MUST be visible (WCAG 2.1 AA minimum)

### 6. Dependencies

```markdown
## Dependencies

### External

- React (specific hooks: useState, useEffect, etc.)
- Third-party libraries (exact package names)

### Internal

- `@/components/...` - Component dependencies
- `@/hooks/...` - Custom hooks
- `@/utils/...` - Utility functions
- `@/styles/...` - Styles (CSS modules or styled-components)

### Generated Types

- `@/types/bindings/generated/TypeName.ts` - Rust type bindings
```

### 7. Implementation Notes

```markdown
## Implementation Notes

### Performance Optimizations

1. **Optimization type**: Description and reasoning
2. **Another optimization**: Implementation details

### Error Handling

Document failure modes:

- Invalid prop: What happens? Default behavior?
- Missing dependency: Graceful degradation
- Runtime errors: Boundary behavior

### Edge Cases

- Unusual data conditions
- Race conditions
- Concurrent operations
- Browser compatibility issues

### Responsive Behavior

- Mobile (<768px): Specific adaptations
- Tablet (768-1024px): Layout changes
- Desktop (>1024px): Enhanced features
```

### 8. Test Scenarios

```markdown
## Test Scenarios

### Unit Tests

\`\`\`typescript
describe('ComponentName', () => {
it('test description', () => {
// What to test and why
});

// 10-15 unit tests covering:
// - Prop handling
// - State transitions
// - Event handlers
// - Edge cases
// - Error conditions
});
\`\`\`

### Integration Tests

\`\`\`typescript
describe('ComponentName Integration', () => {
it('test description', () => {
// Integration scenarios
});

// 4-6 integration tests covering:
// - Interaction with other components
// - Data flow
// - Side effects
// - Async operations
});
\`\`\`

### Visual Regression Tests

- Screenshot scenarios for visual states
- Animation frame captures
- Responsive breakpoint tests
```

**Test coverage expectations**:

- Unit tests: 80%+ coverage
- Integration tests: Critical user paths
- Visual regression: All visual states documented
- Accessibility tests: Keyboard and screen reader flows

### 9. Usage Examples

```markdown
## Usage Examples

### Basic Usage

\`\`\`tsx
// Simplest possible usage
<ComponentName prop="value" />
\`\`\`

### Common Patterns

\`\`\`tsx
// 2-3 realistic usage examples from user stories
\`\`\`

### Advanced Usage

\`\`\`tsx
// Complex scenarios with composition
\`\`\`
```

### 10. Style Guidelines

```markdown
## Style Guidelines

### CSS Module Structure (or styled-components)

\`\`\`css
/_ Show expected class structure _/
.component-name {
/_ Base styles referencing design tokens _/
}

.component-name--variant {
/_ Variant styles _/
}

.component-name\_\_child-element {
/_ BEM-style naming for clarity _/
}
\`\`\`

### Design Tokens Used

List specific tokens from design system:

- Colors: --color-\*
- Spacing: --space-\*
- Typography: --text-_, --font-_
- Shadows: --shadow-\*
- Radius: --radius-\*
```

**CSS conventions**:

- Use CSS modules (`.module.css`) for scoped styles
- BEM naming for class hierarchy
- Reference design tokens via CSS custom properties
- Mobile-first media queries
- Avoid `!important` (document exceptions)

### 11. Future Enhancements

```markdown
## Future Enhancements

- [ ] Enhancement idea with brief description
- [ ] Another potential improvement
- [ ] Nice-to-have features
```

### 12. Notes

```markdown
## Notes

- Backend integration details (API contracts, data formats)
- Design decisions and trade-offs
- Known limitations
- Migration notes (if replacing existing component)
```

---

## Component Type Definitions

### Presentational Components

**Characteristics**:

- Pure UI rendering based on props
- No business logic or state management
- Highly reusable across contexts
- Focused on visual presentation

**Examples**: TileImage, Button, Badge, Card, Avatar

**State**: Usually stateless or minimal internal UI state (hover, focus)

### Container Components

**Characteristics**:

- Connect presentational components to data/state
- Handle business logic and side effects
- Less reusable, context-specific
- Orchestrate child components

**Examples**: HandContainer, GameBoardContainer, LobbyContainer

**State**: Often connected to global state (Zustand, Context)

### Integration Components

**Characteristics**:

- Bridge between major UI sections
- Coordinate multiple features
- Handle complex workflows
- Top-level routing components

**Examples**: GameScreen, LobbyScreen, SettingsScreen

**State**: Route-level state management

### Hooks

**Characteristics**:

- Reusable stateful logic
- No UI rendering
- Return data and functions
- Composable across components

**Examples**: useWebSocket, useGameState, useSound

**Export**: Functions starting with `use`

### Utility Components

**Characteristics**:

- Specialized helpers (layouts, providers, guards)
- Infrastructure components
- Don't render direct UI elements

**Examples**: ErrorBoundary, ThemeProvider, ProtectedRoute

---

## Documentation Standards

### Language & Tone

- **Imperative mood**: "Renders a tile" (not "Will render a tile")
- **Active voice**: "Component handles errors" (not "Errors are handled")
- **Present tense**: "Displays dice animation" (not "Will display")
- **Concise**: One sentence per concept when possible
- **Precise**: Specific numbers, not vague terms ("300ms" not "fast")

### Code Formatting

```typescript
// Use TypeScript for all examples
// Include type annotations
// Show realistic data structures

interface ExampleProps {
  value: number; // JSDoc comments inline
}

// ✅ Good: Specific, typed example
const tiles: number[] = [0, 9, 18]; // 1 Bam, 1 Crak, 1 Dot

// ❌ Bad: Vague, untyped example
const tiles = [1, 2, 3]; // Some tiles
```

### Markdown Conventions

- Use `#` for component name (h1)
- Use `##` for major sections (h2)
- Use `###` for subsections (h3)
- Code blocks with language specification: \`\`\`typescript, \`\`\`css, \`\`\`tsx
- Lists for enumerations (ordered when sequence matters)
- Tables for structured comparisons
- **Bold** for emphasis on first mention of key terms
- `code` for inline code, prop names, file paths

### File Naming

**Component specs**: `ComponentName.md` (PascalCase matching component)

**Location**: `docs/implementation/frontend/components/`

**Organization by type**:

- `components/presentational/` - Presentational components
- `components/containers/` - Container components
- `components/integration/` - Integration components
- `components/hooks/` - Custom hooks
- `components/utility/` - Utility components

---

## Consistency Checklist

Before finalizing any component spec, verify:

- [ ] Uses design system tokens (never hardcoded colors/spacing)
- [ ] References actual tile asset paths from `/assets/tiles/`
- [ ] Includes complete TypeScript interface with JSDoc
- [ ] Documents all visual states with exact dimensions/styles
- [ ] Covers accessibility requirements (ARIA, keyboard, screen readers)
- [ ] Lists all dependencies (external, internal, generated types)
- [ ] Provides 10+ unit test scenarios
- [ ] Includes 3+ realistic usage examples
- [ ] Uses consistent terminology across all specs
- [ ] Follows markdown conventions (headings, code blocks, lists)
- [ ] Cross-references related user stories
- [ ] States component type (Presentational/Container/etc.)

---

## Example Reference Components

**Simple Presentational**: See `TileImage.md`

- Atomic building block
- Stateless rendering
- High reusability
- Visual-only concerns

**Complex Presentational with Animation**: See `DiceRoller.md`

- Internal animation state
- Sound effects integration
- Complex visual sequences
- Accessibility for motion

**Use these as templates** when documenting similar component types.

---

## Questions & Clarifications

When in doubt:

1. **Design decisions**: Reference [`11-ui-ux-design.md`](../../archive/frontend-design-reference/11-ui-ux-design.md)
2. **Tile assets**: Check `apps/client/public/assets/tiles/README.md`
3. **Backend types**: See `crates/*/bindings/` for generated TypeScript types
4. **User stories**: Cross-reference `docs/implementation/frontend/user-stories/US-*.md`
5. **Component list**: See `COMPONENT-MASTER-LIST.md` for component inventory

**Maintain consistency by**:

- Copying structure from reference components
- Using exact design token names
- Matching terminology across all specs
- Cross-referencing related components

```

```
