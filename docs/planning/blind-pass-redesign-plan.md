# Blind Pass Redesign Plan

**Prepared:** 2026-02-25
**Status:** Draft — awaiting review before implementation
**Scope:** Charleston blind pass stages (FirstLeft, SecondRight)

---

## Background

During the Charleston phase, two passes use a "blind steal" mechanic: **FirstLeft** and **SecondRight**.
The NMJL rules state:

> "If you find you cannot spare any of the tiles in your hand, you may 'steal' one, two or all three
> tiles that are being passed to you and pass them to the player on your left, without looking at them.
> This is called a 'Blind Pass.'"

The physical flow is clear: tiles arrive from your right (or left) neighbor. You pick them up
face-down. You choose whether to look at each one. Any tile you pass on without looking is a
"blind steal."

---

## What Is Wrong Today

### The Current Protocol

The `PassTiles` command carries a `blind_pass_count: Option<u8>` field. The `BlindPassPanel`
component renders a slider that lets the player set this count **before** the incoming tiles from the
previous pass have ever been shown to them. The sequence is:

1. Stage advances to `FirstLeft` / `SecondRight`.
2. Server sends `TilesReceived` (private) with the three incoming tiles in plaintext.
3. The frontend **immediately adds those tiles to `your_hand`** (see `handleTilesReceived` in
   `privateEventHandlers.ts`).
4. `BlindPassPanel` appears, showing a slider: "Forward N incoming tiles without looking."
5. Player sets N, selects 3 − N tiles from their now-expanded hand, and submits.

Problems with this flow:

- The player never sees the incoming tiles face-down. They already know what they are (they're in
  the rack, possibly highlighted).
- The slider forces a pre-commitment before any tile is revealed — the opposite of the physical
  experience.
- The "blind" quality is entirely cosmetic fiction; no enforcement happens.
- The staging area is bypassed entirely. Incoming tiles go straight to the rack.

### What the Rules Actually Require

1. The incoming tiles arrive **before** the player commits their outgoing selection.
2. Those tiles should be visible but **face-down** in a staging area.
3. The player may flip tiles one at a time to reveal them.
4. A revealed tile can be kept (absorbed into the rack) or left in staging to be forwarded.
5. Any tile still face-down at pass time is forwarded "without having been looked at."
6. The player may combine blind-forwarded incoming tiles with tiles from the rack. Total forwarded
   must be exactly 3.
7. Once exactly 3 tiles are staged for forwarding, PASS enables.

---

## Finding: The Server Is Mostly Correct Already

### Current server timing (confirmed by reading the Rust source)

After `FirstAcross` resolves, the server:

1. Stores the three incoming tiles for each player in `CharlestonState.incoming_tiles`.
2. **Immediately** fires `PrivateEvent::TilesReceived { player, tiles, from: Some(seat) }`.
3. Advances the stage to `FirstLeft` via `CharlestonPhaseChanged`.

So the private `TilesReceived` event already arrives at the **correct moment** — when the stage is
`FirstLeft` — carrying actual tile values. The problem is entirely in how the **frontend handles
that event**: it adds tiles to the hand rather than staging them face-down.

The server-side `incoming_tiles` map already serves as the authoritative record of what the player
is receiving. The `blind_pass_count` drain from `incoming_tiles` in `resolve_blind_pass()` is
structurally sound.

---

## 1. Server Protocol Changes

### 1.1 New Event: `BlindIncomingStaged`

The existing `TilesReceived` event is ambiguous: it fires both for normal receive (add to hand) and
for blind-stage delivery (show in staging). Rather than adding a discriminator flag to
`TilesReceived`, introduce a dedicated private event:

```rust
// crates/mahjong_core/src/event/private_events.rs  (add)
BlindIncomingStaged {
    /// Seat receiving the tiles for blind staging.
    player: Seat,
    /// The three incoming tiles (actual values).
    tiles: Vec<Tile>,
    /// Originating seat (always Some for blind stages; included for animation).
    from: Option<Seat>,
},
```

**When it fires**: Replace the `TilesReceived` event emitted inside
`stage_passes_to_incoming_tiles()` — but ONLY when the **resulting** stage is `FirstLeft` or
`SecondRight`. For all other stages, continue emitting `TilesReceived` as today.

