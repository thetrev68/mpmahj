# Charleston Board Geometry Compact Spec — 2026-03-24

**Status:** Proposed
**Input audit items:** 2, 3, 4, 8, 9, 10, 12, 13, 14, 20 from [ui-audit-2026-03-22.md](C:/Repos/mpmahj/docs/implementation/frontend/ui-audit-2026-03-22.md)
**Related plan:** [ui-audit-remediation-plan-2026-03-24.md](C:/Repos/mpmahj/docs/implementation/frontend/ui-audit-remediation-plan-2026-03-24.md)
**Implementation story:** [US-086-charleston-board-region-ownership-and-chrome-stacking.md](C:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-086-charleston-board-region-ownership-and-chrome-stacking.md)

---

## 1. Problem Statement

The current Charleston board still behaves like several neighboring layout fragments instead of one
coherent board scene. The remaining failures are not about missing components. They are about
missing layout ownership.

The unresolved problems share one root issue:

- the center-board interaction region has no explicit container contract
- side racks are not aligned to a single outer board perimeter
- rack width and action/staging placement are still allowed to compete for the same space
- several top-of-board elements still behave like independent overlays with no shared vertical
  flow or z-index rules

This spec defines the missing geometry contract so the next implementation pass can stop patching
local symptoms and instead rebuild the Charleston board around explicit regions.

---

## 2. In-Scope Components

Primary layout owners:

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/components/game/PlayerZone.tsx`

Region participants:

- `apps/client/src/components/game/PlayerRack.tsx`
- `apps/client/src/components/game/OpponentRack.tsx`
- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/components/game/ActionBar.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.tsx`
- `apps/client/src/components/game/TurnIndicator.tsx`
- `apps/client/src/components/game/CharlestonTracker.tsx`
- `apps/client/src/components/game/WallCounter.tsx`

Not in scope:

- hint-content redesign
- backend/game-rule changes
- modal/dialog semantics
- playing-phase parity beyond shared geometry primitives required to avoid immediate divergence

---

## 3. Geometry Rules

### 3.1 Board Boundary

The square board container in `GameBoard.tsx` is the authoritative board scene.

All Charleston board-local layout must fit inside that square. Nothing in the player-zone family is
allowed to visually extend past the square into the right rail.

The outer playable square is defined by the four rack perimeters:

- north rack defines the top edge
- player rack defines the bottom edge
- west-side rack defines the left edge
- east-side rack defines the right edge

The center board is the remaining interior space inside that perimeter.

### 3.2 Side Rack Perimeter Rule

Side opponent racks must align to the same outside square as the player rack.

Concretely:

- the outside edge of the west-side rack aligns with the outside left edge of the player rack
- the outside edge of the east-side rack aligns with the outside right edge of the player rack
- side racks may use different shell depth than the player rack, but not a different outer
  perimeter alignment

This resolves audit items 3 and 10.

### 3.3 Player Zone as a Fixed Board Region

`PlayerZone` is not just "staging beside actions above rack." It is the named south interaction
region of the board.

Its outer bounds are:

- left: inside edge of the west-side rack
- right: inside edge of the east-side rack
- bottom: top edge of the player rack shell
- top: a fixed board-local line that leaves clear center-board space above it

Inside `PlayerZone`, three subregions are permanent:

1. `staging-region`
2. `action-region`
3. `rack-region`

The user should be able to learn these locations once and keep finding them there throughout
Charleston.

### 3.4 Rack Containment Rule

The player rack must always render inside `rack-region`.

The rack shell may scale down, cap width, or allow internal safe overflow behavior, but it may not
bleed behind the right rail or outside the board square.

This resolves audit items 4, 13, and 14.

### 3.5 Staging Anchor Rule

The origin point for staging slots is fixed for the duration of the game.

Allowed:

- changing visible slot count by phase/state
- changing slot styling by state

Not allowed:

- moving the slot origin horizontally between Charleston states
- recentering the staging strip differently based on slot count
- shifting action controls because the instruction text is longer

The left edge of the active staging strip should remain anchored to the same `staging-region`
origin, with additional slots extending in the same logical direction each time.

### 3.6 Action Region Rule

The `action-region` is fixed beside the staging region for all Charleston states.

Permanent residents of this region:

- instruction text
- `Proceed`
- `Mahjong`
- selection count

The region can change content and emphasis, but not position.

The selection count must move into this region. It must no longer live below the player rack.

### 3.7 Center-Board Clearance Rule

The Charleston layout must preserve a clear center-board area between:

- top chrome
- side racks
- player-zone top boundary

No player-zone subregion should expand upward opportunistically because text wraps or staging count
changes.

---

## 4. Fixed-Position Rules

### 4.1 Board-Local vs Viewport-Fixed

Board-local elements:

- opponent racks
- player zone
- staging strip
- action bar
- turn indicators
- dead-hand badges

