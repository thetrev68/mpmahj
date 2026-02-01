# Test Infrastructure

This directory contains the test infrastructure for the American Mahjong frontend.

## Structure

```
test/
├── fixtures/           # Test data (game states, hands, events)
│   ├── game-states/   # Complete game state snapshots
│   ├── hands/         # Sample player hands
│   └── events/        # Event sequences
├── mocks/             # Mock implementations
│   └── websocket.ts   # WebSocket mock
├── setup.ts           # Test environment setup
├── test-utils.tsx     # Custom render utilities
└── *.test.ts(x)       # Infrastructure tests
```

## Running Tests

```bash
# Run tests in watch mode (default)
npm run test

# Run tests once and exit
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Writing Tests

### Basic Component Test

```tsx
import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  test('renders correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### User Interaction Test

```tsx
test('handles user interaction', async () => {
  const { user } = renderWithProviders(<MyComponent />);

  await user.click(screen.getByRole('button'));

  expect(screen.getByText('Updated Text')).toBeInTheDocument();
});
```

### Using Mock WebSocket

```tsx
import { createMockWebSocket } from '@/test/mocks/websocket';

test('handles websocket messages', () => {
  const mockWs = createMockWebSocket();

  // Trigger WebSocket events
  mockWs.triggerOpen();
  mockWs.triggerMessage({ type: 'GameStarted' });

  // Assert behavior
  expect(mockWs.send).toHaveBeenCalled();
});
```

### Testing Zustand Stores

```tsx
import { createMockStore } from '@/test/mocks/zustand';
import { useGameStore } from '@/stores/gameStore';

describe('GameStore', () => {
  const mockStore = createMockStore(useGameStore);

  beforeEach(() => {
    mockStore.reset();
  });

  test('adds a tile', () => {
    const { addTile } = mockStore.getState();
    addTile('Bam1');
    expect(mockStore.getState().tiles).toHaveLength(1);
  });
});
```

See [mocks/README.md](./mocks/README.md) for complete Zustand testing patterns.

### Using Fixtures

```tsx
import charlestonState from '@/test/fixtures/game-states/charleston-first-right.json';

test('loads game state', () => {
  // Use fixture in test
  const state = charlestonState;
  expect(state.phase).toBeDefined();
});
```

## Test Utilities

### `renderWithProviders()`

Custom render function that wraps components with necessary providers. Returns all standard React Testing Library queries plus a `user` object for interactions.

```tsx
const { user, getByText, getByRole } = renderWithProviders(<Component />);
```

### `createMockWebSocket()`

Creates a mock WebSocket for testing network interactions.

```tsx
const mockWs = createMockWebSocket('ws://localhost:3000/ws');
mockWs.triggerOpen();
mockWs.triggerMessage({ data: 'test' });
```

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage for stores, hooks, utilities
- **Component Tests**: 70%+ coverage for UI components
- **Integration Tests**: All critical user flows
- **E2E Tests**: Complete game scenarios (optional)

## Best Practices

1. **Use descriptive test names**: Test names should read like documentation
2. **Arrange-Act-Assert**: Structure tests clearly
3. **Test user behavior, not implementation**: Focus on what users see and do
4. **Mock external dependencies**: Use mocks for WebSocket, timers, etc.
5. **Keep tests isolated**: Each test should be independent
6. **Use fixtures for complex data**: Don't hardcode large objects in tests

## Configuration

- **Vitest config**: [vitest.config.ts](../../vitest.config.ts)
- **Test setup**: [setup.ts](./setup.ts)
- **TypeScript config**: Uses main tsconfig.json

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
