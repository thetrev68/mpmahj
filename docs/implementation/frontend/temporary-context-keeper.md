# Frontend Testing - Current Status & Next Steps

**Created**: 2026-02-01
**Purpose**: Track progress on TDD frontend implementation

---

## Current Status Summary

We've completed comprehensive planning for TDD-based frontend development but haven't set up the actual test infrastructure yet. This document outlines what we have and what's needed before writing tests.

---

## What We Have ✅

1. **Planning docs** - 4-part game design document
2. **User stories** - 36 complete stories (US-001 through US-036)
3. **Component specs** - 35+ components documented in [component-specs/](component-specs/)
4. **Hook specs** - 7 hooks documented
5. **Test plan outline** - Strategy defined in [tests/frontend-test-plan.md](tests/frontend-test-plan.md)
6. **Vitest installed** - Already in [package.json](../../apps/client/package.json)

---

## What We're Missing ❌

### 1. Test Infrastructure Setup

We need to configure the testing tools:

- **Vitest config** (`vitest.config.ts`) - test runner configuration
- **React Testing Library** - install `@testing-library/react` and `@testing-library/jest-dom`
- **Testing utilities** - path aliases, test setup file, global test utilities
- **Test directory structure** - Create `apps/client/src/__tests__/` or `apps/client/tests/`

### 2. Fixture Files

The [tests/fixtures/README.md](tests/fixtures/README.md) outlines the structure, but **no actual JSON files exist yet**. We need:

- **Game state snapshots**: charleston-first-right.json, playing-drawing.json, etc.
- **Sample hands**: winning-hand-consecutive.json, etc.
- **Event sequences**: charleston-sequence.json, etc.

### 3. Mock Utilities

Create test helpers:

- **Mock WebSocket** - simulate backend connection
- **Mock Zustand stores** - test state management in isolation
- **Test helpers** - utilities like `renderWithProviders()`, `setupMockGame()`, etc.

### 4. Test Scenarios (Written Out)

The [tests/test-scenarios/README.md](tests/test-scenarios/README.md) is a template. We need to write the **actual scenario files**:

- `charleston-standard.md`
- `calling-priority-mahjong.md`
- `joker-exchange-single.md`
- etc.

### 5. Optional: Playwright for E2E

If we want E2E tests (recommended per our plan), we need:

- Playwright installation and config
- Backend launcher script (to spin up Rust server for tests)

---

## Recommended Next Steps (In Order)

### Step 1: Test Infrastructure Setup (Highest Priority)

Set up Vitest + React Testing Library configuration so we can actually run tests.

**Tasks**:

- Create `vitest.config.ts`
- Install `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
- Create test setup file
- Configure path aliases for tests
- Create initial test directory structure

### Step 2: Create Mock Utilities

Build the WebSocket mock and test helpers we'll use in every test.

**Tasks**:

- Mock WebSocket client
- Mock Zustand store utilities
- Test rendering helpers (`renderWithProviders()`)
- Common assertions and matchers

### Step 3: Create Fixture Files

Generate or hand-write the JSON fixtures for common game states.

**Tasks**:

- Create game state snapshots (5-8 key states)
- Create sample hands (4-6 scenarios)
- Create event sequences (3-5 flows)

### Step 4: Write Test Scenarios (Optional but Helpful)

Flesh out 3-5 key scenarios in detail to guide test writing.

**Tasks**:

- Charleston standard pass
- Call priority resolution
- Joker exchange flow
- Mahjong declaration

### Step 5: Write Your First Test

Start with a simple unit test (like a Tile component test) to validate setup works.

**Tasks**:

- Write `Tile.test.tsx`
- Verify test runs successfully
- Verify coverage reporting works

### Step 6: Expand Test Coverage

Follow the test plan: stores → hooks → components → integration → E2E

**Order**:

1. Unit test Zustand stores
2. Unit test custom hooks
3. Unit test command validation
4. Component test critical UI flows
5. Integration test command-event flows
6. E2E test complete game scenarios

---

## Success Criteria

We're ready to start TDD when:

- ✅ `npm run test` executes Vitest successfully *(DONE)*
- ✅ At least one passing test exists *(DONE - 37 tests passing)*
- ✅ Mock WebSocket utility is available *(DONE)*
- ✅ Basic fixtures exist for testing *(DONE - 10 fixtures)*
- ✅ Test coverage reporting works *(DONE)*

### Step 1 Status: ✅ COMPLETE

All test infrastructure has been set up successfully:

- ✅ Vitest configured with jsdom environment
- ✅ React Testing Library installed and working
- ✅ Test utilities created (`renderWithProviders`, WebSocket mock)
- ✅ Test directory structure established
- ✅ 7 passing smoke tests verifying setup
- ✅ Test scripts added to package.json
- ✅ Documentation created ([apps/client/TESTING.md](../../apps/client/TESTING.md))

**Next**: Step 2 - Create additional mock utilities for Zustand stores

### Step 2 Status: ✅ COMPLETE

All mock utilities have been created:

- ✅ `createMockStore()` - Create testable Zustand stores
- ✅ `waitForStoreUpdate()` - Wait for async store updates
- ✅ `captureStoreHistory()` - Track state evolution
- ✅ `mockStoreAction()` - Mock specific store actions
- ✅ Example store with comprehensive test patterns
- ✅ 16 passing tests demonstrating all patterns
- ✅ Complete documentation ([src/test/mocks/README.md](../../apps/client/src/test/mocks/README.md))

**Total Tests**: 23 passing (7 infrastructure + 16 Zustand patterns)

**Next**: Step 3 - Create fixture files for testing game states

### Step 3 Status: ✅ COMPLETE

All fixture files have been created:

- ✅ 3 game state snapshots (Charleston, Playing phases)
- ✅ 4 sample hands (standard, winning, near-win, with-jokers)
- ✅ 3 event sequences (charleston-pass, call-window, turn-flow)
- ✅ Central index.ts for type-safe imports
- ✅ 14 validation tests confirming fixtures load correctly
- ✅ Complete documentation with usage examples

**Total Tests**: 37 passing (7 infrastructure + 16 Zustand + 14 fixtures)

**Next**: Step 4 - Write test scenarios (optional) OR Step 5 - Write first component test

---

## Related Documentation

- [Frontend Test Plan](tests/frontend-test-plan.md) - Overall testing strategy
- [Component Master List](COMPONENT-MASTER-LIST.md) - All components to be tested
- [User Stories Index](user-stories/STORIES-INDEX.md) - Requirements being tested
- [Fixtures README](tests/fixtures/README.md) - Fixture file specifications
- [Test Scenarios README](tests/test-scenarios/README.md) - Scenario template

---

**Next Action**: Begin Step 1 - Test Infrastructure Setup
