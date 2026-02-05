# Master Test List - Frontend TDD Roadmap

**Status**: 140 tests passing (Foundation complete: Tile + TileImage + useTileSelection)
**Note**: US-030 join flow updated to invite-code join on 2026-02-05. See TDD_IMPLEMENTATION_ORDER.md.
**ABANDONED** This entire list was hallucinated. Switched to TDD_IMPLEMENTATION_ORDER.md.
**Goal**: Build complete game UI using Test-Driven Development
**Approach**: ~~Bottom-up~~ → **User Story Driven** (see [TDD_IMPLEMENTATION_ORDER.md](TDD_IMPLEMENTATION_ORDER.md))

---

## ⚠️ IMPORTANT: Use TDD_IMPLEMENTATION_ORDER.md Instead

This file was created with a bottom-up technical approach that doesn't align with the user stories and test scenarios.

**Use this instead**: **[TDD_IMPLEMENTATION_ORDER.md](TDD_IMPLEMENTATION_ORDER.md)**

The new file:

- ✅ Implements complete user stories (US-029, US-030, US-001, US-002, etc.)
- ✅ Uses your existing test scenarios (charleston-standard.md, etc.)
- ✅ Follows the actual game flow
- ✅ Builds infrastructure as needed, not speculatively

---

## Foundation Status (Completed)

**140 tests passing:**

## Priority Legend

- **P0**: Critical path - MVP blockers
- **P1**: High priority - Core gameplay
- **P2**: Medium priority - Enhanced features
- **P3**: Low priority - Polish & edge cases

---

## Phase 1: Foundation Layer (P0)

### 1.1 Core UI Components

#### `<Tile>` Component Tests (`components/game/Tile.test.tsx`)

- [x] P0: Renders tile with correct image based on tile index
- [x] P0: Shows different states (default, selected, disabled, highlighted, dimmed)
- [x] P0: Handles click events when clickable
- [x] P0: Does not trigger onClick when disabled
- [x] P0: Applies correct size variant (small, medium, large)
- [x] P0: Renders face-down tiles correctly
- [x] P0: Applies rotation for exposed melds
- [x] P1: Hover state shows lift and shadow
- [x] P1: Accessibility - ARIA labels correct
- [x] P1: Accessibility - Keyboard focus and Enter/Space trigger click
- [x] P2: Newly drawn tile shows pulsing animation
- [x] P3: Edge case: Invalid tile index shows error state

**Dependencies**: TileImage component (stub created)
**Test Count**: ✅ 50 tests passing
**Component Spec**: [docs/implementation/frontend/component-specs/game/Tile.md](../component-specs/game/Tile.md)

---

#### `<TileImage>` Component Tests (`components/game/TileImage.test.tsx`)

- [x] P0: Renders correct SVG for each tile index (0-36)
- [x] P0: Handles all suits (Bam, Crak, Dot)
- [x] P0: Handles special tiles (Winds, Dragons, Jokers, Flowers)
- [ ] P1: Lazy loads images if not in viewport (deferred - not critical for MVP)
- [x] P2: Handles missing asset gracefully
- [x] P3: Performance - memoizes correctly

**Dependencies**: None
**Test Count**: ✅ 27 tests passing
**Component**: [apps/client/src/components/game/TileImage.tsx](../../../apps/client/src/components/game/TileImage.tsx)

---

### 1.2 Tile Selection Logic

#### `useTileSelection` Hook Tests (`hooks/useTileSelection.test.ts`)

- [x] P0: Tracks selected tile indices
- [x] P0: Toggles selection on tile click
- [x] P0: Enforces max selection limit (e.g., 3 for Charleston)
- [x] P0: Prevents selection of disabled tiles
- [x] P0: Clears selection on command
- [ ] P1: Multi-select with Shift key (range selection)
- [ ] P1: Multi-select with Ctrl/Cmd key (toggle)
- [ ] P2: Keyboard navigation (arrow keys)
- [ ] P3: Touch gestures for mobile

