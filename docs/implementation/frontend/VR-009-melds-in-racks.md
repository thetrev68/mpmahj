# VR-009 — Move ExposedMeldsArea Into Racks

**Phase:** 2 — High Impact, Medium Effort
**Source:** Visual-Redesign-20220222.md §A.2a, §B.3, §D item 9

## Summary

Remove the top-level `ExposedMeldsArea` loops from `PlayingPhasePresentation`. Opponent melds move inside `OpponentRack` as a new melds row. Local player melds move inside `PlayerRack` as a top row in the wooden rack. Both rack components gain a `melds` prop.

## Acceptance Criteria

### OpponentRack

- **AC-1**: `OpponentRack` gains a `melds: Meld[]` prop (default `[]`).
- **AC-2**: When `melds` is non-empty, an `<ExposedMeldsArea melds={melds} compact={true} ownerSeat={player.seat} />` row renders above the concealed tile enclosure.
- **AC-3**: `data-testid="exposed-melds-area"` is preserved (it is on the `ExposedMeldsArea` inner element — no change needed there).
- **AC-4**: Existing `data-testid` attributes on `OpponentRack` are unchanged.
- **AC-5**: When `melds` is empty, the melds row does not render (zero height, no placeholder).

### PlayerRack (local player)

- **AC-6**: `PlayerRack` gains a `melds?: Array<Meld & { called_from?: Seat }>` prop (default `[]`).
- **AC-7**: When `melds` is non-empty, `<ExposedMeldsArea melds={melds} compact={false} ownerSeat={yourSeat} />` renders inside the wooden rack container, above the tile row.
- **AC-8**: `upgradeableMeldIndices` and `onMeldClick` (for meld upgrade, US-016) are forwarded to the `ExposedMeldsArea` via additional optional props on `PlayerRack`:
  - `upgradeableMeldIndices?: number[]`
  - `onMeldClick?: (meldIndex: number) => void`
- **AC-9**: `data-testid="player-rack"` is preserved.

### PlayingPhasePresentation

- **AC-10**: The `ExposedMeldsArea` loop over all opponent seats (if present) is removed.
- **AC-11**: The local player's standalone `<ExposedMeldsArea>` call is removed.
- **AC-12**: Each `<OpponentRack>` call receives `melds={player.exposed_melds}`.
- **AC-13**: `<PlayerRack>` receives `melds={localPlayer.exposed_melds}` (where `localPlayer` is derived from `gameState.players.find(p => p.seat === gameState.your_seat)`).

## Connection Points

| File | Location | Change |
|------|----------|--------|
| `apps/client/src/components/game/OpponentRack.tsx` | `OpponentRackProps` | Add `melds?: Meld[]` |
| `apps/client/src/components/game/OpponentRack.tsx` | JSX body | Conditionally render `<ExposedMeldsArea>` above wooden enclosure |
| `apps/client/src/components/game/PlayerRack.tsx` | `PlayerRackProps` | Add `melds?`, `upgradeableMeldIndices?`, `onMeldClick?` |
| `apps/client/src/components/game/PlayerRack.tsx` | Inside wooden rack `<div>` | Conditionally render `<ExposedMeldsArea>` above tile row |
| `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` | `ExposedMeldsArea` usages | Remove; pass melds via rack props |

### ExposedMeldsArea import

Both `OpponentRack` and `PlayerRack` will need:

```tsx
import { ExposedMeldsArea } from './ExposedMeldsArea';
import type { Meld } from '@/types/bindings/generated/Meld';
```

## Test Requirements

### Unit Tests — OpponentRack

**File:** `apps/client/src/components/game/OpponentRack.test.tsx` (existing — add)

- **T-1**: Render with `melds={[mockMeld]}`. Assert `getByTestId('exposed-melds-area')` is present.
- **T-2**: Render with `melds={[]}`. Assert `queryByTestId('exposed-melds-area')` is null.
- **T-3**: Assert melds area renders before the concealed tile enclosure in DOM order.

### Unit Tests — PlayerRack

**File:** `apps/client/src/components/game/PlayerRack.test.tsx` (existing — add)

- **T-4**: Render with `melds={[mockMeld]}`. Assert `getByTestId('exposed-melds-area')` is present inside the rack.
- **T-5**: Render without `melds`. Assert `queryByTestId('exposed-melds-area')` is null.
- **T-6**: Render with `melds`, `upgradeableMeldIndices={[0]}`, and `onMeldClick` mock. Simulate click on upgradeable meld. Assert `onMeldClick` called with `0`.

### Integration Tests

**File:** `apps/client/src/features/game/Playing.integration.test.tsx` or `ExposedMelds.integration.test.tsx`

- **T-7**: After a `PungCalled` event that exposes melds for East, assert `getByTestId('opponent-rack-east')` contains an `exposed-melds-area`.
- **T-8**: After a `PungCalled` event for the local player, assert `getByTestId('player-rack')` contains an `exposed-melds-area`.
- **T-9**: Assert no duplicate `exposed-melds-area` elements exist in the DOM (PlayingPhasePresentation no longer renders its own).

## Out of Scope

- Meld upgrade UI changes (US-016).
- Compact vs. full display differences are already handled by the `compact` prop on `ExposedMeldsArea`.

## Dependencies

- VR-003 (wooden enclosure in OpponentRack) — melds should render within the established wooden rack structure.
- VR-008 (PlayerZone) — PlayerRack already has wooden rack; melds slot inside it naturally once positioning is resolved.
