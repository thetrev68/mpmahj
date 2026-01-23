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
- [ ] (missing) Mahjong call resolution does not consume the discard or advance phase. (`crates/mahjong_core/src/table/handlers/playing.rs`)
- [ ] (missing) DeclareMahjong does not verify the winning tile matches the current discard during a call window. (`crates/mahjong_core/src/table/handlers/win.rs`)
- [ ] (missing) Meld call does not verify caller owns required tiles or that called tile is included. (`crates/mahjong_core/src/table/handlers/playing.rs`)
- [ ] (missing) Add-to-exposure (convert Pung -> Kong/Quint from hand) is not supported. (`nmjl_mahjongg-rules.md` Play)
- [ ] (missing) Sextet calls are not supported. (`crates/mahjong_core/src/meld.rs`)

## Jokers

- [x] (enforced) Jokers cannot be used for singles/pairs/flowers (via ineligible histograms). (`crates/mahjong_core/src/rules/card.rs`)
- [ ] (missing) Exposed melds of all jokers are rejected. (`crates/mahjong_core/src/meld.rs` rejects all-joker melds)
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

This plan is ordered by priority and dependency. Each phase includes specific files to modify, acceptance criteria, and testing requirements.

**Scope Reference**: See [ADR 0025: NMJL Rules Scope and Server-Side Enforcement](../../adr/0025-nmjl-rules-scope-and-enforcement.md) for architectural decisions on which rules are in-scope, penalty enforcement, Sextet support, scoring models, dealer rotation, Charleston features, and Heavenly Hand handling.

### Phase 1: Critical Win/Call Flow Fixes (HIGH PRIORITY)

**Goal**: Fix fundamental issues where Mahjong can be called without validation.

#### 1.1: Server-side hand verification for DeclareMahjong

**File**: `crates/mahjong_core/src/table/handlers/win.rs`

**Current issue**: `DeclareMahjong` accepts client-supplied `Hand` without verification.

**Implementation**:

1. Modify `handle_declare_mahjong` to:
   - Remove `hand: Hand` parameter from the command
   - Reconstruct hand from `player_state.hand_tiles` and `player_state.exposed_melds`
   - Validate reconstructed hand matches 14 tiles total
2. Add helper function `reconstruct_player_hand(player: &PlayerState) -> Hand`
3. Add validation: `if hand.tile_count() != 14 { return Err(InvalidMahjong) }`

**Acceptance criteria**:

- DeclareMahjong command no longer accepts external Hand
- Server uses only server-tracked tiles
- Test: Client cannot send fake winning hand

#### 1.2: Tie Mahjong calls to current discard

**File**: `crates/mahjong_core/src/table/handlers/win.rs`

**Current issue**: DeclareMahjong doesn't verify winning tile matches current discard during call window.

**Implementation**:

1. In `handle_declare_mahjong`:
   - Check `table.phase`: if `Playing(CallWindow { .. })`, extract `last_discard`
   - If call window: verify `winning_tile` parameter matches `last_discard.tile`
   - If not call window (self-draw): verify `winning_tile` was just drawn
2. Add field to `CallWindow`: `last_discard: TileInstance` for easy reference
3. Return error `WinningTileMismatch` if verification fails

**Acceptance criteria**:

- Cannot declare Mahjong with wrong tile during call window
- Test: Call Mahjong with tile != last discard → rejected
- Test: Self-draw Mahjong with correct drawn tile → accepted

#### 1.3: Call-window Mahjong consumes discard and advances phase

**File**: `crates/mahjong_core/src/table/handlers/win.rs`

**Current issue**: Mahjong during call window doesn't consume the discard or advance game state.

**Implementation**:

1. In successful `handle_declare_mahjong` during `CallWindow`:
   - Add `last_discard` tile to winner's hand reconstruction
   - Mark discard as claimed (remove from discard pool if tracked)
   - Transition phase to `GameOver(MahjongWin { winner, .. })`
2. Ensure turn counter and call window are closed
3. Preserve win metadata: `is_self_draw: bool`, `winning_tile: Tile`, `discarder: Option<PlayerId>`

**Acceptance criteria**:

- After Mahjong call, phase is `GameOver`
- Discard is consumed (not available for other calls)
- Winner's hand includes the called tile
- Test: Full game flow with call-window Mahjong

### Phase 2: Meld Validation (HIGH PRIORITY)

**Goal**: Ensure meld calls are legitimate and tiles are actually held.

#### 2.1: Validate caller owns required tiles

**File**: `crates/mahjong_core/src/table/handlers/playing.rs`

**Current issue**: `CallMeld` doesn't verify caller has the tiles they claim.

**Implementation**:

1. In `handle_call_meld`:
   - Accept `tiles_from_hand: Vec<TileInstance>` (tiles caller is contributing)
   - Verify each tile in `tiles_from_hand` exists in `caller.hand_tiles`
   - Verify `called_tile` (the discard) is included in the final meld
   - Calculate: `final_meld = tiles_from_hand + [called_tile]`
2. Validate `final_meld` matches meld type (Pung/Kong/Quint)
   - Use existing `Meld::validate()` or create `Meld::from_tiles()`
3. Remove tiles from caller's hand, add to `exposed_melds`
4. Return error `InsufficientTiles` or `InvalidMeldComposition` on failure

**Acceptance criteria**:

- Cannot call meld without owning required tiles
- Called tile must be part of the meld
- Test: Call Pung without 2 matching tiles → rejected
- Test: Call Kong with correct 3 tiles → accepted

#### 2.2: Add Sextet support

**File**: `crates/mahjong_core/src/meld.rs`

**Implementation**:

1. Add `Sextet` variant to `Meld` enum
2. Update `Meld::validate()` to check 6 matching tiles
3. Add validation: Sextets cannot be all jokers (per NMJL joker rules)
4. Update call priority logic in `crates/mahjong_core/src/call_resolution.rs`

**Acceptance criteria**:

- Sextet variant exists and validates correctly
- Can call and expose Sextets
- Test: Call Sextet with 5 matching + 1 joker → accepted

#### 2.3: Add-to-exposure (Pung → Kong/Quint)

**File**: `crates/mahjong_core/src/table/handlers/playing.rs`

**Implementation**:

1. Create new command: `AddToExposure { meld_index: usize, tile: TileInstance }`
2. In handler:
   - Verify it's caller's turn and phase is `Playing(PlayerTurn)`
   - Verify `meld_index` exists in `player.exposed_melds`
   - Verify `tile` exists in `player.hand_tiles`
   - Verify adding tile creates valid upgraded meld (Pung→Kong, Kong→Quint)
3. Remove tile from hand, upgrade meld in `exposed_melds`
4. Player must still discard after add-to-exposure

**Acceptance criteria**:

- Can upgrade Pung to Kong by adding 4th tile
- Can upgrade Kong to Quint by adding 5th tile
- Must be on player's turn
- Test: Add matching tile to Pung → becomes Kong

### Phase 3: Joker Rules (MEDIUM PRIORITY)

**Goal**: Enforce NMJL joker restrictions.

#### 3.1: Block calls on discarded jokers

**File**: `crates/mahjong_core/src/table/validation.rs` and `crates/mahjong_core/src/flow/playing.rs`

**Implementation**:

1. In `CallWindow` creation (when discard happens):
   - Check if `discarded_tile.is_joker()`
   - If joker, skip creating `CallWindow` phase entirely
   - Transition directly to next player's turn
2. Add validation in `handle_call_meld` and `handle_declare_mahjong`:
   - Return `CannotCallJoker` error if somehow reached

**Acceptance criteria**:

- Discarding joker immediately advances to next turn
- No call window opens for joker discards
- Test: Discard joker → no calls allowed, next player draws

#### 3.2: Joker exchange timing enforcement

**File**: `crates/mahjong_core/src/table/handlers/joker.rs` (or create it)

**Current issue**: Joker exchange doesn't check timing rules.

**Implementation**:

1. Modify `handle_exchange_joker`:
   - Verify phase is `Playing(PlayerTurn)` and it's caller's turn
   - Verify caller has drawn this turn (add `has_drawn: bool` to `PlayerTurn` if needed)
   - Or: verify caller just completed a call (add `has_called: bool`)
   - Return `InvalidJokerExchangeTiming` if neither condition met