The caller (`resolve_pass_for_stage`) already knows the next stage, so this condition is
straightforward to express.

**Visibility rule** (server): Like `TilesReceived`, deliver to the receiving player only (unicast).

**Tile values**: Send the real tile values. See §1.5 for a discussion of server-side value hiding;
the Phase 1 implementation uses a client-trust model.

### 1.2 Modified Command: `PassTiles` for Blind Stages

The current `PassTiles` command for blind stages:

```rust
PassTiles { player, tiles: Vec<Tile>, blind_pass_count: Option<u8> }
// tiles.len() + blind_pass_count.unwrap_or(0) == 3
```

The problem: `blind_pass_count` is a count, and the server drains the **first N** tiles from
`incoming_tiles` in arrival order. This means the player cannot choose **which** specific incoming
tiles to absorb vs. forward — only **how many**.

For the new UX (where the player reveals individual tiles and selects which to absorb), the
count-based model is acceptable **with one constraint**: in the staging UI, the player's absorption
decisions are serialized left-to-right (first revealed + absorbed tile is the "first" in
`incoming_tiles`). The UI must enforce this ordering so the server's drain order matches the
player's intent.

**No change to `PassTiles` is strictly required for Phase 1.** The command structure is already
valid. However, for a richer Phase 2 (see §1.6), consider replacing `blind_pass_count` with:

```rust
// Future (Phase 2):
PassTiles {
    player: Seat,
    tiles: Vec<Tile>,               // tiles from hand to forward
    keep_from_incoming: Vec<Tile>,  // incoming tiles to absorb into rack (not forwarded)
    // forward_from_incoming = incoming_tiles - keep_from_incoming (derived server-side)
}
```

This enables the player to select specific incoming tiles to keep by value, regardless of order.

**For Phase 1**: Keep `PassTiles { tiles, blind_pass_count }` unchanged.

### 1.3 Revised Turn Sequence for Blind Stages

#### Before (current)

```
Stage = FirstAcross
→ all players submit PassTiles { tiles, blind_pass_count }
→ server resolves passes, fires TilesReceived (tiles land in hand)
→ stage → FirstLeft
→ BlindPassPanel shows slider (tiles already in hand)
→ all players submit PassTiles { tiles, blind_pass_count }
→ server resolves
```

#### After (proposed)

```
Stage = FirstAcross
→ all players submit PassTiles { tiles }   (no blind_pass_count — FirstAcross is not blind)
→ server resolves passes:
    - stores incoming tiles in incoming_tiles[target]
    - fires BlindIncomingStaged (private) to each player      ← NEW event replaces TilesReceived here
    - fires CharlestonPhaseChanged → FirstLeft (public)

Stage = FirstLeft
→ players see incoming tiles face-down in StagingStrip
→ player may flip tiles (reveal) — client-side state only
→ player absorbs any revealed tiles they want to keep (moves from staging to rack)
→ player selects tiles from rack to stage for forwarding (fills staging to 3 total)
→ player clicks PASS
→ client sends PassTiles { tiles: [rack tiles], blind_pass_count: Some(n) }
    where n = count of incoming tiles still in staging at pass time
→ server resolves:
    - drains n tiles from incoming_tiles (forward to next player)
    - adds remaining incoming tiles to player's hand (the absorbed ones)
    - removes hand tiles from player's hand
→ fires TilesReceived for players receiving the forward
→ stage → VotingToContinue
```

The `SecondRight` stage follows the identical pattern.

### 1.4 Server-Side Tile Value Hiding: Client-Trust vs. Server-Trust

**Client-trust model** (Phase 1 recommendation):

The server sends actual tile values in `BlindIncomingStaged`. The client displays them face-down by
default and only renders the face when the player explicitly flips. A player who inspects their
browser's network tab could see the values — but this is no different from inspecting RAM in a
desktop app. For casual and semi-competitive play this is acceptable.

**Server-trust model** (Phase 2, for tournament use):

