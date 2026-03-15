# US-053: Exchange Joker — Click-to-Exchange Flow

## Status

- State: Completed
- Priority: High
- Batch: E

## Problem

The **Exchange Joker** button in the gameplay action pane is removed by `US-052` as part of the
two-button cleanup. There is no longer a click target that initiates a joker exchange.

This story replaces the button with a direct click-to-exchange flow: the player clicks any Joker
tile visible in an exposed meld — their own or an opponent's. The system derives which tile the
Joker represents, shows a focused confirmation ("Exchange [2 Bam] with Joker from [West]? Yes /
No"), and — on confirmation — performs a local pre-flight check before sending the `ExchangeJoker`
command to the server.

## Dependency

`US-052` is a prerequisite. It removes `exchange-joker-button` and the `canExchangeJoker` /
`onExchangeJoker` props from `ActionBarPhaseActions.tsx`, `ActionBar.types.ts`, and all call
sites. US-053 must not re-introduce those props or that button.

Implementation readiness note: this story is only implementation-ready once `US-052` is merged
into the target branch. If `exchange-joker-button`, `canExchangeJoker`, `onExchangeJoker`,
`showJokerExchangeDialog`, or `handleOpenJokerExchange` still exist in the working tree, finish
`US-052` first or explicitly fold those removals into the implementation branch before starting
US-053.

## Scope

**In scope:**

- Compute, per seat and meld (including the local player's own melds), which tile positions
  contain an exchangeable Joker (i.e. the Joker's represented tile is in the local player's
  hand). The existing `jokerExchangeOpportunities` logic in `useMeldActions.ts` currently skips
  the local seat (`your_seat`); extend it to also scan `gameState.players.find(p => p.seat ===
your_seat)?.exposed_melds` using the same `joker_assignments` + `myTiles.has` check.
- Add an `exchangeableJokersByMeld` lookup (seat → meld index → joker position list) and an
  `onJokerTileClick(seat, meldIndex, tilePosition)` callback to the prop chain for opponent
  melds: `useMeldActions` → `PlayingPhasePresentation` → `OpponentRack` → `ExposedMeldsArea` →
  `MeldDisplay`.
- Thread the same props for the local player's own melds: `PlayingPhasePresentation` →
  `PlayerRack` → `ExposedMeldsArea` → `MeldDisplay` (using the local-seat slice from the same
  `exchangeableJokersBySeat` map).
- Render exchangeable Joker tiles inside `MeldDisplay` with a yellow ring and `cursor-pointer`
  affordance. Non-exchangeable Jokers (tile not in local hand, wrong stage) render as default
  tiles with no interactive treatment.
- Create `JokerExchangeConfirmDialog.tsx` — a focused yes/no confirmation dialog for a single
  exchange opportunity. Dialog body: _"Exchange [tile name] with Joker from [Seat]?"_ with
  **Yes** and **No** buttons.
- Add local pre-flight check before sending command:
  1. Check local gameplay staging state for the represented tile.
  2. If not in staging, check local concealed hand.
  3. If found in neither: show inline error _"You don't have [tile name] to exchange."_ inside
     the open dialog; do not send command.
  4. If found: send `ExchangeJoker` command.
- Replace `showJokerExchangeDialog` / `handleOpenJokerExchange` / `handleCloseJokerExchange` in
  `useMeldActions.ts` with a `pendingExchangeOpportunity: ExchangeOpportunity | null` state
  and `handleJokerTileClick`, `handleConfirmExchange`, and `handleCancelExchange` handlers.
- Mount `JokerExchangeConfirmDialog` in `PlayingPhaseOverlays.tsx` (replacing the
  `JokerExchangeDialog` mount site).
- Delete `JokerExchangeDialog.tsx` and `JokerExchangeDialog.test.tsx`. Its only trigger (the
  button) is gone after US-052, and the list-picker pattern is superseded by the per-joker
  click-to-confirm flow.
- Remove the J-key keyboard shortcut handler from `useMeldActions.ts` (currently
  `setShowJokerExchangeDialog(true)`). This shortcut referenced the now-deleted dialog; a
  keyboard replacement is deferred.
- Update all tests that reference `JokerExchangeDialog`, `joker-exchange-dialog`,
  `exchange-confirm-button-*`, or `joker-exchange-cancel-button`.

**Out of scope:**

- J-key keyboard shortcut replacement — deferred to a later accessibility story.
- Any change to the `ExchangeJoker` server command shape or the `joker_assignments` binding.
- Visual animation of the tile leaving the rack and entering the meld — deferred.
- Optimistic UI update of the meld before server confirmation — server event drives the visual
  update when `JokerExchanged` is received, as in the current flow.
- Exchange Joker during `CallWindow`, `Drawing`, or any non-`Discarding` sub-stage — the
  opportunity list is gated on `isDiscardingStage && isMyTurn` in `useMeldActions.ts`.

## Authority Contract

### What the client checks (local pre-flight only)

After the player presses **Yes** in the confirmation dialog:

1. Is the represented tile present in the local gameplay staging state?
   In the current Playing-phase implementation, this means either:
   - the single incoming tile shown in `StagingStrip.incomingTiles` (`stagedIncomingTile` when a
     draw is staged), or
   - any tile currently staged for discard/claim in `StagingStrip.outgoingTiles` (derived from the
     current selected hand tiles).
2. If not in staging, is it present in the remaining concealed hand?
   In current code terms, this is `gameState.your_hand` after excluding any tile instances already
   represented in the staging strip for the current interaction.
3. If found in neither: surface inline error inside the dialog without sending a command.
4. If found: send the `ExchangeJoker` command. The client does not enforce any further rules.

The pre-flight is a UX guard against sending a command the server will definitely reject. It is
not a substitute for server validation.

### What the server validates (authoritative)

- Whether the current stage allows joker exchange (`Discarding`, player's own turn).
- Whether the player's server-side hand contains the replacement tile.
- Whether the specified meld position holds a Joker and the Joker's `joker_assignments` entry
  matches the proposed replacement tile.
- Any additional game-rule enforcement (e.g. tile must exactly match the joker's represented
  tile type).

If the server rejects the command (error event), the existing `SET_ERROR_MESSAGE` handler
in `useMeldActions` already clears the loading state. The dialog should also close on error
(`handleCancelExchange` called from the error handler).

## Acceptance Criteria

- AC-1: During `Discarding` (my turn), each Joker tile in any exposed meld — including the
  local player's own melds and all opponent melds — whose represented tile is in the local
  player's hand renders with a yellow ring and `cursor-pointer` affordance
  (`data-testid="joker-tile-exchangeable"` on the wrapper).
- AC-2: Joker tiles whose represented tile is **not** in the local player's hand render as
  plain tiles with no ring and no cursor-pointer.
- AC-3: Joker tiles in any exposed meld during `Drawing`, `CallWindow`, opponent `Discarding`,
  or any non-playing phase render as plain tiles with no interactive affordance.
- AC-4: Clicking an exchangeable Joker tile opens `JokerExchangeConfirmDialog`
  (`data-testid="joker-exchange-confirm-dialog"`) showing the text
  _"Exchange [tile name] with Joker from [Seat]?"_ where `[tile name]` is derived from
  `joker_assignments` for that position and `[Seat]` is the owning seat name (which may be
  the local player's own seat).
- AC-5: Pressing **No** or Escape closes the dialog without sending any command.
- AC-6: Pressing **Yes** when the represented tile is found in staging or concealed hand sends
  the `ExchangeJoker` command and shows a loading state on the **Yes** button.
- AC-7: Pressing **Yes** when the represented tile is found in **neither** staging nor concealed
  hand displays the inline error _"You don't have [tile name] to exchange."_ inside the open
  dialog. No command is sent.
- AC-8: On `SET_JOKER_EXCHANGED` (exchange confirmed by server), the confirmation dialog closes
  automatically.
- AC-9: No element with `data-testid="joker-exchange-dialog"` exists in the DOM (the old
  `JokerExchangeDialog` is deleted).
- AC-10: No element with `data-testid="exchange-joker-button"` exists in the DOM (enforced by
  US-052; must not regress).
- AC-11: Multiple exchangeable Jokers from different melds or different opponents each have
  independent click targets. Clicking one opens the confirmation for only that Joker.
- AC-12: The confirmation dialog is accessible: the triggerable Joker tile wrapper has
  `aria-label="Exchange Joker for [tile name] — click to exchange"`, the dialog has
  `role="dialog"`, `aria-modal="true"`, and a visible heading.

## Edge Cases

- EC-1: Two Jokers in the same meld → each renders as an independent click target with its own
  position-specific confirmation. The player must click the specific Joker they intend to
  exchange.
- EC-2: The player has the same tile type twice (once in staging, once concealed) → the
  pre-flight succeeds on the first match (staging is checked first); the command is sent. The
  server resolves which tile instance is used.
- EC-3: `isBusy` is true (e.g. command already in flight) → all Joker tiles in any exposed meld
  (own or opponent) have no interactive affordance for the duration of the pending command.
  This prevents double-submission.
- EC-4: Reconnect / remount during `Discarding` sub-stage → `jokerExchangeOpportunities` are
  recomputed from the new server snapshot; interactive affordance is restored on the correct
  Joker tiles automatically.
- EC-5: History / read-only mode → no Joker tile has interactive affordance. `ExposedMeldsArea`
  must not receive click props when `readOnly` is true. `JokerExchangeConfirmDialog` must not
  open.
- EC-6: After a Joker exchange is confirmed, the server emits `JokerExchanged` which updates
  `exposed_melds` in the game snapshot. The recomputed `jokerExchangeOpportunities` may be
  empty or reduced; interactive affordance updates automatically via the derived list.
- EC-7: The player clicks a Joker, the confirmation is open, and during the round-trip the
  server advances the stage (e.g. another player draws). On the stage change event, the dialog
  should close (`handleCancelExchange`) so the player is not left in a stale confirmation state.

## Primary Files (Expected)

- `apps/client/src/components/game/MeldDisplay.tsx` — add optional
  `exchangeableTilePositions?: number[]` and `onJokerTileClick?: (tilePosition: number) => void`
  props; render Joker tiles at those positions as interactive wrappers with yellow ring and
  `data-testid="joker-tile-exchangeable"`
- `apps/client/src/components/game/MeldDisplay.test.tsx` — add tests for interactive affordance
  and `onJokerTileClick` callback
- `apps/client/src/components/game/ExposedMeldsArea.tsx` — add optional
  `exchangeableJokersByMeld?: Record<number, number[]>` and
  `onJokerTileClick?: (meldIndex: number, tilePosition: number) => void` props; forward to
  `MeldDisplay` per meld index
- `apps/client/src/components/game/ExposedMeldsArea.test.tsx` — add tests for prop forwarding
- `apps/client/src/components/game/OpponentRack.tsx` — add optional
  `exchangeableJokersByMeld?: Record<number, number[]>` and
  `onJokerTileClick?: (meldIndex: number, tilePosition: number) => void` props; forward to
  `ExposedMeldsArea`
- `apps/client/src/components/game/OpponentRack.test.tsx` — add test for prop forwarding
- `apps/client/src/components/game/PlayerRack.tsx` — add optional
  `exchangeableJokersByMeld?: Record<number, number[]>` and
  `onJokerTileClick?: (meldIndex: number, tilePosition: number) => void` props; forward to
  the `ExposedMeldsArea` in the meld row (lines ~157–165)
- `apps/client/src/components/game/PlayerRack.test.tsx` — add test for prop forwarding
- `apps/client/src/components/game/JokerExchangeConfirmDialog.tsx` — create; new single-exchange
  confirmation dialog following the `UpgradeConfirmationDialog` pattern (shadcn `Dialog`)
- `apps/client/src/components/game/JokerExchangeConfirmDialog.test.tsx` — create; new test file
- `apps/client/src/components/game/JokerExchangeDialog.tsx` — **delete** (trigger removed by
  US-052; list-picker pattern replaced by click-to-confirm)
- `apps/client/src/components/game/JokerExchangeDialog.test.tsx` — **delete**
- `apps/client/src/hooks/useMeldActions.ts` — replace `showJokerExchangeDialog` /
  `handleOpenJokerExchange` / `handleCloseJokerExchange` with `pendingExchangeOpportunity`,
  `handleJokerTileClick`, `handleConfirmExchange`, `handleCancelExchange`; add
  `exchangeableJokersBySeat` derived lookup; remove J-key `useEffect`
- `apps/client/src/hooks/useMeldActions.test.ts` — update: remove old dialog-open tests; add
  tests for `handleJokerTileClick`, pre-flight check, `handleConfirmExchange`,
  `handleCancelExchange`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx` — replace
  `JokerExchangeDialog` import and render with `JokerExchangeConfirmDialog`; wire
  `pendingExchangeOpportunity`, `onConfirm`, `onCancel`, `isLoading`, `inlineError` props
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.test.tsx` — update
  mock to reference `JokerExchangeConfirmDialog` instead of `JokerExchangeDialog`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` — add
  joker-click props to the type and pass the seat-appropriate slice down to both `OpponentRack`
  (each opponent's seat) and `PlayerRack` (local seat); remove `canExchangeJoker` and
  `onExchangeJoker` references if not already removed by US-052
- `apps/client/src/components/game/phases/playing-phase/usePlayingPhaseViewState.ts` — remove
  `canExchangeJoker` derivation and `handleOpenJokerExchange` refs; add wiring for
  `exchangeableJokersBySeat` and `handleJokerTileClick`

## Notes for Implementer

### Joker position lookup

`joker_assignments` on a meld is `Record<number, Tile>` where each key is the tile-array index
of a Joker within `meld.tiles` and the value is the tile that Joker represents. For example:

```ts
meld.tiles = [5, 42, 5]; // 42 = Joker at position 1
meld.joker_assignments = { 1: 5 }; // position 1 represents tile 5 (2 Bam)
```

When computing exchangeable positions, iterate `joker_assignments` for each player's melds
(including the local seat) and check `myTiles.has(representedTile)`. The existing loop in
`useMeldActions.ts` (lines 53–73) skips `your_seat` with a `continue` guard; remove that guard
to include the local player's own melds. Adapt the loop to also produce a per-seat-per-meld
lookup for prop passing.

Interactive affordance must only be derived when all of the following are true:

- `isDiscardingStage` is true
- `isMyTurn` is true
- `readOnly` / historical mode is false
- `isBusy` is false

Do not rely on `isDiscardingStage` alone. Opponent `Discarding` sub-stage must render plain Joker
tiles even if the represented tile is in the local player's hand.

### Data flow for click props

The cleanest shape to thread through the component tree:

```ts
// Per seat: which meld indices have which joker positions available
type ExchangeableJokersBySeat = Record<Seat, Record<number, number[]>>;
```

`useMeldActions` derives this from `jokerExchangeOpportunities` (now inclusive of the local
seat). `PlayingPhasePresentation` receives it and the `handleJokerTileClick(seat, meldIndex,
tilePosition)` callback, then passes the seat-specific slice to each `OpponentRack` and to
`PlayerRack` (for the local seat) as `exchangeableJokersByMeld` and a curried
`onJokerTileClick(meldIndex, tilePosition)`.

Keep the prop surface minimal: `MeldDisplay` receives only the positions for its own meld (a
`number[]`), not the full seat-level map.

### JokerExchangeConfirmDialog interface

Follow `UpgradeConfirmationDialog` as the structural template. Suggested props:

```ts
interface JokerExchangeConfirmDialogProps {
  isOpen: boolean;
  opportunity: ExchangeOpportunity | null;
  isLoading: boolean;
  inlineError?: string; // set when pre-flight fails
  onConfirm: () => void; // triggers pre-flight + command send
  onCancel: () => void;
}
```

Dialog body copy (finalized):

- Heading: `"Exchange Joker?"`
- Body: `"Exchange [getTileName(opportunity.representedTile)] with Joker from [opportunity.targetSeat]?"`
- Buttons: `"Yes"` (primary, disabled + spinner when `isLoading`) and `"No"` (secondary)
- Inline error: rendered below body when `inlineError` is set; clears when dialog reopens

### Pre-flight implementation in useMeldActions

`handleConfirmExchange` receives the current staging tiles and concealed hand as arguments (or
reads them from the hook's gameState dependency). Suggested signature on the result type:

```ts
handleConfirmExchange: (stagedTiles: Tile[], concealedHand: Tile[]) => void;
```

Check order:

1. `stagedTiles.includes(representedTile)` → if true, proceed
2. `concealedHand.includes(representedTile)` → if true, proceed
3. Neither → set `inlineError` on the dialog state without sending command

The staging strip state lives in `PlayingPhase` (or the playing-phase state hook). Pass it down
to `handleConfirmExchange` at the call site in `PlayingPhaseOverlays` or `PlayingPhase`.

For this story, define the staging inputs in current code terms rather than introducing a new
`stagedTiles` store:

- `stagedIncomingTile`: the single staged draw tile, if present
- `outgoingTiles`: the tiles currently staged in the strip from the user's selection

Convert those UI values to tile values before the pre-flight check. The "concealed hand" check is
performed against the remaining hand after excluding those staged tile instances, so the same tile
instance is not counted in both checks.

### Deletion of JokerExchangeDialog

Before deleting, confirm that `JokerExchangeDialog` is only imported from:

- `PlayingPhaseOverlays.tsx` (render site)
- `useMeldActions.ts` (type import for `ExchangeOpportunity`)

The `ExchangeOpportunity` type must move to a shared location (e.g.
`src/types/ExchangeOpportunity.ts` or directly into `useMeldActions.ts`) before deletion, so
`useMeldActions.ts` does not depend on a deleted file. `JokerExchangeConfirmDialog.tsx` re-exports
or re-declares the same type as needed.

### Stage-change dialog dismissal (EC-7)

Watch for a turn-change or stage-change event in `useMeldActions` or the parent phase
component. If `pendingExchangeOpportunity` is non-null when the stage advances away from
`Discarding`, call `handleCancelExchange` to reset it. This prevents stale confirmation state
across turns.

Treat loss of turn ownership the same way. If the local player is no longer the active player,
close the dialog and remove interactive Joker affordances immediately.

### Interaction precedence with upgradeable melds

Local exposed melds can already be clickable at the meld-wrapper level for upgrades. If a meld is
both upgradeable and contains one or more exchangeable Jokers:

- clicking directly on an exchangeable Joker tile triggers joker exchange only
- clicking elsewhere on the meld wrapper continues to trigger upgrade
- the Joker tile click must stop propagation so the upgrade dialog does not also open

This precedence applies only to the local player's meld row. Opponent melds do not have upgrade
click behavior.

### MeldDisplay interactive wrapper pattern

For exchangeable Joker positions, wrap the existing `<Tile>` in a `<button>` element:

```tsx
<button
  onClick={() => onJokerTileClick?.(index)}
  className="rounded ring-2 ring-yellow-400 ring-offset-1 cursor-pointer"
  data-testid="joker-tile-exchangeable"
  aria-label={`Exchange Joker for ${getTileName(representedTile)} — click to exchange`}
>
  <Tile tile={tile} ... />
</button>
```

Use `representedTile` from `exchangeableTilePositions` context (passed down from the meld's
`joker_assignments` via props) for the `aria-label`. The `<button>` wrapper avoids making the
entire `<Tile>` clickable when the position is not exchangeable.

## Test Plan

- `JokerExchangeConfirmDialog.test.tsx` (new):
  - Renders dialog when `isOpen` is true.
  - Shows correct tile name and seat in dialog body.
  - Pressing No calls `onCancel`.
  - Pressing Yes calls `onConfirm`.
  - `isLoading = true` disables Yes button and shows spinner.
  - `inlineError` text is displayed below dialog body.
  - Dialog is hidden when `isOpen` is false.
  - Escape key calls `onCancel`.
- `MeldDisplay.test.tsx` (update):
  - Joker at position in `exchangeableTilePositions` renders `joker-tile-exchangeable` wrapper.
  - Clicking it fires `onJokerTileClick` with the correct position.
  - Joker NOT in `exchangeableTilePositions` renders as a plain tile with no wrapper.
- `ExposedMeldsArea.test.tsx` (update):
  - `onJokerTileClick` is forwarded to the correct meld's `MeldDisplay` with the meld index
    prepended.
- `useMeldActions.test.ts` (update):
  - `handleJokerTileClick(seat, meldIndex, tilePosition)` sets `pendingExchangeOpportunity`
    to the matching entry from `jokerExchangeOpportunities`.
  - `handleCancelExchange` clears `pendingExchangeOpportunity`.
  - `handleConfirmExchange` sends `ExchangeJoker` command when tile found in staged/concealed.
  - `handleConfirmExchange` sets `inlineError` and does not send command when tile absent.
  - On `SET_JOKER_EXCHANGED` via `handleUiAction`, `pendingExchangeOpportunity` is cleared.
  - J-key handler is removed: pressing J does not open any dialog.
- Update `PlayingPhaseOverlays.test.tsx`:
  - Mock references `JokerExchangeConfirmDialog` (not `JokerExchangeDialog`).
  - Assert `joker-exchange-dialog` testid is absent (old dialog gone).
- Integration test (existing `Playing.integration.test.tsx` or similar):
  - Assert `exchange-joker-button` is absent in `Discarding` sub-stage.
  - Simulate click on `joker-tile-exchangeable`; assert `joker-exchange-confirm-dialog` appears.
  - Confirm exchange; assert `ExchangeJoker` command is sent.
  - Assert no command is sent when the tile is absent from hand.
- Confirm no file imports `JokerExchangeDialog` after deletion.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/JokerExchangeConfirmDialog.test.tsx
npx vitest run apps/client/src/components/game/MeldDisplay.test.tsx
npx vitest run apps/client/src/components/game/ExposedMeldsArea.test.tsx
npx vitest run apps/client/src/hooks/useMeldActions.test.ts
npx vitest run apps/client/src/components/game/phases/playing-phase/
npx vitest run apps/client/src/features/game/
npx tsc --noEmit
npx prettier --write \
  apps/client/src/components/game/MeldDisplay.tsx \
  apps/client/src/components/game/ExposedMeldsArea.tsx \
  apps/client/src/components/game/OpponentRack.tsx \
  apps/client/src/components/game/PlayerRack.tsx \
  apps/client/src/components/game/JokerExchangeConfirmDialog.tsx \
  apps/client/src/hooks/useMeldActions.ts \
  apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx \
  apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx \
  docs/implementation/frontend/user-stories/US-053-exchange-joker-click-to-exchange-flow.md \
  docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md
```

## Codex Implementation Summary

Implemented US-053 and committed it as `feat(us-053): implement click-to-exchange joker flow` in `e411716`.

The old list-based joker exchange flow is removed. Exposed jokers now become clickable only when allowed in playing discard state on your turn, including both opponent melds and your own exposed melds. The UI chain now carries `exchangeableJokersBySeat`, `MeldDisplay` renders only valid jokers as interactive buttons with the exchange affordance, and the new confirm dialog lives in [PlayingPhaseOverlays.tsx]. The hook flow in [useMeldActions.ts] now uses `pendingExchangeOpportunity`, staged-first preflight validation, inline errors, and closes on success / turn loss / read-only transitions. The old `JokerExchangeDialog` files were deleted and `ExchangeOpportunity` moved to [exchange.ts].

Implemented AC/EC coverage includes opponent and local meld exchange, multiple jokers in one meld, busy-state affordance suppression during submit, and end-to-end command sending from the new confirm dialog. Deferred items remain the story’s existing deferrals: no keyboard replacement for J, no server command changes, no optimistic animation work.

### Verification completed

- Targeted Vitest runs for the new dialog, meld display, exposed meld area, hook, playing-phase tests, opponent/player rack tests, and updated playing integration tests.
- Full `src/components/game/phases/playing-phase/` suite.
- Full `src/features/game/` suite.
- `npx tsc --noEmit`.
- Full AGENTS pipeline: `cargo fmt --all`, `cargo check --workspace`, `cargo test --workspace`, `cargo clippy --all-targets --all-features`, `npx prettier --write .`, `npx tsc --noEmit`, `npm run check:all`.

Only the intended US-053 files were staged and committed. The unrelated doc changes in [US-051-charleston-action-pane-courtesy-pass-and-two-button-model.md], [US-052-gameplay-action-pane-and-controls-cleanup.md], and [USER-TESTING-BACKLOG.md] remain unstaged.

22 files changed +1143 -566

apps/client/src/components/game/ExposedMeldsArea.test.tsx
apps/client/src/components/game/ExposedMeldsArea.tsx
apps/client/src/components/game/JokerExchangeConfirmDialog.test.tsx
apps/client/src/components/game/JokerExchangeConfirmDialog.tsx
apps/client/src/components/game/JokerExchangeDialog.test.tsx
apps/client/src/components/game/JokerExchangeDialog.tsx
apps/client/src/components/game/MeldDisplay.test.tsx
apps/client/src/components/game/MeldDisplay.tsx
apps/client/src/components/game/OpponentRack.test.tsx
apps/client/src/components/game/OpponentRack.tsx
apps/client/src/components/game/PlayerRack.test.tsx
apps/client/src/components/game/PlayerRack.tsx
apps/client/src/components/game/phases/PlayingPhase.tsx
apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.test.tsx
apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx
apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx
apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx
apps/client/src/components/game/phases/playing-phase/usePlayingPhaseViewState.ts
apps/client/src/features/game/Playing.integration.test.tsx
apps/client/src/hooks/useMeldActions.test.ts
apps/client/src/hooks/useMeldActions.ts
apps/client/src/types/game/exchange.ts

## Claude Review

## US-053 Implementation Review

### Prerequisite check — US-052 cleanup items

`grep` finds zero matches for `canExchangeJoker`, `handleOpenJokerExchange`, `showJokerExchangeDialog`, and `JokerExchangeDialog` anywhere under `src/`. [JokerExchangeDialog.tsx] and [JokerExchangeDialog.test.tsx] are confirmed absent via Glob. The implementation branch is clean of all prerequisite artifacts.

### AC-1 — Yellow ring + cursor-pointer on exchangeable Jokers during my Discarding turn

**Source lines**:

`useMeldActions.ts:57–58` — affordance guard:

`const canRenderExchangeAffordance =`
`isDiscardingStage && isMyTurn && !readOnly && !isBusy && !jokerExchangeLoading;`

`useMeldActions.ts:72–73` — opportunities empty when guard is false:

`if (!canRenderExchangeAffordance) return [];`

`useMeldActions.ts:99–113` — `exchangeableJokersBySeat` derived only from live opportunities.

`MeldDisplay.tsx:89,112–124` — exchangeable position gets a `<button>` wrapper:

`className="rounded ring-2 ring-yellow-400 ring-offset-1 ring-offset-transparent cursor-pointer"`
`data-testid="joker-tile-exchangeable"`

`PlayingPhasePresentation.tsx:225–228, 312–317` — seat-specific slice threaded to both `OpponentRack` and `PlayerRack` (local seat uses meldActions.exchangeableJokersBySeat[gameState.your_seat]).
`PlayingPhase.tsx:65` — `isDiscardingStage` already bakes in `isMyTurn`:

`const isDiscardingStage = typeof turnStage === 'object' && 'Discarding' in turnStage && isMyTurn;`

**Local player's own melds** — the old `your_seat` skip guard is gone. `useMeldActions.ts:78` iterates `gameState.players` unconditionally, including the local player's seat. Test at `useMeldActions.test.ts:81–86` confirms `South: { 0: [3] }` alongside opponent entries.

**Verdict: PASS**. Interactive affordance is computed correctly for all melds including own, and the CSS ring + testid are applied.

### AC-2 — Non-exchangeable Jokers render as plain tiles

**Source lines**:

`MeldDisplay.tsx:89, 112–128` — only positions in `exchangeableTilePositions` get the `button` wrapper; all other tiles (including Jokers not in the list) fall through to the plain `{tileElement}` branch.

**Verdict: PASS**.

### AC-3 — Non-Discarding / opponent-turn phases render plain Jokers

**Source lines**:

`useMeldActions.ts:72–73` — `jokerExchangeOpportunities` returns `[]` when `!canRenderExchangeAffordance`. Since `isDiscardingStage` in `PlayingPhase.tsx:65` requires `isMyTurn`, opponent-turn Discarding and Drawing stages all yield an empty list. `exchangeableJokersBySeat` consequently has `{}` per seat, so no positions reach `MeldDisplay`.

**Verdict: PASS**.

### AC-4 — Clicking opens `JokerExchangeConfirmDialog` with correct copy

**Source lines**:

`useMeldActions.ts:133–148` — `handleJokerTileClick` finds the matching opportunity from the list and calls `setPendingExchangeOpportunity(opportunity)`.

`PlayingPhaseOverlays.tsx:266–278`:

```tsx
<JokerExchangeConfirmDialog
  isOpen={meldActions.pendingExchangeOpportunity !== null}
  opportunity={meldActions.pendingExchangeOpportunity}
  ...
```

`JokerExchangeConfirmDialog.tsx:53–58`:

```tsx
<DialogTitle>Exchange Joker?</DialogTitle>
<DialogDescription>
  Exchange {tileName} with Joker from {opportunity.targetSeat}?
</DialogDescription>
```

Test `JokerExchangeConfirmDialog.test.tsx:28` asserts `"Exchange 6 Bam with Joker from West?"`.

The spec includes `[Seat]` may be the local player's own seat. `handleJokerTileClick` in `PlayingPhasePresentation.tsx:315–317` calls `meldActions.handleJokerTileClick(gameState.your_seat, ...)` for own melds, so `opportunity.targetSeat` will correctly be the local seat.

**Verdict: PASS**.

### AC-5 — No / Escape closes dialog without command

**Source lines**:

`JokerExchangeConfirmDialog.tsx:86` — No button calls `onCancel`.
`JokerExchangeConfirmDialog.tsx:25–37` — custom keydown listener for Escape calls `onCancel`.
`JokerExchangeConfirmDialog.tsx:46` — shadcn `Dialog onOpenChange={(open) => !open && onCancel()}` also handles Escape via Radix.

**Minor note**: There are two Escape handlers (the custom `useEffect` and Radix's built-in). This means `onCancel` (`handleCancelExchange`) will fire twice on Escape. Since `handleCancelExchange` is idempotent (resets state that's already null), this is harmless in practice, but it's a redundant handler. The test (`useMeldActions.test.ts:111–126`) only exercises the custom handler.

**Verdict: PASS** (no command sent; double-fire is harmless).

### AC-6 — Yes when tile found sends ExchangeJoker + loading state

**Source lines**:

`useMeldActions.ts:151–176` — `handleConfirmExchange`:

```tsx
  const hasStagedTile = stagedTiles.includes(representedTile);
  const hasConcealedTile = concealedHand.includes(representedTile);
  if (!hasStagedTile && !hasConcealedTile) { setInlineError(...); return; }
  setInlineError(null);
  setJokerExchangeLoading(true);
  sendCommand({ ExchangeJoker: { player, target_seat, meld_index, replacement } });
```

`PlayingPhaseOverlays.tsx:271–276` — onConfirm passes both staging slices:

```tsx
  onConfirm={() =>
    meldActions.handleConfirmExchange(
      [...stagedTiles.incoming, ...stagedTiles.outgoing],
      stagedTiles.concealedAfterExcludingStaged
    )
  }
```

`PlayingPhase.tsx:251–254` — `stagedTiles` slice built correctly:

```tsx
  stagedTiles={{
    incoming: playing.stagedIncomingTile ? [playing.stagedIncomingTile.tile] : [],
    outgoing: stagedOutgoingTiles,
    concealedAfterExcludingStaged,
  }}
```

`JokerExchangeConfirmDialog.tsx:73` — Yes button is `disabled={isLoading}` and shows spinner when loading.

Test `useMeldActions.test.ts:115–150` covers the staged-tiles-first path. Test at line 152–178 covers the concealed-hand fallback.

**Verdict: PASS**.

### AC-7 — Yes when tile absent shows inline error, no command

**Source lines**:

`useMeldActions.ts:158–162`:

```tsx
if (!hasStagedTile && !hasConcealedTile) {
  setInlineError(`You don't have ${getTileName(representedTile)} to exchange.`);
  setJokerExchangeLoading(false);
  return;
}
```

`JokerExchangeConfirmDialog.tsx:60–68`:

```tsx
{
  inlineError ? (
    <p data-testid="joker-exchange-inline-error" role="alert">
      {inlineError}
    </p>
  ) : null;
}
```

Test `useMeldActions.test.ts:180–206` confirms no command sent and error string set.
Test `JokerExchangeConfirmDialog.test.tsx:94–109` confirms error renders in DOM.

**Verdict: PASS**.

### AC-8 — Dialog closes automatically on `SET_JOKER_EXCHANGED`

**Source lines**:

`useMeldActions.ts:208–211`:

```tsx
SET_JOKER_EXCHANGED: () => {
  handleCancelExchange();
  return true;
},
```

`handleCancelExchange` resets `pendingExchangeOpportunity` to null, closing the dialog (`isOpen` check at `PlayingPhaseOverlays.tsx:267`).

Test `useMeldActions.test.ts:208–238` dispatches `SET_JOKER_EXCHANGED` and asserts `pendingExchangeOpportunity === null`.

**Verdict: PASS**.

### AC-9 — No `joker-exchange-dialog` testid in DOM

**Source lines**:

[JokerExchangeDialog.tsx] is deleted (Glob returns nothing). `PlayingPhaseOverlays.test.tsx:180` asserts `queryByTestId('joker-exchange-dialog')` is not in the document.

**Verdict: PASS**.

### AC-10 — No `exchange-joker-button` testid in DOM

Already enforced by US-052. Confirmed by `ActionBar.test.tsx:121` and `ActionBarPhaseActions.test.tsx:63` asserting the testid is absent.

**Verdict: PASS**.

### AC-11 — Multiple exchangeable Jokers have independent click targets

**Source lines**:

`useMeldActions.ts:82–90` — iterates all `joker_assignments` entries per meld, one `ExchangeOpportunity` pushed per position.
`useMeldActions.ts:99–113` — per-seat per-meld positions list. Multiple positions in the same meld produce `{ meldIndex: [pos1, pos2] }`.
`MeldDisplay.tsx:87–129` — each tile index is checked independently against `exchangeableTilePositions`; each gets its own `<button>` with `onClick={() => onJokerTileClick?.(index)}`.

Test fixture at `useMeldActions.test.ts:27–33` has `joker_assignments: { 3: 5, 4: 6 }` — but position 4 (tile 6) isn't in the hand so only one appears in the result. EC-1 below also covers the two-in-same-meld case explicitly.

**Verdict: PASS**.

### AC-12 — Accessibility: aria-label, role, aria-modal, visible heading

**Source lines**:

`JokerExchangeConfirmDialog.tsx:50–55`:

```tsx
  data-testid="joker-exchange-confirm-dialog"
  role="dialog"
  aria-modal="true"

  <DialogTitle className="text-xl font-bold text-yellow-300 text-center">
    Exchange Joker?
  </DialogTitle>
```

Heading is rendered as visible text without `sr-only`.

`MeldDisplay.tsx:117`:

```tsx
aria-label={`Exchange Joker for ${getTileName(representedTile)} - click to exchange`}
```

**Defect — AC-12 aria-label character**: The spec requires an em dash —:

`aria-label="Exchange Joker for [tile name] — click to exchange"`

The implementation uses a plain hyphen-minus `" - "`. This is a literal mismatch with the spec. Screen readers typically announce an em dash as a pause or nothing, while a hyphen reads as "hyphen" in some configurations. Minor but the spec is explicit.

**Verdict: PARTIAL PASS**. `role`, `aria-modal`, and visible heading are correct. The Joker tile wrapper `aria-label` uses a hyphen (`-`) where the spec mandates an em dash (`—`).

### EC-1 — Two Jokers in same meld, independent targets

**Source lines**:

`useMeldActions.ts:82–90` — loop over `Object.entries(jokerAssignments)` pushes each matching position independently. `exchangeableJokersBySeat` at lines 107–109 accumulates `[...positions, opportunity.tilePosition]` per meld index. `MeldDisplay.tsx:89` checks each tile index independently.

**Verdict: PASS**.

### EC-2 — Same tile type in staging and concealed hand

**Source lines**:

`useMeldActions.ts:155` — checks staging first: `stagedTiles.includes(representedTile)`. If found, sends command. `concealedHand` is only checked if staging misses. Test at `useMeldActions.test.ts:152–178` covers this. `concealedAfterExcludingStaged` in `PlayingPhase.tsx:130–145` correctly excludes staged tile instances before passing as `concealedHand`.

**Verdict: PASS**.

### EC-3 — `isBusy` suppresses affordance

**Source lines**:

`useMeldActions.ts:57–58`:

```tsx
const canRenderExchangeAffordance =
  isDiscardingStage && isMyTurn && !readOnly && !isBusy && !jokerExchangeLoading;
```

`useMeldActions.ts:72–73` — returns empty list when false.

`PlayingPhase.tsx:149, 153` — `isBusy: playing.isProcessing`, and `jokerExchangeLoading` also adds to `isBusy` via the affordance formula.

Test `useMeldActions.test.ts:310–311` confirms `exchangeableJokersBySeat.West === {}` when `isBusy=true`.

**Verdict: PASS**.

### EC-4 — Reconnect/remount restores affordance from new snapshot

**Source lines**:

`useMeldActions.ts:72–97` — `jokerExchangeOpportunities` is a `useMemo` over [`canRenderExchangeAffordance`, `gameState.players`, `gameState.your_hand`]. New snapshot props cause recomputation automatically.

**Verdict: PASS** (by design of the hook's dependency array).

### EC-5 — History/read-only: no interactive affordance

**Source lines**:

`PlayingPhase.tsx:151` — `readOnly: historyPlayback.isHistoricalView` passed to `useMeldActions`.
`useMeldActions.ts:57–58` — `!readOnly` in `canRenderExchangeAffordance`.
`useMeldActions.ts:72–73` — empty list when false → `exchangeableJokersBySeat` all empty.

**Minor gap vs. spec wording**: The spec says "ExposedMeldsArea must not receive click props when `readOnly` is true." In `PlayingPhasePresentation.tsx:315–317`, `onJokerTileClick` is wired unconditionally (unlike `onMeldClick` which is gated with `historyPlayback.isHistoricalView ? undefined : ...` at line 311). However, since `exchangeableJokersByMeld` will always be `{}` in read-only mode, `MeldDisplay` never renders any button wrappers, so no click is reachable. `handleJokerTileClick` also guards via `if (!canRenderExchangeAffordance) return` at line 135.

Functionally correct; the prop-passing diverges slightly from the spec's preferred approach of undefined prop omission, but the outcome is identical.

**Verdict: PASS** (functionally; prop omission gap is cosmetic).

### EC-6 — Post-exchange meld update

**Source lines**: Same as EC-4. `jokerExchangeOpportunities` recomputes from the updated `gameState.players` after `JokerExchanged` updates the snapshot.

**Verdict: PASS** (by construction).

### EC-7 — Stage-change closes dialog

**Source lines**:

`useMeldActions.ts:59–70` — `shouldForceClosePending` fires synchronously during render when `pendingExchangeOpportunity !== null && (!isDiscardingStage || !isMyTurn || readOnly)`:

```tsx
  if (shouldForceClosePending) {
    setPendingExchangeOpportunity(null);
    ...
  }
```

Test `useMeldActions.test.ts:241–283` — confirms dialog clears when `isMyTurn` changes to `false`.

**Verdict: PASS**.

### J-key handler removal

Grepping for any `useEffect` with keyboard handling in [useMeldActions.ts] — the file has no `useEffect` at all. The J-key shortcut is fully removed.

**Verdict: PASS**.

### Interaction precedence (meld upgrade + joker exchange)

**Source lines**:

`MeldDisplay.tsx:118–120`:

```tsx
  onClick={(event) => {
    event.stopPropagation();
    onJokerTileClick?.(index);
  }}
```

`stopPropagation()` prevents the outer `ExposedMeldsArea` meld-wrapper `onClick` (which triggers upgrade) from also firing.

**Verdict: PASS**.

## Summary

| Criterion | Verdict           | Notes                                                                                                                           |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| AC-1      | PASS              | Ring + testid on all exchangeable Jokers (own + opponent melds)                                                                 |
| AC-2      | PASS              | Non-exchangeable Jokers render as plain tiles                                                                                   |
| AC-3      | PASS              | Non-Discarding/opponent-turn → empty opportunity list                                                                           |
| AC-4      | PASS              | Click sets `pendingExchangeOpportunity`; dialog body copy correct                                                               |
| AC-5      | PASS              | No/Escape both call onCancel; double-fire on Escape is idempotent                                                               |
| AC-6      | PASS              | Pre-flight passes → ExchangeJoker command sent + loading state                                                                  |
| AC-7      | PASS              | Pre-flight fails → inlineError set, no command                                                                                  |
| AC-8      | PASS              | `SET_JOKER_EXCHANGED` handler calls `handleCancelExchange`                                                                      |
| AC-9      | PASS              | `JokerExchangeDialog` files deleted                                                                                             |
| AC-10     | PASS              | `exchange-joker-button` absent (US-052 confirmed)                                                                               |
| AC-11     | PASS              | Multiple Jokers → multiple independent `<button>` targets                                                                       |
| AC-12     | PARTIAL           | `role`, `aria-modal`, visible heading ✓ — but tile wrapper uses hyphen `-` not em dash `—` in `aria-label`                      |
| EC-1      | PASS              | Two Jokers in same meld produce separate opportunities                                                                          |
| EC-2      | PASS              | Staged-first check; falls back to concealed                                                                                     |
| EC-3      | PASS              | `isBusy` clears opportunity list and suppresses affordance                                                                      |
| EC-4      | PASS              | useMemo deps ensure recompute on new snapshot                                                                                   |
| EC-5      | PASS (functional) | Affordance correctly suppressed; `onJokerTileClick` not set to `undefined` in read-only (cosmetic divergence from spec wording) |
| EC-6      | PASS              | Post-exchange snapshot update triggers recompute                                                                                |
| EC-7      | PASS              | `shouldForceClosePending` closes dialog on stage/turn change                                                                    |

### One literal defect to fix

`MeldDisplay.tsx:117` — change `" - click to exchange"` to `" — click to exchange"` (em dash) to match the spec's exact required string for the Joker tile wrapper `aria-label`.
