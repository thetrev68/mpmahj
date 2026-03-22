# US-081: Charleston Hint Panel Tile-First Pattern Presentation

## Status

- State: Blocked
- Priority: High
- Batch: L
- Implementation Ready: No

## Problem

The Charleston `HintPanel` still exposes implementation-oriented score sections and text-only
pattern summaries. That does not match the intended product direction. The panel should lead with
actual tile visuals for recommended passes and pattern targets, while hiding raw `tile_scores` and
`utility_scores` from the player-facing UI.

Today, however, the generated `PatternSummary` binding does not include the tile sequence or
exposed/concealed metadata needed for the planned pattern cards. That makes the recommended-pass
portion buildable now, but blocks the full pattern-card deliverable.

## Scope

**In scope:**

- Replace text-only `Recommended Pass` content with actual tile visuals.
- Render `Patterns to Play For` using super-small but readable tiles in the correct sequence.
- Each pattern entry should include:
  - tile sequence
  - point value
  - key identifier
  - exposed/concealed marker (`X` or `C`)
  - distance
  - win chance
- Remove `tile_scores` and `utility_scores` from the player-facing hint panel.
- If needed for temporary debugging, move those values to console/debug output instead of visible
  UI.
- Extend the backend/frontend hint contract so `PatternSummary` includes:
  - ordered pattern tile sequence
  - exposed/concealed marker
  - any additional metadata needed to render the compact pattern card faithfully

**Out of scope:**

- Fixing backend AI engine quality.
- Rewriting general hint-request flow.
- Full playing-phase hint redesign beyond what is shared by the Charleston panel.

## Acceptance Criteria

- AC-1: `Recommended Pass` renders tile visuals instead of a text-only tile-name list.
- AC-2: `PatternSummary` (or replacement payload) is extended at the Rust binding source and
  regenerated into TypeScript so the frontend receives ordered pattern tile sequences and
  exposed/concealed metadata.
- AC-3: `Patterns to Play For` renders compact tile sequences in correct order.
- AC-4: Each visible pattern entry includes point value, key, exposed/concealed marker, distance,
  and win chance.
- AC-5: The tile visuals are small but still readable.
- AC-6: `tile_scores` and `utility_scores` no longer appear in the player-facing hint panel.
- AC-7: The resulting panel hierarchy clearly favors recommendation and pattern targets over
  technical internals.

## Edge Cases

- EC-1: Duplicate pattern names must still remain distinguishable when key identifiers are shown.
- EC-2: Charleston hints with no recommended pass or no best-pattern payload must degrade
  gracefully.

## Dependency

Blocked on a hint-payload expansion. Current generated `PatternSummary` only exposes:

- `pattern_id`
- `variation_id`
- `pattern_name`
- `probability`
- `score`
- `distance`

The frontend cannot render tile-first pattern cards until the payload includes ordered pattern
tiles and the exposed/concealed marker.

## Primary Files (Expected)

- `crates/mahjong_core/src/hint.rs`
- `crates/mahjong_server/src/hint/mod.rs`
- `apps/client/src/components/game/HintPanel.tsx`
- `apps/client/src/components/game/Tile.tsx`
- `apps/client/src/components/game/TileImage.tsx`
- `apps/client/src/types/bindings/generated/PatternSummary.ts`
- `apps/client/src/components/game/HintPanel.test.tsx`

## Notes for Implementer

Do not reintroduce long technical score lists in smaller text just to preserve the old content.
This story is explicitly about removing those from player-facing UI.

Prefer compact tile strips over verbose text labels. The point is to make the hint panel feel like
mahjong UI, not a debug report.

The Rust-side payload contract must be updated first, then bindings regenerated before frontend
implementation can satisfy the core pattern-card acceptance criteria.

## Test Plan

- Add or update Rust-side tests for the new hint payload shape as needed.
- Update `HintPanel` tests for tile-based recommendation rendering.
- Add assertions for removed score blocks.
- Add pattern-card assertions for point value, key, exposure marker, distance, and win chance.

## Verification Commands

```bash
cd crates/mahjong_core
cargo test export_bindings
cd ../..
npx vitest run apps/client/src/components/game/HintPanel.test.tsx apps/client/src/components/game/RightRailHintSection.test.tsx
npx tsc --noEmit
```
