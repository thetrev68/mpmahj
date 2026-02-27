# Blind Pass + Universal Staging Implementation Stories

**Prepared:** 2026-02-26  
**Source Plan:** `docs/planning/blind-pass-redesign-plan.md`  
**Purpose:** execution tracker for staging-first redesign delivery

---

## Status Overview

1. US-STAGE-001: implemented
2. US-STAGE-002: implemented
3. US-STAGE-003: implemented
4. US-STAGE-004: merged into VR stories
5. US-STAGE-005: merged into VR stories
6. US-STAGE-006: merged into VR stories
7. US-STAGE-007: merged into VR stories
8. US-STAGE-008: merged into VR stories

---

## Active US Stories (Backend + Contract)

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

## Merged into VR Stories

US-STAGE-004 through US-STAGE-008 are now tracked in VR documents to keep frontend behavior/spec and implementation in one place.

| Former US Story                                      | New Canonical VR Story                                                                                                                                                                               | Merge Notes                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| US-STAGE-004: Core `StagingStrip` component          | `docs/implementation/frontend/VR-006-staging-strip.md`                                                                                                                                               | Incoming/outgoing lanes, shared action strip, staging-first interaction shell  |
| US-STAGE-005: Charleston phase staging-first cutover | `docs/implementation/frontend/VR-006-staging-strip.md`, `docs/implementation/frontend/VR-010-blind-slot-display.md`                                                                                  | Charleston orchestration + blind pass UX moved under VR acceptance criteria    |
| US-STAGE-006: Playing phase staging-first cutover    | `docs/implementation/frontend/VR-012-playing-phase-staging-flow.md`                                                                                                                                  | Draw/discard/call/exchange now defined as staging-first playing behavior       |
| US-STAGE-007: Blind pass UX + rules hardening        | `docs/implementation/frontend/VR-010-blind-slot-display.md`, `docs/implementation/frontend/VR-011-incoming-entry-animation.md`, `docs/implementation/frontend/VR-013-charleston-direction-banner.md` | Blind-facing behavior, animation semantics, commit-time direction signal       |
| US-STAGE-008: Bot + reconnect + regression hardening | `docs/implementation/frontend/VR-013-charleston-direction-banner.md` (cross-cutting), plus referenced integration checklists                                                                         | Cross-cutting release/hardening gates attached to VR implementation completion |

Implementation policy:

- Backend protocol remains tracked in US stories (001-003).
- Frontend behavior and user-facing acceptance criteria are tracked in VR stories.
- Any new frontend scope should be added directly to the relevant VR file, not as new US-STAGE entries.

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