The server sends placeholder values (e.g., a new sentinel `Tile::Hidden = 255`) in
`BlindIncomingStaged`. Each tile is assigned a server-generated `staging_id`. When the player flips
a tile, they send:

```rust
// New command (Phase 2 only):
RevealStagedTile { player: Seat, staging_id: u32 }
```

Server responds with a private event:

```rust
// New event (Phase 2 only):
StagedTileRevealed { player: Seat, staging_id: u32, tile: Tile }
```

The server tracks which `staging_id` → `Tile` mapping lives in each player's `incoming_tiles`.
This ensures the client never receives a tile's value until the player explicitly acts.

**Recommendation**: Implement the client-trust model first. Gate the server-trust model behind a
`CompetitiveMode` house rule flag when required.

### 1.5 IOU Edge Case: All-Blind-Pass Deadlock

The NMJL rules state:

> "In the event that all players want to do a 'Blind Pass,' the player with the greatest number of
> tiles to pass begins by passing 1 or 2 tiles and says to the next player 'I.O.U.' … In the
> unlikely event that no one has a tile to pass, then the Charleston ceases and play begins."

The current server implementation detects the deadlock via `CharlestonState::is_all_blind_pass()`,
which fires when all four `pending_blind_passes[seat] == 3`. When detected:

- `IOUDetected` event fires with the debt map.
- All `incoming_tiles` are returned to each player's hand.
- `CharlestonComplete` fires immediately.

**In the new protocol**, this detection must still fire correctly. Because `blind_pass_count` is
sent with the final `PassTiles` commit, the server still has the information it needs. The IOU
check remains unchanged structurally; it just triggers at the moment all four `PassTiles` commands
arrive for a blind stage.

**One edge case to verify**: in the new two-event flow, a player who received `BlindIncomingStaged`
and then absorbed one tile before submitting will have `blind_pass_count < 3`, breaking the
all-blind deadlock condition. IOU therefore can only fire if all four players genuinely forward all
three incoming tiles — which is exactly the correct behavior.

No changes to IOU logic are required.

---

## 2. Frontend Changes

### 2.1 StagingStrip as Universal Interchange

The unimplemented **VR-006** spec defines `StagingStrip` as a six-slot panel with outgoing-only
semantics. The redesign promotes it to a **universal tile interchange** — the single place where
all tiles in transit live, regardless of direction:

| Source | Condition | Staging behavior |
|---|---|---|
| Rack selection (outgoing) | All phases | Tile appears in a staging slot |
| Incoming tiles (normal pass) | Non-blind stage | Tiles appear briefly in staging, auto-absorbed into rack after animation |
| Incoming tiles (blind stage) | FirstLeft / SecondRight | Tiles appear in staging **face-down**; player decides per tile |
| Draw (playing phase) | After `TileDrawn` event | Drawn tile occupies a dedicated staging slot (see VR-012) |
| Called tile (playing phase) | After `CallResolved` | Called tile appears in staging briefly before meld forms |

This unification removes the inconsistency where some phases use staging and others bypass it.

### 2.2 StagingStrip Revised Props Interface

The VR-006 props interface must be extended to support incoming blind tiles:

```typescript
interface StagingStripProps {
  // Outgoing (selected from rack)
  outgoingTiles: TileInstance[];

  // Incoming (received this turn; shown face-down during blind stages)
  incomingTiles: IncomingStagedTile[];    // ← NEW
  incomingSlotCount: number;              // how many incoming slots to reserve (0 or 3)

  // Display flags
  blindIncoming: boolean;                 // ← renamed from blindStaging; applies to incoming slots
  incomingFromSeat: Seat | null;         // for entry animation direction

  // Slot layout
  slotCount?: number;                    // total slots (default 6)

  // Interaction
  onRemoveOutgoing: (tileId: string) => void;
  onFlipIncoming: (tileId: string) => void;          // ← NEW
  onAbsorbIncoming: (tileId: string) => void;        // ← NEW; moves incoming tile to rack

  // Action bar
  onPassTiles: () => void;
  onCallTile: () => void;
  onDiscardTile: () => void;
  canPass: boolean;
  canCall: boolean;
  canDiscard: boolean;
  isProcessing: boolean;
}

interface IncomingStagedTile {
  id: string;          // client-generated id for this staging slot
  tile: Tile;          // actual tile value (always known; see §1.5)
  revealed: boolean;   // whether the player has flipped this tile
}
```

