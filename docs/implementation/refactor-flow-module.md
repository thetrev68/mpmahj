# Refactoring flow.rs into LLM-Friendly Module Structure

**Status**: Proposed  
**Created**: 2026-01-19  
**Estimated Effort**: 4-6 hours  
**Risk Level**: Low (pure refactor with test coverage)

## Problem Statement

[flow.rs](../../../crates/mahjong_core/src/flow.rs) has grown to 1,124 lines containing 15 public types, making it challenging for LLMs to work with efficiently within context windows. The Charleston subsystem alone comprises 350+ lines across 5 tightly-coupled types with complex state management.

### Current Metrics

- **Total lines**: 1,124 (737 code, 387 tests; tests ≈34.4%)
- **Public types**: 17 (12 enums, 5 structs)
- **Public methods**: 19
- **Test cases**: 23
- **Usage sites**: 50+ locations across 4 crates

### Complexity Hotspots

1. **CharlestonState** struct: 120+ lines with nested `HashMap<Seat, Option<Vec<Tile>>>`
2. **TurnStage::CallWindow** variant: 5 fields with complex resolution logic
3. **GamePhase::transition()**: 62-line method with 12+ match arms
4. **Tests interleaved**: 34% of file is tests, making navigation harder

## Proposed Structure

### Hybrid Module Layout (Option C)

```text
crates/mahjong_core/src/flow/
├── mod.rs (~80 lines)
│   ├── StateError enum
│   ├── GamePhase enum + transition() method
│   ├── SetupStage enum (small, keep here)
│   ├── PhaseTrigger enum
│   └── Module declarations only (no re-exports)
│
├── charleston/
│   ├── mod.rs (~50 lines) - Module declarations only (no re-exports)
│   ├── stage.rs (~150 lines)
│   │   ├── CharlestonStage enum + methods
│   │   ├── PassDirection enum + methods
│   │   └── CharlestonVote enum
│   ├── state.rs (~150 lines)
│   │   └── CharlestonState struct + 10 methods
│   └── tests.rs (~120 lines) - Charleston-specific tests
│
├── playing.rs (~200 lines)
│   ├── TurnStage enum + methods
│   │   ├── is_call_window()
│   │   ├── eligible_actors()
│   │   └── resolve_call_window()
│   └── TurnAction enum
│
├── outcomes.rs (~150 lines)
│   ├── WinContext struct
│   ├── WinType enum
│   ├── ScoreModifiers struct
│   ├── ScoreBreakdown struct
│   ├── GameResult struct
│   ├── GameEndCondition enum
│   └── AbandonReason enum
│
├── tests/
│   ├── phase_transitions.rs (~100 lines)
│   ├── playing.rs (~80 lines)
│   └── outcomes.rs (~80 lines)
│
└── README.md - Module structure guide for LLMs
```

**All files <200 lines** ✅

### Rationale for This Structure

1. **Charleston isolation**: Most complex subsystem (350+ lines, 5 types) gets dedicated submodule with stage/state separation
2. **Phase alignment**: Structure mirrors game phases (charleston/ vs playing.rs vs outcomes.rs)
3. **LLM-friendly sizing**: Largest file is 200 lines, easily fits in context windows
4. **Cognitive clarity**: Related types grouped together (e.g., all win/score types in outcomes.rs)
5. **Test separation**: Tests moved to companion modules, reducing main file noise

## Implementation Steps

### Step 1: Create Module Skeleton

**Estimated time**: 30 minutes  
**Risk**: Low

1. Create `crates/mahjong_core/src/flow/` directory
2. Create empty module files:
   - `flow/mod.rs`
   - `flow/charleston/mod.rs`
   - `flow/charleston/stage.rs`
   - `flow/charleston/state.rs`
   - `flow/playing.rs`
   - `flow/outcomes.rs`
3. Set up module declarations in each `mod.rs`

### Step 2: Move Core Phase Types to flow/mod.rs

**Estimated time**: 45 minutes  
**Risk**: Low

Move from [flow.rs](../../../crates/mahjong_core/src/flow.rs) to [flow/mod.rs](../../../crates/mahjong_core/src/flow/mod.rs):

- `StateError` enum (lines 19-38)
- `GamePhase` enum + `impl GamePhase { fn transition() }` (lines 43-127)
- `SetupStage` enum (lines 128-146)
- `PhaseTrigger` enum (lines 148-164)

Add module declarations only (no re-exports):

```rust
pub mod charleston;
pub mod playing;
pub mod outcomes;
```

