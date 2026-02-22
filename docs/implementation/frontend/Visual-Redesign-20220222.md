# Professional Redesign Plan: American Mahjong UI

> Recovered from session `dea6642e` · UI/UX agent output · 2026-02-21

## Executive Summary

This plan addresses two parallel problems. The staging area problem is a functional gap — without a visible outgoing slot strip, users have no spatial model of what they are committing to pass. The visual polish problem is a presentation gap — the current layout reads as a prototype rather than a finished product. Both are solvable within the existing React + Tailwind constraint set, without touching any `data-testid` attributes or component API shapes.

The plan is organized into four sections: A (Staging Area), B (Opponent Rack), C (Overall Layout), and D (Implementation Roadmap).

---

## A. Staging Area Design

### A.1 Mental Model and Layout Rationale

The user's hand rack sits at the very bottom of the screen (`fixed bottom-4`). When a tile is selected in charleston mode, it lifts upward via `translateY(-12px)`. This upward motion already implies "moving toward a destination above." The staging area exploits that affordance by placing exactly that destination above the rack.

The staging area is a fixed-width strip that sits immediately above the rack, visually attached to it. Together the two form a single "player zone" — the rack is where your hand lives, the staging strip is what you are committing to/from the table.

### A.2 Slot Layout — 6 Slots

```
┌────────────────────────────────────────────────────────────────────────┐
│                         PLAYER ZONE                                    │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  STAGING STRIP                                                   │  │
│  │                                                                  │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐  ┌──────┐ ┌──────┐ ┌──────┐       │  │
│  │  │  T1  │ │  T2  │ │  T3  │  │  ?   │ │  ?   │ │  ?   │       │  │
│  │  │      │ │ [sel]│ │      │  │ face │ │ face │ │ face │       │  │
│  │  └──────┘ └──────┘ └──────┘  └──────┘ └──────┘ └──────┘       │  │
│  │                                                                  │  │
│  │  [PASS TILES]  (disabled until 3/3 filled)                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  HAND RACK (wooden)                                              │  │
│  │  [tile][tile][tile][tile][tile][tile][tile][tile][tile][tile]    │  │
│  │  [tile][tile][tile][tile][tile][tile]                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

The 6 slots are represented by a dashed-line border around where each of the 6 tiles would sit. When tiles are selected, the move from the rack to the staging area. When tiles are received, the arrive at the staging area and players select them to animate them to the rack.

### A.3 Slot States

Each slot has four visual states:

**Empty:**

```text
┌──────┐
│      │
│  ··  │   border: 2px dashed rgba(255,255,255,0.25)
│      │   background: rgba(255,255,255,0.04)
└──────┘
```

Tailwind: `border-2 border-dashed border-white/25 bg-white/[0.04] rounded-md`

**Filled:**
Tile is rendered at `size="medium"` (63x90px) directly in the slot. The slot background disappears because the tile image fills it. A gold glow border echoes the existing `tile-selected` gold treatment:

```
border: 2px solid #ffd700
box-shadow: 0 0 8px rgba(255,215,0,0.4)
```

**Blind (incoming — for FirstLeft / SecondRight blind pass stages):**
Slot shows a face-down tile back instead of the selected tile's face. A small "BLIND" badge in amber sits at the top-right corner of the slot. This uses the existing `faceUp={false}` prop on `Tile`.

```text
┌──────┐
│BLIND │   amber badge, text-[10px]
│ ╔══╗ │   face-down tile back (gray gradient from Tile.css)
│ ╚══╝ │
└──────┘
```

### A.4 Interaction Model

**Clicking a tile in the rack during charleston mode:**
Currently the tile lifts with `translateY(-12px)`. After the redesign, clicking a tile moves its visual representation to the next empty outgoing slot in the staging strip. The tile in the rack becomes a ghost placeholder (opacity: 0.25, no interaction) showing where the tile came from. Clicking the staged tile (or the ghost) removes it from the staging strip and returns it to the rack.

This is accomplished entirely in `ConcealedHand` and the new `StagingStrip` component with no change to the underlying `selectedIds` state shape. The `selectedIds` array already tracks which tiles are selected — the staging strip reads that same array to populate its slots in order.

**Pass button enabling:**
The "Pass Tiles" button inside `ActionBar` is already gated on `totalSelected === 3`. After the redesign the button moves from the floating `ActionBar` panel into the staging strip's own footer, so the gate logic is closer to the visual slot fill state. The ActionBar's separate "Pass Tiles" button is removed from the charleston-phase render path; a new `onPassRequest` prop passes the command up. This is a non-breaking change because the `data-testid="pass-tiles-button"` attribute stays on whatever element renders the button.

### A.5 Opponent Staging Area During Charleston

Show a simplified staging indicator on each opponent rack: three small tiles in a row below the opponent's tile backs. Each tile remains face down and their presence indicates how many tiles they have committed. This does NOT reveal which tiles were selected. As each opponent calls `PlayerReadyForPass`, the tiles fill in one by one.

```
Opponent: West (Bot)
[back][back][back][back][back][back][back][back][back][back][back][back][back]
  O    O    O      ← 0/3 staged
