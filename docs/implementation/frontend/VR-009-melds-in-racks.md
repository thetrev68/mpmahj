# VR-009 — Move ExposedMeldsArea Into Racks

**Phase:** 2 — High Impact, Medium Effort
**Status:** Implemented (Codex) Validated (Sonnet)
**Source:** Visual-Redesign-20220222.md §A.2a, §B.3, §D item 9

## Summary

Remove the top-level `ExposedMeldsArea` loops from `PlayingPhasePresentation`. Opponent melds move inside `OpponentRack` as a new melds row. Local player melds move inside `PlayerRack` as a top row in the wooden rack. Both rack components gain a `melds` prop.

## Acceptance Criteria

### OpponentRack

- **AC-1**: `OpponentRack` gains a `melds?: Array<Meld & { called_from?: Seat }>` prop (default `[]`).
- **AC-2**: `OpponentRack`'s meld row remains part of the wooden rack at all times (fixed reserved space, no collapse).
- **AC-3**: When `melds` is non-empty, an `<ExposedMeldsArea melds={melds} compact={true} ownerSeat={player.seat} />` renders inside that meld row above the concealed tile enclosure.
- **AC-4**: `data-testid="exposed-melds-area"` is preserved (it is on `ExposedMeldsArea`'s root element — no change needed there).
- **AC-5**: Existing `data-testid` attributes on `OpponentRack` are unchanged.
- **AC-6**: When `melds` is empty, the meld row still renders at fixed height, but `ExposedMeldsArea` does not render. Do not show any empty-state text or placeholder beyond the rack row itself.

### PlayerRack (local player)

- **AC-7**: `PlayerRack` gains the following optional props (default `[]` / `undefined` where applicable):
  - `melds?: Array<Meld & { called_from?: Seat }>`
  - `yourSeat?: Seat` (required to forward `ownerSeat` to `ExposedMeldsArea` — see AC-7)
  - `upgradeableMeldIndices?: number[]`
  - `onMeldClick?: (meldIndex: number) => void`
- **AC-8**: `PlayerRack`'s meld row remains part of the wooden rack at all times (fixed reserved space, no collapse).
- **AC-9**: When `melds` is non-empty, `<ExposedMeldsArea melds={melds} compact={false} ownerSeat={yourSeat} />` renders inside the wooden rack container, above the tile row.
- **AC-10**: `upgradeableMeldIndices` and `onMeldClick` (for meld upgrade, US-016) are forwarded to `ExposedMeldsArea` via the props added in AC-7.
- **AC-11**: `data-testid` is renamed from `"concealed-hand"` to `"player-rack"` (the component was renamed from `ConcealedHand` to `PlayerRack`; the testid should match). Update the two existing references to `"concealed-hand"` in `PlayerRack.test.tsx` at the same time.

### PlayingPhasePresentation

- **AC-12**: The `gameState.players.map(…)` block that renders a top-level `<ExposedMeldsArea>` for every player is removed entirely (it is a single unified loop — there is no separate opponent loop and local-player call).
- **AC-13**: Each `<OpponentRack>` call receives `melds={player.exposed_melds}`.
- **AC-14**: `<PlayerRack>` receives `melds={localPlayer.exposed_melds}` and `yourSeat={gameState.your_seat}`, where `localPlayer` is `gameState.players.find(p => p.seat === gameState.your_seat)`. Use non-null assertion or optional chaining — `find` may return `undefined` even though the local seat is always present in a valid snapshot.

## Connection Points

| File                                                                                | Location                   | Change                                                                                                        |
| ----------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/client/src/components/game/OpponentRack.tsx`                                  | `OpponentRackProps`        | Add `melds?: Array<Meld & { called_from?: Seat }>`                                                            |
| `apps/client/src/components/game/OpponentRack.tsx`                                  | JSX body                   | Conditionally render `<ExposedMeldsArea>` above wooden enclosure                                              |
| `apps/client/src/components/game/PlayerRack.tsx`                                    | `PlayerRackProps`          | Add `melds?`, `yourSeat?`, `upgradeableMeldIndices?`, `onMeldClick?`; rename `data-testid` to `"player-rack"` |
| `apps/client/src/components/game/PlayerRack.tsx`                                    | Inside wooden rack `<div>` | Conditionally render `<ExposedMeldsArea>` above tile row                                                      |
| `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` | `ExposedMeldsArea` usages  | Remove; pass melds via rack props                                                                             |

### ExposedMeldsArea import

Both `OpponentRack` and `PlayerRack` will need:

```tsx
import { ExposedMeldsArea } from './ExposedMeldsArea';
import type { Meld } from '@/types/bindings/generated/Meld';
```

(`Seat` is already imported in both files — do not add a duplicate import. It is referenced in the augmented meld type and in the `yourSeat` prop on `PlayerRack`.)

## Test Requirements

### Shared Fixture

Use the following `mockMeld` in T-1, T-4, T-7, and T-8:

```ts
const mockMeld = {
  meld_type: 'Pung' as const,
  tiles: [1, 1, 1],
  called_tile: 1,
  joker_assignments: {},
};
```

### Unit Tests — OpponentRack

**File:** `apps/client/src/components/game/OpponentRack.test.tsx` (existing — add)

- **T-1**: Render with `melds={[mockMeld]}`. Assert `getByTestId('exposed-melds-area')` is present.
- **T-2**: Render with `melds={[]}`. Assert `queryByTestId('exposed-melds-area')` is null, but the fixed meld row in the rack is still present.
- **T-3**: Assert the meld row renders before the concealed tile enclosure in DOM order.

### Unit Tests — PlayerRack

**File:** `apps/client/src/components/game/PlayerRack.test.tsx` (existing — add)

- **T-0**: Update existing `getByTestId('concealed-hand')` / `toHaveAttribute(…'concealed-hand')` references to `'player-rack'` (two occurrences, required by AC-9).
- **T-4**: Render with `melds={[mockMeld]}`. Assert `getByTestId('exposed-melds-area')` is present inside the rack.
- **T-5**: Render without `melds`. Assert `queryByTestId('exposed-melds-area')` is null, but the fixed meld row in the rack is still present.
- **T-6**: Render with `melds`, `upgradeableMeldIndices={[0]}`, and `onMeldClick` mock. Simulate click on `data-testid="meld-upgrade-wrapper-0"` inside the exposed-melds-area. Assert `onMeldClick` called with `0`.

### Integration Tests

**File:** `apps/client/src/features/game/Playing.integration.test.tsx` (new)

- **T-7**: After a `TileCalled` event that exposes melds for East, assert `getByTestId('opponent-rack-east')` contains an `exposed-melds-area`.
- **T-8**: After a `TileCalled` event for the local player, assert `getByTestId('player-rack')` contains an `exposed-melds-area`.
- **T-9**: Assert no duplicate `exposed-melds-area` elements exist in the DOM (PlayingPhasePresentation no longer renders its own).

## Out of Scope

- Meld upgrade UI changes (US-016).
- Compact vs. full display differences are already handled by the `compact` prop on `ExposedMeldsArea`.

## Dependencies

- VR-003 (wooden enclosure in OpponentRack) — melds should render within the established wooden rack structure.
- VR-008 (PlayerZone) — PlayerRack already has wooden rack; melds slot inside it naturally once positioning is resolved.
