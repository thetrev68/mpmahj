# Frontend Alignment Report: Mockup vs Current Implementation

Audit date: 2026-02-14
Source mockup: `docs/implementation/frontend/component-specs/mahjong-ui-mockup.html`

## Summary

Status: Not complete. Some visual foundations are aligned, but key table-layout and HUD behaviors from the mockup are still missing.

## Aligned Areas

| Element | Status | Evidence |
| :--- | :--- | :--- |
| Table surface | Matched | `apps/client/src/components/game/GameBoard.tsx` uses `bg-gradient-to-br from-green-800 to-green-900`. |
| Wall placement | Matched | `apps/client/src/components/game/Wall.tsx` still positions East/West at `12%` and North/South per mockup-style percentages. |
| Wall counter placement | Matched | `apps/client/src/components/game/WallCounter.tsx` is fixed top-left, matching the "menu/counter corner" intent. |

## Remaining Gaps

### 1. Opponent rack presentation is incomplete

- Mockup expects each opponent area to show identity (name/seat), tile count, and concealed tile backs.
- Current `PlayingPhase` only renders global `TurnIndicator`, per-seat `ExposedMeldsArea`, and the local `ConcealedHand`; no dedicated opponent concealed-hand rack exists.

Key files:

- `apps/client/src/components/game/phases/PlayingPhase.tsx`
- `apps/client/src/components/game/ExposedMeldsArea.tsx`

### 2. Persistent seat-orientation HUD is missing

- Mockup expects a persistent wind/seat compass.
- Current UI shows only the active-seat badge in `TurnIndicator`, not a persistent all-seat mapping panel.

Key files:

- `apps/client/src/components/game/TurnIndicator.tsx`
- `apps/client/src/components/game/phases/PlayingPhase.tsx`

### 3. Discard floor aesthetic does not match mockup

- Mockup expects a translucent "floor" treatment and looser/fanned tile placement feel.
- Current `DiscardPool` uses a strict `grid grid-cols-6` with no floor backdrop and no per-tile rotation jitter.

Key file:

- `apps/client/src/components/game/DiscardPool.tsx`

### 4. Opponent-facing tile orientation is not represented

- Mockup expects opponent-side concealed tiles oriented toward table center.
- Current tiles are upright except called-tile/meld-specific transforms.

Key files:

- `apps/client/src/components/game/Tile.tsx`
- `apps/client/src/components/game/phases/PlayingPhase.tsx`

## Architecture Note

The previous note "refactoring in progress with feature flags" is outdated. `GameBoard` now uses the extracted phase components and event bridge directly (feature flags removed).

Key file:

- `apps/client/src/components/game/GameBoard.tsx`

## Tracking

These remaining items are now tracked in `TODO.md` under P2 as mockup-alignment tasks.
