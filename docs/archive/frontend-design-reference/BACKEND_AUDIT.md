# Backend Feature Audit for UX Requirements

This document audits the backend implementation against UX features documented in the UX suite. Each feature is categorized as:

- ✅ **Implemented**: Feature has backend support

- ⚠️ **Partial**: Some backend support exists, needs enhancement

- ❌ **Missing**: No backend support, needs implementation

- 🎨 **Frontend-Only**: No backend changes needed

---

## 1. Charleston Features

### 1.1 Charleston Tutorial Overlay 🎨

**UX Reference**: [user-journeys.md](user-journeys.md#phase-3-first-charleston-experience-2min---5min) - Journey 1, Step 9

**Status**: 🎨 **Frontend-Only**

**Rationale**: Tutorial overlay is pure UI; backend already supports Charleston commands.

**Backend Requirements**: None

---

### 1.2 Charleston Timer with Warnings ⚠️

**UX Reference**: [edge-cases.md](edge-cases.md#31-player-timeout-doesnt-select-tiles-) - Section 3.1

**Status**: ⚠️ **Partial**

**Current Backend**:

- ✅ Timer exists in `CharlestonState` ([state-machine-design.md](../architecture/04-state-machine-design.md#42-charleston-stage))

- ✅ Event `CharlestonTimerStarted` with `duration`, `started_at_ms`, `timer_mode` ([command-event-system-api-contract.md](../architecture/06-command-event-system-api-contract.md))

- ✅ Auto-select random tiles on timeout (per CLAUDE.md)

**Missing Backend**:

- ❌ **10-second warning event** (not in GameEvent enum)

- ❌ **Which tiles were auto-selected notification** (frontend can't show "9D, E, S were randomly selected")

**Recommended Backend Changes**:

```rust
// Add to GameEvent enum
CharlestonTimerWarning {
    stage: CharlestonStage,
    seconds_remaining: u32,
}

CharlestonAutoSelected {
    player: Seat,
    tiles: Vec<Tile>, // Show which tiles were auto-picked
}

```text

text

---

### 1.3 Blind Pass/Steal Validation ✅

**UX Reference**: [edge-cases.md](edge-cases.md#33-player-selects-only-2-tiles-wants-to-pass-fewer-) - Section 3.3

**Status**: ✅ **Implemented**

**Backend Support**:

- ✅ `CharlestonStage::allows_blind_pass()` returns true for FirstLeft and SecondRight

- ✅ Command validation allows 1-3 tiles on blind pass stages

- ✅ Frontend can dynamically enable/disable "Confirm Pass" button

**\*No Changes Needed**

---

### 1.4 Charleston Vote Timeout ⚠️

**UX Reference**: [edge-cases.md](edge-cases.md#34-charleston-vote-deadlock-) - Section 3.4

**Status**: ⚠️ **Partial**

**Current Backend**:

- ✅ Vote system exists (`CharlestonVote::Continue` or `Stop`)

- ✅ Vote result resolution (any Stop = Stop)

**Missing Backend**:

- ❌ **30-second vote timer** (no timeout mechanism for voting stage)

- ❌ **Default vote to "Stop" for disconnected/idle players**

**Recommended Backend Changes**:

```rust
// Add to CharlestonState
pub vote_timer: Option<Duration>,
pub vote_started_at: Option<Instant>,

// Auto-vote logic in Table
fn check_vote_timeout(&mut self) {
    if vote_timer_expired() {
        for player in unvoted_players {
            self.votes.insert(player, CharlestonVote::Stop);
        }
        emit(VoteResult { result: Stop });
    }
}

```text

text

---

### 1.5 Courtesy Pass Negotiation Preview ❌

**UX Reference**: [edge-cases.md](edge-cases.md#35-courtesy-pass-negotiation-mismatch-) - Section 3.5

**Status**: ❌ **Missing**

**Current Backend**:

- ✅ `CharlestonStage::CourtesyAcross` exists

- ❌ No negotiation state tracking (can't show "South wants 0, you want 3")

**Missing Backend**:

```rust
// Add to CharlestonState
pub courtesy_proposals: HashMap<Seat, u8>, // 0-3 tiles

// New event
GameEvent::CourtesyProposalReceived {
    from_player: Seat,
    tile_count: u8,
}

```text

text

**Reasoning**: UX spec shows real-time preview of opponent's proposal before confirmation. Backend must track proposals separately from actual exchange.

---

## 2. Main Game Features

### 2.1 Turn Timer with 10s Warning ⚠️

**UX Reference**: [edge-cases.md](edge-cases.md#44-player-runs-out-of-time-on-turn-) - Section 4.4

**Status**: ⚠️ **Partial**

**Current Backend**:

- ✅ Turn timer exists (60s default per ruleset)

- ✅ Auto-discard on timeout (CLAUDE.md mentions BasicBot integrated)

**Missing Backend**:

- ❌ **10-second warning event** (no `TurnTimerWarning` event)

- ❌ **Which tile was auto-discarded notification**

**Recommended Backend Changes**:

```rust
// Add to GameEvent enum
TurnTimerWarning {
    player: Seat,
    seconds_remaining: u32,
}

TurnAutoDiscarded {
    player: Seat,
    tile: Tile,
    reason: String, // "Selected by AI as least useful"
}

```text

text

---

### 2.2 Call Window Timer ✅

**UX Reference**: [interaction-states.md](interaction-states.md#31-call-window-modal) - Section 3.1

**Status**: ✅ **Implemented**

**Backend Support**:

- ✅ `CallWindowOpened` event includes `timer`, `started_at_ms`, `timer_mode`

- ✅ 10-second default timer

- ✅ Auto-pass on expiration

**\*No Changes Needed**

---

### 2.3 Multiple Callers Conflict Resolution ✅

**UX Reference**: [edge-cases.md](edge-cases.md#42-multiple-players-call-same-discard-) - Section 4.2

**Status**: ✅ **Implemented**

**Backend Support**:

- ✅ Conflict resolution logic: Mahjong > other calls, turn order priority

- ✅ `CallRejected` event sent to losers with `CommandError::NotYourTurn` or similar

**Enhancement Needed**:

- ⚠️ **Rejection reason clarity**: Current error is `NotYourTurn`, but UX spec wants "South called first (turn order priority)"

**Recommended Backend Change**:

```rust
// Enhance CommandError
CallRejectedTurnOrder {
    winner: Seat,
    reason: String, // "South called first (turn order priority)"
}

```text

text

---

### 2.4 Pattern Viability Tracking ❌

**UX Reference**: [user-journeys.md](user-journeys.md#phase-3-competitive-play-3min---15min) - Journey 2, Step 11

**Status**: ❌ **Missing**

**Current Backend**:

- ✅ Hand validation against all patterns exists

- ✅ "Distance to win" calculation via `Hand::calculate_deficiency()`

- ❌ No dead tile tracking (all 4 copies discarded/exposed)

**Missing Backend**:

```rust
// New server-side analysis
pub struct DeadTileAnalysis {
    pub dead_tiles: HashSet<Tile>, // All 4 out
    pub impossible_patterns: Vec<String>, // Patterns requiring dead tiles
}

// New event
GameEvent::PatternViabilityUpdate {
    player: Seat,
    dead_tiles: HashSet<Tile>,
    impossible_patterns: Vec<String>,
}

```text

text

**Implementation Scope**:

- Track discard pile + all exposed melds

- Check which tiles have 4 copies visible

- Filter patterns requiring those tiles

- Send update after each discard

---

### 2.5 AI Hint System ❌

**UX Reference**: [user-journeys.md](user-journeys.md#phase-4-main-game---first-discard-5min---7min) - Journey 1, Step 19

**Status**: ❌ **Missing**

**Current Backend**:

- ✅ AI evaluation exists (MCTS, greedy AI)

- ❌ No "hint request" command

- ❌ No hint event

**Missing Backend**:

```rust
// New command
Command::RequestHint {
    player: Seat,
}

// New event
GameEvent::HintProvided {
    player: Seat,
    suggested_discard: Tile,
    closest_pattern: String,
    distance: u8,
    reasoning: String, // "Keep: 2B, 4B, 6D. Need: 2, 2, 4..."
}

```text

text

**Implementation Scope**:

- Run AI analysis on player's hand

- Find closest pattern

- Suggest best discard

- Only available in practice/beginner mode (not competitive)

---

### 2.6 False Mahjong Client-Side Validation ⚠️

**UX Reference**: [edge-cases.md](edge-cases.md#43-player-declares-false-mahjong-) - Section 4.3

**Status**: ⚠️ **Partial**

**Current Backend**:

- ✅ Server validates winning hand

- ✅ `InvalidMahjong` event with reason

- ⚠️ Frontend can't pre-validate (no validator exposed via API)

**Enhancement Needed**:

- ❌ **Expose validation API to client** (currently server-only)

- ❌ **"Closest pattern" analysis on rejection**

**Recommended Backend Changes**:

```rust
// New command (validation request, doesn't declare)
Command::ValidateHand {
    player: Seat,
}

// New event
GameEvent::HandValidationResult {
    player: Seat,
    is_valid: bool,
    closest_pattern: Option<String>,
    distance: Option<u8>,
}

```text

text

**Rationale**: UX spec wants client-side pre-validation to prevent embarrassment. Client needs validation logic or server API.

---

## 3. Network & Reconnection Features

### 3.1 Reconnection with Grace Period ✅

**UX Reference**: [edge-cases.md](edge-cases.md#52-complete-disconnection-websocket-close-) - Section 5.2

**Status**: ✅ **Implemented**

**Backend Support**:

- ✅ Session management with timeout

- ✅ Heartbeat mechanism

- ✅ Bot takeover for disconnected players

- ✅ Replay system for "what you missed" summary

**\*No Changes Needed**

---

### 3.2 Reconnection "What You Missed" Summary ⚠️

**UX Reference**: [user-journeys.md](user-journeys.md#phase-2-connection-drop-5min) - Journey 3, Step 5-6

**Status**: ⚠️ **Partial**

**Current Backend**:

- ✅ Replay system stores all events

- ❌ No "summary" event (client must reconstruct from replay)

**Enhancement Needed**:

```rust
// New event on reconnection
GameEvent::ReconnectionSummary {
    player: Seat,
    missed_events: Vec<GameEvent>, // Last N events
    current_state: GameStateSnapshot,
}

```text

text

**Rationale**: UX spec shows condensed summary modal. Backend should provide filtered event list.

---

### 3.3 Slow Connection Warning ❌

**UX Reference**: [edge-cases.md](edge-cases.md#51-intermittent-connection-packet-loss-) - Section 5.1

**Status**: ❌ **Missing**

**Current Backend**:

- ✅ Heartbeat mechanism exists

- ❌ No RTT measurement

- ❌ No degraded connection event

**Missing Backend**:

```rust
// New event
GameEvent::ConnectionDegraded {
    player: Seat,
    rtt_ms: u64,
    packet_loss_pct: f32,
}

```text

text

**Implementation Scope**:

- Measure ping/pong round-trip time

- Detect 30% packet loss threshold

- Send warning to affected client

---

## 4. Accessibility Features

### 4.1 Extended Timers for Screen Readers ❌

**UX Reference**: [edge-cases.md](edge-cases.md#81-screen-reader--timer-conflict-) - Section 8.1

**Status**: ❌ **Missing**

**Current Backend**:

- ✅ Configurable timers (60s turn, 10s call window)

- ❌ No per-player timer adjustments

- ❌ No accessibility mode detection

**Missing Backend**:

```rust
// Add to Player struct
pub accessibility_mode: bool,

// Modify timer logic
fn get_timer_duration(&self, base: u32) -> u32 {
    if self.accessibility_mode {
        base * 2 // 2x for screen readers
    } else {
        base
    }
}

```text

text

**Implementation Scope**:

- Client declares accessibility needs during auth

- Server adjusts all timers for that player

- Announce adjustment in event

---

### 4.2 Condensed Audio Mode 🎨

**UX Reference**: [user-journeys.md](user-journeys.md#phase-2-understanding-hand-state-2min---5min) - Journey 4, Step 4

**Status**: 🎨 **Frontend-Only**

**Rationale**: "Bamboo: 1, 2, 3" vs "1 Bamboo, 2 Bamboo, 3 Bamboo" is TTS formatting, no backend changes.

---

## 5. Mobile-Specific Features

### 5.1 Haptic Feedback 🎨

**UX Reference**: [mobile-constraints.md](mobile-constraints.md#103-haptic-feedback-optional-enhancement) - Section 10.3

**Status**: 🎨 **Frontend-Only**

**Rationale**: Vibration API is client-side.

---

### 5.2 Low Battery Mode Detection 🎨

**UX Reference**: [edge-cases.md](edge-cases.md#72-low-battery-mode-performance-throttling-) - Section 7.2

**Status**: 🎨 **Frontend-Only**

**Rationale**: Battery API and animation disabling are client-side.

---

## 6. Analytics & Metrics

### 6.1 Dropout Tracking ❌

**UX Reference**: [user-journeys.md](user-journeys.md#journey-metrics-summary) - Summary Table

**Status**: ❌ **Missing**

**Backend Requirements**:

```rust
// New events for analytics
GameEvent::PlayerDroppedOut {
    player: Seat,
    stage: String, // "Charleston_FirstRight", "Playing_Turn12", "ViewedCard"
    session_duration_ms: u64,
}

GameEvent::SessionCompleted {
    player: Seat,
    total_duration_ms: u64,
    game_completed: bool,
}

```text

text

**Implementation Scope**:

- Track when players leave game

- Record which phase they were in

- Send telemetry event

---

### 6.2 Performance Metrics ❌

**UX Reference**: [interaction-states.md](interaction-states.md#performance-benchmarks) - Section 11

**Status**: ❌ **Missing**

**Backend Requirements**:

```rust
// Server-side performance logging
struct PerformanceMetrics {
    pub validation_time_ms: u64,
    pub event_processing_ms: u64,
    pub ai_decision_time_ms: u64,
}

```text

text

**Rationale**: UX spec defines performance budgets (< 100ms tile selection, < 300ms Card viewer load). Backend should log actual timings for monitoring.

---

## 7. Replay System

### 7.1 Instant Replay with Timeline ⚠️

**UX Reference**: [user-journeys.md](user-journeys.md#phase-4-end-game-analysis-15min---17min) - Journey 2, Step 14

**Status**: ⚠️ **Partial**

**Current Backend**:

- ✅ Replay system stores all events

- ✅ Player-filtered views

- ⚠️ No "jump to turn N" API

**Enhancement Needed**:

```rust
// New command
Command::RequestReplaySlice {
    player: Seat,
    from_turn: u32,
    to_turn: u32,
}

// Response event
GameEvent::ReplaySlice {
    player: Seat,
    events: Vec<GameEvent>,
}

```text

text

---

## 8. Game Over Analysis

### 8.1 "How Close Were You" Analysis ❌

**UX Reference**: [user-journeys.md](user-journeys.md#phase-6-end-game-15min---20min) - Journey 1, Step 28

**Status**: ❌ **Missing**

**Current Backend**:

- ✅ `GameOver` event includes winner

- ❌ No loser hand analysis

**Missing Backend**:

```rust
// Enhance GameOver event
GameEvent::GameOver {
    result: GameResult,
    loser_analysis: HashMap<Seat, HandAnalysis>,
}

pub struct HandAnalysis {
    pub closest_pattern: String,
    pub distance: u8,
    pub needed_tiles: Vec<Tile>,
}

```text

text

**Implementation Scope**:

- Run validator on all final hands

- Find closest pattern for each loser

- Include in GameOver event

---

## Summary Table: Backend Feature Coverage

| Category      | Total Features | ✅ Implemented | ⚠️ Partial  | ❌ Missing  | 🎨 Frontend-Only |
| ------------- | -------------- | -------------- | ----------- | ----------- | ---------------- |
| Charleston    | 5              | 1              | 3           | 1           | 1                |
| Main Game     | 6              | 1              | 2           | 3           | 0                |
| Network       | 3              | 1              | 1           | 1           | 0                |
| Accessibility | 2              | 0              | 0           | 1           | 1                |
| Mobile        | 2              | 0              | 0           | 0           | 2                |
| Analytics     | 2              | 0              | 0           | 2           | 0                |
| Replay        | 1              | 0              | 1           | 0           | 0                |
| Game Over     | 1              | 0              | 0           | 1           | 0                |
| **TOTAL**     | **22**         | **3 (14%)**    | **7 (32%)** | **9 (41%)** | **4 (18%)**      |

---

## Priority Recommendations

### P0 - Critical for MVP (Block UI Development)

1. ⚠️ **Charleston Timer Warnings** - Frontend can't implement 10s warning without backend event

1. ⚠️ **Turn Timer Warnings** - Same issue

1. ⚠️ **Multiple Caller Rejection Clarity** - UX spec requires specific rejection reasons

1. ❌ **AI Hint System** - P0 UX feature (60% dropout prevention)

### P1 - High Impact (Delay Frontend Polish)

1. ⚠️ **Reconnection Summary** - Can work around with client-side event filtering, but clunky

1. ❌ **Pattern Viability Tracker** - Most requested by experienced players

1. ⚠️ **Charleston Vote Timeout** - Game can hang without this

1. ❌ **Courtesy Pass Negotiation** - UX shows real-time preview

### P2 - Post-MVP (Nice to Have)

1. ❌ **Slow Connection Warning**

1. ❌ **Extended Timers for Accessibility**

1. ❌ **"How Close Were You" Analysis**

1. ❌ **Dropout Tracking**

1. ⚠️ **Replay Timeline API**

---

## Next Steps

1. **Review this audit** with team to validate priorities

1. **Create GitHub issues** for each P0/P1 item

1. **Estimate effort** for backend changes (see below)

1. **Parallel development strategy**:
   - Frontend can start on features marked ✅ or 🎨

   - Backend team tackles P0 items first

   - Coordinate on P1 items (may need API design discussion)

---

## Effort Estimates (Rough)

| Feature                            | Estimated Backend Work | Complexity                           |
| ---------------------------------- | ---------------------- | ------------------------------------ |
| Timer warnings (Charleston + Turn) | 2-4 hours              | Low - add events + timer checks      |
| AI Hint System                     | 1-2 days               | Medium - expose AI API, design hints |
| Pattern Viability                  | 1 day                  | Medium - dead tile tracking logic    |
| Reconnection Summary               | 4-8 hours              | Low - filter existing replay data    |
| Vote Timeout                       | 4 hours                | Low - timer + auto-vote logic        |
| Courtesy Negotiation               | 1 day                  | Medium - state tracking              |
| Multi-Caller Rejection             | 2 hours                | Low - error message enhancement      |
| "How Close" Analysis               | 4-8 hours              | Medium - run validator on losers     |

**Total P0 Estimate**: 3-5 days
**Total P1 Estimate**: 4-6 days
**Total P0+P1**: 1-2 weeks backend work

---

**Last Updated**: 2026-01-10
**Document Purpose**: Map UX specs to backend requirements for coordinated frontend/backend development
