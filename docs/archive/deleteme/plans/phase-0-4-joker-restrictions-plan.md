# Phase 0.4: Joker Restrictions - Detailed Implementation Plan

**Status:** IMPLEMENTED (2026-01-06)

**Created:** 2026-01-06

**Goal:** Enforce NMJL joker restrictions in validation. Jokers may substitute only in 3+ identical tile groups. Jokers cannot complete singles or pairs, and joker pairs are not allowed. All-joker 3+ groups are allowed. Jokers cannot substitute for flowers.

## Implementation Summary

- Added `ineligible_histogram` to Unified Card variations and analysis entries for strict natural-only slots.
- Updated `Hand::calculate_deficiency()` and `HandValidator` to use strict vs flexible counts.
- Generated `ineligible_histogram` from the CSV and forced flowers to be ineligible regardless of CSV flags.
- Kept CSV as source of truth; unified card descriptions are derived from `hand_pattern` (criteria text omitted for now).
- Added strict joker tests, including a flower substitution rejection case.
- Moved card tooling + CSV to `scripts/card_tools/` to avoid tmp cleanup.

## Decisions and Outcome

1. **Strict joker enforcement uses split histograms**
   - `histogram`: total tile requirements
   - `ineligible_histogram`: tiles that must be natural (pairs, singles, flowers)

2. **CSV remains the source of truth**
   - `scripts/card_tools/NMJL_2025_Card_Playable.csv` drives unified card generation.
   - Tooling lives in `scripts/card_tools/convert_card.py`.

3. **Flowers are always ineligible**
   - Conversion forces flower slots into `ineligible_histogram`.

4. **Display text scope**
   - Descriptions currently use `hand_pattern` only; the criteria text can be reintroduced later by concatenating CSV fields.

## Files Modified

| File                                             | Changes                                                      |
| ------------------------------------------------ | ------------------------------------------------------------ |
| `crates/mahjong_core/src/hand.rs`                | Strict joker deficiency logic using `ineligible_histogram`.  |
| `crates/mahjong_core/src/rules/card.rs`          | Added `ineligible_histogram` to schema and analysis entries. |
| `crates/mahjong_core/src/rules/validator.rs`     | Uses strict joker deficiency calculation.                    |
| `crates/mahjong_core/tests/joker_strict_test.rs` | Added flower substitution test.                              |
| `scripts/card_tools/convert_card.py`             | CSV-driven generator with flower override.                   |
| `scripts/card_tools/NMJL_2025_Card_Playable.csv` | Source of truth (moved from tmp).                            |
| `data/cards/unified_card2025.json`               | Regenerated with `ineligible_histogram`.                     |

## Exit Criteria

1. ✅ Jokers are blocked for singles, pairs, and flowers.
2. ✅ Jokers are allowed only for 3+ identical groups.
3. ✅ Flower substitution is rejected.
4. ✅ Joker restriction tests pass.
