# Supplemental Implementation Checklist

This file contains the detailed phased implementation checklist extracted from `13-backend-gap-analysis.md` (Section 8). It's intended to be edited independently of the gap-analysis overview.

## Phase 0: Baseline Rules Parity (Must Be Complete Before Gap Features)

> **PHASE STATUS (2026-01-09): ✅ COMPLETE (7/7 done)**

**Priority:** CRITICAL - Already discussed, required before UI integration

- [x] **Call Priority + Adjudication**: Enforce Mahjong > Pung/Kong/Quint with seat-order tie-breaks ✅ **DONE** (see 6.2)
- [x] **Scoring + Settlement**: Calculate points, apply payouts, handle no-winner resolution, rotate dealer ✅ **DONE** (see 6.4)
- [x] **Ruleset Metadata**: Persist card year + house-rule flags in `Room` and replay logs ✅ **DONE** (see 6.1)
- [x] **Joker Restrictions**: Add pattern-specific limits and pair restrictions to validation ✅ **DONE** (completed 2026-01-09 - see 6.3)
- [x] **Courtesy Pass Negotiation**: Implement the full 0-3 negotiation flow ✅ **DONE** (verified in `handlers/charleston.rs`)
- [x] **Timer Behavior**: Use `HouseRules` for call window + Charleston timing; allow passive/enforced modes ✅ **DONE** (see 6.1, Section 3)
- [x] **Deterministic Replay Inputs**: Persist wall order/seed, break point, and replacement draws ✅ **DONE** (see 6.5)

## Phase 0 Implementation Plan (by crate)

### `crates/mahjong_core`

- **Call Priority + Adjudication**
  - Add a call-resolution policy to `TurnStage::CallWindow` (priority + seat-order tie-breaks).
  - Buffer multiple call intents and resolve deterministically instead of first-come-first-served.
- **Scoring + Settlement**
  - Extend `GameResult` with points/payouts and dealer-rotation metadata.
  - Add scoring logic in `apply_declare_mahjong` and a no-winner resolution path.
- **Ruleset Metadata**
  - Extend `HouseRules` to include card year, joker limits, optional rule flags.
  - Store the active ruleset in `Table` and include in `GameStateSnapshot`.
- **Joker Restrictions**
  - Add joker-limit metadata to `UnifiedCard` (pattern/variation level).
  - Update `HandValidator` to enforce joker limits and pair restrictions.
- **Courtesy Pass Negotiation**
  - Implement `GameCommand::ProposeCourtesyPass` and explicit accept/confirm flow.
- **Timer Behavior**
  - Use `HouseRules.call_window_seconds` and `HouseRules.charleston_timer_seconds` in `TurnStage`.
  - Add a ruleset flag for passive vs enforced timers.
- **Deterministic Replay Inputs**
  - Persist wall order/seed + break point in state snapshots.
  - Track replacement draws for Kongs/Quints in state.

### `crates/mahjong_server`

- **Ruleset Persistence**
  - Store ruleset metadata (card year + house rules) with game records and snapshots.
- **Replay Determinism**
  - Persist wall order/seed + break point + replacement draws in replay events or snapshots.
  - Update replay reconstruction to use wall state instead of seed=0.
- **Call Adjudication**
  - Ensure server accepts buffered call intents and waits for resolution event.

### `crates/mahjong_ai`

- **Ruleset Awareness**
  - Consume joker restrictions from core (avoid proposing invalid calls).
  - Respect passive/enforced timers in bot decision loops.

## Tests (core + server)

- Call priority resolution and tie-break cases.
- Joker restriction enforcement (per-pattern limits + no-joker pairs).
- Courtesy pass negotiation paths (0-3 tiles, mismatched proposals).
- Deterministic replay reconstruction (wall order + replacement draws).

## Phase 1: Core Refactoring (MVP Foundation)

**Priority:** HIGH - Required for all other features

- [ ] **Move `StrategicEvaluation`**: Move from `mahjong_ai` to `mahjong_core/src/analysis.rs` to prevent circular deps
  - Ensure no heavy AI logic comes with it (keep core pure)
  - Update imports in `mahjong_ai` and `mahjong_server`
- [ ] **Always-On Analysis Loop**: Modify `mahjong_server` to run analysis after state changes
  - Add `analysis: HashMap<Seat, Vec<StrategicEvaluation>>` to `Room`
  - Trigger analysis after: TilesDealt, DrawTile, DiscardTile events
  - Profile performance (target: <50ms avg)
- [ ] **Passive Timers**: Strip timer-based force-move logic from `mahjong_server`
  - Keep timer metadata for UI display only
  - Update state machine to wait indefinitely for player actions
  - Add AFK detection (bot takeover after 3 min inactivity)
- [ ] **Game Activity Log**: Add `game_log: Vec<GameEvent>` to `Room`
  - Append every broadcasted event
  - Expose via reconnect/refresh API
- [ ] **Ruleset Snapshot & Validation**: Persist ruleset config in `Room`
  - Validate all moves against per-game ruleset
  - Store ruleset metadata in replay log
