# Backend Implementation Plan: Gap Analysis & Refinements

This document outlines the backend changes required to support the "Mahjong 4 Friends" parity features, integrated deeply into the core system rather than as add-ons.

## Document Status

**Status:** DRAFT - In active iteration
**Last Updated:** 2026-01-05
**Purpose:** High-level feature planning before detailed implementation specs

## Open Questions

1. **Scope Boundaries**: Which features are MVP vs. Phase 2/3? (See checklist at bottom)
2. **Performance Budgets**: What are acceptable latency limits for analysis? (Proposed: <50ms avg)
3. **Multiplayer vs. Practice Mode**: Which features work in live multiplayer vs. solo practice only?
4. **Frontend Priority**: Should we spec out UI changes before backend implementation?

---

## 1. Feature: "Smart" Undo (Rewind to Decision)

**Goal:** Allow players (in Practice Mode) to correct mistakes. The undo must rewind not just the last server command, but the game state back to the **last moment the player had agency**.

### 1.1 Architecture

- **State Management:** The `Room` struct maintains a `history: Vec<(GamePhase, Table)>` stack.
- **Snapshot Triggers:** Snapshots are taken at the start of:
  - `TurnStage::Drawing` (start of a player's turn).
  - `TurnStage::CallWindow` (when a player can choose to call/pass).
  - `CharlestonStage` transitions.

### 1.2 Logic Flow

1. **Client Request:** Sends `GameCommand::Undo`.
2. **Server Logic:**
    - The server iterates backwards through the history stack.
    - It searches for the most recent state where `Table.current_turn == requesting_seat` OR `Table.phase` was a Call Window involving the player.
    - **Why:** This effectively "rewinds" any bot moves that happened instantly after the player's mistake, returning control to the player.
3. **State Restoration:** The server replaces the current table with this historical snapshot and broadcasts the update.

### 1.3 Implementation Details

**Undo Depth & Limitations:**

- **Question:** How many undo steps are allowed? Options:
  - Single undo (rewind to last decision point only)
  - Unlimited undo (rewind to any previous state in current game)
  - Bounded undo (e.g., last 10 decision points)
- **Recommendation:** Start with single undo for MVP, extend to bounded history later
- **Multiplayer:** Undo is **Practice Mode only** (cannot undo in live multiplayer games)
- **Charleston Undo:** Should players be able to undo Charleston passes?
  - **Question:** Allow undo during Charleston phase, or only during main game?
  - **Proposed:** Allow undo during Charleston (common pain point for new players)

**State Management:**

- **History Size:** `Vec<(GamePhase, Table)>` could grow large. Mitigation strategies:
  - Bounded history (keep last N states, where N = 20 for MVP)
  - Clear history on phase transitions (Charleston → Playing)
  - Consider compression for older states (future optimization)
- **Memory Budget:** Each snapshot ≈ 2KB, 20 snapshots = 40KB per room (acceptable)

**Error Handling:**

- What if undo stack is empty? → Return error "No previous state available"
- What if undoing would invalidate AI comparison log? → Clear AI log entries after undo point
- What if player disconnects mid-undo? → Undo is atomic (either completes or rolls back)

**Network Protocol:**

- **Command:** `GameCommand::Undo` (no parameters for MVP)
- **Response:** `GameEvent::StateRestored { previous_turn: u32, seat: Seat }`
- **Broadcast:** All players in room receive the restored state snapshot

### 1.4 Frontend Impact

**UI Components Needed:**

- "Undo" button in Practice Mode (disabled in multiplayer)
- Visual indicator when undo succeeds: "State restored to Turn 12"
- Confirmation dialog for undo? (Question: Yes for destructive actions, or just allow freely?)
- Keyboard shortcut: Ctrl+Z / Cmd+Z

**State Synchronization:**

- Client must handle `StateRestored` event and update entire game state
- Animation: Fade out → restore → fade in (or instant?)
- Toast notification: "Undid last move"

---

## 2. Feature: The "Always-On" Analyst

**Goal:** Integrate AI analysis as a core part of the game loop, not an on-demand utility. This powers Bots, Hints, and Pattern Viability tracking simultaneously.

### 2.1 Architecture

- **Core Integration:** The `HandValidator` or a new `GameAnalyst` struct is embedded in the `Table` (or `Room`).
- **Trigger:** Analysis runs automatically:
  - After `TilesDealt`.
  - After every `DiscardTile` (to analyze call opportunities).
  - After every `DrawTile`.

### 2.2 Data Structure

- Move `StrategicEvaluation` from `mahjong_ai` to `mahjong_core/src/analysis.rs`.
- Add `analysis: HashMap<Seat, Vec<StrategicEvaluation>>` to the `Room` (kept server-side).

### 2.3 Logic Flow

1. **Event:** A move occurs (e.g., Tile Discarded).
2. **Analysis:** Server calculates `evaluate_hand` for all 4 seats.
    - **For Bots:** The result determines their next move immediately.
    - **For Humans:** The result is cached.
3. **Distribution:**
    - When sending `GameStateSnapshot` or events to a client, the server includes a summary of *their* specific analysis (e.g., "Top 3 viable patterns", "List of impossible patterns").
    - **Optimization:** Only send this heavy data if it changed significantly or upon request/turn start.

### 2.4 Performance Considerations

**Analysis Frequency:**

- **Challenge:** Running full analysis after every state change (4 players × 500 patterns) could be expensive
- **Proposed Optimization Strategies:**
  1. **Lazy Evaluation:** Only analyze on a player's turn (not after every discard)
  2. **Incremental Analysis:** Cache previous results, only recalculate deltas
  3. **Parallel Processing:** Use multi-threading to analyze all 4 hands simultaneously
  4. **Smart Triggers:** Only re-analyze when hand composition changes (not on every event)

**Performance Budget:**

- **Target:** Analysis must complete in <50ms on average (90th percentile <100ms)
- **Profiling Required:** Measure actual performance with production data before optimization
- **Question:** Should we use a background worker thread for analysis to avoid blocking game loop?

**Bandwidth Optimization:**

- **Delta Compression:** Only send changed patterns, not full analysis every time
- **Client-Side Caching:** Client remembers last analysis, server sends diff
- **Concrete Thresholds:**
  - Send full analysis: On turn start, or when >30% of patterns change viability
  - Send delta update: When 1-30% of patterns change
  - Send nothing: When <1% change (cosmetic differences)
- **Question:** Should analysis updates be sent automatically, or only on client request?

### 2.5 Hint System Integration

**Goal:** Use Always-On Analyst to power intelligent hints for human players.

**Hint Types:**

1. **Discard Suggestions:**
   - "Discard 7D to keep maximum pattern options open"
   - Based on expected value calculation from StrategicEvaluation
2. **Pattern Recommendations:**
   - "Focus on '2468 Consecutive' - you're 2 tiles away"
   - Highlight top 3 most probable patterns
3. **Call Opportunities:**
   - "Calling this Pung closes off 4 other patterns - consider passing"
   - Defensive analysis: "This discard is safe (opponent unlikely to call)"
4. **Win Alerts:**
   - "You're 1 tile away from Mahjong! Waiting for: 3B, 6D"
   - Flash notification when hand becomes "hot"

**Skill Level Tuning:**

- **Beginner Mode:** Show explicit hints ("Discard this tile →")
- **Intermediate Mode:** Show pattern probabilities, let player decide
- **Expert Mode:** No hints, just pattern viability (dead/alive)
- **Question:** Should hints be toggle-able mid-game, or locked at game start?

**Data Structure:**

```rust
struct HintData {
    recommended_discard: Option<Tile>,
    best_patterns: Vec<(String, f64)>, // (pattern_name, probability)
    tiles_needed_for_win: Vec<Tile>,
    distance_to_win: u8, // Minimum tiles needed
}
```

### 2.6 Frontend Impact

**UI Components Needed:**

- **Card Viewer Integration:**
  - Gray out impossible patterns (viable == false)
  - Highlight "close" patterns (distance <= 3 tiles)
  - Sort patterns by probability/score
- **Hint Panel (Optional, toggleable):**
  - "Recommended discard: 7D"
  - "Best pattern: Consecutive 2468 (75% chance with 2 more tiles)"
- **Win Proximity Indicator:**
  - Badge showing "2 tiles away" or "1 tile away!"
  - Color-coded: Red (far), Yellow (close), Green (1 away)
- **Performance:**
  - Analysis updates should not cause UI lag
  - Consider throttling updates (max 1 update per second)

---

## 3. Feature: Passive Timers (No Auto-Play)

**Goal:** Respect the player's pace. Timers are for urgency/UI feedback, not server-side enforcement.

### 3.1 Architecture

- **Removal:** Remove `timer` expiration logic from `mahjong_server` loop.
- **Metadata:** Keep `timer` fields in `TurnStage::CallWindow` and `CharlestonState`, but strictly for Client UI display ("Time remaining: 10s").

### 3.2 Logic Updates

- **Call Window:**
  - The server enters `CallWindow`.
  - It waits indefinitely for `GameCommand::Pass` or `GameCommand::Call` from all eligible players.
  - It **never** auto-advances.
  - **Visuals:** The client can flash/beep when the metadata timer reaches 0, but the player is never skipped.
- **Charleston:**
  - Similarly, waits for all players to select tiles. No random auto-selection.

### 3.3 Edge Cases & Questions

**Multiplayer Considerations:**

- **Question:** In live multiplayer, do we still want passive timers? Or only in Practice Mode?
- **Proposed:** Passive timers for Practice Mode only; multiplayer can have optional enforcement
- **AFK Detection:**
  - If a player is inactive for >5 minutes, should the server:
    - Pause the game and notify other players?
    - Let an AI bot take over temporarily?
    - Kick the player and forfeit?
  - **Recommendation:** Bot takeover after 3 minutes of inactivity (existing feature)

**UI/UX Concerns:**

- **Timer Display:** Show timer even if it's passive ("suggested time remaining")
- **Visual Urgency:** Flash/pulse UI when timer expires, but don't block actions
- **Question:** Should timer speed up audio cues as it approaches zero? (Like a countdown beep)

**Settings Integration:**

- **Per-Game Setting:** "Enable timer enforcement" toggle
  - Default OFF for Practice Mode
  - Default ON for Ranked/Competitive Mode (future)
- **Timer Duration:** Customizable (30s, 60s, 90s, unlimited)

### 3.4 Frontend Impact

**UI Changes:**

- Remove "auto-play countdown" indicators
- Change timer color scheme: Green → Yellow → Red (but no blocking)
- Add setting: "Timer enforcement" checkbox in game settings
- Toast notification: "Timer expired (you can still move)"

---

## 4. Feature: Dead Hand / Pattern Viability

**Goal:** Visualize which patterns are statistically impossible based on the *global* board state (Standard Mahjong "Card Tracking").

### 4.1 Logic

- This is a derived view of the **Always-On Analyst**.
- The `StrategicEvaluation` struct already contains `viable: bool` (calculated by checking if required tiles are dead).
- **Frontend Integration:**
  - The Client receives the list of `StrategicEvaluation` for the user's hand.
  - The Client UI (Card Viewer) iterates through this list.
  - If `viable == false`, the pattern is grayed out or marked "Impossible".
  - If `viable == true` but `difficulty` is high, it might be marked "Hard".

### 4.2 Tile Tracking & Viability Calculation

**What Makes a Pattern "Dead":**

- **Required tiles exhausted:** If a pattern needs 4× of a specific tile, but all 4 are visible (discarded or in exposed melds), the pattern is impossible.
- **Joker limitations:** Some patterns have joker restrictions (e.g., "No jokers allowed" or "Max 1 joker").
- **Suit consistency:** For variable suit patterns (VSUIT1, VSUIT2), if all tiles of a required suit are dead, the pattern is impossible.

**Data Requirements:**

- Server must track:
  - All discarded tiles (already tracked in discard pile)
  - All exposed melds (already tracked per player)
  - Tiles remaining in wall (implicit: 152 - dealt - discarded)
- **Privacy:** Server only sends viability data for the requesting player's hand (doesn't reveal other players' concealed tiles)

**Algorithm:**

```rust
fn is_pattern_viable(hand: &Hand, pattern: &Pattern, visible_tiles: &TileSet) -> bool {
    let required_histogram = pattern.histogram;
    for (tile_idx, count_needed) in required_histogram.iter().enumerate() {
        let visible_count = visible_tiles.count(tile_idx);
        let in_hand = hand.histogram[tile_idx];
        let remaining = 4 - visible_count - in_hand; // Tiles still in wall/other hands

        if count_needed > (in_hand + remaining) {
            return false; // Not enough tiles available
        }
    }
    true
}
```

### 4.3 Pattern Difficulty Classification

**Beyond Viable/Impossible, classify patterns by difficulty:**

- **Easy (Green):** 0-1 tiles needed, high probability tiles available
- **Medium (Yellow):** 2-3 tiles needed, moderate probability
- **Hard (Orange):** 4+ tiles needed, or low probability tiles (many already discarded)
- **Impossible (Gray):** Mathematically impossible (required tiles exhausted)

**Question:** Should difficulty be calculated server-side or client-side?

- **Recommendation:** Server-side (part of StrategicEvaluation), so Hints can use it too

### 4.4 Frontend Impact

**Card Viewer Enhancements:**

- **Color Coding:**
  - Gray out impossible patterns with strikethrough
  - Color-code viable patterns by difficulty (green/yellow/orange)
- **Filtering:**
  - Toggle: "Show only viable patterns"
  - Toggle: "Hide impossible patterns"
- **Sorting:**
  - Sort by: Probability, Score, Difficulty, Name
  - Default: Sort by Probability (most likely first)
- **Tooltips:**
  - Hover over impossible pattern: "This pattern needs 4× 5D, but all are discarded"
  - Hover over viable pattern: "2 tiles needed: 3C, 6C"

**Performance:**

- Card Viewer should update in real-time as patterns become dead
- Debounce updates to avoid flickering (max 1 update per 500ms)

---

## 5. Feature: Enhanced Logging & Comparative Analysis

**Goal:** Maintain a persistent record of game events and a side-channel log of AI decision-making for debugging and strategy comparison.

### 5.1 Game Activity Log

- **Structure:** `game_log: Vec<GameEvent>` stored in `Room`.
- **Function:** Appends every broadcasted event.
- **Usage:**
  - Sent to client on reconnect/refresh (History View).
  - Used for "Replay" feature (Roadmap).

### 5.2 AI Comparison Log ("Director's Cut")

- **Structure:**

    ```rust
    struct AnalysisLogEntry {
        turn_number: u32,
        seat: Seat,
        hand_snapshot: Hand,
        recommendations: HashMap<String, Recommendation>, // Key = "Greedy", "MCTS", "Basic"
    }
    ```

- **Logic:**
  - If `debug_mode` is enabled, the Analysis step runs *multiple* AI strategies on the current hand.
  - It records what each engine *would* have recommended.
- **Access:** Exposed via a debug endpoint/websocket channel. Not sent to standard clients to save bandwidth.

### 5.3 Replay System Integration

**Goal:** Use Game Activity Log to enable post-game replay and analysis.

**Replay Features:**

- **Basic Replay:**
  - Play back the entire game from start to finish
  - Step forward/backward through moves
  - Jump to specific turns
- **Filtered Replay:**
  - View from a specific player's perspective
  - Show only that player's visible information (no cheating by seeing other hands)
- **"What-If" Analysis (Future):**
  - Branch from any point in history
  - Try different moves and see outcomes
  - Compare actual vs. hypothetical results

**Data Structure:**

```rust
struct GameReplay {
    game_id: String,
    players: Vec<String>, // Player names/IDs
    card_year: u16,
    events: Vec<GameEvent>, // Full event log
    analysis_log: Option<Vec<AnalysisLogEntry>>, // Only if debug mode
}
```

**Storage:**

- **Question:** Store replays in database or as JSON files?
  - **Recommendation:** Database for active games, export to JSON for archival
- **Retention:** Keep replays for 30 days, or indefinitely for "saved" games
- **Privacy:** Players can choose to make replays public/private

### 5.4 Statistical Tracking

**Goal:** Track long-term patterns for player improvement and game balancing.

**Metrics to Track:**

1. **Pattern Usage:**
   - Which patterns are won most often?
   - Which patterns are attempted but not completed?
   - Pattern win rate by skill level
2. **Discard Safety:**
   - Which tiles are called most often?
   - "Dangerous discard" statistics per tile type
3. **AI Performance:**
   - Win rate by AI difficulty
   - Average game length by AI level
   - Which AI strategies perform best?
4. **Player Statistics:**
   - Overall win rate
   - Favorite patterns
   - Average time per move
   - Charleston efficiency (tiles passed vs. tiles kept)

**Storage:**

```rust
struct PlayerStats {
    player_id: String,
    games_played: u32,
    games_won: u32,
    patterns_won: HashMap<String, u32>, // Pattern name → count
    average_turns_to_win: f64,
    favorite_patterns: Vec<String>,
}
```

**Question:** Should stats be calculated real-time or batch-processed overnight?

- **Recommendation:** Real-time for basic stats (win/loss), batch for complex analysis

### 5.5 Frontend Impact

**Replay Viewer:**

- **UI Components:**
  - Timeline scrubber (drag to any point in game)
  - Play/Pause/Step Forward/Step Backward buttons
  - Speed control (1x, 2x, 4x)
  - Player perspective selector
- **Visualization:**
  - Animate tile movements as they happened
  - Show analysis overlay (if available)
  - Highlight winning hand at end

**Statistics Dashboard:**

- **UI Components:**
  - Win rate chart (overall and by pattern)
  - Pattern popularity graph
  - Personal best scores
  - Recent game history list
- **Filters:**
  - Date range, AI difficulty, card year

---

## 6. Core Rules & Deterministic State (Backend-Critical)

These items are foundational for rules parity and data integrity; they are not optional UX polish.

### 6.1 Ruleset Configuration & Metadata

**Goal:** Make all rule-variant settings explicit and persisted with the game so analysis, replay, and scoring are consistent.

- **Ruleset Fields:** NMJL card year, house rules, optional Charleston variants, timer enforcement, blank tiles, joker policy.
- **Persistence:** Store ruleset snapshot in `Room` and replay log (per-game, immutable once started).
- **Validation:** Server validates every move against the ruleset, not client assumptions.

### 6.2 Call Priority & Illegal-Move Enforcement

**Goal:** Adjudicate call windows deterministically and reject invalid claims.

- **Priority:** Mahjong > Pung/Kong/Quint, with seat-order tie-breaks.
- **Call Window Rules:** Who can call what, and when (including simultaneous call resolution).
- **Illegal Actions:** Server rejects out-of-rule calls/discards and emits clear error events.

### 6.3 Joker Rules & Replacement Draws

**Goal:** Encode common American Mahjong joker rules server-side.

- **Joker Restrictions:** No jokers in singles/pairs (except joker pairs if allowed), pattern-specific limits.
- **Joker Swap:** Allow exchanging a joker from an exposed meld when you can replace it with the natural tile.
- **Replacement Draw:** When a player declares a Kong/Quint (as allowed), handle replacement draws per ruleset.

### 6.4 Scoring, Settlement, and Dealer Rotation

**Goal:** Provide authoritative end-of-hand resolution.

- **Hand Validation:** Determine the exact winning pattern and score (exposed vs. concealed, self-draw vs. call).
- **Payouts/Accounting:** Apply scoring to all players (points or chip-style settlement).
- **Round Flow:** Dealer rotation, wall exhaustion handling (no-winner), and rematch setup.

### 6.5 Deterministic State Capture (Undo + Replay)

**Goal:** Make undo and replay deterministic and debuggable.

- **State Snapshot Completeness:** Include wall order, RNG seed, replacement draws, and any random tie-breaks.
- **Replay Integrity:** Log enough to reconstruct the exact game (not just event list).

### 6.6 Multiplayer Stalling Controls

**Goal:** Avoid indefinite stalls when timers are passive.

- **Host Controls:** Pause/resume, forfeit, or bot-takeover actions.
- **Reconnect Policy:** Timeouts, grace periods, and rejoin rules.

### 6.7 Completion Split: "Should Already Be Done" vs. "Gap Features"

**Goal:** Separate baseline rules parity work (already discussed, should exist) from new parity gap features.

**Should Already Be Done (Baseline Rules Parity):**

- **Call Priority + Adjudication:** Resolve simultaneous calls; Mahjong > Pung/Kong/Quint; seat-order tie-breaks.
- **Scoring + Settlement:** Pattern scoring, win type modifiers, dealer rotation, no-winner resolution.
- **Ruleset Metadata:** Card year, joker restrictions, house-rule flags stored in `Room` and replay logs.
- **Joker Restrictions:** Pattern-specific joker limits; no jokers in pairs unless allowed.
- **Courtesy Pass Negotiation:** Full negotiation flow for 0-3 tiles.
- **Timer Behavior:** Use `HouseRules` for timer configuration; passive vs enforced options.
- **Deterministic Replay Inputs:** Persist wall order/seed, break point, and replacement draws.

**Gap Features (Parity Additions):**

- Smart Undo (Practice Mode)
- Always-On Analyst + Hint System
- Pattern Viability / Dead Hand visualization
- Enhanced Logging + Replay UX features
- Defensive Play Analysis, Practice Auto-Play, Pattern Filters

---

## 7. Additional Features to Consider

### 6.1 Defensive Play Analysis

**Goal:** Help players identify when their discards might be dangerous (could complete an opponent's hand).

**How It Works:**

- Always-On Analyst tracks not just the current player's hand, but also:
  - What patterns opponents *might* be pursuing (based on their discards and exposed melds)
  - Which tiles are "hot" (likely to be called by opponents)
- When a player is about to discard, show a risk indicator:
  - **Safe (Green):** Low probability of being called
  - **Risky (Yellow):** Moderate probability (opponent might need this)
  - **Dangerous (Red):** High probability (opponent is 1 tile away and this could win for them)

**Privacy Concerns:**

- This doesn't reveal opponents' concealed hands, only statistical likelihood based on public information
- Similar to experienced players' mental tracking

**Frontend Impact:**

- Tile highlight in hand: Color border based on discard safety
- Confirmation dialog: "This tile is dangerous - are you sure?"

### 6.2 Practice Mode Auto-Play

**Goal:** Let AI temporarily "take over" for a player during practice, then hand control back.

**Use Cases:**

- "Show me what you would do" - Watch AI play a few turns, then resume
- "I'm stuck, help me" - AI plays until hand improves, then player resumes
- "Fast-forward through Charleston" - AI handles passes, player takes over for main game

**Implementation:**

- New command: `GameCommand::EnableAIAssist { duration: Option<u32> }` // # of turns, or until player resumes
- Server switches player to "AI-controlled" mode temporarily
- UI shows "AI is playing..." overlay with "Resume Control" button

### 6.3 Pattern Recommendation Filters

**Goal:** Allow players to focus on specific types of patterns based on their strategy.

**Filter Options:**

- **By Section:** 2025, Consecutive, Quints, etc.
- **By Concealment:** Only concealed patterns, only exposed patterns, or both
- **By Score:** Only high-value patterns (50+ points)
- **By Joker Restrictions:** Only patterns that allow jokers, or no-joker patterns

**Frontend Impact:**

- Card Viewer: Add filter dropdown/checkboxes
- Analysis updates respect filters (only analyze filtered subset)
- Performance benefit: Fewer patterns to check = faster analysis

---

## 8. Revised Implementation Checklist

### Phase 0: Baseline Rules Parity (Must Be Complete Before Gap Features)

**Priority:** CRITICAL - Already discussed, required before UI integration

- [ ] **Call Priority + Adjudication**: Enforce Mahjong > Pung/Kong/Quint with seat-order tie-breaks
- [ ] **Scoring + Settlement**: Calculate points, apply payouts, handle no-winner resolution, rotate dealer
- [ ] **Ruleset Metadata**: Persist card year + house-rule flags in `Room` and replay logs
- [ ] **Joker Restrictions**: Add pattern-specific limits and pair restrictions to validation
- [ ] **Courtesy Pass Negotiation**: Implement the full 0-3 negotiation flow
- [ ] **Timer Behavior**: Use `HouseRules` for call window + Charleston timing; allow passive/enforced modes
- [ ] **Deterministic Replay Inputs**: Persist wall order/seed, break point, and replacement draws

**Phase 0 Implementation Plan (by crate):**

**`crates/mahjong_core`**

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

**`crates/mahjong_server`**

- **Ruleset Persistence**
  - Store ruleset metadata (card year + house rules) with game records and snapshots.
- **Replay Determinism**
  - Persist wall order/seed + break point + replacement draws in replay events or snapshots.
  - Update replay reconstruction to use wall state instead of seed=0.
- **Call Adjudication**
  - Ensure server accepts buffered call intents and waits for resolution event.

**`crates/mahjong_ai`**

- **Ruleset Awareness**
  - Consume joker restrictions from core (avoid proposing invalid calls).
  - Respect passive/enforced timers in bot decision loops.

**Tests (core + server)**

- Call priority resolution and tie-break cases.
- Joker restriction enforcement (per-pattern limits + no-joker pairs).
- Courtesy pass negotiation paths (0-3 tiles, mismatched proposals).
- Deterministic replay reconstruction (wall order + replacement draws).

### Phase 1: Core Refactoring (MVP Foundation)

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

### Phase 2: Smart Undo & Pattern Viability (Practice Mode Enhancements)

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

### Phase 3: Hint System & Analysis Optimization (Player Assistance)

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

### Phase 4: Logging & Replay (Advanced Features)

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

### Phase 5: Advanced Assistance (Optional Enhancements)

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

**Feature 1: Smart Undo**

- [ ] Undo successfully rewinds to player's last decision point (100% accuracy in tests)
- [ ] Undo only available in Practice Mode (multiplayer games reject undo commands)
- [ ] History stack stays within memory budget (<50KB per room)
- [ ] User feedback: "Undo made practice mode much more enjoyable" (qualitative)

**Feature 2: Always-On Analyst**

- [ ] Analysis completes in <50ms average (90th percentile <100ms)
- [ ] Bots use pre-calculated analysis (no redundant computation)
- [ ] Analysis updates sent efficiently (bandwidth <5KB per update)
- [ ] Pattern viability calculation 100% accurate (no false positives/negatives)

**Feature 3: Passive Timers**

- [ ] Timers never force-skip player actions in Practice Mode
- [ ] AFK detection triggers bot takeover after 3 minutes
- [ ] UI shows timer expiration without blocking actions
- [ ] User feedback: "Timers feel less stressful" (qualitative)

**Feature 4: Pattern Viability**

- [ ] "Dead" patterns correctly identified based on visible tiles
- [ ] Card Viewer updates in real-time as patterns become impossible
- [ ] Difficulty classification correlates with actual win probability
- [ ] User feedback: "Card tracking helped me avoid dead ends" (qualitative)

**Feature 5: Replay & Logging**

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

---

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