**Dependencies**: None
**Test Count**: ✅ 24 tests passing
**Hook**: [apps/client/src/hooks/useTileSelection.ts](../../../apps/client/src/hooks/useTileSelection.ts)
**Spec**: [docs/implementation/frontend/component-specs/hooks/useTileSelection.md](../component-specs/hooks/useTileSelection.md)

---

## Phase 2: Store Layer (P0)

### 2.1 State Management

#### `gameStore` Tests (`stores/gameStore.test.ts`)

- [ ] P0: Initializes with empty state
- [ ] P0: Applies GameStateSnapshot correctly
- [ ] P0: Handles Public events (phase changes, turn changes)
- [ ] P0: Handles Private events (concealed tiles updates)
- [ ] P0: Handles Analysis events (hint data)
- [ ] P0: Updates player turn state on TurnChanged event
- [ ] P0: Updates Charleston stage on CharlestonPhaseChanged event
- [ ] P0: Adds exposed melds on MeldExposed event
- [ ] P0: Updates discard pile on TileDiscarded event
- [ ] P0: Updates wall count on TileDrawn event
- [ ] P1: Event queue processes in FIFO order
- [ ] P1: Snapshot reconciliation after reconnect
- [ ] P2: Handles malformed events gracefully
- [ ] P3: Event deduplication by ID

**Dependencies**: Fixtures (eventSequences)
**Test Count**: ~14 tests

---

#### `uiStore` Tests (`stores/uiStore.test.ts`)

- [ ] P0: Manages selected tiles state
- [ ] P0: Tracks action queue (for animations)
- [ ] P0: Controls dialog visibility (call window, undo vote)
- [ ] P1: Toast notification queue
- [ ] P1: Animation settings (enable/disable)
- [ ] P2: History mode state (active/inactive)
- [ ] P2: Sound effects preferences
- [ ] P3: Dark mode toggle

**Dependencies**: None
**Test Count**: ~8 tests

---

## Phase 3: Communication Layer (P0)

### 3.1 WebSocket Hook

#### `useGameSocket` Hook Tests (`hooks/useGameSocket.test.ts`)

- [ ] P0: Connects to WebSocket on mount
- [ ] P0: Sends Authenticate message immediately after connection
- [ ] P0: sendCommand wraps command in { kind: 'Command', payload }
- [ ] P0: Receives events and applies to gameStore
- [ ] P0: Auto-reconnects on disconnect with exponential backoff
- [ ] P0: Queues commands when disconnected
- [ ] P1: Heartbeat keeps connection alive
- [ ] P1: Handles connection errors gracefully
- [ ] P1: Cleans up on unmount
- [ ] P2: Timeout commands after 10s
- [ ] P3: Rate limiting feedback

**Dependencies**: WebSocket mock, gameStore
**Test Count**: ~11 tests
**Component Spec**: [docs/implementation/frontend/component-specs/hooks/useGameSocket.md](../component-specs/hooks/useGameSocket.md)

---

### 3.2 Action Queue Hook

#### `useActionQueue` Hook Tests (`hooks/useActionQueue.test.ts`)

- [ ] P1: Queues actions for sequential execution
- [ ] P1: Respects animation delays between actions
- [ ] P1: Cancels queue when needed
- [ ] P2: Pauses queue during history mode
- [ ] P2: Resumes queue after history exit
- [ ] P3: Adjusts speed based on settings

**Dependencies**: uiStore
**Test Count**: ~6 tests

---

## Phase 4: Display Components (P0-P1)

### 4.1 Hand Display

#### `<ConcealedHand>` Component Tests (`components/game/ConcealedHand.test.tsx`)

