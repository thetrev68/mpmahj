# US-058: Charleston Blind Pass Contract Realignment

## Status

- State: Completed
- Priority: Critical
- Batch: F
- Implementation Ready: Yes

## Problem

`US-049` and `ADR-0026` define blind pass as a receive-first model:

- ordinary pass-2 tiles auto-absorb into the rack before blind pass begins
- the rack stays server-authoritative and visually intact during blind-pass selection
- blind incoming candidates remain a separate staged group
- blind staged tiles are hidden because their source seat is hidden

The shipped code does not follow that contract.

### BP-1 — Core/Server Charleston Semantics Still Use Staging-First Everywhere

`mahjong_core` currently stages all Charleston outcomes into `IncomingTilesStaged` and keeps those
tiles in `incoming_tiles` across stage transitions. That means:

- `FirstAcross -> FirstLeft` does not auto-absorb into the rack
- `SecondAcross -> SecondRight` does not auto-absorb into the rack
- the player enters blind pass with the older "11 in rack + 3 staged incoming" model instead of the
  intended "full rack + 3 blind candidates" model

### BP-2 — Blind Incoming Visibility Contract Is Broken

The generated bindings and frontend expect blind-stage `IncomingTilesStaged.from` to be `null` so
the client can render those tiles face-down. The current core exchange calculation still records a
real source seat for every stage. This produces the exact inconsistent UI the user reported:

- badge says `BLIND`
- tile renders face-up

### BP-3 — Frontend Still Materializes Staged Blind Tiles Into the Rack

`CharlestonPhase` locally appends "absorbed" staged blind tiles onto the rendered rack and treats
them as part of `handTileInstances`. This recreates a second local rack owner and reintroduces the
same class of rack-count drift `US-043` was supposed to eliminate.

### BP-4 — Tests Are Guarding the Wrong Model

The current integration tests mostly inject synthetic `IncomingTilesStaged { from: null }` events
directly into blind stages and assert that clicking staged blind tiles moves them into the rack.
Those tests pass because they are verifying the obsolete frontend-only model, not the actual
core/server/client contract that should exist.

## Scope

**In scope:**

- Realign the core Charleston protocol so ordinary pre-blind passes auto-absorb into the hand and
  blind passes remain staged.
- Ensure blind-stage `IncomingTilesStaged` events use `from: null`.
- Remove rack inflation / local absorbed-tile ownership from the frontend Charleston phase.
- Keep the rack server-authoritative during blind-pass selection.
- Preserve the `US-049` reveal-on-click rule as a secondary blind-pass interaction, but implement it
  without creating extra local rack ownership.
- Replace synthetic blind-stage integration shortcuts with tests driven from real preceding-stage
  outcomes or server-faithful event helpers.
- Update fixtures and verification commands so story tests can actually be run from the intended
  working directory.

**Out of scope:**

- Courtesy-pass UX cleanup beyond what is required to preserve Charleston correctness.
- New right-rail content for Charleston or Setup; that is covered by a follow-up story.
- General gameplay hint behavior during Playing phase.
- Broader database persistence cleanup unrelated to the Charleston contract.

## Acceptance Criteria

- AC-1: `FirstAcross -> FirstLeft` auto-absorbs the three received tiles into the player hand via
  the normal `TilesReceived` path before blind-pass staging begins.
- AC-2: `SecondAcross -> SecondRight` auto-absorbs the three received tiles into the player hand via
  the normal `TilesReceived` path before blind-pass staging begins.
- AC-3: When a blind stage begins (`FirstLeft`, `SecondRight`), the rack count shown in the client
  matches the server-authoritative concealed hand count for that seat:
  - East: 14
  - non-East: 13
- AC-4: Blind-stage `IncomingTilesStaged` events carry `from: null`.
- AC-5: Blind staged tiles render face-down on initial render and remain face-down on hover.
- AC-6: Blind staged tiles use `BLIND` labeling and never use `PEEK`.
- AC-7: The frontend does not append locally absorbed blind tiles onto `gameState.your_hand` or a
  rack-local derived equivalent during Charleston.
- AC-8: The player can still complete a blind pass using any valid 3-tile composition:
  - 3 from rack
  - 3 from blind staging
  - mixed rack + blind staging totaling 3