- [ ] **Call Priority & Illegal-Move Handling**: Resolve simultaneous calls server-side
  - Mahjong > Pung/Kong/Quint, seat-order tie-breaks
  - Reject invalid claims/discards with explicit errors
- [ ] **Joker Rules & Replacement Draws**: Encode joker restrictions and swap logic
  - Pattern-specific joker limits, joker swaps from exposed melds
  - Replacement draws for Kongs/Quints as per ruleset
- [ ] **Scoring & Settlement**: Implement authoritative end-of-hand resolution
  - Pattern validation, scoring, payouts, dealer rotation
- [ ] **Deterministic State Capture**: Log wall order + RNG for undo/replay
  - Ensure undo and replay can reproduce exact state

**Estimated Effort:** 2-3 weeks

## Phase 2: Smart Undo & Pattern Viability (Practice Mode Enhancements)

**Priority:** MEDIUM-HIGH - Key UX improvements for solo play

- [ ] **History Stack**: Implement `history: Vec<(GamePhase, Table)>` in `Room`
  - Snapshot at: TurnStage::Drawing, CallWindow, CharlestonStage transitions
  - Bounded history (last 20 states)
  - Clear history on phase transitions
- [ ] **Undo Logic**: Implement "rewind to last decision point" algorithm
  - Add `GameCommand::Undo` and `GameEvent::StateRestored`
  - Practice Mode only (disable in multiplayer)
  - Handle edge cases (empty stack, AI log invalidation)
- [ ] **Pattern Viability Calculation**: Enhance `StrategicEvaluation` with tile tracking
  - Implement `is_pattern_viable()` (check if required tiles are exhausted)
  - Add difficulty classification (Easy/Medium/Hard/Impossible)
  - Include viability data in analysis updates to client
- [ ] **Frontend: Undo Button**: Add UI for undo in Practice Mode
  - Keyboard shortcut: Ctrl+Z / Cmd+Z
  - Visual feedback on state restoration
- [ ] **Frontend: Card Viewer Enhancements**: Visualize pattern viability
  - Gray out impossible patterns
  - Color-code by difficulty (green/yellow/orange)
  - Add filters and sorting options

**Estimated Effort:** 3-4 weeks

## Phase 3: Hint System & Analysis Optimization (Player Assistance)

**Priority:** MEDIUM - Improves accessibility and learning curve

- [ ] **Hint Data Structure**: Define `HintData` struct with recommended actions
  - Recommended discard
  - Best patterns to pursue
  - Tiles needed for win
  - Distance to win
- [ ] **Hint Generation**: Use Always-On Analyst to generate hints
  - Skill level tuning (Beginner/Intermediate/Expert modes)
  - Progressive disclosure based on settings
- [ ] **Bandwidth Optimization**: Implement delta compression for analysis updates
  - Client-side caching of last analysis
  - Send full analysis on turn start or >30% change
  - Send delta updates for 1-30% change
  - Concrete thresholds and throttling
