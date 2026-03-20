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

Verbosity is removed entirely. The hint system uses a single on/off toggle and the protocol should
model that directly. When hints are on, the server returns **everything**: discard
recommendations, pattern guidance, tile scores, and Charleston pass recommendations. The UI renders
all available content. There is no tiered capability model and no protocol-level verbosity enum.

## Scope

**In scope:**

- **Server**: Change `HintComposer::compose()` to always populate all hint fields (`best_patterns`,
  `recommended_discard`, `tile_scores`, `charleston_pass_recommendations`) whenever hinting is
  enabled.
- **Protocol**: Remove `HintVerbosity` from Rust and generated TypeScript bindings.
- **Protocol**: Replace `SetHintVerbosity` / verbosity-bearing `RequestHint` contracts with a
  simple enabled/disabled hint capability contract.
- **Frontend**: Remove the `ACTIVE_HINT_VERBOSITY` constant and any verbosity-level branching in
  `useHintSystem`. When hints are enabled, issue the simplified request shape with no verbosity
  value.
- **Frontend**: Remove any dead UI branches that condition on verbosity level (e.g., "show
  tile_scores only for Intermediate").
- **Frontend**: `HintSettingsSection` remains a single toggle -- no changes needed.
- **Frontend**: Update `HintPanel` to render all available fields from the payload without
  verbosity-conditional sections.
- Regenerate TS bindings if any Rust types change.
- Update tests to enforce the simplified contract end-to-end.

**Out of scope:**

- New backend analysis algorithms or AI strategy changes.
- Charleston hint UX (covered by `US-059`).
- General rail layout or theme cleanup (covered by `US-063`).
- Adding the pattern rendering UI to HintPanel (covered by `US-064`).

## Acceptance Criteria

### Server

- AC-1: `HintComposer::compose()` populates `best_patterns` whenever hints are enabled.
- AC-2: `HintComposer::compose()` populates `tile_scores` whenever hints are enabled.
- AC-3: `HintComposer::compose()` populates `recommended_discard` whenever hints are enabled.
- AC-4: `HintComposer::compose()` populates `charleston_pass_recommendations` during Charleston
  whenever hints are enabled.
- AC-5: The protocol no longer exposes `HintVerbosity`, `SetHintVerbosity`, or any verbosity-bearing
  hint request contract.
- AC-6: Hint-disabled state still suppresses hint delivery.
- AC-7: Existing Rust hint tests are updated to assert the combined payload and the new protocol
  shape.

### Frontend

- AC-8: `useHintSystem` no longer references or branches on a verbosity constant and no longer sends
  a verbosity value in hint-related commands.
- AC-9: `HintPanel` renders all available hint fields from the payload without verbosity-gated
  sections. If a field is empty or null, the panel handles it gracefully.
- AC-10: `HintSettingsSection` remains a single "Use Hints" toggle with no verbosity selector.
- AC-11: Canceling an in-flight hint request returns to idle state. This behavior is tested.
- AC-12: Tests fail if `best_patterns` is populated but the panel does not render it (relies on
  `US-064` pattern rendering being in place).

## Edge Cases

- EC-1: Historical view still blocks new requests while preserving any existing hint content.
- EC-2: Turning hints off mid-session clears hint content from the panel.
- EC-3: Timeout/error states do not leave the UI in a broken state.
- EC-4: Reconnect/remount flows continue to respect the simplified hint-enabled state without a
  separate verbosity value to reconcile.

## Primary Files (Expected)

Server:

- `crates/mahjong_core/src/command.rs` -- remove `HintVerbosity` from command definitions
- `crates/mahjong_server/src/hint/mod.rs` -- remove verbosity-based field gating in `compose()`
- `crates/mahjong_server/src/hint/` tests -- update expected payloads

Frontend:

- `apps/client/src/hooks/useHintSystem.ts` -- remove `ACTIVE_HINT_VERBOSITY`, simplify
  enabled/disabled logic and request shape
- `apps/client/src/components/game/HintPanel.tsx` -- remove verbosity-conditional rendering
- `apps/client/src/components/game/HintSettingsSection.tsx` -- confirm no changes needed
- `apps/client/src/hooks/useHintSystem.test.ts` -- simplified contract tests
- `apps/client/src/components/game/HintPanel.test.tsx` -- assert all fields rendered when present
- `apps/client/src/features/game/HintRightRail.integration.test.tsx` -- end-to-end hint flow

Bindings:

- `apps/client/src/types/bindings/generated/HintData.ts` -- update JSDoc comments if regenerated
- `apps/client/src/types/bindings/generated/` -- remove generated `HintVerbosity` output and any
  related protocol bindings

## Notes for Implementer

### Server and protocol change

The key behavior change in `HintComposer::compose()` is to remove field gating and always populate
the full hint payload when hinting is enabled. After this change, it should:

1. Always run pattern analysis and populate `best_patterns`.
2. Always run discard analysis (GreedyAI or best available) and populate `recommended_discard` +
   `tile_scores`.
3. Always populate `charleston_pass_recommendations` when `charleston_stage` is `Some`.
4. Treat hint-disabled state as the only special case (return empty/no-op hint).

The protocol should then be simplified to match the product:

1. Remove `HintVerbosity`.
2. Remove `SetHintVerbosity`.
3. Replace verbosity-bearing request paths with a direct hint-enabled contract.

The choice of AI strategy (BasicBot vs. Greedy vs. MCTS) for the discard engine is an
implementation detail. Use the best available (Greedy or MCTS) since there is no longer a reason to
use a weaker engine for tiered verbosity.

### Frontend change is also minimal

`useHintSystem.ts` should model hints as enabled vs. disabled only. The main cleanup is removing
the `ACTIVE_HINT_VERBOSITY` constant, removing verbosity-bearing command payloads, and deleting any
verbosity-conditional logic.

### Relationship to US-064

`US-064` adds the pattern rendering section to `HintPanel`. This story ensures the data actually
arrives in the payload. If both stories are implemented, the end-to-end path is complete. If
`US-064` lands first, the pattern section will be coded but `best_patterns` will be empty until
this story's server change ships. If this story lands first, the data will arrive but the panel
won't render it until `US-064` adds the UI. Either order works.

### Binding regeneration

After removing `HintVerbosity` and updating the command/types, regenerate TS bindings:

```bash
cd crates/mahjong_core
cargo test export_bindings
```

The hint payload shape should remain aligned with the simplified protocol after regeneration.

## Test Plan

- Rust hint tests:
  - enabled hint composition returns non-empty `best_patterns`
  - enabled hint composition returns non-empty `tile_scores`
  - hint-disabled state returns empty/no hint
  - Charleston stage + hints enabled returns `charleston_pass_recommendations`
  - removed verbosity-bearing commands/types no longer compile
- Frontend hook tests:
  - enabled hint sends the simplified request with no verbosity field
  - disabled hint suppresses requests or sends the new disabled contract as designed
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

---

## Implementation Summary

Implemented the hint contract simplification end-to-end by removing protocol-level verbosity from
Rust commands, server handling, and generated TypeScript bindings. `GameCommand::RequestHint` now
only carries `player`, `SetHintVerbosity` was replaced with `SetHintEnabled { player, enabled }`,
and the generated client bindings were regenerated to match. The stale generated
`HintVerbosity.ts` binding was removed.

Updated server hint composition so enabled hints always return the full payload. `HintComposer`
now always includes pattern guidance, discard reasoning, tile scores, utility scores, and
Charleston pass recommendations when applicable, while `AnalysisManager` tracks only whether hint
delivery is enabled per seat. Both the background analysis worker and direct hint-request path now
respect that enabled/disabled capability.

Updated the frontend hint flow to model hints as a simple on/off capability. `useHintSystem`
removes `ACTIVE_HINT_VERBOSITY`, syncs `SetHintEnabled` on mount and setting changes, and sends
`RequestHint` with no verbosity field. Existing hint panel rendering already supported the richer
payload from `US-064`, so the main frontend test changes were in the hook and integration flow.

Verification run on 2026-03-18:

- `cd crates/mahjong_core && cargo test export_bindings`
- `cargo test -p mahjong_server hint`
- `cd apps/client && npx vitest run src/hooks/useHintSystem.test.ts`
- `cd apps/client && npx vitest run src/components/game/HintPanel.test.tsx`
- `cd apps/client && npx vitest run src/features/game/HintRightRail.integration.test.tsx`
- `cd apps/client && npx tsc --noEmit`

Notes:

- `cargo fmt --all` was run successfully.
- `npx prettier --write ...` could not be run because this workspace does not have Prettier
  installed locally, and sandboxed `npx` attempted a blocked registry fetch.