Viewport/global overlays only:

- full-screen leaving overlay
- dialogs and modal overlays
- reconnect blocker

### 4.2 Top Chrome Flow

The top-of-board chrome must use a shared vertical stack, not independent hardcoded `top` offsets.

Required order:

1. board controls strip
2. Charleston tracker
3. wall counter row or wall-counter slot within the same chrome system

This does not require them to all be in one visual bar, but they must participate in one vertical
layout flow so wrapping/growth in one item cannot collide with the next.

This resolves audit item 20.

### 4.3 Turn Indicator Anchoring

`TurnIndicator` and dead-hand badges must anchor to board-local named edges or corners, not to
viewport percentages.

They should reference the board square, not the browser window.

---

## 5. Theme and Surface Rules

Theme work here is bounded to geometry-supporting surfaces only.

- `PlayerZone` should read as one composed surface family
- `staging-region` and `action-region` may have distinct sub-panels, but they should feel related
- action-region surfaces must not depend on board green showing through to define their color
- rack containment wrappers should not rely on transparent overflow that visually merges with the
  right rail

This spec does not define final decorative styling for rack wood in dark mode. That remains a later
visual pass.

---

## 6. Z-Index Scale

The Charleston board needs a documented z-index scale. Use semantic layers rather than ad hoc local
numbers.

Recommended scale:

- `z-0`: board background and passive board regions
- `z-10`: board-local gameplay surfaces
  - opponent racks
  - player zone
  - turn indicators
- `z-20`: board-local chrome and transient inline feedback
  - tracker
  - wall counter
  - inline error banners
- `z-30`: board-local overlays
  - pass animation layer
  - vote result overlay if still board-local
- `z-50+`: viewport-global overlays
  - leave overlay
  - dialogs
  - reconnect blocker

Rule:

- components may use a layer from this scale, but should not invent new arbitrary z-index values
  unless the scale is updated centrally

This resolves audit item 12.

---

## 7. Breakpoint Behavior

### 7.1 Large Desktop (`lg` with right rail visible)

- the full board square contract is active
- side racks align to the player-rack outer perimeter
- `PlayerZone` uses fixed `staging-region` and `action-region` placement
- right rail remains outside the board square and must not be used as overflow relief

### 7.2 Mid-Width Desktop

- the same named regions still exist
- rack width, staging width, and action-region width may compress within defined bounds
- no page-level horizontal scroll is allowed
- if compression is insufficient, tile shell scaling or safe internal behavior is preferred over
  board bleed

### 7.3 Tablet / Rail-Hidden Layouts

- the board-local region model still applies
- side-perimeter alignment should degrade proportionally, not revert to ad hoc floating geometry
- top chrome may simplify vertically, but collisions remain forbidden

---

## 8. Test Assertions

Unit/integration assertions should verify structure and ownership, not pixel-perfect layout.

Required assertions:

- `PlayerZone` exposes stable `staging-region`, `action-region`, and `rack-region` wrappers
- selection count renders inside the `action-region`
- action-region wrapper remains present across Charleston states
- staging-region wrapper remains present across Charleston states
- side rack wrappers use perimeter-alignment classes or attributes rather than free-floating auto
  centering
- player rack wrapper is width-constrained by a board-local region
- top chrome wrappers participate in one shared stack container
- `TurnIndicator` no longer uses viewport-fixed percentage classes
- z-index values map to the documented scale

Browser/manual assertions required:

- large desktop Charleston view
- mid-width desktop Charleston view
- no overlap between top chrome layers
- no rack bleed into the right rail
- stable staging/action placement when switching among:
  - first pass
  - blind pass
  - voting
  - courtesy pass

---

## 9. Screenshot States To Verify

Required visual states:

1. `charleston-dark-lg-first-right`
2. `charleston-dark-lg-first-left-blind`
3. `charleston-dark-lg-voting`
4. `charleston-dark-lg-courtesy`
5. `charleston-dark-midwidth-first-right`
6. `charleston-light-lg-first-right`

For each state, verify:

- side racks align to the same outer board perimeter
- `PlayerZone` reads as one fixed board-region unit
- selection count is inside the action region
- no top-chrome collision
- no player-rack bleed into rail or viewport edge

---

## 10. Implementation Guidance

Recommended order:

1. establish top chrome stack ownership in `GameBoard.tsx`
2. refactor `CharlestonPhase.tsx` to expose named board regions
3. refactor `PlayerZone.tsx` to formalize `staging-region`, `action-region`, `rack-region`
4. move selection count ownership out of `PlayerRack.tsx` and into the action-region owner
5. align side-rack perimeter rules
6. apply z-index scale and remove local exceptions
7. run browser verification across the required screenshot states

This compact spec is sufficient to start implementation. If additional work introduces new
interaction behavior or new settings/state contracts, that follow-up should become a full user
story rather than stretching this geometry spec.
