# Phase 2: Meld Validation + Exposure Updates - Implementation Summary

**Status**: ✅ COMPLETE

This document summarizes the implementation of Phase 2 from [rules-audit-checklist.md](docs/implementation/backend/rules-audit-checklist.md).

## Overview

Phase 2 introduces comprehensive meld validation, Sextet support, all-joker melds per NMJL rules, and the add-to-exposure feature for upgrading melds during gameplay.

## Completed Tasks

### 2.1: Sextet Support ✅

**Files Modified**:

- [crates/mahjong_core/src/meld.rs](crates/mahjong_core/src/meld.rs)

**Changes**:

- Added `MeldType::Sextet` variant to the enum
- Updated `tile_count()` method to return 6 for Sextet
- All downstream match statements automatically handle Sextet through exhaustive patterns

**Example**:

```rust
let sextet = Meld::new(MeldType::Sextet, vec![DOT_5; 6], Some(DOT_5))?;
assert_eq!(sextet.tile_count(), 6);
```

### 2.2: All-Joker Melds Per NMJL ✅

**Files Modified**:

- [crates/mahjong_core/src/meld.rs](crates/mahjong_core/src/meld.rs)

**Changes**:

- Modified `Meld::new()` to allow melds with zero natural tiles
- When `called_tile` is provided, jokers are assigned to that tile even if no natural tiles exist
- When no `called_tile` is provided in an all-joker meld, no joker assignments are created
- Updated `validate()` to allow all-joker melds (no error if all tiles are jokers)
- Modified `can_exchange_joker()` to support all-joker melds with called_tile as the base
- Removed `MeldError::AllJokers` since all-joker melds are now valid

**Examples**:

```rust
// All-joker Pung with called_tile (can exchange)
let meld1 = Meld::new(MeldType::Pung, vec![JOKER; 3], Some(DOT_5))?;
assert!(meld1.can_exchange_joker(DOT_5)); // Can exchange for DOT_5

// All-joker Pung without called_tile (cannot exchange)
let meld2 = Meld::new(MeldType::Pung, vec![JOKER; 3], None)?;
assert!(!meld2.can_exchange_joker(DOT_5)); // Cannot exchange
```

### 2.3: Meld Call Validation ✅

**Files Modified**:

- [crates/mahjong_core/src/table/validation.rs](crates/mahjong_core/src/table/validation.rs#L302)

**Changes**:

- Enhanced `validate_call_intent()` to perform comprehensive meld validation
- Validates meld structure (tile count and matching)
- Verifies `meld.called_tile` matches the current call window tile
- Ensures meld contains the called tile
- Checks player owns all required tiles (except the called tile)

**Validation Flow**:

1. Basic meld structure validation (tile_count, matching non-jokers)
2. Meld must have a called_tile that matches the window tile
3. Meld tiles must include the called tile
4. Player must own all non-called tiles in the meld

**Documentation**: Full Rustdoc with detailed error cases

### 2.4: Add-To-Exposure Command ✅

**Files Modified**:

- [crates/mahjong_core/src/command.rs](crates/mahjong_core/src/command.rs) - Command definition
- [crates/mahjong_core/src/table/validation.rs](crates/mahjong_core/src/table/validation.rs) - Validation logic
- [crates/mahjong_core/src/table/handlers/win.rs](crates/mahjong_core/src/table/handlers/win.rs) - Handler implementation
- [crates/mahjong_core/src/table/mod.rs](crates/mahjong_core/src/table/mod.rs) - Command dispatch
- [crates/mahjong_core/src/event/public_events.rs](crates/mahjong_core/src/event/public_events.rs) - Event definition

**Changes**:

- Added `GameCommand::AddToExposure { player, meld_index, tile }`
- Added validation to ensure:
  - Player is in Discarding phase and it's their turn
  - Meld exists at the specified index
  - Player owns the tile to add
  - Tile matches the meld's base tile
  - Meld is not already a Sextet
- Added `add_to_exposure()` handler that:
  - Upgrades Pung → Kong → Quint → Sextet
  - Removes tile from player's concealed hand
  - Emits MeldUpgraded event
- Added `PublicEvent::MeldUpgraded` with meld_index and new_meld_type

**Example Flow**:

```rust
// Player has exposed Pung, wants to upgrade to Kong
let cmd = GameCommand::AddToExposure {
    player: Seat::East,
    meld_index: 0,
    tile: DOT_5, // Tile matches the Pung
};
// Result: Pung becomes Kong, DOT_5 removed from concealed hand
```

## Consistency Across Codebase

All modules that pattern-match on `MeldType` have been updated to handle `Sextet`:

✅ [crates/mahjong_core/src/meld.rs](crates/mahjong_core/src/meld.rs) - MeldType::tile_count()
✅ [crates/mahjong_core/src/call_resolution.rs](crates/mahjong_core/src/call_resolution.rs) - Handles generically
✅ [crates/mahjong_ai/src/strategies/greedy.rs](crates/mahjong_ai/src/strategies/greedy.rs) - Updated match
✅ [crates/mahjong_ai/src/strategies/random.rs](crates/mahjong_ai/src/strategies/random.rs) - Updated match
✅ [crates/mahjong_server/src/analysis/comparison.rs](crates/mahjong_server/src/analysis/comparison.rs) - Updated matches (2x)
✅ [crates/mahjong_server/src/analysis/mod.rs](crates/mahjong_server/src/analysis/mod.rs) - Updated hash function
✅ [crates/mahjong_terminal/src/bot.rs](crates/mahjong_terminal/src/bot.rs) - Added event handler

## Testing

### New Integration Test Suite: Phase 2

Created comprehensive test file: [crates/mahjong_core/tests/phase2_meld_validation.rs](crates/mahjong_core/tests/phase2_meld_validation.rs)

**Test Coverage** (23 tests):

#### Sextet Support Tests (3)

- `test_sextet_tile_count` - Verifies tile count for all meld types
- `test_create_sextet_meld` - Creates and validates Sextet structure
- `test_sextet_with_jokers` - Sextet with joker assignments

#### All-Joker Meld Tests (6)

- `test_all_joker_pung_with_called_tile` - All-joker Pung with base tile
- `test_all_joker_pung_without_called_tile` - All-joker Pung without base tile
- `test_all_joker_kong_with_called_tile` - All-joker Kong validation
- `test_can_exchange_joker_all_joker_meld_with_called_tile` - Exchange with base
- `test_can_exchange_joker_all_joker_meld_without_called_tile` - Cannot exchange without base
- `test_mixed_natural_and_joker_melds` - Hybrid natural + joker melds

#### Meld Call Validation Tests (5)

- `test_meld_call_requires_called_tile` - Meld must have called_tile
- `test_meld_call_called_tile_must_match_window` - called_tile matches window
- `test_meld_call_must_contain_called_tile` - Tiles include called_tile
- `test_meld_call_player_must_own_tiles` - Player owns required tiles
- `test_valid_meld_call_with_correct_tiles` - Valid call succeeds

#### Add-To-Exposure Tests (6)

- `test_add_to_exposure_pung_to_kong` - Pung → Kong upgrade
- `test_add_to_exposure_kong_to_quint` - Kong → Quint upgrade
- `test_add_to_exposure_quint_to_sextet` - Quint → Sextet upgrade
- `test_add_to_exposure_wrong_tile_type` - Rejects mismatched tiles
- `test_add_to_exposure_player_doesnt_own_tile` - Rejects missing tile
- `test_add_to_exposure_removes_tile_from_hand` - Verifies tile removal

#### Integration Tests (3)

- `test_call_resolution_with_sextet` - Sextet melds resolve correctly
- `test_all_joker_meld_with_joker_exchange` - All-joker exchange works
- `test_sextet_with_mixed_jokers` - Sextet with mixed natural + joker

**Test Results**: All 23 tests ✅ PASSING

### Integration with Existing Tests

- Phase 1 tests (8 tests) still pass ✅
- Call priority tests (4 tests) still pass ✅
- Library tests (73 tests) still pass ✅

## Architecture Notes

### Command/Event Pattern

Follows established patterns from Phase 1:

- **AddToExposure command** flows through validation → dispatch → handler
- **MeldUpgraded event** is broadcast to all players
- Server maintains authoritative state in Table

### Type Safety

Uses Rust's exhaustive pattern matching to ensure:

- All MeldType variants are handled everywhere
- Compiler catches missing cases when new variants are added
- No silent failures in meld processing

### Validation Layers

Three-layer validation ensures integrity:

1. **Command validation** - Checks preconditions (phase, turn, ownership)
2. **Meld validation** - Validates meld structure
3. **Intent validation** - Validates against call window context

## Documentation

All code follows Rustdoc standards with:

- Detailed method documentation
- Examples for public APIs
- Error conditions documented
- Acceptance criteria in comments

## Performance Impact

- ✅ Negligible: All operations are O(1) or O(n) where n ≤ 6
- ✅ No new data structures or allocations beyond meld tiles
- ✅ Validation uses existing hand structures

## Next Steps (Phase 3+)

The implementation is complete for Phase 2. The following phases can proceed:

- Phase 3: Joker rules (dead tile, timing, finesse)
- Phase 4: Penalties and dead hands
- Phase 5: Charleston blind pass/steal and IOU
- Phase 6: Scoring alignment

## References

- [Rules Audit Checklist](docs/implementation/backend/rules-audit-checklist.md#phase-2-meld-validation--exposure-updates-high-priority)
- [ADR 0025: NMJL Rules Scope and Enforcement](docs/adr/0025-nmjl-rules-scope-and-enforcement.md)
- [Architecture Documentation](docs/architecture/)
