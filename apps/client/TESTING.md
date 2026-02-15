# Testing Guide

This document provides an overview of the testing setup and guidelines for the American Mahjong frontend.

## Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Run tests
npm run test          # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage report
```

## Test Infrastructure Setup ✅

The following test infrastructure has been configured:

### 1. Testing Packages

- ✅ **Vitest** - Fast unit test framework
- ✅ **React Testing Library** - Component testing
- ✅ **jsdom** - Browser environment simulation
- ✅ **@testing-library/user-event** - User interaction simulation
- ✅ **@testing-library/jest-dom** - Custom matchers

### 2. Configuration Files

- ✅ [vitest.config.ts](./vitest.config.ts) - Test runner configuration
- ✅ [src/test/setup.ts](./src/test/setup.ts) - Test environment setup

### 3. Test Utilities

- ✅ [src/test/test-utils.tsx](./src/test/test-utils.tsx) - Custom render helpers
- ✅ [src/test/mocks/websocket.ts](./src/test/mocks/websocket.ts) - WebSocket mock
- ✅ [src/test/mocks/zustand.ts](./src/test/mocks/zustand.ts) - Zustand store testing utilities
- ✅ [src/test/mocks/example-store.ts](./src/test/mocks/example-store.ts) - Example store for testing patterns

### 4. Test Scripts

```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

### 5. Directory Structure

```text
apps/client/src/
├── test/
│   ├── fixtures/          # Test data
│   │   ├── game-states/  # Game state snapshots
│   │   ├── hands/        # Sample hands
│   │   └── events/       # Event sequences
│   ├── mocks/            # Mock implementations
│   │   └── websocket.ts  # WebSocket mock
│   ├── setup.ts          # Test setup
│   ├── test-utils.tsx    # Custom utilities
│   └── *.test.ts(x)      # Infrastructure tests
└── components/
    └── **/*.test.tsx     # Component tests
```

## Testing Strategy

Following the plan outlined in [docs/implementation/frontend/tests/frontend-test-plan.md](../../docs/implementation/frontend/tests/frontend-test-plan.md):

### Phase 1: Unit Tests (Current Focus)

1. **Zustand Stores** - Test state management
2. **Custom Hooks** - Test hook logic in isolation
3. **Command Validation** - Test command builders

### Phase 2: Component Tests

1. **Critical UI Components** - Test user interactions
2. **Game Components** - Test tile selection, Charleston, etc.

### Phase 3: Integration Tests

1. **Command-Event Flows** - Test full synchronization
2. **Game Scenarios** - Test complete flows

### Phase 4: E2E Tests (Optional)

1. **Playwright** - Test against real backend

## Writing Your First Test

Create a test file next to the component:

```tsx
// src/components/Tile.test.tsx
import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { Tile } from './Tile';

describe('Tile', () => {
  test('renders a bamboo tile', () => {
    renderWithProviders(<Tile suit="Bam" rank={1} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

## Test Coverage

Run coverage reports:

```bash
npm run test:coverage
```

Coverage reports are generated in `coverage/` directory.

### Coverage Goals

- **Stores**: 80%+
- **Hooks**: 80%+
- **Components**: 70%+
- **Utilities**: 90%+

## E2E (Playwright)

The E2E suite runs headless and starts both backend and frontend automatically via Playwright `webServer`.

```bash
# From repo root
npm run test:e2e:phase1
npm run test:e2e:phase2
npm run test:e2e:phase3
npm run test:e2e:critical

# From apps/client
npm run test:e2e:phase1
npm run test:e2e:phase2
npm run test:e2e:phase3
npm run test:e2e:critical
npm run test:e2e        # full e2e directory
```

Current phase coverage:

- Auth + lobby boot stability.
- Create room and room entry reliability.
- Join room by code.
- Join room by deep link.
- Failure UX for room-not-found and room-full.
- Multiplayer host/joiner transition to first actionable game state.
- Bot-fill path transition.
- Duplicate create/join submit resilience during room startup.
- Refresh recovery in lobby, room waiting, and active game.
- Temporary offline reconnect recovery without deadlock.

Notes:

- E2E retries are intentionally disabled to expose real flakiness.
- Traces/videos are retained on failure for debugging.

## Next Steps

See [docs/implementation/frontend/temporary-context-keeper.md](../../docs/implementation/frontend/temporary-context-keeper.md) for the roadmap:

1. ✅ **Step 1**: Test Infrastructure Setup (COMPLETE)
2. ✅ **Step 2**: Create Mock Utilities (COMPLETE - WebSocket + Zustand stores)
3. 📝 **Step 3**: Create Fixture Files
4. 📝 **Step 4**: Write Test Scenarios
5. 📝 **Step 5**: Write First Component Test
6. 📝 **Step 6**: Expand Test Coverage

## Resources

- [Test Infrastructure README](./src/test/README.md)
- [Frontend Test Plan](../../docs/implementation/frontend/tests/frontend-test-plan.md)
- [Component Specs](../../docs/implementation/frontend/component-specs/)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
