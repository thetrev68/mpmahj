# Phase 2: Core Components and Layouts

## Goal

Build the core UI components used throughout the game. These components must handle Tile(u8) rendering, support both desktop and mobile, and be modular enough to support Charleston, calls, and scoring.

## 1. Component Inventory (Minimum Set)

**Game components (`apps/client/src/components/game`)**

- `Tile.tsx`: render a tile by id with hover/selection.
- `TileBack.tsx`: render the back face.
- `TileRow.tsx`: horizontal row for hands or recent discards.
- `Meld.tsx`: exposed meld (Pung/Kong/Quint).
- `DiscardGrid.tsx`: grid of all discards.
- `LastDiscardFocus.tsx`: large center tile.
- `PlayerStatus.tsx`: name, seat, connection, tile count.
- `OpponentStrip.tsx`: compact display for 3 opponents (mobile).
- `TableLayout.tsx`: overall 4-seat arrangement.
- `ActionBar.tsx`: call/discard buttons.
- `TurnBanner.tsx`: current turn indicator.
- `WallCounter.tsx`: remaining tiles.

**Feature components (`apps/client/src/components/features`)**

- `charleston/CharlestonOverlay.tsx`
- `call/CallWindow.tsx`
- `card/CardViewer.tsx`
- `scoring/ScoringSummary.tsx`
- `settings/SettingsModal.tsx`

**UI primitives (`apps/client/src/components/ui`)**

- `Button.tsx`, `Modal.tsx`, `Toast.tsx`, `Tooltip.tsx`, `Badge.tsx`

## 2. Tile Rendering (Tile(u8) Model)

**File:** `apps/client/src/components/game/Tile.tsx`

```tsx
import type { Tile as TileId } from '@/types/bindings';
import { tileAssetPath, tileLabel } from '@/utils/tile';

type TileProps = {
  tile: TileId;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  selected?: boolean;
  highlighted?: boolean;
  hidden?: boolean;
  interactive?: boolean;
  onClick?: (tile: TileId) => void;
  className?: string;
};

export function Tile({
  tile,
  size = 'md',
  selected,
  highlighted,
  hidden,
  interactive,
  onClick,
  className,
}: TileProps) {
  const label = tileLabel(tile);
  const src = tileAssetPath(tile);

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={!!selected}
      disabled={!interactive}
      onClick={() => onClick?.(tile)}
    >
      {hidden ? <TileBack size={size} /> : <img src={src} alt={label} />}
      {selected && <span className="tile-selected-ring" />}
      {highlighted && <span className="tile-highlight-ring" />}
    </button>
  );
}
```

**Test criteria**

- Renders correct asset for tile id.
- Uses `TileBack` when `hidden` is true.
- Click calls `onClick`.

## 3. Hand and Meld Components

**File:** `apps/client/src/components/game/Hand.tsx`

- Uses `tileKey` utilities for stable keys.
- Uses `LayoutGroup` for smooth reordering.
- Selection limit for Charleston (max 3).

**File:** `apps/client/src/components/game/Meld.tsx`

```tsx
type MeldProps = {
  meld: Meld;
  size?: 'xs' | 'sm' | 'md';
};
```

## 4. Discards and Table Center

**File:** `apps/client/src/components/game/DiscardGrid.tsx`

- Desktop: 12x? grid with consistent gaps.
- Mobile: show last 6 in a horizontal row + a toggle for full grid.

**File:** `apps/client/src/components/game/LastDiscardFocus.tsx`

- Large tile for the most recent discard.
- Click opens "CallWindow" if `TurnStage.CallWindow` and you can act.

## 5. Player Layout

**File:** `apps/client/src/components/game/TableLayout.tsx`

- Uses seat rotation (local player always south).
- Maps `Seat` to visual positions: north/east/south/west.
- Takes `players`, `currentTurn`, `yourSeat` and renders `PlayerStatus` + exposed melds.

```tsx
type TableLayoutProps = {
  players: PublicPlayerInfo[];
  currentTurn: Seat;
  yourSeat: Seat;
  discardPile: DiscardInfo[];
  remainingTiles: number;
};
```

## 6. Action Bar and Contextual Actions

**File:** `apps/client/src/components/game/ActionBar.tsx`

Buttons depend on `GamePhase` and `TurnStage`:

- `Draw` button only when `TurnStage.Drawing` and player is current.
- `Discard` button when `TurnStage.Discarding` and tile selected.
- `Call` and `Pass` button only during `CallWindow`.
- `Mahjong` button when eligible (client-side check).
- `Exchange Joker` and `Exchange Blank` buttons when house rules allow it.

## 7. Layouts (Desktop vs Mobile)

**File:** `apps/client/src/components/layout/GameRoom.tsx`

```tsx
const isMobile = useMediaQuery('(max-width: 840px)');
return isMobile ? <MobileLayout /> : <DesktopLayout />;
```

**Mobile layout:**

- Top bar (room, turn, wall)
- Opponent strip (avatars + tile count)
- Center field (last discard + recent discards + show table toggle)
- Player zone (exposed melds + hand + action bar)

**Desktop layout:**

- Table grid with all players visible.
- Discard grid in center.
- Action bar anchored bottom.

## 8. UI Primitives

Ensure `Button`, `Modal`, `Toast`, and `Tooltip` are consistent with the design system in `docs/architecture/frontend/11-ui-ux-design.md`.

## 9. Preview and Fixtures

Create a "fixture page" to test components in isolation without backend:

- `apps/client/src/pages/DevGallery.tsx`
- Provide hard-coded `GameStateSnapshot` fixtures.
- Add route toggle in `App.tsx` guarded by `import.meta.env.DEV`.

## Deliverables

1. Tile component and tile utilities wired to assets.
2. Hand, meld, and discard components with selection/animation support.
3. Table layout for desktop and mobile.
4. Action bar wired to phase/turn logic.
5. Dev fixture page to validate UI without server.
