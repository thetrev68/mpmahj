# Table Refactoring Plan (Completed)

**Status:** ✅ Completed on 2026-01-07
**Outcome:** The `table.rs` file was successfully refactored into a modular `table/` directory structure with a functional handler architecture.

## Final Structure

```bash
crates/mahjong_core/src/table/
├── mod.rs                 # The "Brain": Table struct & process_command orchestration
├── types.rs               # Pure Data: Enums, Structs (Ruleset, TimerMode)
├── validation.rs          # Logic: Pure validation rules
├── snapshot.rs            # Logic: State projection
├── bot.rs                 # Logic: AI decision making
├── tests.rs               # Unit tests (migrated from original file)
└── handlers/              # Logic: State mutation implementations
    ├── mod.rs             # Module exports
    ├── setup.rs           # impl: roll_dice, ready_to_start
    ├── charleston.rs      # impl: pass_tiles, vote, courtesy
    ├── playing.rs         # impl: draw, discard, call, resolve
    └── win.rs             # impl: mahjong, exchange, abandon
```text

## Changes Implemented

### 1. `mod.rs` (The Central Hub)

- Defines `Table` struct with `pub` and `pub(crate)` fields.
- Implements `process_command` which:
  1. Calls `validation::validate(self, &cmd)`
  2. Matches the command and dispatches directly to `handlers::*` functions.

### 2. `handlers/*.rs` (The Logic)

- Pure functions that take `&mut Table` and arguments.
- Return `Vec<GameEvent>`.
- No wrapper structs or traits; just clean functional composition.

### 3. `validation.rs` (The Rules)

- Contains `validate(table, cmd)` which routes to private helpers:
  - `validate_setup`
  - `validate_charleston`
  - `validate_playing`
  - `validate_win`

### 4. `types.rs` (The Data)

- Contains `Ruleset`, `TimerMode`, `HouseRules`, `DiscardedTile`, `CommandError`.

### 5. Verification

- All 138 unit tests passed.
- Integration tests (`turn_flow`, `charleston_flow`, etc.) passed.
- Codebase is now modular and ready for further expansion without the "God Class" overhead.