- [ ] P0: Renders 13-14 tiles in horizontal row
- [ ] P0: Shows selected tiles with visual state
- [ ] P0: Sorts tiles by suit and rank
- [ ] P0: Handles tile click events
- [ ] P0: Disables Jokers during Charleston
- [ ] P1: Groups tiles by suit with spacing
- [ ] P1: Highlights newly drawn tile
- [ ] P2: Horizontal scroll on small screens
- [ ] P3: Keyboard navigation

**Dependencies**: Tile component, useTileSelection
**Test Count**: ~9 tests

---

#### `<DiscardPile>` Component Tests (`components/game/DiscardPile.test.tsx`)

- [ ] P0: Renders tiles in 7-column grid
- [ ] P0: Shows tiles in discard order
- [ ] P0: Highlights latest discard
- [ ] P1: Compact size for opponents
- [ ] P2: Virtualization for 50+ tiles
- [ ] P3: Accessibility - announce discards

**Dependencies**: Tile component
**Test Count**: ~6 tests

---

#### `<ExposedMelds>` Component Tests (`components/game/ExposedMelds.test.tsx`)

- [ ] P0: Renders Pung (3 tiles)
- [ ] P0: Renders Kong (4 tiles)
- [ ] P0: Renders Quint (5 tiles)
- [ ] P0: Shows called tile as rotated
- [ ] P1: Groups melds with spacing
- [ ] P2: Shows meld type labels
- [ ] P3: Accessibility - describes meld structure

**Dependencies**: Tile component
**Test Count**: ~7 tests

---

### 4.2 Player Rack

#### `<PlayerRack>` Component Tests (`components/game/PlayerRack.test.tsx`)

- [ ] P0: Renders current player with full hand
- [ ] P0: Renders opponent with tile count only
- [ ] P0: Shows exposed melds for all players
- [ ] P0: Shows discard pile for all players
- [ ] P0: Displays player info (name, wind, score)
- [ ] P0: Highlights active player with turn indicator
- [ ] P0: Shows dealer badge for East player
- [ ] P1: Applies correct orientation (bottom, top, left, right)
- [ ] P1: Compact layout for opponents
- [ ] P2: Reconnection badge when disconnected
- [ ] P3: Long name truncation

**Dependencies**: ConcealedHand, ExposedMelds, DiscardPile
**Test Count**: ~11 tests
**Component Spec**: [docs/implementation/frontend/component-specs/game/PlayerRack.md](../component-specs/game/PlayerRack.md)

---

### 4.3 Game Board

#### `<GameBoard>` Component Tests (`components/game/GameBoard.test.tsx`)

- [ ] P0: Renders 4 PlayerRack components in cross layout
- [ ] P0: Shows current player at bottom
- [ ] P0: Positions opponents correctly (top, left, right)
- [ ] P0: Displays central game area (wall, discards)
- [ ] P1: Responsive layout adjusts to screen size
- [ ] P2: Animations during tile passes
- [ ] P3: Zoom controls for accessibility

**Dependencies**: PlayerRack, Wall, WallCounter
**Test Count**: ~7 tests

---

## Phase 5: Game Flow Components (P1)

### 5.1 Charleston UI

#### `<CharlestonTracker>` Component Tests (`components/game/CharlestonTracker.test.tsx`)

- [ ] P1: Shows current stage (First Right, Across, Left)
- [ ] P1: Indicates completed stages
- [ ] P1: Shows voting status
- [ ] P1: Displays second Charleston stages if active
- [ ] P1: Shows courtesy pass option
- [ ] P2: Animated transitions between stages
- [ ] P3: Accessibility - announces stage changes

**Dependencies**: None (pure display)
**Test Count**: ~7 tests

---

#### `<CharlestonTimer>` Component Tests (`components/game/CharlestonTimer.test.tsx`)

- [ ] P1: Displays remaining time
- [ ] P1: Updates countdown every second
- [ ] P1: Shows warning at 10s remaining
- [ ] P1: Shows urgent state at 5s remaining
- [ ] P2: Pauses during voting
- [ ] P3: Accessibility - announces time warnings