**`canPass` logic for blind stages**: `(outgoingTiles.length + incomingTiles.filter(t => !absorbed).length) === 3`. The count includes both hand-selected outgoing tiles and any face-down/revealed-but-not-absorbed incoming tiles.

### 2.3 BlindPassPanel: Remove

`BlindPassPanel.tsx` is entirely removed. Its slider-based count pre-selection is superseded by the
staging area's per-tile flip/absorb interaction. No replacement component is needed — the
StagingStrip handles this directly.

Affected import sites:
- `CharlestonPhase.tsx` — remove `BlindPassPanel` import and usage
- `useCharlestonState.ts` — remove `blindPassCount` state and `setBlindPassCount` action
- `UIStateAction` types — remove `SET_BLIND_PASS_COUNT` action type
- Tests — remove all `blind-pass-panel` and `blind-pass-slider` testid assertions

### 2.4 CharlestonPhase.tsx Orchestration Changes

New state needed in `CharlestonPhase.tsx`:

```typescript
// Tiles received via BlindIncomingStaged that live in staging (not yet in rack)
const [stagedIncomingTiles, setStagedIncomingTiles] = useState<IncomingStagedTile[]>([]);
```

New event bus handler cases:

| Action type | Trigger | Effect |
|---|---|---|
| `SET_BLIND_INCOMING_TILES` | `BlindIncomingStaged` private event | Populate `stagedIncomingTiles` with face-down tiles |
| `FLIP_STAGED_TILE` | Player clicks face-down tile | Set `revealed = true` on that tile in `stagedIncomingTiles` |
| `ABSORB_STAGED_TILE` | Player clicks revealed tile to keep | Remove from `stagedIncomingTiles`, add to `your_hand` via state update |
| `CLEAR_STAGED_INCOMING` | Stage change / pass resolves | Reset `stagedIncomingTiles = []` |

The `isBlindPassStage` flag continues to control which UI mode is active. The `handMaxSelection`
calculation changes:

```typescript
// Before:
const handMaxSelection = isBlindPassStage ? 3 - charleston.blindPassCount : 3;

// After:
const unabsorbedIncoming = stagedIncomingTiles.length;
const handMaxSelection = isBlindPassStage ? 3 - unabsorbedIncoming : 3;
```

When the player clicks PASS during a blind stage, the `PassTiles` command is constructed as:

```typescript
const cmd: GameCommand = {
  PassTiles: {
    player: gameState.your_seat,
    tiles: selectedIdsToTiles(selectedIds),      // from rack selection
    blind_pass_count: stagedIncomingTiles.length, // all remaining staged incoming are forwarded
  },
};
```

`stagedIncomingTiles.length` equals the number of incoming tiles not yet absorbed — i.e., the
blind pass count. This replaces the slider.

### 2.5 `handleTilesReceived` Changes

`privateEventHandlers.ts / handleTilesReceived` currently adds all received tiles to `your_hand`
unconditionally. This remains correct for non-blind stages.

For `BlindIncomingStaged`, a new handler is needed:

```typescript
// privateEventHandlers.ts (new function)
export function handleBlindIncomingStaged(
  event: Extract<PrivateEvent, { BlindIncomingStaged: unknown }>,
  gameState: GameStateSnapshot | null
): EventHandlerResult {
  const { tiles, from } = event.BlindIncomingStaged;

  // Build IncomingStagedTile list (revealed=false by default)
  const stagedTiles: IncomingStagedTile[] = tiles.map((tile, i) => ({
    id: `blind-staged-${i}-${Date.now()}`,
    tile,
    revealed: false,
  }));

  return {
    stateUpdates: [],  // tiles do NOT go to your_hand yet
    uiActions: [
      { type: 'SET_BLIND_INCOMING_TILES', tiles: stagedTiles },
      ...(from ? [{ type: 'SET_INCOMING_FROM_SEAT', seat: from }] : []),
    ],
    sideEffects: [],
  };
}
```

