# Frontend Layout & Visual Polish Plan

**Status:** Reviewed
**Relates to:** Board square conversion follow-up

**Proceed-flow overlap:** Relevant geometry/control-placement items in this plan are now incorporated into [proceed-flow-user-story-set.md](C:/Repos/mpmahj/docs/implementation/frontend/proceed-flow-user-story-set.md), especially the staging-width, side-rack alignment, left-anchoring, and control decluttering work.

---

## Context

The board was recently converted from a centered rectangle to a square. This plan addresses the follow-up layout tightening, clutter removal, and tile artwork cleanup requested after seeing the square layout in action.

**Goals:**

1. Left-align the board to the viewport edge
2. Align side opponent racks flush with the outer edges of the player rack
3. Remove the AnimationSettings button from the Charleston phase
4. Remove the HouseRulesPanel; repurpose the Settings (gear) icon for future sound settings
5. Widen the staging area so all 6 tiles fit on one row
6. Remove the black SVG stroke from tile artwork (except Joker, which already lacks it)

---

## Change 1 — Left-align the Board

**File:** `apps/client/src/components/game/GameBoard.tsx`

### What changes

The `game-board-layout` div at line ~280 currently centers the board with `mx-auto` and `lg:justify-center`. The board should be left-anchored, but the reserved `right-rail` from US-036 / US-042 must remain in place.

```tsx
// BEFORE
<div
  className="mx-auto flex h-full w-full max-w-[1680px] px-4 pb-4 pt-16 lg:items-center lg:justify-center lg:gap-6"
  data-testid="game-board-layout"
>
  ...
  <div
    className="right-rail hidden w-64 flex-shrink-0 lg:block"
    data-testid="right-rail"
    aria-hidden="true"
  />
</div>

// AFTER
<div
  className="flex h-full w-full px-4 pb-4 pt-16 lg:items-center lg:justify-start"
  data-testid="game-board-layout"
>
  ...
  <div
    className="right-rail hidden w-64 flex-shrink-0 lg:block"
    data-testid="right-rail"
    aria-hidden="true"
  />
</div>
```

### Why

- Removes `mx-auto` so the container is no longer centered in the page
- Changes `lg:justify-center` → `lg:justify-start` to align content to the left
- Removes `max-w-[1680px]` (no longer needed since board is square and left-anchored)
- Keeps the empty `right-rail` spacer div because it is an explicit reserved region from US-036 / US-042, not just a centering hack
- The `px-4` keeps a small gutter from the viewport left edge

### Guardrail

Do **not** remove `data-testid="right-rail"` or the rail reservation classes. The rail is still part of the board layout contract even if it no longer participates in visual centering.

---

## Change 2 — Opponent Rack Flush Alignment (Both Phases)

**Files:**

- `apps/client/src/components/game/phases/CharlestonPhase.tsx` (lines ~400–415)
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` (lines ~179–182)

### Visual changes

The left and right side racks are positioned with `left-4` / `right-4` (16px inset). Changing to `left-0` / `right-0` pushes them flush with the square board container edges, aligning with the outer edges of the player rack and creating more horizontal room for the staging area.

```tsx
// BEFORE
pos === 'right'
  ? 'absolute right-4 top-[42%] z-10 -translate-y-1/2'
  : 'absolute left-4 top-[42%] z-10 -translate-y-1/2';

// AFTER
pos === 'right'
  ? 'absolute right-0 top-[42%] z-10 -translate-y-1/2'
  : 'absolute left-0 top-[42%] z-10 -translate-y-1/2';
```

Same change in both CharlestonPhase.tsx and PlayingPhasePresentation.tsx.

---

## Change 3 — Remove AnimationSettings Button from Charleston Phase

**File:** `apps/client/src/components/game/phases/CharlestonPhase.tsx`

### Button changes

Remove the `charleston-settings-button` toggle button and its `AnimationSettings` panel (lines ~591–609). Remove the `showSettings` local state. Keep the `useAnimationSettings()` hook — `isEnabled()` is still used for animation gating throughout the component.

```tsx
// REMOVE these two blocks entirely:

{
  /* Settings button (top-right) */
}
<div className="absolute right-4 top-4 z-30">
  <Button
    variant="outline"
    size="sm"
    onClick={() => setShowSettings((v) => !v)}
    data-testid="charleston-settings-button"
    aria-pressed={showSettings}
  >
    {showSettings ? 'Hide Settings' : 'Settings'}
  </Button>
</div>;

{
  /* Animation / game settings panel */
}
{
  showSettings && (
    <div className="absolute right-4 top-16 z-30 w-72 rounded-lg bg-gray-900/95 p-4 shadow-xl">
      <AnimationSettings prefersReducedMotion={prefersReducedMotion} />
    </div>
  );
}
```

Also remove:

- `const [showSettings, setShowSettings] = useState(false);` local state
- `import { AnimationSettings } from '../AnimationSettings';`

> **Pattern note:** The `hint-settings-button` in `PlayingPhasePresentation` (same screen position, opens hint settings) is the **approved pattern** for per-phase settings buttons. The `charleston-settings-button` was a divergent implementation and is being removed. Any future per-phase settings button in Charleston should follow the PlayingPhase pattern.

---

## Change 4 — Remove HouseRulesPanel; Repurpose Settings Button

**File:** `apps/client/src/components/game/GameBoard.tsx`

### Panel changes

The gear icon (board-settings-button) currently toggles `showBoardSettings` which renders `HouseRulesPanel`. Replace with a `showSoundSettings` toggle showing a placeholder panel.

```tsx
// BEFORE — state
const [showBoardSettings, setShowBoardSettings] = useState(true);

// AFTER — state
const [showSoundSettings, setShowSoundSettings] = useState(false);
```

```tsx
// BEFORE — button
<Button
  ...
  aria-label={showBoardSettings ? 'Hide board settings' : 'Show board settings'}
  data-testid="board-settings-button"
  onClick={() => setShowBoardSettings((prev) => !prev)}
>
  <Settings className="h-4 w-4" />
</Button>

// AFTER — button
<Button
  ...
  aria-label={showSoundSettings ? 'Hide sound settings' : 'Show sound settings'}
  data-testid="board-settings-button"
  onClick={() => setShowSoundSettings((prev) => !prev)}
>
  <Settings className="h-4 w-4" />
</Button>
```

```tsx
// BEFORE — panel
{
  showBoardSettings && (
    <div
      className={`absolute right-4 ${isCharleston ? 'top-20' : 'top-16'} z-30 w-64 rounded-md bg-black/20 p-2`}
    >
      <HouseRulesPanel rules={gameState.house_rules} onChange={() => {}} readOnly />
    </div>
  );
}

// AFTER — panel
{
  showSoundSettings && (
    <div className="absolute right-4 top-16 z-30 w-64 rounded-md bg-black/80 p-4 text-sm text-white">
      Sound settings coming soon
    </div>
  );
}
```

Also remove `import { HouseRulesPanel } from './HouseRulesPanel';`.

---

## Change 5 — Staging Area: All 6 Tiles on One Row

### 5a. Widen PlayerZone

**File:** `apps/client/src/components/game/PlayerZone.tsx`

The inner container at line ~26 caps at `max-w-[920px]`. At 920px wide, the staging slot gets 70% = 644px. The 6 tile slots (418px) plus the button column (~160px) plus padding leaves very little margin and causes wrapping.

```tsx
// BEFORE
<div className="mx-auto flex w-full max-w-[920px] flex-col gap-3">

// AFTER
<div className="mx-auto flex w-full max-w-full flex-col gap-3">
```

With `max-w-full`, the zone spans the full board width (up to 1200px), giving staging 70% = 840px — ample room for 6 tiles plus the button column.

### 5b. Prevent tile wrapping in StagingStrip

**File:** `apps/client/src/components/game/StagingStrip.tsx`

The slot container at line ~169 uses `flex flex-wrap`. Change to `flex-nowrap`:

```tsx
// BEFORE
<div className="flex flex-wrap justify-center gap-2">{slotElements}</div>