**Dependencies**: useTimer hook
**Test Count**: ~6 tests

---

#### `<TileSelectionPanel>` Component Tests (`components/game/TileSelectionPanel.test.tsx`)

- [ ] P0: Shows selected tile count
- [ ] P0: Enables "Pass" button when 3 tiles selected
- [ ] P0: Shows blind pass option on left pass
- [ ] P1: Displays IOU indicator
- [ ] P1: Shows courtesy pass controls
- [ ] P2: Keyboard shortcuts (Enter to pass)
- [ ] P3: Touch gestures for mobile

**Dependencies**: useTileSelection
**Test Count**: ~7 tests

---

### 5.2 Calling UI

#### `<CallWindowPanel>` Component Tests (`components/game/CallWindowPanel.test.tsx`)

- [ ] P0: Appears on TileDiscarded event (other player)
- [ ] P0: Shows call options (Pung, Kong, Quint, Mahjong)
- [ ] P0: Enables only valid call types
- [ ] P0: Disables if hand cannot call
- [ ] P0: Auto-closes after 5s timeout
- [ ] P1: Shows call intent buffering
- [ ] P1: Displays priority indicator
- [ ] P2: Keyboard shortcuts (P, K, Q, M)
- [ ] P3: Touch-friendly buttons

**Dependencies**: useGameSocket
**Test Count**: ~8 tests

---

#### `<CallPriorityIndicator>` Component Tests (`components/game/CallPriorityIndicator.test.tsx`)

- [ ] P1: Shows Mahjong has priority
- [ ] P1: Shows turn order for Pung/Kong
- [ ] P1: Highlights winning caller
- [ ] P2: Animated transition
- [ ] P3: Accessibility - announces winner

**Dependencies**: None (pure display)
**Test Count**: ~5 tests

---

### 5.3 Turn Actions

#### `<ActionBar>` Component Tests (`components/game/ActionBar.test.tsx`)

- [ ] P0: Shows "Draw" button during Drawing phase
- [ ] P0: Shows "Discard" button during Discarding phase
- [ ] P0: Shows "Mahjong" button when hand is winning
- [ ] P0: Disables buttons when not player's turn
- [ ] P1: Shows hint request button
- [ ] P1: Shows undo button (if enabled)
- [ ] P1: Displays keyboard shortcuts
- [ ] P2: Touch gestures
- [ ] P3: Haptic feedback

**Dependencies**: useGameSocket, gameStore
**Test Count**: ~9 tests

---

## Phase 6: Integration Tests (P1)

### 6.1 Command-Event Flows

#### Charleston Integration Tests (`integration/charleston.test.ts`)

- [ ] P0: Standard pass (select 3 → send PassTiles → receive TilesPassed)
- [ ] P1: Blind pass (select 1-2 → send PassTiles)
- [ ] P1: Stop vote (send VoteStopCharleston → all players respond)
- [ ] P1: Second Charleston activation
- [ ] P1: Courtesy pass negotiation
- [ ] P2: IOU resolution
- [ ] P3: Timeout handling

**Dependencies**: All Charleston components, useGameSocket
**Test Count**: ~7 tests
**Test Scenarios**: [docs/implementation/frontend/tests/test-scenarios/](test-scenarios/)

---

#### Calling Integration Tests (`integration/calling.test.ts`)

- [ ] P0: Intent buffering (multiple calls, priority resolution)
- [ ] P0: Mahjong priority over Pung/Kong
- [ ] P0: Turn order priority for same call type
- [ ] P1: Cancel call intent
- [ ] P1: Timeout closes call window
- [ ] P2: Edge case: Multiple Mahjong calls
- [ ] P3: Dead hand after invalid call

**Dependencies**: CallWindowPanel, useGameSocket
**Test Count**: ~7 tests

---

#### Turn Flow Integration Tests (`integration/turn-flow.test.ts`)