When a staged tile is absorbed (`ABSORB_STAGED_TILE`), a separate state update adds it to
`your_hand`. This can be handled by `CharlestonPhase.tsx` directly (no need for a server round-trip
in Phase 1).

When the pass resolves (after `TilesPassed` fires and the stage advances), any remaining tiles in
`stagedIncomingTiles` that were forwarded are gone. The server will add any non-forwarded incoming
tiles to the hand via a separate mechanism (the server handles this in `resolve_blind_pass()`). The
client should listen for the next `CharlestonPhaseChanged` or `TilesReceived` that confirms the
resolution and then clear `stagedIncomingTiles`.

### 2.6 useCharlestonState Hook Changes

Remove:
- `blindPassCount: number`
- `setBlindPassCount(count: number)`

Add:
- No new state needed in the hook — `stagedIncomingTiles` lives directly in `CharlestonPhase.tsx`
  because it's specific to the blind stage rendering and not shared across sub-components.

### 2.7 New UIStateAction Types

```typescript
// lib/game-events/types.ts — add to UIStateAction union
| { type: 'SET_BLIND_INCOMING_TILES'; tiles: IncomingStagedTile[] }
| { type: 'FLIP_STAGED_TILE'; tileId: string }
| { type: 'ABSORB_STAGED_TILE'; tileId: string }
| { type: 'CLEAR_STAGED_INCOMING' }
```

Remove:
```typescript
| { type: 'SET_BLIND_PASS_COUNT'; count: number }
```

---

## 3. Spec Rewrites

### 3.1 VR-006 (StagingStrip) — Significant Changes

**What changes**:

The VR-006 spec describes `StagingStrip` as outgoing-only with a single `blindStaging: boolean`
prop that shows outgoing tiles face-down. This model was written before the blind-pass redesign and
is **wrong** for the new flow.

The rewritten spec must:

1. **Add `incomingTiles: IncomingStagedTile[]` prop** — the incoming side of the strip.
2. **Add `incomingSlotCount: number` prop** — reserves N face-down placeholder slots before tiles
   arrive, showing the player that tiles are expected.
3. **Remove `blindStaging: boolean`** — replace with `blindIncoming: boolean` (the outgoing
   side is never forced face-down; the player chose those tiles).
4. **Add `onFlipIncoming` and `onAbsorbIncoming` callbacks** — per-tile interaction.
5. **Update slot layout**: 3 incoming slots (left half) + 3 outgoing slots (right half) during
   blind stages; 6 uniform outgoing slots during normal stages. Or: a single flat 6-slot array
   where incoming and outgoing tiles are mixed — simpler to implement, less visually oriented.
6. **Update `canPass` logic** to account for the two-part count.
7. **Update all test cases** (T-1 through T-11) — several existing tests reference `blindStaging`
   or assume outgoing-only semantics.

**What does NOT change**:
- 6 slots by default, dashed border for empty slots, gold border for filled slots.
- Integrated action bar with PASS / CALL / DISCARD buttons.
- `isProcessing` spinner behavior.
- `data-testid` for slots and buttons.

### 3.2 VR-010 (Blind Slot Display) — Complete Rewrite

VR-010 currently describes **outgoing** slots displaying face-down during blind stages. This is
wrong. The correct behavior is **incoming** slots display face-down.

**New VR-010 summary**:

> During blind pass stages (FirstLeft, SecondRight), the three incoming slots in StagingStrip show
> tiles face-down with an amber "BLIND" badge. The player clicks a face-down slot to flip it (reveal
> the tile face). A revealed tile shows a teal "PEEK" badge and can be clicked again to absorb it
> into the rack.

**New ACs** (replacing the old ACs completely):

- **AC-1**: When `blindIncoming=true` and a slot is filled, tile renders `<Tile faceUp={false} />` by default.
- **AC-2**: Each face-down incoming slot shows an amber "BLIND" badge (`text-amber-400 bg-black/60
  rounded px-0.5 absolute top-0.5 right-0.5 text-[10px]`).
- **AC-3**: Clicking a face-down slot calls `onFlipIncoming(tileId)`, causing `revealed=true` on
  that tile.
