# Blind Pass + Universal Staging Redesign Plan

**Prepared:** 2026-02-26  
**Status:** Draft — revised after technical review  
**Scope:** Full staging-first interaction model for Charleston and regular gameplay
**Execution Stories:** `docs/planning/blind-pass-redesign-stories.md`

---

## 0) Product Decision (Locked)

This plan intentionally expands beyond blind pass only.

**Locked product direction:** every tile transition must pass through a visible player staging area before final commitment.

- Charleston: incoming and outgoing tiles are staged.
- Playing phase: drawn tile, called tile, discard candidate, and exchange candidates are staged.
- We are building from first principles (greenfield): compatibility with existing frontend behavior is not required.

---

## 1) Design Principles

1. **Server-authoritative outcomes**: final game state is committed only by server command handling.
2. **Staging-first UX**: tiles do not jump directly to rack/discard/exposure when user action is required.
3. **Explicit transfer semantics**: incoming transfer events must encode whether tiles are auto-applied or player-mediated.
4. **Deterministic replay/reconnect**: staging-relevant state must be reconstructable from events/snapshot.
5. **No hidden coupling**: private-event routing stays in private handlers; public handlers remain public-only.

---

## 2) Corrected Findings About Current Code

### 2.1 Event timing correction

Current server flow applies exchanges/incoming events before emitting `CharlestonPhaseChanged`.

- In `pass_tiles()`, `apply_completed_pass_outcome(...)` runs before `advance_charleston_stage(...)`.
- Therefore, incoming events are emitted before the next phase-change event.

Implication: client cannot assume “incoming receive event arrives after stage update.”

### 2.2 Private event routing correction

Private events are dispatched by:

- `apps/client/src/lib/game-events/privateEventHandlers.ts`

not by public handlers. Any new private event must be wired there.

### 2.3 Enum helper coverage correction

Adding any `PrivateEvent` variant requires updates in:

- `crates/mahjong_core/src/event/helpers.rs`
  - `target_player()`
  - `is_for_seat()`
  - `associated_player()`

### 2.4 Bot behavior correction

Bots are server-state driven in `bot_runner.rs` (table phase + charleston state), not client-event driven.

Implication: new private client event types do **not** inherently block bots, but bot command logic must still be updated if command semantics change.

---

## 3) First-Principles Target Architecture

## 3.1 Universal Staging Model

Introduce a single staging domain in the client:

```ts
interface StagedTile {
  id: string;
  tile: Tile;
  source: 'incoming_pass' | 'draw' | 'call' | 'rack_select' | 'exchange';
  state: 'hidden' | 'revealed' | 'selected' | 'locked';
  fromSeat?: Seat | null;
}
```

And two logical lanes in UI:

- `incomingLane`: tiles arriving to player and awaiting decision.
- `outgoingLane`: tiles selected by player for an action (pass/discard/call/exchange).

## 3.2 Charleston blind behavior

For `FirstLeft` and `SecondRight`:

- incoming pass tiles are staged face-down (`hidden`).
- player may reveal tile-by-tile.
- player may absorb revealed tiles into hand.
- remaining staged incoming tiles are forwarded blindly when pass commits.

## 3.3 Charleston non-blind behavior

For `FirstRight`, `FirstAcross`, `SecondLeft`, `SecondAcross`, and courtesy flow:

- incoming pass tiles still stage first (face-up unless house rule says otherwise).
- player explicitly confirms absorb/commit action.

This preserves one interaction pattern across all Charleston stages.

## 3.4 Playing phase behavior

- **Draw**: tile appears in staging first, then player chooses final action path.
- **Discard**: selected rack tile moves to outgoing staging; commit sends discard command.
- **Call resolution**: called tile appears in staging before meld commitment visuals.
- **Joker/blank exchanges**: candidate replacement tile stages before commit.

---

## 4) Server Protocol Redesign

## 4.1 Private events

Add:

```rust
IncomingTilesStaged {
    player: Seat,
    tiles: Vec<Tile>,
    from: Option<Seat>,
    context: IncomingContext,
}

enum IncomingContext {
    Charleston,
    Draw,
    CalledTile,
    Exchange,
}
```

For blind stages, event payload still carries true values in Phase 1 (client-trust reveal).

## 4.2 Charleston command semantics

Replace count-only blind forwarding intent with explicit staged decision payload:

```rust
CommitCharlestonPass {
    player: Seat,
    from_hand: Vec<Tile>,
    forward_incoming_count: u8,
}
```