- [ ] P0: Draw tile → Discard tile → Next player's turn
- [ ] P1: Draw from wall → Wall count decreases
- [ ] P1: Discard → Tile added to discard pile
- [ ] P1: Discard → Call window opens for others
- [ ] P2: Self-draw Mahjong
- [ ] P2: Joker exchange after call
- [ ] P3: Wall game (no tiles left)

**Dependencies**: GameBoard, ActionBar, useGameSocket
**Test Count**: ~7 tests

---

#### Undo Integration Tests (`integration/undo.test.ts`)

- [ ] P1: Solo undo (solo game mode)
- [ ] P1: Voting undo (multiplayer)
- [ ] P1: Undo denied (player votes no)
- [ ] P2: Undo approved (all vote yes)
- [ ] P2: Undo timeout (auto-deny)
- [ ] P3: Multiple undo requests

**Dependencies**: UndoVotePanel, useGameSocket
**Test Count**: ~6 tests

---

## Phase 7: Advanced Features (P2)

### 7.1 History Mode

#### History UI Tests (`components/game/HistoryScrubber.test.tsx`)

- [ ] P2: Timeline scrubber shows move history
- [ ] P2: Click move jumps to that state
- [ ] P2: Resume from history point
- [ ] P2: Truncate history warning
- [ ] P3: Keyboard shortcuts (← →)
- [ ] P3: Touch gestures

**Dependencies**: gameStore
**Test Count**: ~6 tests

---

### 7.2 Hints & AI Analysis

#### `<HintPanel>` Component Tests (`components/game/HintPanel.test.tsx`)

- [ ] P2: Request hint button enabled when turn
- [ ] P2: Displays AI analysis (probabilities, recommendations)
- [ ] P2: Adjust verbosity (basic, detailed, expert)
- [ ] P2: Shows pattern suggestions
- [ ] P3: Animated hints
- [ ] P3: Accessibility - screen reader support

**Dependencies**: useGameSocket, gameStore
**Test Count**: ~6 tests

---

### 7.3 Timers & Settings

#### `useTimer` Hook Tests (`hooks/useTimer.test.ts`)

- [ ] P1: Counts down from initial value
- [ ] P1: Emits tick events every second
- [ ] P1: Emits timeout event at zero
- [ ] P1: Pause and resume
- [ ] P2: Reset timer
- [ ] P3: Adjust duration

**Dependencies**: None
**Test Count**: ~6 tests

---

#### `<AnimationSettings>` Component Tests (`components/game/AnimationSettings.test.tsx`)

- [ ] P2: Toggle animations on/off
- [ ] P2: Adjust animation speed
- [ ] P2: Local-only settings (no server sync)
- [ ] P3: Accessibility preferences

**Dependencies**: uiStore
**Test Count**: ~4 tests

---

## Phase 8: End-to-End Tests (P2-P3)

### 8.1 Playwright Setup

#### E2E Infrastructure (`e2e/setup.ts`)

- [ ] P2: Launch backend server for tests
- [ ] P2: Create test rooms with fixtures
- [ ] P2: Seed game states for scenarios
- [ ] P3: Cleanup after tests

**Dependencies**: Backend server
**Test Count**: N/A (setup only)

---

### 8.2 Full Game Scenarios

#### E2E: Complete Game (`e2e/complete-game.spec.ts`)

- [ ] P2: 4 players join room
- [ ] P2: Charleston completes (3 stages)
- [ ] P2: Main game turn progression
- [ ] P2: Player calls Pung
- [ ] P2: Player calls Mahjong
- [ ] P2: Score display and game over

**Dependencies**: Full stack (backend + frontend)
**Test Count**: ~1 long test (~5 min)

---

#### E2E: Reconnection (`e2e/reconnection.spec.ts`)

- [ ] P2: Player disconnects during Charleston
- [ ] P2: Player reconnects and resumes
- [ ] P2: Bot takes over if not reconnected
- [ ] P3: Multiple reconnects

