# NMJL Rules Audit Checklist (Backend)

This checklist compares `nmjl_mahjongg-rules.md` to current server enforcement in
`crates/mahjong_core`. It focuses on rules that are enforceable in the backend
(not in-person etiquette).

Legend:

- (enforced) already validated by the server
- (partial) some behavior exists, but key parts are missing
- (missing) no server enforcement yet
- (out-of-scope) in-person only or UI-only

## Setup and deal

- [x] (enforced) East starts with 14 tiles, others with 13. (`crates/mahjong_core/src/deck.rs`)
- [x] (enforced) East acts first after Charleston (starts in Discarding). (`crates/mahjong_core/src/flow/mod.rs`)
- [x] (enforced) Heavenly hand (East wins immediately; Charleston waived; double pay). (`crates/mahjong_core/src/table/handlers/setup.rs` validates East's hand before Charleston)
- [ ] (out-of-scope) Determining East by dice or by draw. (lobby/seat assignment)

## Charleston

- [x] (enforced) First Charleston pass order Right -> Across -> Left. (`crates/mahjong_core/src/flow/charleston/stage.rs`)
- [x] (enforced) Vote to continue; unanimous continue required for Second Charleston. (`crates/mahjong_core/src/flow/charleston/state.rs`)
- [x] (enforced) Courtesy pass negotiation with 0-3 tiles and min count wins. (`crates/mahjong_core/src/table/handlers/charleston.rs`)
- [x] (enforced) Jokers cannot be passed. (`crates/mahjong_core/src/table/validation.rs`)
- [x] (enforced) Blind pass/steal on FirstLeft/SecondRight (including 1-3 tile blind pass). (`crates/mahjong_core/src/table/handlers/charleston.rs` handles `blind_pass_count` and `incoming_tiles`)
- [x] (enforced) IOU rule when all players blind pass. (`crates/mahjong_core/src/table/handlers/charleston.rs` detects all-blind-pass and ceases Charleston per NMJL)
- [x] (enforced) Courtesy pass is optional; server always enters the stage, and 0-tile pass is supported.

## Main play (draw, discard, call)

- [x] (enforced) Turn order and call window behavior. (`crates/mahjong_core/src/flow/playing.rs`)
- [x] (enforced) Call priority (Mahjong over meld, then right/across/left). (`crates/mahjong_core/src/call_resolution.rs`)
- [x] (enforced) Cannot call own discard. (`crates/mahjong_core/src/table/validation.rs`)
- [x] (enforced) Discarded Joker is dead tile and cannot be called. (`nmjl_mahjongg-rules.md` Joker rules)
- [x] (enforced) Mahjong call resolution stores discard and transitions to AwaitingMahjong stage. (`crates/mahjong_core/src/table/handlers/playing.rs`)
- [x] (enforced) DeclareMahjong verifies winning tile and rebuilds hand from server state (Phase 1 complete). (`crates/mahjong_core/src/table/handlers/win.rs`)
- [x] (enforced) Meld call validates called tile and required hand tiles. (`crates/mahjong_core/src/table/validation.rs`)
- [x] (enforced) Add-to-exposure (convert Pung -> Kong/Quint/Sextet) is supported. (`crates/mahjong_core/src/command.rs`, `crates/mahjong_core/src/table/handlers/win.rs`)
- [x] (enforced) Sextet calls are supported. (`crates/mahjong_core/src/meld.rs`, `crates/mahjong_core/src/call_resolution.rs`)

## Jokers

- [x] (enforced) Jokers cannot be used for singles/pairs/flowers (via ineligible histograms). (`crates/mahjong_core/src/rules/card.rs`)
- [x] (enforced) Allow melds with zero natural tiles (all jokers) for Pung/Kong/Quint/Sextet per NMJL. (`crates/mahjong_core/src/meld.rs`)
- [x] (enforced) Joker exchange requires matching tile and a joker in the target meld. (`crates/mahjong_core/src/table/validation.rs`)
- [x] (enforced) Discarded Joker is dead tile and cannot be called. (`crates/mahjong_core/src/table/handlers/playing.rs`)
- [x] (enforced) Joker exchange timing rules (must be on your turn after draw/call). (`crates/mahjong_core/src/table/validation.rs`)
- [x] (enforced) Finesse rule (last move is a joker exchange counts as self-draw). (`crates/mahjong_core/src/table/handlers/win.rs`, `crates/mahjong_core/src/table/mod.rs`)
- [x] (enforced) Jokerless scoring bonus and singles/pairs exception. (`nmjl_mahjongg-rules.md` Standard Scoring)

## Validation and penalties

- [x] (enforced) Hand must contain 14 tiles to win. (`crates/mahjong_core/src/rules/validator.rs`)
- [x] (enforced) Wrong tile count → dead hand, stop picking/disposing, pay full value. (`crates/mahjong_core/src/table/handlers/win.rs`, `crates/mahjong_core/src/table/handlers/playing.rs`)
- [x] (enforced) Mahjong in error → dead hand rules and recovery paths. (`crates/mahjong_core/src/table/handlers/win.rs`)
- [x] (out-of-scope) Picking from wrong wall/end and related penalties. (Server controls wall/draw order automatically)
- [ ] (out-of-scope) In-person enforcement details (dogging, verbal calls, touching tiles).

## Scoring and dealer rotation

- [x] (enforced) Use per-pattern card value for base score (not fixed 25). (`crates/mahjong_core/src/scoring.rs`)
- [x] (enforced) Called discard payments: discarder pays double, others pay single. (`crates/mahjong_core/src/scoring.rs`)
- [x] (enforced) Self-draw payments: all losers pay double. (`crates/mahjong_core/src/scoring.rs`)
- [x] (enforced) Jokerless bonus (2x multiplier) and singles/pairs exception. (`crates/mahjong_core/src/scoring.rs`)
- [x] (enforced) Dealer rotation: always rotates clockwise every game per NMJL. (`crates/mahjong_core/src/scoring.rs`)
- [x] (enforced) Concealed and dealer bonuses are optional house rules (disabled by default). (`crates/mahjong_core/src/table/types.rs`, `crates/mahjong_core/src/scoring.rs`)

## Implementation plan

This plan is ordered by priority and dependency. Each phase lists concrete file touchpoints aligned with the current codebase.

**Scope reference**: [ADR 0025](../../adr/0025-nmjl-rules-scope-and-enforcement.md). Note: NMJL is the source of truth for joker and sextet rules; update ADR 0025 if it conflicts.

### Phase 1: Win/call flow + server verification (✅ COMPLETE)

**Status**: Fully implemented and tested.

**Summary**: Server now tracks called tiles server-side, validates hands by rebuilding from server state (ignoring client), and transitions through `AwaitingMahjong` stage before finalizing wins.

**Files modified**:

- `crates/mahjong_core/src/flow/playing.rs` - Added AwaitingMahjong stage
- `crates/mahjong_core/src/table/handlers/win.rs` - Server-side validation rewrites client hand
- `crates/mahjong_core/src/table/handlers/playing.rs` - Call window resolution stores discard in AwaitingMahjong
- `crates/mahjong_core/src/event/public_events.rs` - Added AwaitingMahjongValidation event
- `crates/mahjong_core/src/event/helpers.rs` - Updated event helpers
- `crates/mahjong_core/src/bot_utils.rs` - Added pattern matching cases
- `crates/mahjong_terminal/src/bot.rs` - Added event handling
- `crates/mahjong_terminal/src/ui.rs` - Added stage formatting

**Test coverage**:

- 8 comprehensive integration tests in `crates/mahjong_core/tests/phase1_win_call_flow.rs`
- All existing 173+ tests still pass
- All pattern matching exhaustive

**Details**:

#### 1.1: Server-side verification for `DeclareMahjong` ✅

**Implementation**: `crates/mahjong_core/src/table/handlers/win.rs`

- Client-supplied hand is completely ignored
- Server rebuilds hand from player state, adds stored discard if in AwaitingMahjong
- Validates tile count == 14
- Validates pattern match via HandValidator
- Returns CommandRejected on invalid (no phase change)
- Full Rustdoc documentation included

#### 1.2: Add an `AwaitingMahjong` stage after call resolution ✅

**Implementation**: `crates/mahjong_core/src/flow/playing.rs`

- Extended TurnStage with `AwaitingMahjong { caller, tile, discarded_by }`
- `active_player()` returns caller's seat
- `can_player_act()` enforces caller-only access
- Updated `resolve_call_window` to transition to AwaitingMahjong instead of GameOver
- Stores discard immutably to prevent spoofing
- Full Rustdoc documentation included

#### 1.3: Finalize the win only on valid `DeclareMahjong` ✅

**Implementation**: `crates/mahjong_core/src/table/handlers/playing.rs` + `src/table/handlers/win.rs`

- Call window resolution removes discard from pile and stores in AwaitingMahjong
- Emits AwaitingMahjongValidation event to client
- Game continues (not GameOver) until DeclareMahjong validation completes
- Invalid mahjong keeps tile with caller, game continues
- Valid mahjong transitions to Scoring/GameOver with correct WinContext

### Phase 2: Meld validation + exposure updates (✅ COMPLETE)

**Status**: Fully implemented and validated.

**Goal**: Meld calls are legitimate and align to NMJL.

#### 2.1: Validate meld intent against the call window tile and hand counts

**Files**: `crates/mahjong_core/src/table/validation.rs`, `crates/mahjong_core/src/table/handlers/playing.rs`

**Implementation**:

1. In `validate_call_intent`, when `CallIntentKind::Meld(meld)`:
   - Require `meld.called_tile == Some(call_window.tile)`.
   - Require `meld.tiles` to include the called tile.
   - Count tiles required from the caller's hand (meld tiles minus the called tile) and verify counts exist in `player.hand`.
2. Reject invalid calls before they enter `pending_intents`.

**Acceptance criteria**:

- Caller must own the non-called tiles.
- Called tile must match the current discard.

#### 2.2: Add Sextet support

**Files**: `crates/mahjong_core/src/meld.rs`, `crates/mahjong_core/src/call_resolution.rs`

**Implementation**:

1. Add `Sextet` to `MeldType` and update `tile_count()` to 6.
2. Update validation and any match logic that assumes only 3/4/5 tiles.
3. Call priority remains Mahjong > meld, with all melds equal priority.

**Acceptance criteria**:

- Sextet melds validate and expose correctly.

#### 2.3: Allow all-joker melds per NMJL

**Files**: `crates/mahjong_core/src/meld.rs`, `crates/mahjong_core/src/table/validation.rs`

**Implementation**:

1. Update `Meld::new`/`validate` to allow melds with zero natural tiles.
2. If `called_tile` is present, use it as the base for joker assignments.
3. If no base tile exists, store empty assignments and disallow joker exchange for that meld.

**Acceptance criteria**:

- NMJL "no minimum natural tiles" rule is respected.

#### 2.4: Add-to-exposure (Pung -> Kong -> Quint -> Sextet)

**Files**: `crates/mahjong_core/src/command.rs`, `crates/mahjong_core/src/table/validation.rs`, `crates/mahjong_core/src/table/handlers/playing.rs`

**Implementation**:

1. Add `GameCommand::AddToExposure { player, meld_index, tile }`.
2. Require `GamePhase::Playing(TurnStage::Discarding { player })`.
3. Validate meld upgrade path and remove the tile from the player's hand.

**Acceptance criteria**:

- Player can upgrade exposed melds on their turn before discarding.

### Phase 3: Joker rules (✅ COMPLETE)

**Status**: Fully implemented and tested.

**Summary**: Server now enforces all NMJL joker rules including dead tile handling, exchange timing, and the Finesse rule. Discarded jokers skip call windows, exchanges are restricted to the Discarding stage, and joker exchange followed by Mahjong is treated as a self-draw win.

**Files modified**:

- `crates/mahjong_core/src/table/handlers/playing.rs` - Discarded jokers skip call window
- `crates/mahjong_core/src/table/validation.rs` - Joker exchange timing enforcement
- `crates/mahjong_core/src/table/handlers/win.rs` - Finesse rule implementation and exchange tracking
- `crates/mahjong_core/src/table/mod.rs` - Added LastAction enum and tracking field

**Test coverage**:

- 10 comprehensive tests in `crates/mahjong_core/tests/phase3_joker_rules.rs`
- All existing 115+ tests still pass
- All pattern matching exhaustive

**Details**:

#### 3.1: Discarded joker is a dead tile (no calls) ✅

**Implementation**: `crates/mahjong_core/src/table/handlers/playing.rs`

- When a joker is discarded, the turn advances directly to the next player's Drawing stage
- Call window is completely skipped for joker discards
- Full Rustdoc documentation included

#### 3.2: Joker exchange timing enforcement ✅

**Implementation**: `crates/mahjong_core/src/table/validation.rs`

- ExchangeJoker only allowed during `GamePhase::Playing(TurnStage::Discarding { player })`
- Rejects exchanges during Drawing, CallWindow, or when not the player's turn
- Returns appropriate error codes (WrongPhase, NotYourTurn)
- Full Rustdoc documentation included

#### 3.3: Finesse rule (joker exchange -> Mahjong counts as self-draw) ✅

**Implementation**: `crates/mahjong_core/src/table/mod.rs` + `src/table/handlers/win.rs`

- Added `LastAction` enum to track recent player actions
- Tracks Draw, Discard, and JokerExchange actions
- In `declare_mahjong`, checks if last action was JokerExchange by the same player
- If so, applies `WinType::SelfDraw` (Finesse rule)
- Actions are cleared on discard to prevent false positives
- Full Rustdoc documentation included

### Phase 4: Penalties and dead hands (✅ COMPLETE)

**Status**: Fully implemented and tested.

**Summary**: Server now enforces all NMJL penalty rules for dead hands. Wrong tile counts and mahjong in error result in PlayerStatus::Dead, preventing further gameplay actions. Dead players are automatically skipped in turn progression, and the game ends if all players become dead.

**Files**: `crates/mahjong_core/src/table/validation.rs`, `crates/mahjong_core/src/table/handlers/win.rs`, `crates/mahjong_core/src/player.rs`, `crates/mahjong_core/src/table/mod.rs`, `crates/mahjong_core/src/table/handlers/playing.rs`, `crates/mahjong_core/src/event/public_events.rs`, `crates/mahjong_core/src/flow/outcomes.rs`, `crates/mahjong_core/src/table/types.rs`

**Test coverage**:

- 11 comprehensive tests in `crates/mahjong_core/tests/phase4_dead_hand_rules.rs`
- All existing 173+ tests still pass
- All pattern matching exhaustive

**Details**:

#### 4.1: Detect wrong tile counts and mark PlayerStatus::Dead ✅

**Implementation**: `crates/mahjong_core/src/table/mod.rs`, `crates/mahjong_core/src/table/handlers/win.rs`

- Added `has_correct_tile_count()` helper to Table
- Added `mark_hand_dead()` helper to Table
- In `declare_mahjong`, check tile count and mark dead if != 14
- Emit `HandDeclaredDead` event with reason "Wrong tile count"
- Full Rustdoc documentation included

#### 4.2: Mahjong in error marks hand dead and game continues ✅

**Implementation**: `crates/mahjong_core/src/table/handlers/win.rs`

- In `declare_mahjong`, if validator rejects pattern, mark hand dead
- Emit `HandDeclaredDead` event with reason "Mahjong in error"
- If in AwaitingMahjong stage, transition back to Playing with next active player
- Called tile stays with dead player (not returned to pile)
- Full Rustdoc documentation included

#### 4.3: Dead hands cannot draw/discard/call ✅

**Implementation**: `crates/mahjong_core/src/table/validation.rs`, `crates/mahjong_core/src/player.rs`

- Added `CommandError::DeadHand` variant
- In `validate()`, check `player.can_act()` and reject with DeadHand if false
- `PlayerStatus::Dead` causes `can_act()` to return false
- Full Rustdoc documentation included

#### 4.4: Turn progression skips dead players ✅

**Implementation**: `crates/mahjong_core/src/table/mod.rs`, `crates/mahjong_core/src/table/handlers/playing.rs`

- Added `next_active_player()` helper to skip dead players in rotation
- In `draw_tile()`, check if current player is dead and skip to next active
- Emit `PlayerSkipped` event when skipping dead players
- If all players dead, emit `GameAbandoned` with `AllPlayersDead` reason
- Prevents infinite recursion with proper cycle detection
- Full Rustdoc documentation included

#### 4.5: Events and types ✅

**Implementation**: `crates/mahjong_core/src/event/public_events.rs`, `crates/mahjong_core/src/flow/outcomes.rs`

- Added `PublicEvent::HandDeclaredDead { player, reason }`
- Added `PublicEvent::PlayerSkipped { player, reason }`
- Added `AbandonReason::AllPlayersDead`
- All events exported to TypeScript via ts-rs
- Full Rustdoc documentation included

**Implementation**:

1. Detect wrong tile counts and mark `PlayerStatus::Dead`; skip them in turn progression.
2. On Mahjong in error, mark hand dead and continue play; keep the called tile with the dead hand.
3. Ensure dead hands cannot draw/discard/call.

### Phase 5: Charleston (✅ COMPLETE)

**Status**: Fully implemented and tested.

**Summary**: Server now enforces all NMJL Charleston rules including blind pass/steal, IOU detection, and heavenly hand detection. East's initial 14 tiles are validated before Charleston begins, and special tile forwarding logic handles blind pass scenarios.

**Files modified**:

- `crates/mahjong_core/src/flow/charleston/state.rs` - Added incoming_tiles and iou_debts tracking
- `crates/mahjong_core/src/table/handlers/charleston.rs` - Blind pass forwarding and IOU detection
- `crates/mahjong_core/src/table/handlers/setup.rs` - Heavenly hand detection before Charleston
- `crates/mahjong_core/src/event/public_events.rs` - Added HeavenlyHand, BlindPassPerformed, IOUDetected, IOUResolved events

**Test coverage**:

- 7 comprehensive tests in `crates/mahjong_core/tests/phase5_charleston_rules.rs`
- Tests cover heavenly hand, blind pass, and IOU scenarios
- All existing 173+ tests still pass

**Details**:

#### 5.1: Blind pass/steal (FirstLeft and SecondRight) ✅

**Implementation**: `crates/mahjong_core/src/table/handlers/charleston.rs`, `crates/mahjong_core/src/flow/charleston/state.rs`

- Added `incoming_tiles` HashMap to CharlestonState to track tiles from previous pass
- After FirstAcross and SecondAcross, tiles are stored as `incoming_tiles` instead of immediately added to hands
- During FirstLeft and SecondRight, players can specify `blind_pass_count` to forward incoming tiles without looking
- Blind tiles are extracted from `incoming_tiles` and combined with hand tiles for the pass
- Total tiles passed must equal 3 (hand tiles + blind tiles)
- Emits `BlindPassPerformed` event to track blind pass activity
- Full Rustdoc documentation included

#### 5.2: IOU resolution (Charleston-only) ✅

**Implementation**: `crates/mahjong_core/src/table/handlers/charleston.rs`, `crates/mahjong_core/src/flow/charleston/state.rs`

- Added `iou_debts` HashMap to track outstanding tile debts during blind pass stages
- IOU detection triggers when all players attempt to blind pass all 3 tiles (pass 0 from hand)
- When IOU scenario is detected:
  - `IOUDetected` event emitted with initial debt counts
  - Per NMJL: "In the unlikely event that no one has a tile to pass, then the Charleston ceases and play begins"
  - All incoming tiles are added to players' hands
  - `IOUResolved` event emitted
  - Charleston completes early
- Full Rustdoc documentation included

#### 5.3: Heavenly hand detection ✅

**Implementation**: `crates/mahjong_core/src/table/handlers/setup.rs`

- Before Charleston begins, East's 14-tile hand is validated against the card
- If East has a winning pattern, heavenly hand is triggered:
  - `HeavenlyHand` event emitted with pattern and base score
  - Charleston is waived (not started)
  - Double payment applied (heavenly hand multiplier = 2)
  - Game transitions directly to GameOver with East as winner
  - Dealer rotates to South for next game
- If no winning pattern, Charleston proceeds normally
- Full Rustdoc documentation included

### Phase 6: Scoring alignment (✅ COMPLETE)

**Status**: Fully implemented and tested.

**Summary**: Server now implements complete NMJL scoring rules with per-pattern scores, correct payment calculations for called discards and self-draw, jokerless bonus (with Singles/Pairs exception), and dealer always rotates clockwise every game. House-rule bonuses (concealed, dealer) are now optional toggles.

**Files modified**:

- `crates/mahjong_core/src/scoring.rs` - Implemented NMJL scoring rules, jokerless bonus, and dealer rotation
- `crates/mahjong_core/src/table/handlers/win.rs` - Pass pattern score and category to scoring functions
- `crates/mahjong_core/src/table/types.rs` - Added optional house-rule toggles for concealed/dealer bonuses

**Test coverage**:

- Updated 15 unit tests in `crates/mahjong_core/src/scoring.rs`
- Updated 7 integration tests in `crates/mahjong_core/tests/scoring_integration.rs`
- All 173+ tests still pass

**Details**:

#### 6.1: Use pattern score from AnalysisResult ✅

**Implementation**: `crates/mahjong_core/src/scoring.rs`, `crates/mahjong_core/src/table/handlers/win.rs`

- Removed fixed `BASE_SCORE` constant (was 25)
- Updated `calculate_score()` to accept `pattern_score: u16` parameter
- Extract score from `AnalysisResult.score` in win.rs (default to 25 if no validator)
- Full Rustdoc documentation included

#### 6.2: Implement NMJL payment rules ✅

**Implementation**: `crates/mahjong_core/src/scoring.rs`

- **Self-draw**: All 3 losers pay 2x base score
- **Called discard**: Discarder pays 2x base, other 2 players pay 1x base
- Updated `calculate_payments()` function with correct NMJL logic
- Full Rustdoc documentation included

#### 6.3: Apply jokerless bonus ✅

**Implementation**: `crates/mahjong_core/src/scoring.rs`

- Check if hand contains no jokers (concealed or exposed)
- Apply 2x multiplier to all payments if jokerless
- **Exception**: Singles and Pairs category does not get jokerless bonus
- Detection uses pattern name/category to identify Singles/Pairs
- Effective payments: Self-draw jokerless = 4x base; Called jokerless = 4x/2x
- Full Rustdoc documentation included

#### 6.4: Dealer rotation always rotates ✅

**Implementation**: `crates/mahjong_core/src/scoring.rs`

- Updated `calculate_next_dealer()` to always rotate clockwise
- Per NMJL rules, dealer rotates every game regardless of who wins
- Rotation: East → South → West → North → East
- Full Rustdoc documentation included

#### 6.5: Optional house-rule bonuses ✅

**Implementation**: `crates/mahjong_core/src/table/types.rs`, `crates/mahjong_core/src/scoring.rs`

- Added `concealed_bonus_enabled: bool` to HouseRules (default: false)
- Added `dealer_bonus_enabled: bool` to HouseRules (default: false)
- These bonuses are NOT part of NMJL standard rules
- Concealed bonus: +50% to base score (if enabled)
- Dealer bonus: +50% to all payments from losers (if enabled)
- Full Rustdoc documentation included

### Phase 7: Tests and docs (✅ COMPLETE)

**Status**: All implementation phases complete. This checklist is now archived.

**Note**: Rustdoc in `crates/mahjong_core/` is the canonical source of truth for implementation details. All dedicated phase tests are in place (`phase1_win_call_flow.rs`, `phase3_joker_rules.rs`, `phase4_dead_hand_rules.rs`, `phase5_charleston_rules.rs`, plus updated scoring tests).

---

## Dependency order summary

1. **Phase 1** blocks Phase 6 (scoring depends on correct win metadata).
2. **Phase 2** can run in parallel with Phase 1.
3. **Phase 3** depends on Phase 1 (turn/call flow).
4. **Phase 5** is mostly independent once Phase 1 is stable.
5. **Phase 4** ties into Phase 1 failure paths.

## Success metrics

- All (missing) items either enforced or explicitly documented as out-of-scope.
- No client-supplied tiles are trusted for win validation.
- Core win/call flow, jokers, Charleston, and scoring each have dedicated tests.

## Scope questions (RESOLVED)

All scope questions have been resolved in [ADR 0025](../../adr/0025-nmjl-rules-scope-and-enforcement.md), with NMJL overriding any joker/sextet conflicts:

- **Penalty rules**: All NMJL penalties enforced server-side (dead hand, wrong tile count, mahjong in error)
- **Scoring model**: Hybrid - default NMJL with configurable house rules
- **Sextet support**: YES - required for card years 2017-2025 and beyond
- **Joker melds**: NMJL allows zero natural tiles in Pung/Kong/Quint/Sextet; implement accordingly
- **Dealer rotation**: East = room creator initially, then rotates every game
- **Charleston features**: Blind pass/steal and IOU MUST be implemented
- **Heavenly hand**: MUST be supported (rare but valid NMJL rule)
