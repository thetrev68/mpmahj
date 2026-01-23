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
- [ ] (missing) Heavenly hand (East wins immediately; Charleston waived; double pay). (`nmjl_mahjongg-rules.md` Charleston)
- [ ] (out-of-scope) Determining East by dice or by draw. (lobby/seat assignment)

## Charleston

- [x] (enforced) First Charleston pass order Right -> Across -> Left. (`crates/mahjong_core/src/flow/charleston/stage.rs`)
- [x] (enforced) Vote to continue; unanimous continue required for Second Charleston. (`crates/mahjong_core/src/flow/charleston/state.rs`)
- [x] (enforced) Courtesy pass negotiation with 0-3 tiles and min count wins. (`crates/mahjong_core/src/table/handlers/charleston.rs`)
- [x] (enforced) Jokers cannot be passed. (`crates/mahjong_core/src/table/validation.rs`)
- [ ] (missing) Blind pass/steal on FirstLeft/SecondRight (including 1-2 tile blind pass). (`crates/mahjong_core/src/table/handlers/charleston.rs` ignores `blind_pass_count`)
- [ ] (missing) IOU rule when all players blind pass. (`nmjl_mahjongg-rules.md` Charleston)
- [ ] (partial) Courtesy pass is optional; server always enters the stage, but 0-tile pass can emulate a skip.

## Main play (draw, discard, call)

- [x] (enforced) Turn order and call window behavior. (`crates/mahjong_core/src/flow/playing.rs`)
- [x] (enforced) Call priority (Mahjong over meld, then right/across/left). (`crates/mahjong_core/src/call_resolution.rs`)
- [x] (enforced) Cannot call own discard. (`crates/mahjong_core/src/table/validation.rs`)
- [ ] (missing) Discarded Joker is dead tile and cannot be called. (`nmjl_mahjongg-rules.md` Joker rules)
- [x] (enforced) Mahjong call resolution stores discard and transitions to AwaitingMahjong stage. (`crates/mahjong_core/src/table/handlers/playing.rs`)
- [x] (enforced) DeclareMahjong verifies winning tile and rebuilds hand from server state (Phase 1 complete). (`crates/mahjong_core/src/table/handlers/win.rs`)
- [ ] (missing) Meld call does not verify caller owns required tiles or that called tile is included. (`crates/mahjong_core/src/table/handlers/playing.rs`)
- [ ] (missing) Add-to-exposure (convert Pung -> Kong/Quint from hand) is not supported. (`nmjl_mahjongg-rules.md` Play)
- [ ] (missing) Sextet calls are not supported. (`crates/mahjong_core/src/meld.rs`)

## Jokers

- [x] (enforced) Jokers cannot be used for singles/pairs/flowers (via ineligible histograms). (`crates/mahjong_core/src/rules/card.rs`)
- [ ] (missing) Allow melds with zero natural tiles (all jokers) for Pung/Kong/Quint/Sextet per NMJL; `Meld::new` currently errors when all tiles are jokers. (`crates/mahjong_core/src/meld.rs`)
- [x] (enforced) Joker exchange requires matching tile and a joker in the target meld. (`crates/mahjong_core/src/table/validation.rs`)
- [ ] (missing) Joker exchange timing rules (must be on your turn after draw/call). (`nmjl_mahjongg-rules.md` Joker rules)
- [ ] (missing) Finesse rule (last move is a joker exchange counts as self-draw). (`nmjl_mahjongg-rules.md` Joker rules)
- [ ] (missing) Jokerless scoring bonus and singles/pairs exception. (`nmjl_mahjongg-rules.md` Standard Scoring)

## Validation and penalties

- [x] (enforced) Hand must contain 14 tiles to win. (`crates/mahjong_core/src/rules/validator.rs`)
- [ ] (missing) Wrong tile count -> dead hand, stop picking/disposing, pay full value. (`nmjl_mahjongg-rules.md` Rules and Penalties)
- [ ] (missing) Mahjong in error -> dead hand rules and recovery paths. (`nmjl_mahjongg-rules.md` Mahjong in Error)
- [ ] (missing) Picking from wrong wall/end and related penalties. (`nmjl_mahjongg-rules.md` Rules and Penalties)
- [ ] (out-of-scope) In-person enforcement details (dogging, verbal calls, touching tiles).

## Scoring and dealer rotation

- [ ] (missing) Use per-pattern card value for base score (not fixed 25). (`nmjl_mahjongg-rules.md` Standard Scoring)
- [ ] (missing) Called discard payments: discarder pays double, others pay single. (`nmjl_mahjongg-rules.md` Standard Scoring)
- [ ] (partial) Self-draw payments are doubled (implemented), but other multipliers diverge. (`crates/mahjong_core/src/scoring.rs`)
- [ ] (missing) Jokerless bonus and singles/pairs exception. (`nmjl_mahjongg-rules.md` Standard Scoring)
- [ ] (missing) Dealer rotation: rules imply East rotates every game; current code keeps dealer when East wins. (`crates/mahjong_core/src/scoring.rs`)
- [ ] (partial) Concealed and dealer bonuses are applied, but not described in NMJL rules (confirm desired ruleset). (`crates/mahjong_core/src/scoring.rs`)

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