- [ ] **Performance Optimization**: Optimize analysis frequency
  - Consider lazy evaluation (only on player's turn)
  - Incremental analysis (cache and update deltas)
  - Parallel processing (multi-threading for 4 hands)
- [ ] **Frontend: Hint Panel**: Add toggleable hint UI
  - "Recommended discard" indicator
  - "Best pattern" suggestions
  - Win proximity badge (color-coded by distance)

**Estimated Effort:** 2-3 weeks

## Phase 4: Logging & Replay (Advanced Features)

**Priority:** LOW-MEDIUM - Nice-to-have for debugging and post-game analysis

- [ ] **AI Comparison Log**: Implement multi-engine analysis logging
  - `AnalysisLogEntry` structure
  - Debug mode: Run multiple AI strategies per turn
  - Expose via debug endpoint (not broadcast to clients)
- [ ] **Replay Storage**: Store complete game replays
  - `GameReplay` struct with full event log
  - Database persistence (30-day retention)
  - Privacy controls (public/private replays)
- [ ] **Statistical Tracking**: Collect long-term player statistics
  - `PlayerStats` struct (win rate, pattern usage, etc.)
  - Real-time for basic stats, batch for complex analysis
- [ ] **Frontend: Replay Viewer**: Build post-game replay UI
  - Timeline scrubber, play/pause controls
  - Player perspective filtering
  - Analysis overlay (if available)
- [ ] **Frontend: Statistics Dashboard**: Display player stats
  - Win rate charts, pattern popularity graphs
  - Recent game history, personal bests

**Estimated Effort:** 4-5 weeks

## Phase 5: Advanced Assistance (Optional Enhancements)

**Priority:** LOW - Future considerations, not MVP

- [ ] **Defensive Play Analysis**: Show discard safety indicators
  - Risk assessment (Safe/Risky/Dangerous)
  - Confirmation for dangerous discards
- [ ] **Practice Mode Auto-Play**: AI takeover feature
  - "Show me what you would do" mode
  - Temporary AI control with resume button
- [ ] **Pattern Filters**: Let players focus on pattern subsets
  - Filter by section, concealment, score, joker usage
  - Reduce analysis overhead by checking fewer patterns

**Estimated Effort:** 2-3 weeks

---

## 9. Success Metrics & Testing Strategy

### Success Metrics

#### Feature 1: Smart Undo

- [ ] Undo successfully rewinds to player's last decision point (100% accuracy in tests)
- [ ] Undo only available in Practice Mode (multiplayer games reject undo commands)
- [ ] History stack stays within memory budget (<50KB per room)
- [ ] User feedback: "Undo made practice mode much more enjoyable" (qualitative)

#### Feature 2: Always-On Analyst

- [ ] Analysis completes in <50ms average (90th percentile <100ms)
- [ ] Bots use pre-calculated analysis (no redundant computation)
- [ ] Analysis updates sent efficiently (bandwidth <5KB per update)
- [ ] Pattern viability calculation 100% accurate (no false positives/negatives)

#### Feature 3: Passive Timers

- [ ] Timers never force-skip player actions in Practice Mode
- [ ] AFK detection triggers bot takeover after 3 minutes
- [ ] UI shows timer expiration without blocking actions
- [ ] User feedback: "Timers feel less stressful" (qualitative)

#### Feature 4: Pattern Viability

- [ ] "Dead" patterns correctly identified based on visible tiles
- [ ] Card Viewer updates in real-time as patterns become impossible
- [ ] Difficulty classification correlates with actual win probability
- [ ] User feedback: "Card tracking helped me avoid dead ends" (qualitative)

#### Feature 5: Replay & Logging

- [ ] Full game replay available within 1 second of game end
- [ ] Replays playable from any turn (forward/backward navigation works)
- [ ] Player perspective filtering preserves privacy (no concealed hand leaks)
- [ ] Statistics dashboard loads in <2 seconds

### Testing Strategy

**Unit Tests:**

- `is_pattern_viable()` function (test all edge cases: joker limits, suit exhaustion)
- Undo logic (test empty stack, invalid requests, state corruption)
- Hint generation (test all skill levels produce different hints)
- Delta compression (test bandwidth savings vs. full updates)

**Integration Tests:**

- Full game with Always-On Analyst enabled (verify analysis updates at every state change)
- Undo in Charleston phase vs. main game (different snapshot logic)
- Replay reconstruction from event log (verify deterministic playback)
- Multi-engine AI comparison (verify all strategies run correctly)
- Call priority resolution (simultaneous calls, seat-order tie-breaks)
- Joker swap/replacement draw flows
- Scoring/settlement correctness for common win types

**Performance Tests:**

- Analysis benchmark: 1000 hands × 500 patterns (target: <50ms avg)
- Memory stress test: 100 concurrent rooms with full history (target: <5MB per room)
- Bandwidth test: Measure delta vs. full updates over 100-turn game

**User Acceptance Tests:**

- Practice Mode playthrough with undo (qualitative: "Does undo feel natural?")
- Pattern viability visual feedback (qualitative: "Is the Card Viewer helpful?")
- Hint system usability (quantitative: "Do beginners win more often with hints?")

## 10. Open Questions Summary

Consolidating all questions from above for easy reference:

1. **Smart Undo:**
   - How many undo steps? (Recommendation: Single undo for MVP, bounded later)
   - Allow undo during Charleston? (Recommendation: Yes, common pain point)
   - Confirmation dialog for undo? (Question: Free undo vs. confirm destructive actions?)

2. **Always-On Analyst:**
   - Background worker thread for analysis? (Question: Avoid blocking game loop?)
   - Analysis updates automatic or on-request? (Question: Push vs. pull model?)
   - Hints toggle-able mid-game? (Question: Lock at game start vs. runtime toggle?)

3. **Passive Timers:**
   - Passive timers in multiplayer too? (Recommendation: Practice Mode only; multiplayer optional)
   - Audio countdown as timer expires? (Question: Beep/pulse vs. silent?)

4. **Pattern Viability:**
   - Difficulty calculation server-side or client-side? (Recommendation: Server-side for Hint reuse)

5. **Replay & Logging:**
   - Store replays in database or JSON files? (Recommendation: DB for active, JSON for archival)
   - Stats real-time or batch? (Recommendation: Real-time basic, batch complex)

6. **Core Rules & Determinism:**
   - Which ruleset strictness? (Strict NMJL vs. relaxed/house rules)
   - Deterministic replay requirement? (Do we need exact wall order/RNG capture?)
   - Call priority tie-breaks? (Seat order vs. other resolution rules)
   - Scoring model and settlement? (Points vs. chips; dealer rotation rules)

7. **Performance:**
   - Acceptable latency for analysis? (Proposed: <50ms avg, <100ms p90)
   - Delta compression thresholds? (Proposed: >30% = full, 1-30% = delta, <1% = skip)

**Next Steps:** Review these questions, make decisions, and update this document before implementation begins.

*** End File
