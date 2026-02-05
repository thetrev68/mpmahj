# TDD Implementation Order - User Story Driven

**Status**: 140 tests passing (Foundation complete: Tile, TileImage, useTileSelection)

**Approach**: Implement complete user stories using test scenarios, building infrastructure as needed.

---

## Phase 1: MVP Core Flow (Critical Path)

### 1.1 Room Setup & Connection

**US-029: Create Room** ⭐ CRITICAL ✅ Complete

- Test Scenario: `test-scenarios/create-room.md`
- Components: CreateRoomForm, RoomSettings
- Infrastructure: WebSocket connection, authentication
- Estimated tests: ~8 tests
- **Dependencies**: None (start here after foundation)

**US-030: Join Room** ⭐ CRITICAL

- Test Scenario: `test-scenarios/join-room.md`
- Components: JoinRoomForm, LobbyLayout, PlayerList
- Infrastructure: Room state management
- Estimated tests: ~10 tests
- **Dependencies**: US-029

---

### 1.2 Game Start

**US-001: Roll Dice & Break Wall** 🔶 HIGH

- Test Scenario: `test-scenarios/roll-dice-break-wall.md`
- Components: DiceOverlay, GameBoard
- Infrastructure: gameStore (game phase, dealer, wall position)
- Estimated tests: ~6 tests
- **Dependencies**: US-030

---

### 1.3 Charleston Phase (Sequential)

**US-002: Charleston First Right** ⭐ CRITICAL

- Test Scenario: `test-scenarios/charleston-standard.md`
- Components: ConcealedHand, TileSelectionPanel, CharlestonTracker
- Infrastructure: gameStore (charleston events), useGameSocket (PassTiles command)
- Estimated tests: ~12 tests
- **Dependencies**: US-001, useTileSelection (✅ built)

**US-003: Charleston First Across** ⭐ CRITICAL

- Test Scenario: `test-scenarios/charleston-first-across.md`
- Components: Reuse from US-002, update directions
- Estimated tests: ~8 tests
- **Dependencies**: US-002

**US-004: Charleston First Left (Blind Pass)** ⭐ CRITICAL

- Test Scenarios: `test-scenarios/charleston-standard.md`, `charleston-blind-pass.md`
- Components: Blind pass checkbox, tile stealing UI
- Estimated tests: ~10 tests
- **Dependencies**: US-003

**US-005: Charleston Voting (Stop/Continue)** ⭐ CRITICAL

- Test Scenario: `test-scenarios/charleston-voting.md`
- Components: VotePanel, voting indicators
- Estimated tests: ~8 tests
- **Dependencies**: US-004

---

### 1.4 Core Gameplay - Turn Flow

**US-009: Drawing a Tile** ⭐ CRITICAL

- Test Scenario: `test-scenarios/drawing-discarding.md` (part 1)
- Components: ActionBar (Draw button), Wall component
- Infrastructure: Turn state, draw events
- Estimated tests: ~6 tests
- **Dependencies**: US-005 (post-Charleston)

**US-010: Discarding a Tile** ⭐ CRITICAL

- Test Scenario: `test-scenarios/drawing-discarding.md` (part 2)
- Components: ActionBar (Discard button), DiscardPile
- Infrastructure: Discard events
- Estimated tests: ~8 tests
- **Dependencies**: US-009, useTileSelection (✅ built)

**US-011: Call Window & Intent Buffering** ⭐ CRITICAL

- Test Scenario: `test-scenarios/call-window-intent-buffering.md`
- Components: CallWindowPanel, call intent buttons
- Infrastructure: Call intent queue, timer
- Estimated tests: ~12 tests
- **Dependencies**: US-010

**US-012: Call Priority Resolution** 🔶 HIGH

- Test Scenarios: `calling-priority-mahjong.md`, `calling-priority-turn-order.md`
- Components: CallPriorityIndicator
- Infrastructure: Priority resolution logic
- Estimated tests: ~8 tests
- **Dependencies**: US-011

**US-013: Calling Pung/Kong/Quint** ⭐ CRITICAL