```

vs.

```
  ●    ●    O      ← 2/3 staged
```

vs.

```
  ●    ●    ●  ✓   ← ready (checkmark badge from CharlestonTracker ready list)
```

### A.6 Playing Phase — Drawn Tile Staging

During the playing phase the 6-slot strip remains. The incoming slot concept is reduced to a single "drawn tile zone" — a highlighted single slot that appears when it is the player's drawing turn. The drawn tile arrives in this slot with the `tile-newly-drawn` pulse animation, then the player can move it into position in the rack. This single-slot staging does not require a new component; it is an extension of the existing `newlyDrawn` highlight with a positional container added to `ConcealedHand`.

### A.7 New Component: StagingStrip

**File:** `apps/client/src/components/game/StagingStrip.tsx`

Props interface:

```typescript
interface StagingStripProps {
  /** Tiles from the player's hand that are committed outgoing */
  outgoingTiles: TileInstance[];        // derived from selectedIds
  /** How many outgoing slots to show (3 for standard, 0-3 for courtesy) */
  outgoingSlotCount: number;
  /** Whether to show tiles face-down in outgoing slots (blind pass stages) */
  blindOutgoing: boolean;
  /** Incoming slot count (3 while waiting, 0 after tiles received) */
  incomingSlotCount: number;
  /** Tiles received this pass (for filled incoming slots) */
  incomingTiles: TileInstance[];
  /** Direction label for the current pass */
  directionLabel: string;
  /** Called when user removes a tile from staging (returns it to rack) */
  onRemoveTile: (tileId: string) => void;
  /** Called when Pass Tiles is confirmed */
  onPassTiles: () => void;
  /** Whether the pass button is enabled */
  canPass: boolean;
  /** Pass is in-flight */
  isProcessing: boolean;
  /** Seat tiles are entering from (for animation) */
  incomingFromSeat?: Seat | null;
}
```

The test surface that must be preserved is `data-testid="pass-tiles-button"` on the button element. This testid migrates to the button inside `StagingStrip` with no change to any test file because the button's testid is what tests query — not its parent component.

---

## B. Opponent Rack Redesign

### B.1 Current Problem

`OpponentRack` renders: label + tile-count badge + a flat row/column of face-down tile backs. There is no visual "rack" container. The `ExposedMeldsArea` is rendered separately in `PlayingPhasePresentation` in a loop over all players, meaning the opponent's melds are floating elsewhere on the screen disconnected from their rack.

### B.2 New OpponentRack Layout

Each opponent rack becomes a mini-zone with three layers: an exposed melds section (top, face-up), a rack enclosure (the concealed tiles), and a player label bar underneath.

**Top rack (opponent seated across from player):** --this section is out of order. should be bot name on top, then rack, then melds, then staging area--

```text
┌─────────────────────────────────────────────────────┐
│  MELDS AREA (shown only if exposed_melds > 0)        │
│  ┌────┐  ┌────┐  ┌────┐                              │
│  │meld│  │meld│  │meld│  (compact=true, small tiles) │
│  └────┘  └────┘  └────┘                              │
├─────────────────────────────────────────────────────┤
│  CONCEALED RACK                                      │
│  [■][■][■][■][■][■][■][■][■][■][■][■][■]            │
│                                                      │
│  STAGING TILES (charleston only)                      │
│  ● ● O                                               │
├─────────────────────────────────────────────────────┤
│  West (Bot)   [11]                                   │  ← label bar
└─────────────────────────────────────────────────────┘
```

The rack enclosure uses the same wooden gradient as the player's own rack:

```css
background: linear-gradient(to bottom, #8B5E3C 0%, #6B4226 55%, #4A2D1A 100%);
box-shadow: inset 0 2px 4px rgba(255,255,255,0.08), 0 5px 14px rgba(0,0,0,0.6);
```

This creates visual symmetry — all four racks look like actual wooden holders.

**Left/Right rack (side opponents):** --this section is wrong--
The same structure rotated 90 degrees. The melds area sits on the table-side edge (inner edge facing center), and the label bar is on the outer edge. Since the constraint forbids 3D transforms, the rotation is the existing CSS `rotate(90deg)` already used for individual tile backs — applied to the entire rack container. No new CSS is needed.

```
                    ┌──────┐
   ┌─────────┐      │MELDS │
   │  label  │      │ area │
   │ E (Bot) │  →   │──────│
   │  [9]    │      │RACK  │
   └─────────┘      │[■][■]│
                    │[■][■]│
                    │  ●●O │
                    └──────┘
```

### B.3 Integrating ExposedMeldsArea into OpponentRack

Currently `ExposedMeldsArea` is instantiated in `PlayingPhasePresentation` for all players including the local player. The local player's melds should remain where they are (the existing `ExposedMeldsArea` call with `compact={false}`). The opponent melds should move inside `OpponentRack`.

Change to `OpponentRack`:

- Add `melds: Meld[]` prop (already available from `player.exposed_melds`)
- Add `phase: 'charleston' | 'playing'` prop so staging dots only render during Charleston
- Add `charlestonReadyCount?: number` prop for staging dot fill count
- Render `<ExposedMeldsArea melds={melds} compact={true} ownerSeat={player.seat} />` inside the rack container, above the tile-backs row

Change to `PlayingPhasePresentation`:

- Remove the `ExposedMeldsArea` loop over all players
- Add `melds={p.exposed_melds}` to each `OpponentRack` call
- Keep the local player's `ExposedMeldsArea` call exactly as-is

Change to `CharlestonPhase`:

- Add `readyCount` derived from `charleston.readyPlayers` to each `OpponentRack` call

Existing test surface that must be preserved: `data-testid="opponent-rack-{seat}"`, `data-testid="opponent-seat-{seat}"`, `data-testid="opponent-tile-count-{seat}"`. These stay on their current elements. `data-testid="exposed-melds-area"` moves inside the rack but the attribute itself is unchanged.

### B.4 Rack Container Visual Specification

**Tailwind classes for the concealed tile enclosure (replaces the current bare flex div):**

```
rounded-md px-1.5 pt-1 pb-2
```

With inline style matching the player's own rack:

```javascript
style={{
  background: 'linear-gradient(to bottom, #8B5E3C 0%, #6B4226 55%, #4A2D1A 100%)',
  boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.08), 0 4px 10px rgba(0,0,0,0.5)',
}}
```

**Label bar:**

```
bg-black/60 rounded-b-md px-2 py-1 text-xs text-slate-200 font-medium
flex items-center justify-between
```

The tile-count badge changes from `bg-slate-700` to `bg-amber-900/60 text-amber-200` to make it more readable against the dark felt background.

---

## C. Overall Layout and Polish

### C.1 Unified Player Zone

The player's bottom area should read as a single cohesive zone. Currently there are three separate elements floating independently:

- `ConcealedHand`: `fixed bottom-4 left-1/2 -translate-x-1/2`
- `ActionBar`: `fixed right-[16%] top-1/2 -translate-y-1/2`
- Selection counter: inside ConcealedHand above the rack

**After redesign — the Player Zone:** --missing the meld area--

```
fixed bottom-0 left-0 right-0
height: auto (expands upward from bottom edge)
```

The zone is divided into two columns:

```
┌───────────────────────────────────────────┬──────────────────┐
│  CENTER: staging strip + hand rack         │  RIGHT: actions  │
│                                            │                  │
│  ┌──────────────────────────────────────┐  │  [Pass Tiles]    │
│  │ STAGING STRIP (charleston only)      │  │  [Discard]       │
│  │ [slot][slot][slot] | [slot][slot][sl]│  │  [Get Hint]      │
│  └──────────────────────────────────────┘  │  ─────────────   │
│  ┌──────────────────────────────────────┐  │  [Leave]         │
│  │ HAND RACK (wooden)                   │  │  [Forfeit]       │
│  │ [t][t][t][t][t][t][t][t][t][t][t]   │  │  ─────────────   │
│  └──────────────────────────────────────┘  │  [Sort]          │
└───────────────────────────────────────────┴──────────────────┘
```

This is achieved by converting `ConcealedHand`'s `fixed bottom-4 left-1/2` to `fixed bottom-0 left-0 right-0` on the outer `PlayerZone` wrapper, and making `ActionBar`'s container the right column of that wrapper instead of a fully independent fixed element. The `ActionBar` component itself changes its outermost wrapper from `fixed right-[16%] top-1/2` to `relative` with no position — positioning is handled by the zone.

The visual treatment for the zone itself:

```
background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 80%, transparent 100%)
```

This gradient fades up into the felt table, making the bottom feel anchored without a hard edge.

### C.2 Color Palette and Visual Hierarchy

**Table felt (body background):**
The current `bg-background` from shadcn defaults to white. Add a felt green to the game-specific layout wrapper:

```javascript
// In GameBoard.tsx wrapper or a new PlayerZone wrapper:
style={{ background: 'radial-gradient(ellipse at center, #1a6b3a 0%, #0d4a26 60%, #082d17 100%)' }}
```

This gives a richer center-highlight that real felt has, rather than flat green.

**Wall stacks:**
The current `WallStack` is `linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)` with a gray border — visually indistinguishable from plain white boxes. Change to an ivory/bone palette that reads as tile backs:

```javascript
// WallStack inline style:
background: 'linear-gradient(135deg, #f5f0e8 0%, #e8ddd0 50%, #d9c9b5 100%)'
borderColor: '#9a8b7a'
```

Add a subtle top-edge highlight to simulate a flat tile edge:

```javascript
boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.3)'
```

**CharlestonTracker:**
The current tracker is `bg-black/85` which reads as a dark popup. Convert to a more integrated banner that looks like a game HUD element:

```
background: linear-gradient(to right, rgba(15,40,20,0.95), rgba(20,55,30,0.95))
border-bottom: 2px solid rgba(100,200,120,0.3)
border-left: none; border-right: none; border-top: none
```

Full-width across the top (remove the `left-1/2 -translate-x-1/2` centering, switch to `left-0 right-0`) so it reads as a game status bar rather than a floating tooltip.

**WindCompass:**
Currently `bottom-4 right-4`. Keep position but increase size from `w-28 h-28` to `w-32 h-32` and sharpen the background to `bg-green-950/90` to match the new table color.

### C.3 Charleston Direction Animation Overlay

The existing `PassAnimationLayer` is already separate. The suggestion is to enhance its visual to use a full-width translucent banner rather than a centered element, showing:

```
┌──────────────────────────────────────────────────────────────────────┐
│          ←←←   PASSING LEFT   ←←←                                   │
│          3 tiles moving to: West                                     │
└──────────────────────────────────────────────────────────────────────┘
```

This banner fades in for 600ms, holds for 400ms, fades out — matching the existing `passDirectionDurationRef` duration already in `CharlestonPhase.tsx`.

### C.4 Typography and Label Improvements

**Current:**

- Opponent labels: `text-xs text-slate-300 font-medium` on a bare element with no background
- Section headers: inconsistent sizing, some `text-sm`, some `text-xs`

**After:**

Establish three text roles:

- **HUD label** (persistent, always-visible info): `text-xs font-semibold tracking-wide text-slate-200 uppercase`
- **Status message** (transient, aria-live): `text-sm text-emerald-200 italic`
- **Action label** (button text): existing shadcn button classes, no change

Apply HUD label to: opponent seat names, tile counts, wind compass letters, wall section labels.
Apply status message to: CharlestonTracker status, draw-error alerts, turn-change messages.

**Pass direction label in staging strip:**
Instead of the tracker's text-only direction, the staging strip shows a small icon group:

```
← West     PASS LEFT     West →
                              (directional arrow in amber, 1rem, font-bold)