`from_hand.len() + forward_incoming_count == 3` remains hard validation.

Phase 2 option (tile-precise keep/forward IDs) remains available but not required for Phase 1 if deterministic lane ordering is enforced.

## 4.3 Validation rules

Update charleston validation:

- stage must require pass.
- total outgoing count must be exactly 3.
- no jokers in outgoing hand tiles (existing rule kept).
- `forward_incoming_count <= incoming_tiles[player].len()`.
- reject duplicate submission per stage (`AlreadySubmitted`).

## 4.4 Replay and visibility

Update:

- `crates/mahjong_server/src/network/visibility.rs` for new private event routing.
- `crates/mahjong_core/src/event/helpers.rs` for helper exhaustiveness.
- `crates/mahjong_core/src/table/replay.rs` so replay reconstructs staged incoming behavior deterministically.

---

## 5) Frontend Redesign

## 5.1 Replace blind slider flow

Delete blind slider model (`BlindPassPanel`) and associated UI action/state (`SET_BLIND_PASS_COUNT`, hook fields).

## 5.2 StagingStrip becomes primary interaction surface

Create `StagingStrip.tsx` as always-on transfer surface with incoming/outgoing lanes.

Core props:

```ts
interface StagingStripProps {
  incomingTiles: StagedTile[];
  outgoingTiles: StagedTile[];
  incomingSlotCount: number;
  outgoingSlotCount: number;
  blindIncoming: boolean;
  incomingFromSeat: Seat | null;
  onFlipIncoming: (tileId: string) => void;
  onAbsorbIncoming: (tileId: string) => void;
  onRemoveOutgoing: (tileId: string) => void;
  onCommitPass: () => void;
  onCommitDiscard: () => void;
  onCommitCall: () => void;
  canCommitPass: boolean;
  canCommitDiscard: boolean;
  canCommitCall: boolean;
  isProcessing: boolean;
}
```

## 5.3 Event handling architecture

New private handler:

- `handleIncomingTilesStaged(...)` in `privateEventHandlers.ts`

Must:

- not mutate `your_hand` directly for staged contexts.
- emit UI actions to populate staging state.
- keep `SET_INCOMING_FROM_SEAT` animation support.

Private event router updated only in `handlePrivateEvent(...)`.

## 5.4 Charleston phase orchestration

`CharlestonPhase.tsx` owns staged incoming/outgoing state and commit logic.

When committing blind stage pass:

- compute `forward_incoming_count = remainingIncomingTiles.length`.
- compute `from_hand` from selected outgoing rack tiles.
- send `CommitCharlestonPass`.

## 5.5 Playing phase orchestration

`PlayingPhase.tsx` integrates same staging primitives for draw/discard/call/exchange pathways.

---

## 6) Spec Rewrite Plan

Update these specs before implementation starts:

1. `docs/implementation/frontend/VR-006-staging-strip.md`
   - rewrite to incoming+outgoing universal staging semantics.
2. `docs/implementation/frontend/VR-010-blind-slot-display.md`
   - rewrite to blind incoming (not blind outgoing).
3. `docs/implementation/frontend/VR-011-incoming-entry-animation.md`
   - keep animation class strategy; apply to incoming lane wrappers.
4. `docs/implementation/frontend/VR-012-drawn-tile-zone.md`
   - fold into universal staging or mark superseded by VR-006 rewrite.
5. `docs/implementation/frontend/VR-013-charleston-direction-banner.md`
   - clarify trigger remains outgoing commit (`TilesPassing`-equivalent public event).

---

## 7) Implementation Order (Greenfield)

## Step 1 — Rust protocol core

- Add `IncomingTilesStaged` + `IncomingContext`.
- Add/replace charleston commit command shape (`CommitCharlestonPass`).
- Emit staging events from charleston resolution path.
- Update validations and command errors.

## Step 2 — Rust integration points

- Update `event/helpers.rs` exhaustiveness.
- Update server visibility routing.
- Update replay application (`table/replay.rs`).
- Update tests for visibility and protocol serialization.

## Step 3 — TS bindings

- Regenerate bindings:

```bash
cd crates/mahjong_core
cargo test export_bindings
```

## Step 4 — Frontend event layer

- Add new private event handler.
- Remove blind-count UI action/state.
- Add staging UI actions (`SET_STAGED_INCOMING`, `FLIP_STAGED_TILE`, `ABSORB_STAGED_TILE`, `SET_STAGED_OUTGOING`, `CLEAR_STAGING`).

