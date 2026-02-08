# GameBoard Refactoring - Start Prompt

**Use this prompt to begin the GameBoard.tsx refactoring work in a new chat session.**

---

## Prompt for New Chat

```
I'm working on the American Mahjong project (mpmahj) and need to refactor GameBoard.tsx following our approved refactoring plan.

### Project Context

- **Stack**: React + TypeScript (Vite), Rust backend (WebSocket server)
- **Current State**: GameBoard.tsx is 1,663 lines with 53 state variables, severe complexity issues
- **Goal**: Decompose into testable, maintainable components using TDD approach
- **Refactoring Plan**: See `docs/implementation/frontend/GAMEBOARD_REFACTORING_PLAN.md`

### Key Constraints

1. **CRITICAL**: All 12 integration tests MUST pass after every checkpoint
   - Tests at `apps/client/src/features/game/*.integration.test.tsx`
   - Run with `npm run test:integration`
2. **No behavior changes**: Refactored code must produce identical results to original
3. **TypeScript bindings**: Always use generated types from `src/types/bindings/generated/`
4. **TDD approach**: Write tests before implementation
5. **Feature flags**: Enable gradual rollout with instant rollback capability

### Current Phase: Phase 1 - Foundation (Week 1)

**Objective**: Create testable utilities without touching GameBoard.tsx

**Tasks** (in order):

1. **Create Event Handler Utilities**
   - [ ] Create `apps/client/src/lib/game-events/` directory
   - [ ] Implement `types.ts` (StateUpdater, UIStateAction, SideEffect, EventHandlerResult)
   - [ ] Implement `sideEffectManager.ts` with tests
   - [ ] Extract `handleDiceRolled` with tests (from GameBoard.tsx lines 332-336)
   - [ ] Extract `handleWallBroken` with tests (lines 339-349)
   - [ ] Extract `handlePhaseChanged` with tests (lines 516-525)
   - [ ] **Checkpoint**: All extracted handlers have >90% test coverage

2. **Create Business Logic Utilities**
   - [ ] Create `apps/client/src/lib/game-logic/` directory
   - [ ] Implement `phaseDetection.ts` with tests (isCharlestonPhase, getCharlestonStage, etc.)
   - [ ] Implement `callIntentCalculator.ts` with tests (logic from GameBoard lines 1531-1574)
   - [ ] **Checkpoint**: All utilities have >90% test coverage

3. **Validation**
   - [ ] Run `npm run test:integration` - MUST PASS (no changes to GameBoard yet)
   - [ ] Run `npm run lint` and `npm run format`
   - [ ] Code review utilities

### File Structure to Create

```
apps/client/src/
├── lib/
│   ├── game-events/
│   │   ├── types.ts                    # Event handler types
│   │   ├── sideEffectManager.ts        # Centralized timeout management
│   │   ├── sideEffectManager.test.ts   # Tests
│   │   ├── publicEventHandlers.ts      # Pure event handler functions
│   │   └── publicEventHandlers.test.ts # Tests
│   └── game-logic/
│       ├── phaseDetection.ts           # Phase detection utilities
│       ├── phaseDetection.test.ts      # Tests
│       ├── callIntentCalculator.ts     # Meld calculation logic
│       └── callIntentCalculator.test.ts # Tests
```

### Key Patterns to Follow

#### 1. Event Handler Pattern (Pure Functions)

```typescript
// types.ts
export type StateUpdater = (prev: GameState | null) => GameState | null;
export type UIStateAction =
  | { type: 'SET_DICE_ROLL'; value: number }
  | { type: 'SET_SHOW_DICE_OVERLAY'; value: boolean };
export type SideEffect =
  | { type: 'TIMEOUT'; id: string; ms: number; callback: () => void }
  | { type: 'CLEAR_TIMEOUT'; id: string };
export interface EventHandlerResult {
  stateUpdates: StateUpdater[];
  uiActions: UIStateAction[];
  sideEffects: SideEffect[];
}

// publicEventHandlers.ts
export function handleDiceRolled(
  event: Extract<PublicEvent, { DiceRolled: unknown }>,
  context: EventContext
): EventHandlerResult {
  return {
    stateUpdates: [
      (prev) => prev ? { ...prev, phase: { Setup: 'BreakingWall' } } : null
    ],
    uiActions: [
      { type: 'SET_DICE_ROLL', value: event.DiceRolled.roll },
      { type: 'SET_SHOW_DICE_OVERLAY', value: true },
    ],
    sideEffects: [],
  };
}
```

#### 2. Test Pattern (TDD)

```typescript
// publicEventHandlers.test.ts
describe('handleDiceRolled', () => {
  test('sets dice roll and shows overlay', () => {
    const event: PublicEvent = { DiceRolled: { roll: 7 } };
    const result = handleDiceRolled(event, { gameState: mockGameState });

    expect(result.uiActions).toContainEqual({ type: 'SET_DICE_ROLL', value: 7 });
    expect(result.uiActions).toContainEqual({ type: 'SET_SHOW_DICE_OVERLAY', value: true });
    expect(result.stateUpdates[0](mockGameState).phase).toEqual({ Setup: 'BreakingWall' });
  });
});
```

### Source Material

**Original GameBoard.tsx**: `apps/client/src/components/game/GameBoard.tsx`

**Key sections to extract**:
- Lines 332-336: DiceRolled event handler
- Lines 339-349: WallBroken event handler
- Lines 516-525: PhaseChanged event handler
- Lines 1531-1574: Call intent calculation logic

**DO NOT modify GameBoard.tsx yet** - Phase 1 only creates new utilities.

### Success Criteria for Phase 1

- ✅ All new files created with proper directory structure
- ✅ `sideEffectManager.ts` with >90% test coverage
- ✅ 3 event handlers extracted with >90% test coverage each
- ✅ `phaseDetection.ts` with >90% test coverage
- ✅ `callIntentCalculator.ts` with >90% test coverage
- ✅ Integration tests still pass (12/12)
- ✅ No linting errors
- ✅ Code formatted with Prettier

### Getting Started

1. Read the full refactoring plan: `docs/implementation/frontend/GAMEBOARD_REFACTORING_PLAN.md`
2. Review GameBoard.tsx to understand current implementation
3. Start with creating the directory structure
4. Implement `types.ts` first (foundational types)
5. Implement `sideEffectManager.ts` + tests
6. Extract event handlers one at a time (write test first, then implementation)

### Questions to Ask Before Starting

1. Should I read GameBoard.tsx first to understand current implementation?
2. Do you want me to create all files at once or iteratively?
3. Should I follow the TDD approach strictly (test first, then implementation)?
4. Any specific testing patterns from existing tests I should follow?

### Commands to Run

```bash
# Run integration tests (must pass)
cd apps/client && npm run test:integration

# Run unit tests (for new files)
cd apps/client && npm run test

# Run linting
cd apps/client && npm run lint

# Format code
cd apps/client && npm run format

# Full check
npm run check:all
```

Let's begin with Phase 1, Task 1: Creating the event handler utilities. Should I start by reading GameBoard.tsx to understand the current event handling implementation?
```

---

## Usage Instructions

1. **Copy the prompt above** (everything in the code block)
2. **Start a new chat** with Claude
3. **Paste the prompt**
4. **Follow the TDD workflow** for each task

## Checkpoint After Phase 1

Before moving to Phase 2, validate:
- ✅ All integration tests pass
- ✅ >90% coverage on new utilities
- ✅ Code review approved
- ✅ GameBoard.tsx unchanged (no regressions)

## Next Phase Prompt

After completing Phase 1, use this prompt to start Phase 2:

```
Phase 1 complete! Now starting Phase 2: Charleston Extraction.

**Completed in Phase 1**:
- ✅ Event handler utilities (types, sideEffectManager, 3 handlers)
- ✅ Business logic utilities (phaseDetection, callIntentCalculator)
- ✅ All tests passing with >90% coverage

**Phase 2 Objective**: Extract Charleston state and logic

**Tasks**:
1. Create `hooks/useCharlestonState.ts` with tests
2. Create `hooks/useGameAnimations.ts` with tests
3. Extract all Charleston event handlers (9 handlers)
4. Create `components/game/phases/CharlestonPhase.tsx` with tests
5. Add feature flag and wire into GameBoard

See `docs/implementation/frontend/GAMEBOARD_REFACTORING_PLAN.md` Phase 2 section for details.

Should I start by creating useCharlestonState.ts?
```

---

## Tips for Success

1. **Read the full refactoring plan first** - Understand the big picture
2. **TDD approach** - Write tests before implementation (catches issues early)
3. **One task at a time** - Don't jump ahead, complete each checkpoint
4. **Run tests frequently** - Catch regressions immediately
5. **Feature flags** - Enable gradual rollout, instant rollback
6. **Integration tests are gospel** - They MUST pass at every checkpoint

---

**Document Status**: ✅ Ready to Use

**Last Updated**: 2026-02-08