**Dependencies**: Full stack
**Test Count**: ~4 tests

---

#### E2E: Multi-Device (`e2e/multi-device.spec.ts`)

- [ ] P3: Same user on 2 devices (conflict handling)
- [ ] P3: Different users on different devices (standard multiplayer)
- [ ] P3: Mobile + desktop clients

**Dependencies**: Full stack
**Test Count**: ~3 tests

---

## Summary Statistics

### Test Count by Phase

- **Phase 1: Foundation** - ~27 tests
- **Phase 2: Stores** - ~22 tests
- **Phase 3: Communication** - ~17 tests
- **Phase 4: Display Components** - ~33 tests
- **Phase 5: Game Flow** - ~37 tests
- **Phase 6: Integration** - ~27 tests
- **Phase 7: Advanced** - ~22 tests
- **Phase 8: E2E** - ~8 tests

**Total Estimated Tests**: ~193 tests (excluding E2E infrastructure)

### Current Status

- ✅ Infrastructure: 39 tests passing
- ✅ **Tile Component: 50 tests passing** (RED-GREEN-REFACTOR complete)
- ✅ **TileImage Component: 27 tests passing** (RED-GREEN-REFACTOR complete)
- ✅ **useTileSelection Hook: 24 tests passing** (RED-GREEN-REFACTOR complete)
- 🚧 Next: gameStore tests

---

## Next Steps (Immediate Action Items)

### Week 1: Foundation & Core Components

1. ✅ Review websocket.test.ts (DONE)
2. ✅ Write `<Tile>` component tests (50 tests - DONE)
3. ✅ Implement `<Tile>` component (TDD - DONE)
4. ✅ Write `<TileImage>` tests (27 tests - DONE)
5. ✅ Implement `<TileImage>` component (TDD - DONE)
6. ✅ Write `useTileSelection` tests (24 tests - DONE)
7. ✅ Implement `useTileSelection` hook (TDD - DONE)

### Week 2: Stores & Communication

1. ⏭️ Write `gameStore` tests (14 tests)
2. ⏭️ Implement `gameStore` with event handling
3. ⏭️ Write `uiStore` tests (8 tests)
4. ⏭️ Implement `uiStore`
5. ⏭️ Write `useGameSocket` tests (11 tests)
6. ⏭️ Implement `useGameSocket` hook

### Week 3: Display Components

1. ⏭️ Write `<ConcealedHand>` tests (9 tests)
2. ⏭️ Implement `<ConcealedHand>` component
3. ⏭️ Write `<DiscardPile>` tests (6 tests)
4. ⏭️ Implement `<DiscardPile>` component
5. ⏭️ Write `<ExposedMelds>` tests (7 tests)
6. ⏭️ Implement `<ExposedMelds>` component

### Week 4: Game Board & Player Racks

1. ⏭️ Write `<PlayerRack>` tests (11 tests)
2. ⏭️ Implement `<PlayerRack>` component
3. ⏭️ Write `<GameBoard>` tests (7 tests)
4. ⏭️ Implement `<GameBoard>` component
5. ⏭️ Integration testing & bug fixes

---

## Testing Best Practices

### TDD Workflow

1. **Red**: Write failing test
2. **Green**: Write minimal code to pass
3. **Refactor**: Improve code quality
4. **Repeat**: Next test

### Test Structure

```typescript
describe('ComponentName', () => {
  describe('Behavior', () => {
    test('should do specific thing', () => {
      // Arrange
      const props = { ... };

      // Act
      const { getByRole } = render(<Component {...props} />);

      // Assert
      expect(getByRole('button')).toBeInTheDocument();
    });
  });
});
```

### Coverage Goals

- **Unit tests**: 80%+ coverage
- **Integration tests**: Critical paths 100%
- **E2E tests**: Happy path + 2-3 edge cases

---

**Last Updated**: 2026-02-04
**Maintained by**: Project team
