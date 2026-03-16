# US-067: Hint System Simplification -- Single Toggle, Full Payload

## Status

- State: Proposed
- Priority: Critical
- Batch: H
- Implementation Ready: Yes

## Problem

The hint system has a verbosity abstraction that no longer serves the product. Today:

- The `HintVerbosity` enum defines four levels: `Beginner`, `Intermediate`, `Expert`, `Disabled`.
- The client hard-codes all requests to `Intermediate` (`useHintSystem.ts:11`).
- The server uses verbosity to gate which fields are populated:
  - `best_patterns` is populated only at `Beginner` level.
  - `tile_scores` is populated only at `Intermediate` and above.
  - `utility_scores` is populated only at `Expert`.
- The UI settings surface is already a single "Use Hints" on/off toggle with no verbosity selector.

The result: the user sees one toggle, the client sends one hardcoded level, and the server returns a
partial payload that can never include both pattern guidance and tile scoring at the same time. The
verbosity system is invisible to the user yet silently prevents the UI from showing complete hint
content.

### Product decision

Verbosity is removed as a user-facing and request-level concept. The hint system uses a single
on/off toggle. When hints are on, the server returns **everything**: discard recommendations,
pattern guidance, tile scores, and Charleston pass recommendations. The UI renders all available
content. There is no tiered capability model.

## Scope

**In scope:**

- **Server**: Change `HintComposer::compose()` to always populate all hint fields (`best_patterns`,
  `recommended_discard`, `tile_scores`, `charleston_pass_recommendations`) regardless of the
  `verbosity` parameter value.
- **Server**: The `HintVerbosity` enum and `SetHintVerbosity` / `RequestHint` command signatures
  remain unchanged for backward compatibility. The server simply ignores the verbosity parameter
  for field-gating purposes. `Disabled` still means "do not send hints."
- **Frontend**: Remove the `ACTIVE_HINT_VERBOSITY` constant and any verbosity-level branching in
  `useHintSystem`. When hints are enabled, send any non-`Disabled` verbosity value (e.g.,
  `Intermediate`).