// AFTER
<div className="flex flex-nowrap justify-center gap-2">{slotElements}</div>
```

---

## Change 6 — Remove Black SVG Stroke from Tiles ✅ DONE (manual)

### Root cause

Each regular tile SVG (e.g., `1B_clear.svg`, `E_clear.svg`) contained an outer border path with `stroke="#000000" stroke-width="2" fill="none"`. This was baked into the SVG artwork. The Joker (`J_clear.svg`) did not have this path, which is why it appeared without a black outline.

**CSS cannot override inline SVG stroke when loaded as `<img>`**, so the fix had to be applied to the SVG files directly.

### Status

Manual asset cleanup appears complete for the `_clear.svg` tile set.

- Runtime tile rendering uses `/assets/tiles/...`, which maps to `apps/client/public/assets/tiles/` via `TileImage.tsx`
- `apps/client/src/assets/tiles/` is currently a duplicate/mirror directory, not the runtime source of truth
- `Blank.svg` is still used at runtime for the blank tile and is intentionally outside the `_clear.svg` cleanup scope

No code change is required for tile rendering itself unless a follow-up decides to remove the duplicate `src/assets/tiles/` mirror entirely.

---

## File Summary

| File                                                                                | Change                                                                     |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/client/src/components/game/GameBoard.tsx`                                     | Left-align layout, remove HouseRulesPanel, repurpose Settings button       |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx`                        | Remove AnimationSettings button + panel, rack positions `left-0`/`right-0` |
| `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` | Rack positions `left-0`/`right-0`                                          |
| `apps/client/src/components/game/PlayerZone.tsx`                                    | `max-w-full` for wider staging zone                                        |
| `apps/client/src/components/game/StagingStrip.tsx`                                  | `flex-nowrap` to prevent tile row wrapping                                 |
| `apps/client/public/assets/tiles/*_clear.svg`                                       | ✅ Done — runtime tile outlines cleaned manually                           |
| `apps/client/src/assets/tiles/*_clear.svg`                                          | Optional mirror sync only; not runtime-critical                            |

## Test Impact

These existing tests should be updated alongside the implementation:

- `apps/client/src/components/game/GameBoard.test.tsx`
  - assert left-anchored board layout classes
  - assert `right-rail` is still present
  - assert the gear button toggles the sound-settings placeholder instead of `HouseRulesPanel`
- `apps/client/src/components/game/phases/CharlestonPhase.test.tsx`
  - assert `charleston-settings-button` is absent
  - assert opponent rack classes use `left-0` / `right-0`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx`
  - assert opponent rack classes use `left-0` / `right-0`
- `apps/client/src/components/game/PlayerZone.test.tsx`
  - assert the inner wrapper no longer uses `max-w-[920px]`
- `apps/client/src/components/game/StagingStrip.test.tsx`
  - assert the slot row uses `flex-nowrap`

---

## Verification Checklist

After implementation:

1. Board sits flush-left in viewport with ~16px left gutter
2. Left opponent rack left edge aligns with player rack left edge
3. Right opponent rack right edge aligns with player rack right edge
4. No "Settings"/"Hide Settings" toggle visible in Charleston phase
5. Gear icon in top-right opens "Sound settings coming soon" panel
6. All 6 staging tiles appear on a single row in the Charleston staging strip
7. Right rail reservation still exists beside the board (`data-testid="right-rail"`)
8. ✅ Tiles render without black outline; Joker unchanged — confirmed on runtime assets
9. `npx vitest run apps/client/src/components/game` — clean
10. `npx tsc --noEmit` — clean

---

## Open Questions / Future Work

- **Sound settings panel**: Real sound on/off + volume controls are deferred. The placeholder panel marks the spot.
- **`Auto-sort hand` setting**: Add this to the future sound/settings surface after the rack-local `Sort` migration is fully settled.
- **`src/assets/tiles/` vs `public/assets/tiles/`**: Runtime reads from `public/assets/tiles/`. Decide separately whether the duplicate `src/assets/tiles/` directory should remain as a mirror or be removed.
- **PlayingPhase hint-settings button**: This is the canonical settings button pattern. It stays untouched. Any future settings UI added to Charleston (e.g., hints when that system extends there) should match this button style and position.