- **AC-4**: A revealed tile renders face-up (`faceUp={true}`) with a teal "PEEK" badge
  (`text-teal-400`) replacing the amber badge.
- **AC-5**: Clicking a revealed tile calls `onAbsorbIncoming(tileId)`, removing it from staging and
  adding it to the rack.
- **AC-6**: `canPass` becomes true when `outgoingTiles.length + incomingTiles.length === 3`.
- **AC-7**: Empty incoming slots show a face-down tile back as a placeholder (not a dashed box) to
  indicate tiles are expected.
- **AC-8**: When `blindIncoming=false`, all tiles render face-up and flip/absorb interactions are
  disabled.

### 3.3 VR-011 (Incoming Entry Animation) — Minor Update

VR-011 describes animating incoming tiles into the strip's "incoming slots." The spec is largely
correct but needs to clarify that during blind stages, the animation uses `tile-enter-from-{seat}`
for the face-down backs (not face-up tiles).

Add to VR-011:

- **AC-7**: During blind stages, the entry animation applies to the face-down tile back visual, not
  the face. The `tile-enter-from-{seat}` class is applied to the slot wrapper, not the `<Tile>`
  component, so it works regardless of `faceUp` state.

### 3.4 VR-013 (Charleston Direction Banner) — Verify Compatibility

VR-013 adds a direction banner that fires when `TilesPassing` arrives. Because the blind stage
now has a two-phase flow (incoming arrives first, then outgoing is committed), verify that the
banner fires at the correct moment: it should fire when the **outgoing** pass is committed (i.e.,
when `TilesPassing` fires from the server), not when `BlindIncomingStaged` arrives.

No change to the spec is required — this is a note for implementers.

### 3.5 VR-007 (Opponent Staging Tile Backs) — Verify Compatibility

VR-007 shows face-down tile backs on opponent racks based on `PlayerStagedTile` event counts.
Confirm that `PlayerStagedTile` still fires correctly in the two-phase blind protocol. Because
blind staging is a client-side intermediate state (the player is deciding), **opponent visibility
of the blind staging phase** needs a design decision:

**Option A**: Opponents see no staging backs during the blind decision phase (only when the player
confirms outgoing tiles). Clean; matches physical game where you silently hold tiles.

**Option B**: Opponents see staging backs once the player has committed outgoing tiles (the count
visible to opponents only updates at outgoing commit time).

Recommendation: Option A. Opponents should not see any staging indication until `PassTiles` is
submitted. Verify that `PlayerStagedTile` events are not fired for blind-staged incoming tiles.

---

## 4. Risk and Dependency Map

### 4.1 Affected Existing Features

| Feature | Impact | Notes |
|---|---|---|
| **BlindPassPanel** | Removed | All tests deleted; no migration |
| **`handleTilesReceived`** | Modified | Must not add tiles to hand during blind stages; new conditional branch based on `BlindIncomingStaged` event |
| **`handleBlindPassPerformed`** | Unchanged | Still fires as a public broadcast; message text unchanged |
| **IOU overlay** (`IOUOverlay.tsx`) | Unchanged | `IOUDetected` / `IOUResolved` events are unaffected |
| **Courtesy pass** | Unchanged | `CourtesyAcross` is not a blind stage |
| **VoteResultOverlay / VotingPanel** | Unchanged | VotingToContinue is not a blind stage |
| **`PassAnimationLayer`** | Unchanged | Fires on `TilesPassing` (outgoing commit), not on `BlindIncomingStaged` |
| **`CharlestonTracker`** | Minor | `blindPass` flag still computed from stage; no change to `getStageInfo` |
| **`useCharlestonState`** | Modified | Remove `blindPassCount`; no new fields needed |
| **Integration tests** (`Charleston.integration.test.tsx`, `CharlestonFirstRight.integration.test.tsx`) | Modified | Update blind-pass-related test scenarios |
| **`PlayerStagedTile` events** | Verify | Confirm opponents don't see blind incoming staging phase |
| **`StagingStrip` (VR-006)** | Rewrites spec | Not yet implemented; spec must be updated before implementation begins |

### 4.2 Server-Side Changes Summary

