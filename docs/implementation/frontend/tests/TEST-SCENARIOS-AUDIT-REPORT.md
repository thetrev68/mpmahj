# Test Scenario Audit Report

**Date**: 2026-02-02
**Auditor**: Claude Code
**Files Reviewed**: 39 test scenario markdown files
**Location**: `docs/implementation/frontend/tests/test-scenarios/`

---

## Executive Summary

**Issues Found**: 33 files need fixes (5 critical, 3 moderate, 25 minor)
**Root Cause**: Another LLM hallucinated backend features and wrote UI specs instead of behavior tests

**Key Problems**:

1. Commands/events that don't exist in Rust backend
2. Features described that aren't implemented (house rules system, voting, settings)
3. Anti-TDD: prescriptive UI specs instead of behavioral tests
4. Excessive length (200-300 lines vs 50-100 target)

---

## Critical Issues (Require Rewrite or Deletion)

### ❌ 1. Room Management (Architectural Mismatch)

**Files**: `create-room.md`, `join-room.md`

**Problem**: Tests use commands like `CreateRoom`, `StartGame`, `RoomCreated`, `PlayerJoined`

**Reality**: Room operations are **server-layer `Envelope` messages**, not `GameCommand` enum variants

**Backend Evidence**:

- `crates/mahjong_core/src/command.rs` - `GameCommand` enum has NO room management commands
- Room operations handled in `mahjong_server` layer via WebSocket envelopes

**Fix**: Rewrite using actual WebSocket envelope structure or mark as server integration tests (not frontend game logic tests)

---

### ❌ 2. House Rules Configuration (Feature Doesn't Exist)

**File**: `configure-house-rules.md` (324 lines)

**Problem**: Describes elaborate house rules system with:

- `UpdateHouseRules` command (doesn't exist)
- `HouseRulesUpdated`, `HouseRulesError` events (don't exist)
- Categories: Charleston Rules, Meld Rules, Joker Rules, Undo Rules, Pattern Rules
- Settings like:
  - "Allow Custom Patterns"
  - "Multiple Melds per Turn"
  - "Strict Tile Counting"
  - "Allow Second Charleston"
  - "Blind Pass Required"

**Reality**: Your actual `Ruleset` struct (from `crates/mahjong_core/src/table/types.rs`):

```rust
pub struct Ruleset {
    pub card_year: u16,                  // e.g., 2025
    pub timer_mode: TimerMode,           // Visible or Hidden
    pub blank_exchange_enabled: bool,    // Allow blank tile exchange
    pub call_window_seconds: u32,        // Call window duration
    pub charleston_timer_seconds: u32,   // Charleston timer duration
}
```

**Fix**: **DELETE** or postpone until house rules system is implemented

---

### ❌ 3. Animation Settings (Feature Doesn't Exist)

**File**: `animation-settings.md`

**Problem**: Describes `UpdateSettings`, `SettingsUpdated` commands/events that don't exist

**Reality**: No settings commands exist in `GameCommand` enum

**Fix**: **DELETE** or postpone until settings infrastructure exists

---

### ❌ 4. Abandon Game Voting (Wrong Semantics)

**File**: `abandon-game-consensus.md`

**Problem**: Describes voting workflow with commands:

- `RequestAbandonVote` (doesn't exist)
- `CastAbandonVote` (doesn't exist)
- Events: `AbandonVoteStarted`, `AbandonVoteCast`, `AbandonVoteSucceeded`, `AbandonVoteFailed` (none exist)

**Reality**: `AbandonGame` command exists in backend:

```rust
AbandonGame {
    player: Seat,
    reason: crate::flow::outcomes::AbandonReason,
}
```

But it executes **immediately** - no voting mechanism exists

**Fix**: **DELETE** - feature design is fundamentally different from implementation

---

### ❌ 5. Game Modes (Incorrect Options)

**Files**: `create-room.md`, `configure-house-rules.md`

**Problem**: Lists game modes as: Standard, Practice, **Tournament**

**Reality**: Actual `GameMode` enum (from `crates/mahjong_core/src/table/types.rs`):

```rust
pub enum GameMode {
    Practice,    // Relaxed timers, hidden timer mode
    Casual,      // Moderate timers, visible timer
    Competitive, // Fast timers, visible timer
}
```

**Fix**: Remove "Tournament" and "Standard" references

---

## Moderate Issues (Partial Rewrite Needed)

### ⚠️ 6. Hint System (Wrong Event Names)

**Files**: `request-hints-ai-analysis.md`, `adjust-hint-verbosity.md`

**Problem**:

- Uses event `HintProvided` (doesn't exist)
- Uses event `HintError` (doesn't exist)
- Describes complex hint response structure that may not match actual implementation

**Reality** (from `crates/mahjong_core/src/command.rs`):

```rust
// COMMAND - EXISTS ✅
RequestHint {
    player: Seat,
    verbosity: HintVerbosity,
}

// COMMAND - EXISTS ✅
SetHintVerbosity {
    player: Seat,
    verbosity: HintVerbosity,
}
```

Events use `HintUpdate` and `AnalysisUpdate` (from `AnalysisEvent` enum), NOT `HintProvided`

**Fix**:

- Replace `HintProvided` → `HintUpdate`
- Replace `HintError` → verify actual error event structure
- Verify actual `HintData` response format

---

### ⚠️ 7. Wall Exhaustion (Event Structure Differs)

**File**: `wall-game.md`

**Problem**: Expects standalone `WallExhausted` event

**Reality**: Wall exhaustion triggers `GameOver` event with outcome variant (not a separate event type)

**Fix**: Verify actual `GameOver` event structure and update test assertions

---

### ⚠️ 8. Adjust Hint Verbosity (Mixed Accuracy)

**File**: `adjust-hint-verbosity.md`

**Problem**: Mixes real command (`SetHintVerbosity` ✅) with hallucinated settings system

**Fix**:

- Keep hint verbosity testing sections
- Remove general settings infrastructure references
- Focus on `SetHintVerbosity` command behavior

---

## Minor Issues (Trim & Polish)

### ✂️ 9. Anti-TDD Patterns (22 Files with Accurate Commands but Excessive UI Detail)

**Files with Correct Backend Commands/Events**:

- `calling-priority-mahjong.md`
- `charleston-first-across.md`
- `charleston-second-charleston.md`
- `calling-pung-kong-quint-sextet.md`
- `wall-closure-rule.md`
- `roll-dice-break-wall.md`
- `drawing-discarding.md`
- `joker-exchange-single.md`
- `joker-exchange-multiple.md`
- `mahjong-self-draw.md`
- `mahjong-called.md`
- `mahjong-invalid.md`
- `dead-hand-tile-count.md`
- `timer-expiry.md`
- `disconnect-reconnect.md`
- `leave-game.md`
- `forfeit-game.md`
- `undo-solo.md`
- `undo-voting.md`
- `view-move-history.md`
- `history-jump.md`
- `history-resume.md`
- `call-window-intent-buffering.md`
- `meld-upgrade.md` ⭐ (already concise - use as template!)

**Problem**: These scenarios describe **UI implementation** instead of **behavioral tests**

**Examples of Anti-TDD Patterns**:

❌ **BAD** (Prescriptive UI):

```markdown
### Step 3: User opens House Rules dialog
- User clicks "House Rules" button
- House Rules dialog slides in from center of screen
- UI shows House Rules dialog with:
  - Header: "House Rules"
  - Sections: "Charleston", "Melds", "Jokers"
  - Buttons: "Save", "Cancel"
```

✅ **GOOD** (Behavioral):

```markdown
## Test Flow
1. User configures hint verbosity to "Expert"
2. Send: SetHintVerbosity { player: East, verbosity: Expert }
3. Receive: HintUpdate event with expert-level analysis
4. Assert: Subsequent hints contain advanced recommendations
```

**Current Average Length**: 217 lines
**Target Length**: 50-100 lines
**Reduction Needed**: ~65%

**What to Remove**:

- ❌ UI widget descriptions ("button appears", "dialog slides in", "spinner shows")
- ❌ Color/animation specs ("highlights with selection border", "success animation")
- ❌ Accessibility announcements (move to separate accessibility spec document)
- ❌ Redundant "Step 1: Verify state" sections
- ❌ Cross-reference sections (move to index doc)
- ❌ Backend References sections (use actual rustdoc instead)
- ❌ "Manual Test" references to non-existent checklists

**What to Keep**:

- ✅ Command → Event sequences
- ✅ Game state assertions
- ✅ Error case validations
- ✅ Data verification
- ✅ Fixture references
- ✅ Success criteria

---

## Salvageability Matrix

| Status | Count | Action | Files |
|--------|-------|--------|-------|
| ✅ Keep & Trim | 22 | Reduce length 65%, remove UI detail | Most game flow scenarios |
| ⚠️ Partial Rewrite | 3 | Fix event names, verify structures | `request-hints-ai-analysis.md`, `wall-game.md`, `adjust-hint-verbosity.md` |
| ❌ Delete | 1 | Feature doesn't exist | `abandon-game-consensus.md` |
| ❌ Rewrite/Postpone | 4 | Wrong layer or missing features | `create-room.md`, `join-room.md`, `configure-house-rules.md`, `animation-settings.md` |
| ℹ️ Reference | 1 | Keep as-is | `coverage-matrix.md` |

---

## Detailed File-by-File Assessment

### DELETE (1 file)

| File | Reason | Lines |
|------|--------|-------|
| `abandon-game-consensus.md` | Voting system doesn't exist; AbandonGame is immediate | 250+ |

---

### REWRITE OR POSTPONE (4 files)

| File | Issue | Lines | Action |
|------|-------|-------|--------|
| `create-room.md` | Room ops are server layer, not GameCommand | 317 | Rewrite as server integration test or postpone |
| `join-room.md` | Join is server layer, not GameCommand | ~250 | Rewrite as server integration test or postpone |
| `configure-house-rules.md` | Entire house rules system doesn't exist | 324 | DELETE or postpone until implemented |
| `animation-settings.md` | Settings commands don't exist | ~200 | DELETE or postpone until implemented |

---

### PARTIAL REWRITE (3 files)

| File | Issue | Lines | Fix |
|------|-------|-------|-----|
| `request-hints-ai-analysis.md` | Event name: `HintProvided` → `HintUpdate` | 236 | Fix event name, trim UI detail |
| `adjust-hint-verbosity.md` | Mixed: `SetHintVerbosity` ✅, settings system ❌ | ~180 | Keep hint part, remove settings references |
| `wall-game.md` | Event structure: standalone vs GameOver variant | ~150 | Verify GameOver event structure |

---

### TRIM & POLISH (22 files)

**Charleston Scenarios** (5 files) - ✅ Commands/Events Accurate:

- `charleston-first-across.md` (154 lines → target 60)
- `charleston-second-charleston.md` (~180 lines → target 70)
- `charleston-blind-pass.md` (existing, needs trim)
- `charleston-standard.md` (existing, needs trim)
- `charleston-voting.md` (existing, needs trim)
- `charleston-courtesy-pass.md` (existing, needs trim)
- `charleston-iou.md` (existing, needs trim)

**Calling & Melds** (4 files) - ✅ Commands/Events Accurate:

- `calling-priority-mahjong.md` (~200 lines → target 80)
- `calling-pung-kong-quint-sextet.md` (~190 lines → target 75)
- `call-window-intent-buffering.md` (~170 lines → target 65)
- `meld-upgrade.md` ⭐ (already concise at ~100 lines - GOOD EXAMPLE)

**Mahjong & Dead Hand** (3 files) - ✅ Commands/Events Accurate:

- `mahjong-self-draw.md` (~160 lines → target 65)
- `mahjong-called.md` (~150 lines → target 60)
- `mahjong-invalid.md` (~180 lines → target 70)
- `dead-hand-tile-count.md` (~170 lines → target 65)

**Joker Exchange** (2 files) - ✅ Commands/Events Accurate:

- `joker-exchange-single.md` (~140 lines → target 55)
- `joker-exchange-multiple.md` (~160 lines → target 65)

**Game Management** (4 files) - ✅ Commands/Events Accurate:

- `leave-game.md` (~150 lines → target 60)
- `forfeit-game.md` (~160 lines → target 65)
- `disconnect-reconnect.md` (~200 lines → target 80)
- `timer-expiry.md` (~180 lines → target 70)

**History/Undo** (4 files) - ✅ Commands/Events Accurate:

- `view-move-history.md` (~170 lines → target 65)
- `history-jump.md` (existing, needs trim)
- `history-resume.md` (existing, needs trim)
- `undo-solo.md` (existing, needs trim)
- `undo-voting.md` (existing, needs trim)

**Setup & Gameplay** (3 files) - ✅ Commands/Events Accurate:

- `roll-dice-break-wall.md` (166 lines → target 65)
- `drawing-discarding.md` (~140 lines → target 55)
- `wall-closure-rule.md` (~150 lines → target 60)
- `wall-game.md` (see Partial Rewrite section above)

---

## Statistics Summary

### Hallucinations Detected

**Non-Existent Commands** (8):

1. `CreateRoom`
2. `StartGame`
3. `UpdateHouseRules`
4. `UpdateSettings`
5. `RequestAbandonVote`
6. `CastAbandonVote`
7. `ConfigureTimers`
8. `ConfigureAnimations`

**Non-Existent Events** (12):

1. `RoomCreated`
2. `PlayerJoined`
3. `HouseRulesUpdated`
4. `HouseRulesError`
5. `SettingsUpdated`
6. `HintProvided` (should be `HintUpdate`)
7. `HintError` (verify actual error event)
8. `AbandonVoteStarted`
9. `AbandonVoteCast`
10. `AbandonVoteSucceeded`
11. `AbandonVoteFailed`
12. `RoomCreationFailed`

**Hallucinated Features**:

- Entire house rules configuration system (categories, subcategories, 20+ options)
- Abandon game voting system
- Settings management infrastructure
- "Tournament" and "Standard" game modes

### Length Analysis

| Metric | Current | Target | Reduction |
|--------|---------|--------|-----------|
| Average file length | 217 lines | 75 lines | 65% |
| Longest file | 324 lines | 100 lines | 69% |
| Total lines (33 files) | ~7,160 lines | ~2,475 lines | 65% |

---

## Recommended Action Plan

### Phase 1: Quick Wins (Delete/Archive) - 10 minutes

```bash
# Delete hallucinated features
rm docs/implementation/frontend/tests/test-scenarios/abandon-game-consensus.md
rm docs/implementation/frontend/tests/test-scenarios/animation-settings.md
rm docs/implementation/frontend/tests/test-scenarios/configure-house-rules.md

# Archive files needing architectural rewrite
mkdir -p docs/implementation/frontend/tests/test-scenarios/needs-server-rewrite
mv docs/implementation/frontend/tests/test-scenarios/create-room.md needs-server-rewrite/
mv docs/implementation/frontend/tests/test-scenarios/join-room.md needs-server-rewrite/

# Add README explaining why these were archived
cat > needs-server-rewrite/README.md << 'EOF'
# Archived Test Scenarios

These test scenarios were moved here because they test **server-layer operations** (room creation, joining) rather than **game-layer commands**.

They need to be rewritten as:
- Server integration tests using WebSocket Envelope messages
- OR frontend integration tests for lobby/room UI (not game logic)

Do NOT use these as templates for game command/event testing.
EOF
```

**Update coverage matrix**:

- Mark US-029 (Create Room) and US-030 (Join Room) as "Server Layer - Separate Tests"
- Mark US-033 (Abandon Game Consensus), US-034 (Configure House Rules), US-035 (Animation Settings) as "Not Implemented"

---

### Phase 2: Fix Event Names (3 files) - 30 minutes

**File: `request-hints-ai-analysis.md`**

- Find/Replace: `HintProvided` → `HintUpdate`
- Find/Replace: `HintError` → (verify actual error event name in backend)
- Verify `HintData` structure matches backend
- Trim UI detail (target 100 lines from current 236)

**File: `adjust-hint-verbosity.md`**

- Keep `SetHintVerbosity` command testing
- Remove all "settings panel" and "UpdateSettings" references
- Focus on: Send command → Receive confirmation → Next hint uses new verbosity
- Trim to ~60 lines

**File: `wall-game.md`**

- Check backend: Is `WallExhausted` a standalone event or part of `GameOver`?
- Update assertions to match actual event structure
- Trim UI detail (target 70 lines)

---

### Phase 3: Create Template & Trim All (22 files) - 2-3 hours

**Step 3a: Create Template** (10 minutes)

Use `meld-upgrade.md` as reference (it's already concise). Create template:

```markdown
# Test Scenario: [Feature Name]

**User Story**: US-XXX - [Story Name]
**Fixtures**: `[fixture-name].json`
**Commands**: `GameCommand::[CommandName]`
**Events**: `Event::[EventName]`

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/[fixture].json`
- **Player**: [Seat]
- **Phase**: [GamePhase]
- **Context**: [Any special setup context]

## Test Flow (Act & Assert)

### Happy Path

1. **Given**: [Initial state description]
2. **When**: User [action description]
3. **Send**: `GameCommand::[CommandName] { player: [Seat], ... }`
4. **Receive**: `Event::[EventName] { ... }`
5. **Assert**:
   - ✅ [Expected state change 1]
   - ✅ [Expected state change 2]
   - ✅ [Expected data verification]

### Edge Cases

#### [Error Case Name]
- **Given**: [Error condition]
- **When**: [Action]
- **Expected**: [Error behavior]
- **Assert**: [Error verification]

## Success Criteria

- ✅ [Behavioral outcome 1]
- ✅ [Behavioral outcome 2]
- ✅ [Data verification]
- ✅ Command/event sequence validated
```

**Step 3b: Trim Files Systematically** (~5-8 minutes per file)

For each of the 22 files:

1. **Remove** (usually first 30-50% of file):
   - "Step 1: Verify UI state" sections
   - UI widget descriptions
   - Animation/transition descriptions
   - "Cross-References" section
   - "Backend References" section
   - "Accessibility Notes" section
   - "Manual Test" references

2. **Condense** (middle 30% of file):
   - Combine similar steps
   - Focus on command→event pairs
   - Keep data, remove presentation

3. **Keep** (final ~20-30% of file):
   - Core command/event flow
   - Critical assertions
   - Important error cases
   - Success criteria

4. **Target**: 50-100 lines total

**Estimated time**: 22 files × 6 minutes = 2.2 hours

---

### Phase 4: Verify Against Backend (30 minutes)

After trimming, spot-check 5 random files:

```bash
# Check that commands exist in backend
rg "GameCommand::" docs/implementation/frontend/tests/test-scenarios/*.md | \
  cut -d: -f3 | sort -u | \
  while read cmd; do
    if ! rg -q "$cmd" crates/mahjong_core/src/command.rs; then
      echo "❌ Command not found: $cmd"
    fi
  done
```

---

## Testing Philosophy (For Future Test Writing)

### ✅ DO: Test Behaviors

```markdown
## Test: Hint verbosity affects recommendation detail

1. Set verbosity to Beginner
2. Request hint → Receive simple recommendation
3. Set verbosity to Expert
4. Request hint → Receive detailed analysis with probabilities
5. Assert: Expert hints include advanced metrics not in Beginner
```

### ❌ DON'T: Test UI Implementation

```markdown
## Test: Hint panel appearance

1. Click "Get Hint" button
2. Hint panel slides in from bottom with 200ms ease-out animation
3. Panel shows gradient background (#F0F0F0 to #FFFFFF)
4. "Recommended Discard" label uses 16px Roboto Medium font
5. Confidence bar fills to 85% width with #4CAF50 color
```

### ✅ DO: Focus on Data

```markdown
Assert:
- Event.analysis.recommended_discard == Tile::Crak(3)
- Event.analysis.confidence >= 0.8
- Event.analysis.alternatives.len() == 2
```

### ❌ DON'T: Prescribe Presentation

```markdown
Assert:
- Recommended tile shows with green highlight
- Confidence percentage displays as "85%"
- Alternative tiles appear in dropdown below
```

---

## Completion Checklist

- [ ] Phase 1: Delete 3 files, archive 2 files (10 min)
- [ ] Phase 1: Update coverage-matrix.md (5 min)
- [ ] Phase 2: Fix `request-hints-ai-analysis.md` event names (10 min)
- [ ] Phase 2: Fix `adjust-hint-verbosity.md` (10 min)
- [ ] Phase 2: Fix `wall-game.md` event structure (10 min)
- [ ] Phase 3a: Create template from `meld-upgrade.md` (10 min)
- [ ] Phase 3b: Trim 22 files (~2.5 hours)
- [ ] Phase 4: Verify commands against backend (30 min)
- [ ] Final: Update this audit report with completion status

**Total Estimated Time**: ~4 hours

---

## Notes for Future Test Scenario Writing

1. **Always check backend first**: Read `crates/mahjong_core/src/command.rs` before writing tests
2. **Use meld-upgrade.md as template**: It's concise and accurate
3. **Test behaviors, not UI**: Focus on command→event→state changes
4. **Keep it short**: 50-100 lines is the sweet spot
5. **One scenario per user story**: Don't combine multiple features
6. **Use actual fixtures**: Reference real JSON files in `apps/client/src/test-utils/fixtures/`
7. **Verify events exist**: Check backend event modules before assuming event names

---

## Appendix: Backend Command Reference

**Actual Commands** (from `crates/mahjong_core/src/command.rs`):

### Setup Phase

- `RollDice { player }`
- `ReadyToStart { player }`

### Charleston Phase

- `PassTiles { player, tiles, blind_pass_count }`
- `VoteCharleston { player, vote }`
- `ProposeCourtesyPass { player, tile_count }`
- `AcceptCourtesyPass { player, tiles }`

### Main Game Phase

- `DrawTile { player }`
- `DiscardTile { player, tile }`
- `DeclareCallIntent { player, intent }`
- `Pass { player }`
- `DeclareMahjong { player, hand, winning_tile }`
- `ExchangeJoker { player, target_seat, meld_index, replacement }`
- `ExchangeBlank { player, discard_index }`
- `AddToExposure { player, meld_index, tile }`

### Game Management

- `RequestState { player }`
- `GetAnalysis { player }`
- `RequestHint { player, verbosity }`
- `SetHintVerbosity { player, verbosity }`
- `LeaveGame { player }`
- `AbandonGame { player, reason }`
- `RequestHistory { player }`
- `JumpToMove { player, move_number }`
- `ResumeFromHistory { player, move_number }`
- `ReturnToPresent { player }`

### Smart Undo

- `SmartUndo { player }`
- `VoteUndo { player, approve }`

### Multiplayer Controls

- `PauseGame { by }`
- `ResumeGame { by }`
- `ForfeitGame { player, reason }`

**Commands that DON'T exist**:

- ❌ `CreateRoom`
- ❌ `JoinRoom`
- ❌ `StartGame`
- ❌ `UpdateHouseRules`
- ❌ `UpdateSettings`
- ❌ `RequestAbandonVote`
- ❌ `CastAbandonVote`

---

**End of Audit Report**