## Step 5 — UI components and phases

- Implement `StagingStrip.tsx` and tests.
- Remove `BlindPassPanel.tsx` and tests.
- Rework `CharlestonPhase.tsx` and `PlayingPhase.tsx` around staging-first flow.

## Step 6 — Bot compatibility

- Update bot command generation if command API changed.
- Ensure bot pass decisions for blind stages still satisfy validation and progress stage.

## Step 7 — Integration + QA

- Rewrite Charleston integration tests to staging-first assertions.
- Add playing-phase staging path tests.
- Run full verification gates.

---

## 8) Testing Strategy

## 8.1 Rust tests

- charleston handler tests: staged incoming emission, blind forwarding counts, IOU path.
- validation tests: new command invariants and error paths.
- visibility tests: new private event unicast target.
- replay tests: staged incoming reapplication correctness.

## 8.2 Frontend unit tests

- `StagingStrip.test.tsx`: hidden/revealed/absorb/remove/processing states.
- `privateEventHandlers.test.ts`: staged incoming handling and no direct hand mutation.
- phase tests: commit enablement logic from combined incoming/outgoing counts.

## 8.3 Frontend integration tests

- Charleston first and second blind passes (0/1/2/3 forwarded incoming).
- Charleston non-blind passes still staging-first.
- Draw -> stage -> discard path.
- Call resolution staging path.
- Reconnect snapshot restores staging-relevant UI correctly.

---

## 9) Risks and Mitigations

1. **Protocol churn risk**: command/event changes touch Rust + TS + tests.
   - Mitigation: land protocol and generated bindings first.

2. **Replay divergence risk**: staging event semantics can desync replay.
   - Mitigation: update replay tests in same PR as protocol changes.

3. **Large frontend cutover risk**: replacing ActionBar-centric pass/discard flow.
   - Mitigation: implement StagingStrip + phase adapters together; delete legacy flow fully.

4. **Bot stall risk after command changes**: AI command generation may submit old command shape.
   - Mitigation: block merge until bot runner integration tests pass in Charleston.

---

## 10) Explicitly Removed Legacy Behavior

- Blind slider pre-commit model.
- Automatic hand mutation on every `TilesReceived`-like private event.
- Mixed UX where some tile transitions bypass staging.

---

## 11) Affected Files (Revised)

### Rust

- `crates/mahjong_core/src/event/private_events.rs`
- `crates/mahjong_core/src/event/helpers.rs`
- `crates/mahjong_core/src/table/handlers/charleston.rs`
- `crates/mahjong_core/src/table/validation.rs`
- `crates/mahjong_core/src/table/replay.rs`
- `crates/mahjong_server/src/network/visibility.rs`
- `crates/mahjong_server/tests/visibility_tests.rs`

### Generated TS bindings

- `apps/client/src/types/bindings/generated/PrivateEvent.ts`
- `apps/client/src/types/bindings/generated/GameCommand.ts`
- any dependent generated type files

### Frontend

- `apps/client/src/lib/game-events/privateEventHandlers.ts`
- `apps/client/src/lib/game-events/types.ts`
- `apps/client/src/hooks/useCharlestonState.ts`
- `apps/client/src/components/game/StagingStrip.tsx` (new)
- `apps/client/src/components/game/StagingStrip.test.tsx` (new)
- `apps/client/src/components/game/BlindPassPanel.tsx` (delete)
- `apps/client/src/components/game/BlindPassPanel.test.tsx` (delete)
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/components/game/phases/PlayingPhase.tsx`

### Docs/specs

- `docs/implementation/frontend/VR-006-staging-strip.md`
- `docs/implementation/frontend/VR-010-blind-slot-display.md`
- `docs/implementation/frontend/VR-011-incoming-entry-animation.md`
- `docs/implementation/frontend/VR-012-drawn-tile-zone.md`
- `docs/implementation/frontend/VR-013-charleston-direction-banner.md`

---

## 12) Verification Commands

Run before staging:

```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
cargo clippy --all-targets --all-features
npx prettier --write .
npx tsc --noEmit
npm run check:all
```

For bindings:

```bash
cd crates/mahjong_core
cargo test export_bindings
```

---

## 13) Definition of Done

1. Blind pass works with per-tile reveal/absorb in first and second Charleston.
2. Non-blind Charleston passes still use staging-first interaction.
3. Playing-phase tile transitions use staging-first interaction.
4. Reconnect/replay remain deterministic and tested.
5. Legacy blind slider flow removed from code and tests.