- **Frontend**: Remove any dead UI branches that condition on verbosity level (e.g., "show
  tile_scores only for Intermediate").
- **Frontend**: `HintSettingsSection` remains a single toggle -- no changes needed.
- **Frontend**: Update `HintPanel` to render all available fields from the payload without
  verbosity-conditional sections.
- Regenerate TS bindings if any Rust types change.
- Update tests to enforce the simplified contract end-to-end.

**Out of scope:**

- Removing the `HintVerbosity` type from the protocol entirely (kept for backward compatibility).
- New backend analysis algorithms or AI strategy changes.
- Charleston hint UX (covered by `US-059`).
- General rail layout or theme cleanup (covered by `US-063`).
- Adding the pattern rendering UI to HintPanel (covered by `US-064`).

## Acceptance Criteria

### Server

- AC-1: `HintComposer::compose()` populates `best_patterns` for all non-`Disabled` verbosity
  values, not just `Beginner`.
- AC-2: `HintComposer::compose()` populates `tile_scores` for all non-`Disabled` verbosity values,
  not just `Intermediate`/`Expert`.
- AC-3: `HintComposer::compose()` populates `recommended_discard` for all non-`Disabled` verbosity
  values.
- AC-4: `HintComposer::compose()` populates `charleston_pass_recommendations` during Charleston
  for all non-`Disabled` verbosity values.
- AC-5: `Disabled` verbosity still suppresses hint delivery entirely (no behavior change).
- AC-6: Existing Rust hint tests are updated to assert the combined payload.

### Frontend

- AC-7: `useHintSystem` no longer references or branches on a verbosity constant. The only
  distinction is enabled (`Intermediate` or any non-`Disabled` value) vs. disabled (`Disabled`).
- AC-8: `HintPanel` renders all available hint fields from the payload without verbosity-gated
  sections. If a field is empty or null, the panel handles it gracefully.
- AC-9: `HintSettingsSection` remains a single "Use Hints" toggle with no verbosity selector.
- AC-10: Canceling an in-flight hint request returns to idle state. This behavior is tested.
- AC-11: Tests fail if `best_patterns` is populated but the panel does not render it (relies on
  `US-064` pattern rendering being in place).

## Edge Cases

- EC-1: Historical view still blocks new requests while preserving any existing hint content.
- EC-2: Turning hints off mid-session clears hint content from the panel.
- EC-3: Timeout/error states do not leave the UI in a broken state.
- EC-4: The `SetHintVerbosity` command with any non-`Disabled` value produces the same full
  payload -- no value produces a degraded result.

## Primary Files (Expected)

Server:

- `crates/mahjong_server/src/hint/mod.rs` -- remove verbosity-based field gating in `compose()`
- `crates/mahjong_server/src/hint/` tests -- update expected payloads

Frontend:

- `apps/client/src/hooks/useHintSystem.ts` -- remove `ACTIVE_HINT_VERBOSITY`, simplify
  enabled/disabled logic
- `apps/client/src/components/game/HintPanel.tsx` -- remove verbosity-conditional rendering
- `apps/client/src/components/game/HintSettingsSection.tsx` -- confirm no changes needed
- `apps/client/src/hooks/useHintSystem.test.ts` -- simplified contract tests
- `apps/client/src/components/game/HintPanel.test.tsx` -- assert all fields rendered when present
- `apps/client/src/features/game/HintRightRail.integration.test.tsx` -- end-to-end hint flow

Bindings:

- `apps/client/src/types/bindings/generated/HintData.ts` -- update JSDoc comments if regenerated
  (remove "Beginner only" / "Expert only" annotations)
- `apps/client/src/types/bindings/generated/HintVerbosity.ts` -- no structural changes; type
  remains for protocol compatibility

## Notes for Implementer

### Server change is minimal

The key change in `HintComposer::compose()` is to remove the `match verbosity` branches that gate
field population. Currently the function runs different code paths per verbosity level. After this
change, it should:

1. Always run pattern analysis and populate `best_patterns`.
2. Always run discard analysis (GreedyAI or best available) and populate `recommended_discard` +
   `tile_scores`.
3. Always populate `charleston_pass_recommendations` when `charleston_stage` is `Some`.
4. Treat `Disabled` as the only special case (return empty/no-op hint).

The choice of AI strategy (BasicBot vs. Greedy vs. MCTS) for the discard engine is an
implementation detail. Use the best available (Greedy or MCTS) since there is no longer a reason to
use a weaker engine for "lower" verbosity.

### Frontend change is also minimal

`useHintSystem.ts` already sends `Disabled` when hints are off. When hints are on, it can continue
sending `Intermediate` (or any non-`Disabled` value) -- the server will return the full payload
regardless. The main cleanup is removing the `ACTIVE_HINT_VERBOSITY` constant and any
verbosity-conditional logic.

### Relationship to US-064

`US-064` adds the pattern rendering section to `HintPanel`. This story ensures the data actually
arrives in the payload. If both stories are implemented, the end-to-end path is complete. If
`US-064` lands first, the pattern section will be coded but `best_patterns` will be empty until
this story's server change ships. If this story lands first, the data will arrive but the panel
won't render it until `US-064` adds the UI. Either order works.

### Binding regeneration

If `HintData` Rust doc-comments change (removing "Beginner only" annotations), regenerate TS
bindings:

```bash
cd crates/mahjong_core
cargo test export_bindings
```

The structural shape of `HintData` does not change -- only field population behavior and comments.

## Test Plan

- Rust hint tests:
  - `compose()` with `Intermediate` verbosity returns non-empty `best_patterns`
  - `compose()` with `Beginner` verbosity returns non-empty `tile_scores`
  - `compose()` with `Disabled` verbosity returns empty/no hint
  - Charleston stage + any non-Disabled verbosity returns `charleston_pass_recommendations`
- Frontend hook tests:
  - enabled hint sends non-Disabled verbosity
  - disabled hint sends Disabled verbosity
  - cancel returns to idle
- Frontend panel tests:
  - payload with all fields present renders all sections
  - payload with some fields empty gracefully omits those sections
- Integration tests:
  - request -> response -> full payload rendered

## Verification Commands

```bash
cargo test -p mahjong_server hint
cd apps/client
npx vitest run src/hooks/useHintSystem.test.ts
npx vitest run src/components/game/HintPanel.test.tsx
npx vitest run src/features/game/HintRightRail.integration.test.tsx
npx tsc --noEmit
```