- Test Scenario: `test-scenarios/calling-pung-kong-quint-sextet.md`
- Components: ExposedMelds display, meld selection
- Infrastructure: Meld exposure events
- Estimated tests: ~10 tests
- **Dependencies**: US-012

---

### 1.5 Win Conditions

**US-018: Declaring Mahjong (Self-Draw)** ⭐ CRITICAL

- Test Scenario: `test-scenarios/mahjong-self-draw.md`
- Components: Mahjong button, hand validation indicator
- Infrastructure: Win validation events
- Estimated tests: ~8 tests
- **Dependencies**: US-013

**US-019: Declaring Mahjong (Called Discard)** ⭐ CRITICAL

- Test Scenario: `test-scenarios/mahjong-called.md`
- Components: Mahjong call option in call window
- Estimated tests: ~8 tests
- **Dependencies**: US-018

**US-020: Invalid Mahjong → Dead Hand** 🔶 HIGH

- Test Scenarios: `mahjong-invalid.md`, `dead-hand-tile-count.md`
- Components: Dead hand indicator, error feedback
- Estimated tests: ~6 tests
- **Dependencies**: US-019

**US-021: Wall Game (Draw)** 🔶 HIGH

- Test Scenario: `test-scenarios/wall-game.md`
- Components: Wall exhausted message, draw screen
- Estimated tests: ~4 tests
- **Dependencies**: US-020

---

## Phase 2: Enhanced Gameplay (High Priority)

### 2.1 Special Actions

**US-014: Exchanging Joker (Single)** 🔶 HIGH

- Test Scenario: `test-scenarios/joker-exchange-single.md`
- Components: Joker exchange button, opponent meld interaction
- Estimated tests: ~8 tests
- **Dependencies**: US-013

**US-015: Exchanging Joker (Multiple)** 🔶 HIGH

- Test Scenario: `test-scenarios/joker-exchange-multiple.md`
- Components: Multiple exchange UI
- Estimated tests: ~6 tests
- **Dependencies**: US-014

**US-016: Upgrading Meld** 🔶 HIGH

- Test Scenario: `test-scenarios/meld-upgrade.md`
- Components: Meld upgrade interaction
- Estimated tests: ~6 tests
- **Dependencies**: US-013

**US-017: Wall Closure Rule** 🟡 MEDIUM

- Test Scenario: `test-scenarios/wall-closure-rule.md`
- Components: Wall indicator (last 14 tiles locked)
- Estimated tests: ~4 tests
- **Dependencies**: US-009

---

### 2.2 Charleston Advanced

**US-006: Charleston Second Charleston** 🔶 HIGH

- Test Scenario: `test-scenarios/charleston-second-charleston.md`
- Components: Second charleston voting, reverse passes
- Estimated tests: ~10 tests
- **Dependencies**: US-005

**US-007: Courtesy Pass Negotiation** 🔶 HIGH

- Test Scenario: `test-scenarios/charleston-courtesy-pass.md`
- Components: Courtesy pass dialog
- Estimated tests: ~8 tests
- **Dependencies**: US-006

**US-008: Charleston IOU Detection** 🟡 MEDIUM

- Test Scenario: `test-scenarios/charleston-iou.md`
- Components: IOU warning message
- Estimated tests: ~4 tests
- **Dependencies**: US-004

---

### 2.3 Session Management

**US-031: Leave Game** 🔶 HIGH

- Test Scenario: `test-scenarios/leave-game.md`
- Components: Leave button, confirmation dialog
- Estimated tests: ~4 tests
- **Dependencies**: US-030

**US-032: Forfeit Game** 🟡 MEDIUM

- Test Scenario: `test-scenarios/forfeit-game.md`
- Components: Forfeit button, penalty display
- Estimated tests: ~4 tests
- **Dependencies**: US-031

**US-037: Disconnect / Reconnect** 🟡 MEDIUM

- Test Scenario: `test-scenarios/disconnect-reconnect.md`
- Components: Reconnection overlay, state resync
- Infrastructure: Reconnection logic, snapshot reconciliation
- Estimated tests: ~10 tests
- **Dependencies**: US-030

---