2. Allow exchange only after draw/call, before discard
3. Track exchange as an action (doesn't end turn)

**Acceptance criteria**:

- Can exchange joker after drawing
- Can exchange joker after calling meld
- Cannot exchange on opponent's turn
- Cannot exchange before drawing
- Test: Exchange joker after draw → accepted
- Test: Exchange joker before draw → rejected

#### 3.3: Finesse rule

**File**: `crates/mahjong_core/src/table/handlers/win.rs`

**Implementation**:

1. Track last action before Mahjong: add `last_action: LastAction` enum to state
   - Variants: `Draw`, `Call`, `JokerExchange`
2. In `handle_declare_mahjong`:
   - If `last_action == JokerExchange && !call_window`, treat as self-draw
   - Set `is_self_draw = true` for scoring
3. Update scoring to apply self-draw multiplier for finesse

**Acceptance criteria**:

- Joker exchange → immediate Mahjong counts as self-draw
- Scoring applies self-draw bonus
- Test: Exchange joker, declare Mahjong → self-draw scoring

### Phase 4: Charleston Extensions (MEDIUM PRIORITY)

**Goal**: Add blind pass/steal and IOU rules.

#### 4.1: Blind pass/steal for FirstLeft and SecondRight

**File**: `crates/mahjong_core/src/table/handlers/charleston.rs`

**Current issue**: `blind_pass_count` field is ignored.

**Implementation**:

1. For `FirstLeft` and `SecondRight` passes:
   - Accept `blind_pass_count: u8` (0-3)
   - Accept `tiles_to_pass: Vec<TileInstance>` with length = (3 - blind_pass_count)
   - Validate: `tiles_to_pass.len() + blind_pass_count == 3`
2. During pass resolution:
   - Visible tiles are passed normally
   - For blind tiles: select randomly from passer's remaining hand
   - Receiver gets all tiles (visible + blind) without seeing which were blind
3. Track blind tiles per player for steal resolution
4. Add `steal_blind_from: Option<PlayerId>` to courtesy pass
5. On steal: receiver gets the actual blind tiles passed from that player

**Acceptance criteria**:

- Can pass 0-3 tiles blind on FirstLeft/SecondRight
- Blind tiles selected randomly from passer's hand
- Can steal blind tiles during courtesy pass negotiation
- Test: Blind pass 2 tiles → receiver gets 2 random + 1 visible

#### 4.2: IOU resolution

**File**: `crates/mahjong_core/src/flow/charleston/state.rs`

**Implementation**:

1. During pass resolution, check if all 4 players blind passed 3 tiles
2. If true, create `IouResolution` phase:
   - Players receive their passes immediately
   - Track who owes/is owed: each player owes the player they passed to
   - During game: if player A draws tile that player B needs (and B is owed), B can claim IOU
3. Add `claim_iou` command during `Playing` phase
4. Validate: claimer is owed by drawer, tile matches, etc.

**Acceptance criteria**:

- All blind pass 3 → IOU rule activates
- Players can claim IOUs during play
- Test: Full blind pass → IOU resolution → claim during game

#### 4.3: Heavenly hand detection

**File**: `crates/mahjong_core/src/flow/mod.rs` and `crates/mahjong_core/src/flow/charleston/mod.rs`

**Implementation**:

1. After initial deal, before Charleston:
   - Check if East's 14 tiles form a winning hand (using existing validator)
   - If yes, create event `HeavenlyHandDetected`
   - Transition to `GameOver(HeavenlyHand { winner: East })`
2. Skip Charleston entirely
3. In scoring: apply double payment multiplier for heavenly hand

**Acceptance criteria**:

- East wins immediately if dealt winning hand
- Charleston is skipped
- Heavenly hand scoring applied
- Test: Deal East a winning hand → instant win

### Phase 5: Scoring Alignment (LOW PRIORITY)

**Goal**: Align scoring with NMJL rules or document house rules.

#### 5.1: Per-pattern card values

**File**: `crates/mahjong_core/src/scoring.rs` and `crates/mahjong_core/src/rules/card.rs`

**Current issue**: Uses fixed 25 points instead of pattern's card value.

**Implementation**:

1. Add `base_value: u32` field to `Pattern` struct in card.rs
2. Parse card value from card data files (or default to 25)
3. In `calculate_score`:
   - Use `winning_pattern.base_value` instead of hardcoded 25
   - Apply multipliers to base value

**Acceptance criteria**:

- Each pattern has its own base value
- Scoring uses pattern value
- Test: Win with 30-point pattern → base score 30

#### 5.2: Discard vs. self-draw payment structure

**File**: `crates/mahjong_core/src/scoring.rs`

**Current issue**: Payment logic doesn't follow NMJL discard rules.

**Implementation**:

1. In `calculate_payments`:
   - If `is_self_draw`: all 3 losers pay `base_value * multipliers`
   - If called discard:
     - Discarder pays `2 * base_value * multipliers`
     - Other 2 players pay `base_value * multipliers`
2. Return `HashMap<PlayerId, i32>` with correct amounts
3. Discarder is tracked in win metadata (from Phase 1.3)

**Acceptance criteria**:

- Self-draw: 3 losers pay equal amounts
- Called win: discarder pays double, others single
- Test: Called win → discarder pays 2x

#### 5.3: Jokerless bonus

**File**: `crates/mahjong_core/src/scoring.rs`

**Implementation**:

1. In `calculate_score`:
   - Check if winning hand contains any jokers
   - If no jokers and pattern allows jokers: apply jokerless multiplier (2x per NMJL)
   - If pattern is singles/pairs (no jokers allowed): no bonus
2. Add logic to detect pattern's joker eligibility from card rules

**Acceptance criteria**:

- Jokerless win doubles score (if pattern allows jokers)
- Singles/pairs wins don't get bonus
- Test: Jokerless Pung/Kong win → 2x multiplier

#### 5.4: Dealer rotation

**File**: `crates/mahjong_core/src/scoring.rs` or game loop

**Implementation**:

1. East = room creator for initial game
2. After each hand, rotate East clockwise regardless of winner
3. Document rule in code comments

**Acceptance criteria**:

- Dealer rotation follows NMJL tournament rules
- Test: East wins → dealer rotates clockwise
- Test: South wins → dealer rotates clockwise
- Test: First game → East is room creator

### Phase 6: Testing & Validation

**Goal**: Comprehensive test coverage for all new rules.

#### 6.1: Integration tests for win flow

**File**: `crates/mahjong_core/tests/integration/win_scenarios.rs`

**Tests to add**:

1. Call-window Mahjong with correct tile → success, game over
2. Call-window Mahjong with wrong tile → rejected
3. Self-draw Mahjong after draw → success
4. Mahjong consumes discard and adds to hand
5. Multiple players call Mahjong → priority resolution
6. DeclareMahjong with fake hand → rejected (server validates)

#### 6.2: Meld validation tests

**File**: `crates/mahjong_core/tests/unit/meld_validation.rs`

**Tests to add**:

1. Call Pung without owning tiles → rejected
2. Call Kong with 3 matching tiles → accepted
3. Call meld without including called tile → rejected
4. Add-to-exposure: Pung → Kong → Quint chain
5. Add-to-exposure on opponent's turn → rejected
6. Sextet call and validation

#### 6.3: Joker rule tests

**File**: `crates/mahjong_core/tests/integration/joker_rules.rs`

**Tests to add**:

1. Discard joker → no call window, next player draws
2. Exchange joker after draw → accepted
3. Exchange joker before draw → rejected
4. Exchange joker on opponent's turn → rejected
5. Finesse: exchange → Mahjong counts as self-draw

#### 6.4: Charleston tests

**File**: `crates/mahjong_core/tests/integration/charleston.rs`

**Tests to add**:

1. Blind pass 2 tiles on FirstLeft → random tiles selected
2. Steal blind tiles during courtesy → correct tiles received
3. All players blind pass 3 → IOU activated
4. Claim IOU during game → tile transferred
5. Heavenly hand dealt to East → instant win, Charleston skipped

#### 6.5: Scoring tests

**File**: `crates/mahjong_core/tests/unit/scoring.rs`

**Tests to add**:

1. Pattern with value 30 → base score 30 (not 25)
2. Self-draw win → all 3 losers pay equal
3. Called win → discarder pays 2x, others 1x
4. Jokerless win → 2x multiplier applied
5. Singles/pairs jokerless → no bonus
6. Dealer rotation per configured rule

### Phase 7: Documentation

**Goal**: Update all docs to reflect new rules.

**Actions**:

1. Update `docs/implementation/backend/rules-audit-checklist.md`:
   - Mark all implemented items as (enforced)
   - Remove (missing) and (partial) markers
2. Update [ADR 0025](../../adr/0025-nmjl-rules-scope-and-enforcement.md) if implementation reveals needed scope changes
3. Update API documentation for new commands (AddToExposure, ClaimIOU, etc.)
4. Add code comments explaining complex rule logic (blind pass selection, IOU tracking, etc.)

**Acceptance criteria**:

- Audit checklist reflects implementation status
- ADR 0025 is current with any discovered scope changes
- New commands have doc comments
- Complex algorithms have inline documentation

---

## Dependency order summary

**Prerequisite**: Review [ADR 0025](../../adr/0025-nmjl-rules-scope-and-enforcement.md) before starting implementation to understand scope decisions.

1. **Phase 1** (win/call flow) is critical and blocks scoring work
2. **Phase 2** (meld validation) can run parallel to Phase 1
3. **Phase 3** (joker rules) depends on Phase 1.3 (turn tracking)
4. **Phase 4** (Charleston) is independent, can run parallel to 2-3
5. **Phase 5** (scoring) depends on Phase 1 (win metadata)
6. **Phase 6** (tests) should run after each phase implementation
7. **Phase 7** (docs) is final

## Success metrics

- All (missing) items in audit checklist resolved or documented as out-of-scope
- 95%+ test coverage for rule validation code
- Integration tests for each major rule category pass
- Zero client-supplied data trusted without server verification

## Scope questions (RESOLVED)

All scope questions have been resolved in [ADR 0025](../../adr/0025-nmjl-rules-scope-and-enforcement.md):

- **Penalty rules**: All NMJL penalties enforced server-side (dead hand, wrong tile count, mahjong in error)
- **Scoring model**: Hybrid - default NMJL with configurable house rules
- **Sextet support**: YES - required for card years 2017-2025 and beyond
- **Dealer rotation**: East = room creator initially, then rotates every game
- **Charleston features**: Blind pass/steal and IOU MUST be implemented
- **Heavenly hand**: MUST be supported (rare but valid NMJL rule)