- AC-9: Reveal-on-click remains illegal until at least 1 rack tile is already committed to outgoing
  staging.
- AC-10: When a blind staging tile is revealed/swapped after a rack tile is committed, the already
  committed outgoing rack tile remains committed and the rack-count invariant is preserved.
- AC-11: Blind-pass staging never shows a combined 6-tile state made from "3 just received" plus
  "3 blind candidates".
- AC-12: Reconnect/remount during blind staging restores the correct rack/staging split without
  duplicating tiles and without inflating the rack count.
- AC-13: Integration tests no longer rely on impossible synthetic blind-stage payloads as the only
  proof of correctness; at least one end-to-end path enters blind pass through the preceding pass
  transition.
- AC-14: Story verification commands reference test paths that Vitest can resolve from the intended
  working directory.

## Edge Cases

- EC-1: East blind-pass fixtures retain 14 visible rack tiles during selection; non-East fixtures
  retain 13.
- EC-2: Blind-stage `IncomingTilesStaged.from` being non-null becomes a failing test condition.
- EC-3: Newly received highlighting from the ordinary pre-blind pass survives the auto-sort step.
- EC-4: If the view remounts during the highlight window, the highlight may disappear, but rack
  count and blind-stage split must still restore correctly.
- EC-5: A player who chooses all 3 outgoing tiles from blind staging can still proceed without any
  local rack inflation.
- EC-6: Replay and reconnect paths remain deterministic after the protocol split between ordinary
  pre-blind receives and blind-stage staging.

## Primary Files (Expected)