| Change | Required for Phase 1? | Notes |
|---|---|---|
| New `BlindIncomingStaged` private event | **Yes** | Replaces `TilesReceived` for the blind-stage delivery |
| `PassTiles` command unchanged | **Yes** (no change) | `blind_pass_count` continues to work |
| TS binding regeneration | **Yes** | After adding `BlindIncomingStaged`, run `cargo test export_bindings` |
| `RevealStagedTile` command | No (Phase 2) | Server-trust model; not needed for casual play |
| `PassTiles.keep_from_incoming` field | No (Phase 2) | Tile-specific absorption; count-based is sufficient for Phase 1 |

### 4.3 Implementation Order (Critical Path)

All server work must precede or run in parallel with frontend work that depends on the new event.

```
Step 1 (Rust — server):
    Add PrivateEvent::BlindIncomingStaged to event.rs
    Change stage_passes_to_incoming_tiles() to emit BlindIncomingStaged instead of TilesReceived
        when resulting stage is FirstLeft or SecondRight
    Regenerate TS bindings (cargo test export_bindings)
    Update visibility.rs to unicast BlindIncomingStaged to the receiving player
    Rust tests: add unit tests for BlindIncomingStaged emission

Step 2 (Frontend — event layer):
    Add BlindIncomingStaged to PrivateEvent binding (generated by step 1)
    Add IncomingStagedTile type to frontend types
    Write handleBlindIncomingStaged() in privateEventHandlers.ts
    Add SET_BLIND_INCOMING_TILES / FLIP_STAGED_TILE / ABSORB_STAGED_TILE / CLEAR_STAGED_INCOMING
        to UIStateAction union in types.ts
    Remove SET_BLIND_PASS_COUNT from UIStateAction
    Update useGameEvents.ts routing to call handleBlindIncomingStaged

Step 3 (Frontend — StagingStrip component):
    Rewrite VR-006 spec with incoming-tile support (per §3.1)
    Rewrite VR-010 spec with correct incoming-blind semantics (per §3.2)
    Implement StagingStrip.tsx with full props interface
    Implement StagingStrip.test.tsx

Step 4 (Frontend — CharlestonPhase.tsx):
    Remove BlindPassPanel import and all usages
    Add stagedIncomingTiles state
    Add event bus handlers for new action types
    Integrate StagingStrip with both outgoing and incoming tile management
    Update handMaxSelection calculation
    Update PassTiles command construction (blind_pass_count from stagedIncomingTiles.length)

Step 5 (Frontend — cleanup):
    Remove BlindPassPanel.tsx
    Remove blindPassCount from useCharlestonState.ts
    Update integration tests

Step 6 (Verification):
    Full test suite (npx vitest run, cargo test --workspace)
    Manual playtest: FirstLeft blind steal with 0, 1, 2, 3 stolen tiles
    Manual playtest: IOU scenario (all-blind deadlock)
    Manual playtest: Bot players completing blind stages
```

### 4.4 Testing Strategy

**Unit tests — new/changed**:
- `StagingStrip.test.tsx`: Full suite per revised VR-006 spec, including incoming-flip and absorb
  interactions.
- `privateEventHandlers.test.ts`: Add `handleBlindIncomingStaged` suite:
  - Does not add tiles to `your_hand`.
  - Emits `SET_BLIND_INCOMING_TILES` with `revealed=false` on all tiles.
  - Emits `SET_INCOMING_FROM_SEAT` when `from` is non-null.
- `publicEventHandlers.charleston.test.ts`: Verify `handleBlindPassPerformed` message text is
  unchanged.

**Integration tests — updated**:
- `Charleston.integration.test.tsx`:
  - After `BlindIncomingStaged` WS message, assert tiles appear in staging with `faceUp=false`.
  - After clicking a staging slot, assert tile shows face-up with "PEEK" badge.
  - After clicking a revealed tile (absorb), assert it disappears from staging and appears in rack.
  - After selecting 3 total (rack + staging), assert PASS is enabled.
  - After PASS, assert staging is cleared.
- `CharlestonFirstLeft.integration.test.tsx` (new file): End-to-end scenario for blind stage
  covering 0, 1, 2, 3 blind-stolen tiles.