```

---

## D. Implementation Roadmap

Each item is rated by impact (H/M/L) on user experience and effort (S=hours, M=days, L=week+).

### Phase 1 — High Impact, Low Effort (do first)

| # | Change | Component(s) | New Component? | Complexity | Notes |
|---|--------|--------------|----------------|------------|-------|
| 1 | Table felt radial gradient | `GameBoard.tsx` or layout wrapper | No | S | One inline style change on the root wrapper div |
| 2 | Wall tile ivory/bone texture | `Wall.tsx` — `WallStack` inline styles | No | S | 3 style property changes, no logic changes |
| 3 | Opponent rack wooden enclosure | `OpponentRack.tsx` | No | S | Add wooden div wrapper around tile-backs; keep all testids |
| 4 | CharlestonTracker full-width banner | `CharlestonTracker.tsx` | No | S | Change `left-1/2 -translate-x-1/2` to `left-0 right-0`; add green gradient |
| 5 | Opponent label bar styling | `OpponentRack.tsx` | No | S | Restyle label with amber tile-count badge; add bottom rounded bar |

### Phase 2 — High Impact, Medium Effort (core feature)

| # | Change | Component(s) | New Component? | Complexity | Notes |
|---|--------|--------------|----------------|------------|-------|
| 6 | StagingStrip component (charleston) | `StagingStrip.tsx`, `CharlestonPhase.tsx`, `ConcealedHand.tsx` | YES — `StagingStrip.tsx` | M | New component with 6 slots; reads `selectedIds`; must keep `data-testid="pass-tiles-button"` |
| 7 | Opponent staging dots (charleston) | `OpponentRack.tsx` | No | S | Add `charlestonReadyCount?: number` prop; render 3 dots below rack |
| 8 | Unified Player Zone wrapper | New `PlayerZone.tsx` wrapper | YES — `PlayerZone.tsx` | M | Wraps ConcealedHand + StagingStrip + ActionBar in a single `fixed bottom-0` zone; ActionBar becomes `relative` inside the zone |
| 9 | Move ExposedMeldsArea inside OpponentRack | `OpponentRack.tsx`, `PlayingPhasePresentation.tsx` | No | M | Remove opponent melds from PlayingPhasePresentation loop; add `melds` prop to OpponentRack; local player melds stay where they are |

### Phase 3 — Medium Impact, Medium Effort

| # | Change | Component(s) | New Component? | Complexity | Notes |
|---|--------|--------------|----------------|------------|-------|
| 10 | Blind slot face-down display | `StagingStrip.tsx` | No | S | Depends on item 6; `faceUp={false}` + BLIND badge in outgoing slots when `blindOutgoing=true` |
| 11 | Incoming slot entry animation | `StagingStrip.tsx` | No | S | Depends on item 6; uses existing `tile-enter-from-*` CSS classes, no new animation needed |
| 12 | Single drawn-tile zone (playing phase) | `ConcealedHand.tsx` | No | S | Separate the newly-drawn tile visually from the rest of the hand; render it in a distinct highlighted slot to the right of the rack row |
| 13 | Charleston direction banner (PassAnimationLayer) | `PassAnimationLayer.tsx` | No | M | Widen to full-width; add directional text and seat target label |

### Phase 4 — Lower Priority, Higher Effort

| # | Change | Component(s) | New Component? | Complexity | Notes |
|---|--------|--------------|----------------|------------|-------|
| 14 | ActionBar migration to PlayerZone right column | `ActionBar.tsx` | No | M | Remove `fixed right-[16%] top-1/2` positioning; make it `relative`; parent PlayerZone provides layout |
| 15 | Typography HUD/status/action system | All game components | No | M | Touch ~15 files to regularize text classes; purely additive |
| 16 | Ghost placeholder in rack for staged tiles | `ConcealedHand.tsx` | No | M | Render staged tiles as ghosted outlines in their rack position; requires coord of staged slot back to rack |
| 17 | WindCompass size and color update | `WindCompass.tsx` | No | S | Increase to `w-32 h-32`; change bg to `bg-green-950/90` |

### Dependency Graph

```
Item 1 (felt) — independent
Item 2 (walls) — independent
Item 3 (rack enclosure) — independent
Item 4 (tracker banner) — independent
Item 5 (label bar) — independent
Item 6 (StagingStrip) ← depends on items 3,5
Item 7 (staging dots) ← depends on item 3
Item 8 (PlayerZone) ← depends on items 6,14
Item 9 (melds in rack) ← depends on item 3
Item 10 (blind slots) ← depends on item 6
Item 11 (entry animation) ← depends on item 6
Item 12 (drawn tile zone) — independent (playing phase only)
Item 13 (direction banner) — depends on item 6 or independent in charleston if done in PassAnimationLayer
Item 14 (ActionBar migration) ← depends on item 8
Item 15 (typography) — independent
Item 16 (ghost placeholders) ← depends on items 6, 8
Item 17 (compass) — independent
```

---

## Key Specification Details for Developers

### StagingStrip — Exact Tailwind Class Specification

```
// Outer container — attaches above the rack
className="flex flex-col items-center gap-2 w-full"

