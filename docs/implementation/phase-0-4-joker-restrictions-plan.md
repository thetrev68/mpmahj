# Phase 0.4: Joker Restrictions - Detailed Implementation Plan

**Status:** PLANNED (discussion in progress)

**Created:** 2026-01-06

**Goal:** Enforce NMJL joker restrictions in validation. Jokers may substitute only in 3+ identical tile groups. Jokers cannot complete singles or pairs, and joker pairs are not allowed. All-joker 3+ groups are allowed. Jokers cannot substitute for flowers.

## Implementation Status (Discussion Summary)

- The earlier histogram-only enforcement approach has been backed out.
- Histogram counts cannot distinguish pairs vs 3+ identical groups when the same tile appears in multiple components (e.g., two pairs of the same tile). This breaks strict joker rules.
- The 2025 playable CSV includes explicit joker-substitutable flags per tile slot and maps 1:1 to unified variation IDs (`hand_key-SEQ{sequence}`).
- Performance must preserve histogram-based MCTS; strict joker checks should run only on candidate wins.
- Additional rule: jokers cannot substitute for flowers and must be rejected in flower slots.

## Proposed Direction (Pending)

**Use per-variation eligible/ineligible arrays derived from the CSV:**

- `eligible_counts[42]`: slots where `tile_n_joker == "yes"`.
- `ineligible_counts[42]`: slots where `tile_n_joker == "no"`.
- `histogram[42] = eligible_counts + ineligible_counts` (existing use).

**Validation flow:**

1. Fast pass (MCTS / hints): use existing histogram-based deficiency.
2. Strict pass (Mahjong declaration):
   - Naturals must cover `ineligible_counts` deficits.
   - Jokers may cover only `eligible_counts` deficits.

This keeps O(42) per variation and preserves MCTS speed.

## Open Questions

- Do we want to embed `eligible_counts`/`ineligible_counts` into `unified_card2025.json`, or load them from the CSV at runtime for validation/UI?
- Should we extend the unified card schema to include the 14-slot display layout for variation visualization?

## Next Steps (Awaiting Direction)

1. Decide on data source for strict joker eligibility (CSV vs unified card extension).
2. Update card schema or loader accordingly.
3. Implement strict validation pass and tests.
4. Update UI pattern visualization if needed.