## Phase 3: Advanced Features (Medium Priority)

### 3.1 History & Undo

**US-024: View Move History** 🟡 MEDIUM

- Test Scenario: `test-scenarios/view-move-history.md`
- Components: MoveHistoryList, history panel
- Infrastructure: History tracking
- Estimated tests: ~6 tests
- **Dependencies**: US-021

**US-025: Jump to Historical Move** 🟡 MEDIUM

- Test Scenario: `test-scenarios/history-jump.md`
- Components: HistoryScrubber, timeline navigation
- Estimated tests: ~6 tests
- **Dependencies**: US-024

**US-026: Resume from History Point** 🟡 MEDIUM

- Test Scenario: `test-scenarios/history-resume.md`
- Components: Resume button, truncate warning
- Estimated tests: ~6 tests
- **Dependencies**: US-025

**US-022: Smart Undo (Solo)** 🟡 MEDIUM

- Test Scenario: `test-scenarios/undo-solo.md`
- Components: Undo button
- Infrastructure: Undo command
- Estimated tests: ~4 tests
- **Dependencies**: US-010

**US-023: Smart Undo (Voting)** 🟡 MEDIUM

- Test Scenario: `test-scenarios/undo-voting.md`
- Components: UndoVotePanel
- Estimated tests: ~8 tests
- **Dependencies**: US-022

---

### 3.2 AI Hints

**US-027: Request Hints (AI Analysis)** 🟡 MEDIUM

- Test Scenario: `test-scenarios/request-hints-ai-analysis.md`
- Components: HintPanel, hint request button
- Infrastructure: Hint events
- Estimated tests: ~6 tests
- **Dependencies**: US-010

**US-028: Adjust Hint Verbosity** 🟢 LOW

- Test Scenario: `test-scenarios/adjust-hint-verbosity.md`
- Components: Hint settings
- Estimated tests: ~4 tests
- **Dependencies**: US-027

---

### 3.3 Settings & Configuration

**US-034: Configure House Rules** 🔶 HIGH

- Components: HouseRulesPanel
- Estimated tests: ~6 tests
- **Dependencies**: US-029

**US-035: Animation Settings** 🟡 MEDIUM

- Components: AnimationSettings panel
- Estimated tests: ~4 tests
- **Dependencies**: US-001

**US-036: Timer Configuration** 🟡 MEDIUM

- Test Scenario: `test-scenarios/timer-expiry.md`
- Components: TimerConfigPanel
- Estimated tests: ~6 tests
- **Dependencies**: US-029

---

## Summary Stats

### Phase 1 (MVP Core Flow)

- **15 user stories** (13 Critical + 2 High)
- **~134 estimated tests**
- Build order: Room Setup → Game Start → Charleston → Turn Flow → Win Conditions

### Phase 2 (Enhanced Gameplay)

- **11 user stories** (5 High + 6 Medium)
- **~64 estimated tests**
- Focus: Special actions, Charleston advanced, session management

### Phase 3 (Advanced Features)

- **11 user stories** (1 High + 9 Medium + 1 Low)
- **~56 estimated tests**
- Focus: History/Undo, AI hints, settings

**Total**: 37 user stories, ~254 estimated tests (plus 140 foundation = ~394 total)

---

## Next Steps

### Immediate (After Foundation Complete)

1. **US-029: Create Room** - Start here to enable game sessions
2. **US-030: Join Room** - Complete lobby functionality
3. **US-001: Roll Dice** - Enable game start
4. **US-002: Charleston First Right** - First gameplay feature

### How to Use This List

For each user story:

1. Read the user story file: `docs/implementation/frontend/user-stories/US-XXX-name.md`
2. Read the test scenario: `docs/implementation/frontend/tests/test-scenarios/name.md`
3. Check component specs: `docs/implementation/frontend/component-specs/`
4. Convert test scenario to test code (RED)
5. Build components to pass tests (GREEN)
6. Refactor and commit

---

**Last Updated**: 2026-02-04
**Foundation Status**: ✅ Complete (Tile, TileImage, useTileSelection)
**Current**: Ready to start US-029 (Create Room)