**Note**: We will NOT add re-exports. All usage sites will be updated to use explicit paths.

**Verify**: `cargo check --package mahjong_core` (will fail until imports updated)

### Step 3: Extract Charleston Subsystem

**Estimated time**: 1.5 hours  
**Risk**: Medium (most complex subsystem)

#### 3a. Move to flow/charleston/stage.rs

- `CharlestonStage` enum + impl (lines 166-282)
- `PassDirection` enum + impl (lines 284-311)
- `CharlestonVote` enum (lines 313-320)

#### 3b. Move to flow/charleston/state.rs

- `CharlestonState` struct (lines 322-443)
- All `impl CharlestonState` methods:
  - `new()`
  - `current_stage()`
  - `record_pass()`
  - `all_players_passed()`
  - `record_vote()`
  - `tally_votes()`
  - `record_courtesy_proposal()`
  - `courtesy_proposals_complete()`
  - `finalize_courtesy()`

#### 3c. Set up flow/charleston/mod.rs

```rust
mod stage;
mod state;

pub mod stage;
pub mod state;
```

**Verify**:

```bash
cargo check --package mahjong_core
cargo test --package mahjong_core charleston::
```

### Step 4: Move Playing Phase Types to flow/playing.rs

**Estimated time**: 45 minutes  
**Risk**: Low

Move from [flow.rs](../../../crates/mahjong_core/src/flow.rs):

- `TurnStage` enum + impl (lines 453-591)
  - `is_call_window()`
  - `eligible_actors()`
  - `resolve_call_window()`
- `TurnAction` enum (lines 593-606)

**Verify**:

```bash
cargo check --package mahjong_core
cargo test --package mahjong_core flow::playing
```

### Step 5: Move Outcome Types to flow/outcomes.rs

**Estimated time**: 30 minutes  
**Risk**: Low

Move from [flow.rs](../../../crates/mahjong_core/src/flow.rs):

- `WinContext` struct (lines 608-626)
- `WinType` enum (lines 628-638)
- `ScoreModifiers` struct (lines 640-653)
- `ScoreBreakdown` struct (lines 655-677)
- `GameResult` struct (lines 679-703)
- `GameEndCondition` enum (lines 705-717)
- `AbandonReason` enum (lines 719-734)

**Verify**: `cargo check --package mahjong_core`

### Step 6: Migrate Tests

**Estimated time**: 1 hour  
**Risk**: Low

#### Test Organization Decision

Two options:

**Option A**: Companion test modules (recommended)

```text
flow/charleston/tests.rs
flow/tests/phase_transitions.rs
flow/tests/playing.rs
flow/tests/outcomes.rs
```

**Option B**: Centralized tests/ directory

```text
flow/tests/charleston.rs
flow/tests/phase_transitions.rs
flow/tests/playing.rs
flow/tests/outcomes.rs
```

#### Migration Process

1. Identify all test functions in [flow.rs](../../../crates/mahjong_core/src/flow.rs) (29 tests, lines 736-1124)
2. Categorize by functionality:
   - Charleston tests → `flow/charleston/tests.rs` or `flow/tests/charleston.rs`
   - Phase transition tests → `flow/tests/phase_transitions.rs`
   - Playing phase tests → `flow/tests/playing.rs`
   - Outcome tests → `flow/tests/outcomes.rs`
3. Move test code to appropriate modules
4. Add `#[cfg(test)]` and `use super::*;` as needed

**Verify**:

```bash
cargo test --package mahjong_core flow::
# Should show all 29 tests passing
```

### Step 7: Delete Original flow.rs and Finalize

**Estimated time**: 30 minutes  
**Risk**: Low

1. Delete [crates/mahjong_core/src/flow.rs](../../../crates/mahjong_core/src/flow.rs)
2. Verify [crates/mahjong_core/src/lib.rs](../../../crates/mahjong_core/src/lib.rs) references `pub mod flow;` (should auto-resolve to directory)
3. Run full test suite:

   ```bash
   cargo test --workspace
   ```

4. Verify all import paths have been updated to the new explicit module layout (no re-exports will be added)
5. Create `flow/README.md` documenting structure:

```markdown
# flow Module - Game State Machine

This module defines the hierarchical state machine for American Mahjong game flow.

## Structure

- **mod.rs**: Core phase types (`GamePhase`, `StateError`, `PhaseTrigger`, `SetupStage`)
- **charleston/**: Charleston subsystem (stage, state, vote logic)
- **playing.rs**: Main gameplay turn management (`TurnStage`, `TurnAction`)
- **outcomes.rs**: Win detection and scoring types

## Design Principles

- **Type-safe state machine**: Invalid transitions prevented at compile time
- **Hierarchical phases**: Top-level `GamePhase` contains sub-phases for each game stage
- **Server-authoritative**: All state transitions validated server-side

See [docs/archive/04-state-machine-design.md](../../../../docs/archive/04-state-machine-design.md) for design rationale.
```

### Step 8: Update Documentation

**Estimated time**: 30 minutes  
**Risk**: Low

1. Update [.github/copilot-instructions.md](../../../.github/copilot-instructions.md):

   ```markdown
   ## Crate Structure

   mahjong_core/ Pure game logic (commands, events, validation)
   flow/ State machine (GamePhase, Charleston, Turn stages)
   charleston/ Charleston subsystem (most complex phase)
   ```

   Replace reference to `flow.rs` with `flow/` module.

2. Do NOT add additional long-form markdown: rely on rustdoc as the canonical documentation source. Add a minimal `flow/README.md` that points to the generated rustdoc for full details. Optionally generate a machine-readable `flow/_index.json` for LLM consumption (this file is only a convenience and is NOT the source of truth).

   **Generator**: A small utility is provided at `scripts/generate_flow_index.py` which scans `crates/mahjong_core/src/flow` (and submodules) for `pub` items and extracts adjacent `///` rustdoc comments to produce `crates/mahjong_core/src/flow/_index.json`.

   **Usage**:

   ```bash
   python scripts/generate_flow_index.py --out crates/mahjong_core/src/flow/_index.json
   ```

   The generator is intentionally conservative (regex-based) and is suitable for convenience indexing. For authoritative docs, continue to rely on `cargo doc` / rustdoc output.

3. Update any stale references in:
   - [CLAUDE.md](../../../CLAUDE.md)
   - [Agents.md](../../../Agents.md)
   - [README.md](../../../README.md)

## Complete Refactor Philosophy

### No Backward Compatibility - Complete Updates

This is a **thorough, complete refactor**. We will:

- ✅ Update ALL import paths to use new explicit module structure
- ✅ Find and modify every usage site (50+ locations)
- ✅ Remove the old `flow.rs` file completely
- ❌ NOT use re-exports to hide the changes
- ❌ NOT maintain old import paths

**Goal**: After completion, the code should look like it was always organized this way.

### Why No Re-Exports?

1. **Forces thoroughness**: We must find and fix all usage sites
2. **Prevents technical debt**: No hidden compatibility layers
3. **Better discoverability**: Explicit paths show actual structure
4. **Cleaner module API**: `mod.rs` only declares submodules, doesn't re-export
5. **Future-proof**: New code learns correct paths from day one

### API Surface (No Changes)

All public types remain public with identical signatures. Only import paths change.

### Complete Update Checklist

1. ✅ Find all 50+ import sites using `ripgrep`/`grep_search`
2. ✅ Update imports in `mahjong_core/src/` (internal, use `crate::flow::*`)
3. ✅ Update imports in `mahjong_server/src/` (external, use `mahjong_core::flow::*`)
4. ✅ Update imports in `mahjong_terminal/src/`
5. ✅ Update imports in `mahjong_ai/src/`
6. ✅ Verify TypeScript bindings regenerate correctly (`cargo test export_bindings`)
7. ✅ Verify no stale references in documentation or build scripts

## Success Criteria

- [ ] All 23 existing tests pass
- [ ] Full workspace test suite passes (`cargo test --workspace`)
- [ ] No compilation warnings
- [ ] TypeScript bindings regenerate without errors
- [ ] All files in `flow/` are <200 lines
- [ ] `flow/README.md` created for LLM reference
- [ ] **All 50+ import paths updated to new structure**
- [ ] **No usage of old `use mahjong_core::flow::{CharlestonState}` style imports**
- [ ] **`flow/mod.rs` contains NO re-exports (only module declarations)**
- [ ] Grep search for `use.*flow::\{.*Charleston` returns zero results (all should use `flow::charleston::`)
- [ ] Grep search for `use.*flow::\{.*TurnStage` returns zero results (all should use `flow::playing::`)
- [ ] Grep search for `use.*flow::\{.*WinContext` returns zero results (all should use `flow::outcomes::`)

## Risks & Mitigations