**Bot behavior**: Bots currently submit `PassTiles { tiles, blind_pass_count }`. The bot AI needs
to be updated (in `crates/mahjong_ai`) to wait for `BlindIncomingStaged` before committing, and to
choose `blind_pass_count` based on tile utility. This is a separate scope item.

---

## 5. Open Questions

1. **Slot layout**: Should incoming and outgoing slots be visually separated (left/right halves) or
   interleaved? A left/right split is more intuitive ("tiles coming in on the left, going out on
   the right") but complicates the 6-slot layout when some slots are absent. A flat list with badges
   is simpler.

2. **Tile ordering for count-based drain**: The server drains the first N tiles from
   `incoming_tiles` in insertion order. Should the UI reflect this ordering (leftmost slot = first
   drained) so the player can reason about which tiles will be forwarded if they don't absorb them?

3. **Bot behavior during blind stages**: Bots currently set `blind_pass_count` upfront. In the new
   protocol, bots receive `BlindIncomingStaged` and must evaluate the tiles before responding. Does
   the AI bot need to be updated before or in parallel with the frontend? If the server emits
   `BlindIncomingStaged` and the bot doesn't handle it, the bot will never submit its pass and the
   stage will hang.

4. **Timer interaction**: The Charleston timer starts on `CharlestonTimerStarted`. In the new
   two-phase blind protocol, does the timer run across both phases (incoming staging + outgoing
   commit), or does a second timer start when `BlindIncomingStaged` arrives? The simplest answer:
   one timer covers the whole stage, starting at `CharlestonTimerStarted`. No change needed.

5. **Reconnect / snapshot**: If a player reconnects mid-blind-stage, the `StateRestored` snapshot
   must include their `incoming_tiles`. Currently, `incoming_tiles` are stored in `CharlestonState`
   on the server. The snapshot serializer must include them. Verify that `GameStateSnapshot` already
   carries `charleston_state.incoming_tiles` through the reconnect path.

---

## 6. Summary of Affected Files

### Rust (server)

| File | Change |
|---|---|
| `crates/mahjong_core/src/event/private_events.rs` | Add `BlindIncomingStaged` variant |
| `crates/mahjong_core/src/table/handlers/charleston.rs` | Change emission in `stage_passes_to_incoming_tiles()` |
| `crates/mahjong_server/src/network/visibility.rs` | Add unicast rule for `BlindIncomingStaged` |

### TypeScript (auto-generated)

| File | Change |
|---|---|
| `apps/client/src/types/bindings/generated/PrivateEvent.ts` | Regenerated — gains `BlindIncomingStaged` |

### Frontend (handwritten)

| File | Change |
|---|---|
| `apps/client/src/components/game/BlindPassPanel.tsx` | **Deleted** |
| `apps/client/src/components/game/BlindPassPanel.test.tsx` | **Deleted** |
| `apps/client/src/components/game/StagingStrip.tsx` | **New** — full rewrite of VR-006 spec |
| `apps/client/src/components/game/StagingStrip.test.tsx` | **New** |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx` | Heavy revision |
| `apps/client/src/hooks/useCharlestonState.ts` | Remove `blindPassCount`; remove `setBlindPassCount` |
| `apps/client/src/lib/game-events/privateEventHandlers.ts` | Add `handleBlindIncomingStaged` |
| `apps/client/src/lib/game-events/privateEventHandlers.test.ts` | Add `handleBlindIncomingStaged` suite |
| `apps/client/src/lib/game-events/publicEventHandlers.ts` | Route `BlindIncomingStaged` to new handler |
| `apps/client/src/lib/game-events/types.ts` | Add/remove UIStateAction types |

### Specs

| File | Change |
|---|---|
| `docs/implementation/frontend/VR-006-staging-strip.md` | Significant revision — add incoming-tile support |
| `docs/implementation/frontend/VR-010-blind-slot-display.md` | Complete rewrite — incoming face-down, not outgoing |
| `docs/implementation/frontend/VR-011-incoming-entry-animation.md` | Minor note added |
| `docs/implementation/frontend/VR-007-opponent-staging-tiles.md` | Note added re: blind phase visibility |
