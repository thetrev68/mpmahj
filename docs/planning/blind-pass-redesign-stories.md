# Blind Pass + Universal Staging Implementation Stories

**Prepared:** 2026-02-26  
**Source Plan:** `docs/planning/blind-pass-redesign-plan.md`  
**Purpose:** execution-ordered, implementation-ready story slices for greenfield delivery

---

## Story Order (Critical Path)

1. US-STAGE-001: Server protocol foundation
2. US-STAGE-002: Server integration surfaces (visibility/replay/helpers)
3. US-STAGE-003: TS bindings + frontend event contract
4. US-STAGE-004: Core `StagingStrip` component
5. US-STAGE-005: Charleston phase staging-first cutover
6. US-STAGE-006: Playing phase staging-first cutover
7. US-STAGE-007: Blind pass UX and rules hardening
8. US-STAGE-008: Bot + reconnect + regression hardening

---

## US-STAGE-001: Server Protocol Foundation

**Goal:** introduce staging-aware server contract for incoming tiles and Charleston pass commit.

In scope:

- Add private event `IncomingTilesStaged { player, tiles, from, context }`.
- Add `IncomingContext` enum (`Charleston`, `Draw`, `CalledTile`, `Exchange`).
- Add/replace Charleston commit command (`CommitCharlestonPass` shape from plan).
- Emit staging event from Charleston pass resolution path.
- Update command validation for new pass payload invariants.

Acceptance criteria:

- AC-1: protocol compiles and serializes with new event and command types.
- AC-2: `from_hand + forward_incoming_count == 3` is enforced.
- AC-3: blind stages still support 0-3 forwarded incoming tiles.
- AC-4: non-blind stages continue pass flow with staging semantics.

Edge cases:

- EC-1: invalid `forward_incoming_count` rejected when incoming is insufficient.
- EC-2: duplicate pass submissions rejected.
- EC-3: joker pass prohibition still enforced.

Primary files:

- `crates/mahjong_core/src/command.rs`
- `crates/mahjong_core/src/table/handlers/charleston.rs`
- `crates/mahjong_core/src/table/validation.rs`
- `crates/mahjong_core/src/event/private_events.rs`

Tests:

- Rust unit tests for validation and pass resolution.

---

## US-STAGE-002: Server Integration Surfaces

**Goal:** keep event routing, helper logic, and replay deterministic with the new protocol.

In scope:

- Update private-event routing in server visibility.
- Update `Event` helper exhaustiveness for new private event.
- Update replay application path for staged incoming semantics.

Acceptance criteria:

- AC-1: new private event unicast target is correct.
- AC-2: helper methods compile without uncovered enum branches.
- AC-3: replay reconstructs expected hand/staging outcomes after Charleston transitions.

Edge cases:

- EC-1: courtesy pair-private routing unaffected.
- EC-2: replay remains deterministic through blind + IOU sequences.

Primary files:

- `crates/mahjong_server/src/network/visibility.rs`
- `crates/mahjong_server/tests/visibility_tests.rs`
- `crates/mahjong_core/src/event/helpers.rs`
- `crates/mahjong_core/src/table/replay.rs`

Tests:

- visibility tests + replay tests.

---

## US-STAGE-003: TS Bindings + Frontend Event Contract

**Goal:** expose protocol updates to frontend and establish staging UI actions.

In scope:

- Regenerate bindings.
- Add private handler `handleIncomingTilesStaged(...)`.
- Add staging UI actions (`SET_STAGED_INCOMING`, `FLIP_STAGED_TILE`, `ABSORB_STAGED_TILE`, `SET_STAGED_OUTGOING`, `CLEAR_STAGING`).
- Remove legacy blind-count action/state contract (`SET_BLIND_PASS_COUNT`).

Acceptance criteria:

- AC-1: bindings include new command/event types.
- AC-2: private event router dispatches `IncomingTilesStaged` through private handlers only.
- AC-3: incoming staging event does not directly mutate `your_hand`.

Edge cases:

- EC-1: action bus handles null `from` seat.
- EC-2: existing private events (`TilesPassed`, courtesy events) remain functional.

Primary files:

- `apps/client/src/types/bindings/generated/*`
- `apps/client/src/lib/game-events/privateEventHandlers.ts`
- `apps/client/src/lib/game-events/types.ts`

Tests:

- `apps/client/src/lib/game-events/privateEventHandlers.test.ts`

---

## US-STAGE-004: Core StagingStrip Component

**Goal:** build always-on incoming/outgoing staging surface.

In scope:

- Create `StagingStrip.tsx` and `StagingStrip.test.tsx`.
- Support two lanes: incoming and outgoing.
- Support hidden/revealed incoming tile states.
- Support action commit buttons (pass/discard/call) with processing lock behavior.

Acceptance criteria:

- AC-1: incoming/outgoing slot counts render correctly.
- AC-2: blind incoming tiles render face-down by default, can be flipped/revealed.
- AC-3: revealed incoming tiles can be absorbed.
- AC-4: outgoing tiles removable before commit.
- AC-5: commit buttons honor `canCommit*` and `isProcessing`.

Edge cases:

- EC-1: no incoming tiles with reserved incoming slot placeholders.
- EC-2: rapid flip/absorb interactions remain stable and idempotent.

Primary files:

- `apps/client/src/components/game/StagingStrip.tsx` (new)
- `apps/client/src/components/game/StagingStrip.test.tsx` (new)

---

## US-STAGE-005: Charleston Phase Staging-First Cutover

**Goal:** replace slider-era Charleston UX with staging-first pass flow.

In scope:

- Remove `BlindPassPanel` usage.
- Rework `CharlestonPhase.tsx` to own staged incoming/outgoing flow.
- Pass commit uses staging-derived payload (`from_hand`, `forward_incoming_count`).
- Update `useCharlestonState` to remove blind-count state.

Acceptance criteria:

- AC-1: blind and non-blind Charleston stages both use staging.
- AC-2: pass commit only enabled when staged outgoing total is valid.
- AC-3: first and second blind stages support selective absorb + blind forward.
- AC-4: IOU scenario still triggers when all players forward all three.

Edge cases:

- EC-1: stage transition clears staging safely.
- EC-2: command failure resets submission lock and preserves recoverability.

Primary files:

- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/hooks/useCharlestonState.ts`
- `apps/client/src/components/game/BlindPassPanel.tsx` (delete)
- `apps/client/src/components/game/BlindPassPanel.test.tsx` (delete)

Tests:

- Charleston phase unit/integration suites.

---

## US-STAGE-006: Playing Phase Staging-First Cutover

**Goal:** enforce staging for draw/discard/call/exchange gameplay transitions.

In scope:

- Integrate `StagingStrip` into `PlayingPhase.tsx`.
- Route draw to incoming staging before final user action.
- Route discard candidate to outgoing staging before commit.
- Route call/exchange transitions through staging visuals.

Acceptance criteria:

- AC-1: draw tile visibly stages before final action.
- AC-2: discard command comes from staged outgoing tile selection.
- AC-3: call/exchange staging visuals align with committed server actions.

Edge cases:

- EC-1: call window interruptions do not leave stale staged tiles.
- EC-2: processing lock prevents double-commit.

Primary files:

- `apps/client/src/components/game/phases/PlayingPhase.tsx`
- phase-adjacent components as needed

Tests:

- playing-phase integration tests for draw/discard/call/exchange.

---

## US-STAGE-007: Blind Pass UX + Rules Hardening

**Goal:** finalize blind-stage interaction semantics and documentation.

In scope:

- Ensure blind badges, reveal behavior, and absorb behavior match finalized UX.
- Verify deterministic mapping between staged incoming order and forwarded count semantics.
- Update/rewrite VR docs to match implementation reality.

Acceptance criteria:

- AC-1: blind incoming visual language is consistent in both blind stages.
- AC-2: reveal/absorb actions map correctly to committed pass payload.
- AC-3: VR-006/010/011/012/013 reflect implemented behavior.

Edge cases:

- EC-1: all-blind deadlock remains valid and tested.
- EC-2: mixed absorbed/forwarded sets behave identically across FirstLeft and SecondRight.

Primary files:

- `docs/implementation/frontend/VR-006-staging-strip.md`
- `docs/implementation/frontend/VR-010-blind-slot-display.md`
- `docs/implementation/frontend/VR-011-incoming-entry-animation.md`
- `docs/implementation/frontend/VR-012-drawn-tile-zone.md`
- `docs/implementation/frontend/VR-013-charleston-direction-banner.md`

---

## US-STAGE-008: Bot + Reconnect + Regression Hardening

**Goal:** ensure full-system reliability with new staging-first protocol.

In scope:

- Update bot command generation for any changed Charleston command contract.
- Verify reconnect/snapshot behavior with staging-aware transitions.
- Run full monorepo validation gate and targeted manual scenarios.

Acceptance criteria:

- AC-1: bots progress through Charleston without hangs.
- AC-2: reconnect during staging-sensitive phases restores consistent state.
- AC-3: full validation pipeline passes.

Edge cases:

- EC-1: bot blind decisions remain valid under new validation rules.
- EC-2: reconnect during blind staging does not duplicate or lose tiles.

Primary files:

- `crates/mahjong_server/src/network/bot_runner.rs`
- `crates/mahjong_core/src/table/bot.rs` (if touched)
- reconnect/snapshot handling paths

Tests:

- bot integration tests + reconnect integration tests.

---

## Verification Gate (Per Story + Final)

```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
cargo clippy --all-targets --all-features
npx prettier --write .
npx tsc --noEmit
npm run check:all
```

Bindings refresh (when Rust types change):

```bash
cd crates/mahjong_core
cargo test export_bindings
```