| Risk                            | Likelihood | Impact | Mitigation                                                                               |
| ------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------- |
| Miss import sites during update | Medium     | High   | Use multiple search strategies (rg, grep_search, LSP), verify with grep after completion |
| Tests break during migration    | Medium     | Medium | Move tests incrementally, verify after each step                                         |
| Charleston coupling breaks      | Low        | High   | Keep charleston/ as cohesive unit                                                        |
| Import path update takes longer | High       | Low    | Budget 2-3 hours for Step 7, work systematically                                         |
| Type inference issues           | Low        | Low    | Explicit type annotations if needed                                                      |
| Merge conflicts during refactor | Medium     | Low    | Coordinate with team, do in dedicated PR, rebase frequently                              |

## Tools & Automation

### Finding All Import Sites

Use multiple strategies to ensure complete coverage:

```bash
# Strategy 1: Direct imports
rg "use.*mahjong_core::flow" --type rust
rg "use.*crate::flow" --type rust

# Strategy 2: Qualified usage (might miss some)
rg "flow::Charleston" --type rust
rg "flow::TurnStage" --type rust
rg "flow::WinContext" --type rust

# Strategy 3: Type usage in function signatures
rg "CharlestonState" --type rust
rg "GamePhase" --type rust

# Strategy 4: Check specific high-usage files
rg "flow" crates/mahjong_core/src/table/handlers/*.rs
rg "flow" crates/mahjong_server/src/network/*.rs
```

### Verification After Refactor

```bash
# Should return ZERO results (all should use flow::charleston::)
rg "use.*flow::\{.*Charleston" --type rust

# Should return ZERO results (all should use flow::playing::)
rg "use.*flow::\{.*TurnStage" --type rust

# Should return ZERO results (all should use flow::outcomes::)
rg "use.*flow::\{.*Win" --type rust
```

## Alternatives Considered

### Option A: Phase-Based Split (Simpler)

```text
flow/
├── mod.rs (GamePhase, StateError, PhaseTrigger, SetupStage)
├── charleston.rs (all 5 Charleston types together)
├── playing.rs
└── scoring.rs
```

**Rejected**: Charleston.rs would still be 350+ lines (too large)

### Option B: Structural Split (Type-Based)

```text
flow/
├── mod.rs
├── phases.rs (SetupStage, CharlestonStage, TurnStage)
├── charleston_state.rs (just CharlestonState struct)
├── actions.rs
└── results.rs
```

**Rejected**: Less intuitive, breaks phase cohesion

### Option C: Keep as Single File

**Rejected**: Doesn't address LLM context window problem

## Tools & Automation1

### Finding All Import Sites1

Use multiple strategies to ensure complete coverage:

```bash
# Strategy 1: Direct imports
rg "use.*mahjong_core::flow" --type rust
rg "use.*crate::flow" --type rust

# Strategy 2: Qualified usage (might miss some)
rg "flow::Charleston" --type rust
rg "flow::TurnStage" --type rust
rg "flow::WinContext" --type rust

# Strategy 3: Type usage in function signatures
rg "CharlestonState" --type rust
rg "GamePhase" --type rust

# Strategy 4: Check specific high-usage files
rg "flow" crates/mahjong_core/src/table/handlers/*.rs
rg "flow" crates/mahjong_server/src/network/*.rs
```

### Verification After Refactor1

```bash
# Should return ZERO results (all should use flow::charleston::)
rg "use.*flow::\{.*Charleston" --type rust

# Should return ZERO results (all should use flow::playing::)
rg "use.*flow::\{.*TurnStage" --type rust

# Should return ZERO results (all should use flow::outcomes::)
rg "use.*flow::\{.*Win" --type rust
```

## Follow-Up Work (Future)

1. **Extract GamePhase::transition()** to `flow/transitions.rs` if it grows beyond 100 lines
2. **Add phase-specific validation** modules (e.g., `charleston/validation.rs`) if logic becomes complex
3. **Consider builder patterns** for complex structs like `GameResult`
4. **Benchmark state machine performance** to ensure no regression from module boundaries

## References

- Current implementation: [crates/mahjong_core/src/flow.rs](../../../crates/mahjong_core/src/flow.rs)
- Architecture design: [docs/archive/04-state-machine-design.md](../../archive/04-state-machine-design.md)
- Type-driven design: [docs/adr/0003-core-crate-pure-logic.md](../../adr/0003-core-crate-pure-logic.md)
- Charleston specification: [PLANNING.md](../../../PLANNING.md) (Charleston section)