- `crates/mahjong_core/src/table/handlers/charleston.rs`
- `crates/mahjong_core/tests/charleston_flow.rs`
- `crates/mahjong_core/tests/phase5_charleston_rules.rs`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/components/game/PlayerRack.tsx`
- `apps/client/src/lib/game-events/privateEventHandlers.ts`
- `apps/client/src/stores/gameUIStore.ts`
- `apps/client/src/features/game/CharlestonFirstLeft.integration.test.tsx`
- `apps/client/src/features/game/CharlestonSecondRight.integration.test.tsx`
- `apps/client/src/features/game/Charleston.integration.test.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.test.tsx`
- `apps/client/src/test/fixtures/game-states/charleston-first-left.json`
- `apps/client/src/test/fixtures/game-states/charleston-second-right.json`

## Notes for Implementer

### Contract correction

The authoritative split should be:

1. Ordinary pre-blind passes:
   - resolve to `TilesReceived`
   - mutate the hand
   - sort the hand
   - set newly received highlighting
2. Blind stages:
   - resolve to `IncomingTilesStaged`
   - do not mutate the hand
   - hide the source seat (`from: null`)
   - expose only the three blind candidates in staging

Do not ship another hybrid model where the backend still stages ordinary pre-blind receives and the
frontend tries to fake receive-first by manufacturing extra rack tiles.

### Frontend ownership rule

During Charleston, `gameState.your_hand` remains the sole rack owner. Blind staged tiles may affect
selection state and outgoing command composition, but they must not become a second rack source of
truth.

### Test repair requirement

The current tests are too trusting because they inject private events directly with the exact shape
the frontend wants. The repaired suite must prove at least one real blind-pass transition using:

- the ordinary preceding pass outcome
- the stage change
- the blind-stage staging event

If a synthetic helper remains for narrow component coverage, it must not be the only integration
proof of the flow.

### Verification command hygiene

The existing `US-049` verification commands mix repo-root paths with `apps/client` Vitest
conventions. Fix the command examples so they run as documented.

## Test Plan

- Rust tests:
  - prove ordinary pre-blind passes emit `TilesReceived`, not `IncomingTilesStaged`
  - prove blind stages emit `IncomingTilesStaged { from: null }`
  - prove reconnect/replay remains deterministic
- Client integration tests:
  - `FirstAcross -> FirstLeft` receive-first path
  - `SecondAcross -> SecondRight` receive-first path
  - all-rack / all-blind / mixed blind-pass compositions
  - remount/reconnect without rack inflation
- Component tests:
  - blind staged tile face-down behavior
  - reveal gating after first rack-tile commit
  - rack count invariants
- Verification-path tests:
  - at least one test must fail if blind-stage `from` is not null
  - at least one test must fail if the rack is computed as `server hand + local absorbed blind tiles`

## Verification Commands

```bash
cargo test -p mahjong_core --test charleston_flow
cargo test -p mahjong_core --test phase5_charleston_rules
cd apps/client
npx vitest run src/components/game/phases/CharlestonPhase.test.tsx
npx vitest run src/features/game/CharlestonFirstLeft.integration.test.tsx
npx vitest run src/features/game/CharlestonSecondRight.integration.test.tsx
npx vitest run src/features/game/Charleston.integration.test.tsx
npx tsc --noEmit
```

---

## Claude Implementation Summary

-crashed-

---

## Codex Validation Summary

### Findings

- High: CharlestonPhase.tsx:170 was still materializing locally kept blind tiles into handTileInstances, which broke the receive-first contract and violated AC-7. I removed that path so the rack stays server-authoritative and keeping a blind tile only reduces `forward_incoming_count`.
- Medium: the blind-pass tests were still asserting the obsolete “rack inflates when I click blind tiles” model. I corrected the coverage in [CharlestonFirstLeft.integration.test.tsx:78], [CharlestonSecondRight.integration.test.tsx:258], and [Charleston.integration.test.tsx:414] so they now fail if the rack count drifts during blind pass.
- Low: the story’s Rust verification commands were wrong and could report success while running 0 tests. I fixed them in [US-058-charleston-blind-pass-contract-realignment.md:204].

Core/server behavior already looked aligned. The problem was the frontend still carrying the old mental model.

### Verification

- `cargo test -p mahjong_core --test charleston_flow`
- `cargo test -p mahjong_core --test phase5_charleston_rules`
- `cd apps/client && npx vitest run` [src/components/game/phases/CharlestonPhase.test.tsx] [src/features/game/CharlestonFirstLeft.integration.test.tsx] [src/features/game/CharlestonSecondRight.integration.test.tsx] [src/features/game/Charleston.integration.test.tsx] [src/stores/gameUIStore.test.ts]
- `cd apps/client && npx tsc --noEmit`

All of those passed. I did not run the full repo-wide pre-commit pipeline.

8 files changed +58 -48

apps/client/src/components/game/phases/CharlestonPhase.test.tsx
apps/client/src/components/game/phases/CharlestonPhase.tsx
apps/client/src/features/game/Charleston.integration.test.tsx
apps/client/src/features/game/CharlestonFirstLeft.integration.test.tsx
apps/client/src/features/game/CharlestonSecondRight.integration.test.tsx
apps/client/src/stores/gameUIStore.test.ts
apps/client/src/stores/gameUIStore.ts
docs/implementation/frontend/user-stories/US-058-charleston-blind-pass-contract-realignment.md

---

## Claude Review Summary

### US-058 — Charleston Blind Pass Contract Realignment

**Overall**: ✅ Correctly implemented

- **AC-7 (No rack inflation)**: `CharlestonPhase.tsx` builds `handTileInstances` strictly from `gameState.your_hand`. Absorbed blind tiles track in store as `absorbedTileIndexes` and are filtered from the staging display — they are never appended to the hand. Clean.
- **AC-3 (Rack count = server count)**: Hand size derives entirely from `gameState.your_hand`. No local adjustments. East (14) / non-East (13) invariant holds by construction.
- **AC-4/5/6 (Blind tile contract)**: `hidden: storeStagedIncoming.from === null` drives face-down rendering. BLIND badge renders from the same guard. Correct.
- **AC-8 (Blind pass composition)**: All three modes (rack-only, blind-only, mixed) flow through `CommitCharlestonPass` with forward_incoming_count. Tested at multiple split ratios.
- **AC-13 (Integration tests via preceding stage)**: `CharlestonFirstLeft.integration.test.tsx` has an explicit test that feeds `TilesReceived` (FirstAcross outcome) → `CharlestonPhaseChanged: FirstLeft` → `IncomingTilesStaged: from: null`, and confirms no 6-tile combined state and no rack inflation. This satisfies the "at least one real end-to-end path" requirement.

No concerns identified for US-058.
