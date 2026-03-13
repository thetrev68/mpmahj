# US-053: Exchange Joker — Click-to-Exchange Flow

## Status

- State: Proposed
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