### Phase 2: Meld validation + exposure updates (HIGH PRIORITY)

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

### Phase 3: Joker rules (MEDIUM PRIORITY)

#### 3.1: Discarded joker is a dead tile (no calls)

**Files**: `crates/mahjong_core/src/table/handlers/playing.rs`, `crates/mahjong_core/src/flow/playing.rs`

**Implementation**:

1. In `discard_tile`, if the tile is a joker, skip call window creation and advance directly to the next player's `Drawing` stage.
2. Add a guard in call validation to reject calls if a joker discard somehow reaches a call window.

**Acceptance criteria**:

- Discarding a joker never opens a call window.

#### 3.2: Joker exchange timing enforcement

**Files**: `crates/mahjong_core/src/table/validation.rs`, `crates/mahjong_core/src/table/handlers/win.rs`

**Implementation**:

1. Only allow `ExchangeJoker` during `GamePhase::Playing(TurnStage::Discarding { player })`.
2. Reject exchanges during `Drawing` or `CallWindow`, or on another player's turn.

**Acceptance criteria**:

- Exchange is only legal after a draw/call and before discard.

#### 3.3: Finesse rule (joker exchange -> Mahjong counts as self-draw)

**Files**: `crates/mahjong_core/src/table/handlers/win.rs`, `crates/mahjong_core/src/table/mod.rs`

**Implementation**:

1. Track `last_action` (e.g., `LastAction::JokerExchange { player }`) on the table.
2. In `declare_mahjong`, if last action is a joker exchange by the same player and the win is not from a discard, treat as `WinType::SelfDraw`.

**Acceptance criteria**:

- Exchange + immediate Mahjong applies self-draw scoring.

### Phase 4: Penalties and dead hands (MEDIUM PRIORITY)

**Files**: `crates/mahjong_core/src/table/validation.rs`, `crates/mahjong_core/src/table/handlers/win.rs`, `crates/mahjong_core/src/player.rs`

**Implementation**:

1. Detect wrong tile counts and mark `PlayerStatus::Dead`; skip them in turn progression.
2. On Mahjong in error, mark hand dead and continue play; keep the called tile with the dead hand.
3. Ensure dead hands cannot draw/discard/call.

### Phase 5: Charleston (MEDIUM PRIORITY)

#### 5.1: Blind pass/steal (FirstLeft and SecondRight)

**File**: `crates/mahjong_core/src/table/handlers/charleston.rs`

**Implementation**:

1. Use existing `PassTiles { tiles, blind_pass_count }`.
2. For blind passes, forward `blind_pass_count` tiles from the incoming pass (not from the passer's own hand), without revealing them to the passer.
3. Ensure total outgoing tiles = 3 (visible tiles + blind forwarded tiles).

#### 5.2: IOU resolution (Charleston-only)

**File**: `crates/mahjong_core/src/table/handlers/charleston.rs`

**Implementation**:

1. If all players blind pass all 3 tiles, apply the NMJL IOU flow during the Charleston pass itself.
2. Track owed counts during the pass and resolve them before moving to the next stage.
3. No in-play IOU claiming; IOU is resolved inside Charleston.

#### 5.3: Heavenly hand detection

**File**: `crates/mahjong_core/src/table/handlers/setup.rs`

**Implementation**:

1. After the deal and before Charleston, validate East's 14 tiles.
2. If winning, skip Charleston and trigger a Heavenly Hand win with double payment.

### Phase 6: Scoring alignment (LOW PRIORITY)

**Files**: `crates/mahjong_core/src/scoring.rs`, `crates/mahjong_core/src/table/handlers/win.rs`

**Implementation**:

1. Use the pattern score already in `AnalysisResult.score` as the base value.
2. Implement NMJL payments: called discard (discarder 2x, others 1x); self-draw (all 3 losers pay 2x).
3. Apply jokerless bonus (2x) for eligible patterns; no bonus for Singles/Pairs.
4. Rotate dealer every game (clockwise), regardless of winner.
5. If house-rule multipliers are retained, make them explicit toggles in `HouseRules`.

### Phase 7: Tests and docs (ONGOING)

**Tests**:

- Add win-flow tests in `crates/mahjong_core/src/table/tests.rs`.
- Add Charleston tests in `crates/mahjong_core/src/flow/charleston/tests.rs`.
- Add meld/joker tests near `crates/mahjong_core/src/meld.rs` and `crates/mahjong_core/src/table/tests.rs`.

**Docs**:

- Update this checklist as items become enforced.
- Update ADR 0025 to reflect NMJL joker/sextet alignment if needed.

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
