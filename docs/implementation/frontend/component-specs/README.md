# Component Specifications

This directory contains detailed specifications for each React component, organized by type.

## Directory Structure

```text
component-specs/
├── presentational/    # Stateless, pure rendering components
├── container/         # Stateful components that connect to stores/hooks
└── integration/       # Complex flows that orchestrate multiple components
```

## Component Types

### Presentational Components

- **Purpose**: Display data, handle basic user interactions
- **Characteristics**: No state management, no API calls, pure props-based rendering
- **Examples**: Tile, ActionButton, TurnIndicator, WallCounter

### Container Components

- **Purpose**: Manage state, connect to Zustand stores, orchestrate child components
- **Characteristics**: Use hooks (useGameStore, useGameSocket), handle business logic
- **Examples**: ConcealedHand, PlayerRack, ActionBar, CallWindowPanel

### Integration Components

- **Purpose**: Coordinate complex multi-step flows
- **Characteristics**: Compose multiple container/presentational components
- **Examples**: CharlestonFlow, TurnFlow, CallWindowFlow

## Template

See `../../../scratchpad/component-spec-template.md` for the complete template.

## File Naming Convention

`[ComponentName].md` - PascalCase matching the actual component file name

## What Each Spec Includes

1. **Purpose**: What the component does
2. **Props Interface**: TypeScript interface with descriptions
3. **State** (if container): Internal state management
4. **Visual Behaviors**: How it looks in different states
5. **Interactions**: User actions and event handlers
6. **Dependencies**: External libraries, hooks, child components
7. **Test Cases**: Comprehensive test specifications
8. **Mock Data**: Sample props and fixtures
9. **Implementation Notes**: Performance, animations, error handling

## References

Each component spec references:

- **User Stories**: Which stories require this component
- **Game Design Document**: Visual layout and mechanics (Sections 1-3)
- **Technical Architecture**: Implementation patterns (Section 4)