// The strip itself
className="flex items-center gap-3 px-4 py-3 rounded-t-lg"
style={{ background: 'rgba(0,0,0,0.55)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}

// Outgoing group label
className="text-[10px] font-semibold uppercase tracking-widest text-amber-300/70 mb-1 text-center"

// Individual empty outgoing slot
className="w-[63px] h-[90px] rounded-md border-2 border-dashed border-white/25 bg-white/[0.04] flex items-center justify-center"

// Slot fill count indicator text
className="text-2xl text-white/20 select-none"
// content: "·"

// Divider between outgoing and incoming
className="w-px h-[90px] bg-white/15 mx-1 flex-shrink-0"

// Incoming slot (placeholder, waiting)
className="w-[63px] h-[90px] rounded-md border-2 border-dashed border-white/12 bg-white/[0.02] flex items-center justify-center"

// Incoming placeholder arrow
className="text-white/20 text-xl animate-pulse select-none"
// content: "↓"

// Direction label row
className="flex items-center gap-2 text-xs text-amber-200/80 font-medium mt-1"

// Pass count readout (e.g., "2 / 3")
className="ml-auto text-sm font-mono text-white/60"
```

### OpponentRack — Wooden Enclosure Addition

```javascript
// Replace the bare tile-backs flex div with:
<div
  className="rounded-md px-1.5 pt-1 pb-2"
  style={{
    background: 'linear-gradient(to bottom, #8B5E3C 0%, #6B4226 55%, #4A2D1A 100%)',
    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.08), 0 4px 10px rgba(0,0,0,0.5)',
  }}
>
  {/* Felt groove */}
  <div
    className="absolute bottom-1.5 left-1.5 right-1.5 h-1 rounded-sm"
    style={{ background: 'rgba(0,0,0,0.35)' }}
    aria-hidden="true"
  />
  <div className={cn('relative flex gap-0.5', isVertical ? 'flex-col' : 'flex-row')}>
    {/* existing Tile map unchanged */}
  </div>
</div>
```

### Wall Tile Ivory Palette

```javascript
// In WallStack component, replace inline style:
style={{
  ...size,
  background: 'linear-gradient(135deg, #f5f0e8 0%, #e8ddd0 50%, #d9c9b5 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.35)',
}}
// Replace className border:
className="relative rounded-sm border border-[#9a8b7a]"
```

### CharlestonTracker Banner

```javascript
// Replace current className:
// FROM:
'fixed top-2 left-1/2 -translate-x-1/2 bg-black/85 text-white rounded-lg px-6 py-3 flex items-center gap-4'
// TO:
'fixed top-0 left-0 right-0 z-20 text-white px-6 py-3 flex items-center gap-4'
// style:
style={{ background: 'linear-gradient(to right, rgba(12,35,18,0.97), rgba(18,52,28,0.97))', borderBottom: '1px solid rgba(80,160,100,0.3)' }}
```

### Table Felt Gradient

Apply to the game viewport root (the div that currently holds the green background in `GameBoard.tsx` or `App.tsx`):

```javascript
style={{
  background: 'radial-gradient(ellipse at 50% 40%, #1e7a42 0%, #0f4f28 55%, #072c16 100%)',
  minHeight: '100vh',
}}
```

---

## Files That Will Be Created

1. `apps/client/src/components/game/StagingStrip.tsx` — new Charleston staging strip
2. `apps/client/src/components/game/StagingStrip.test.tsx` — required per agents.md: every new component gets a test file
3. `apps/client/src/components/game/PlayerZone.tsx` — layout wrapper for player's bottom zone (Phase 2, item 8)
4. `apps/client/src/components/game/PlayerZone.test.tsx` — matching test file

## Files That Will Be Modified

1. `apps/client/src/components/game/OpponentRack.tsx` — wooden enclosure, melds prop, staging dots
2. `apps/client/src/components/game/Wall.tsx` — WallStack ivory palette
3. `apps/client/src/components/game/CharlestonTracker.tsx` — full-width banner
4. `apps/client/src/components/game/ConcealedHand.tsx` — ghost placeholders for staged tiles, drawn-tile zone
5. `apps/client/src/components/game/ActionBar.tsx` — remove fixed positioning (Phase 2)
6. `apps/client/src/components/game/WindCompass.tsx` — size and color tweak
7. `apps/client/src/components/game/phases/CharlestonPhase.tsx` — integrate StagingStrip, pass charlestonReadyCount to OpponentRack
8. `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` — remove opponent ExposedMeldsArea loop, pass melds to OpponentRack
9. `apps/client/src/components/game/PassAnimationLayer.tsx` — enhanced direction banner
10. `apps/client/src/index.css` — add felt radial gradient as a CSS custom property or utility class

No `data-testid` attributes are removed or renamed. No component API shapes are removed. All additions are purely additive props with optional/default values.
