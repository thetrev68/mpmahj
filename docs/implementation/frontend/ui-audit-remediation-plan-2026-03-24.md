# UI Audit Remediation Plan — 2026-03-24

**Status:** Proposed
**Input audit:** [ui-audit-2026-03-22.md](C:/Repos/mpmahj/docs/implementation/frontend/ui-audit-2026-03-22.md)
**Purpose:** convert the audit into execution-ready work without forcing every item through a full user-story cycle

---

## Recommendation

Do not create a new full user story for every audit item.

Use three work shapes instead:

1. **Direct fix batch**
   Small implementation tickets for issues that already have enough detail to code and test.
2. **Compact spec**
   Short design/geometry docs for layout items that are not implementation-ready yet.
3. **Full user story**
   Reserve for larger behavior changes, multi-component interaction changes, or work that needs explicit AC/EC and approval before coding.

The audit already contains enough detail for several direct fixes. The failure mode has not been "lack of stories." The larger problem is that some completed stories were not verified against the actual UI state after implementation.

---

## Readiness Split

### Fix Now

These items are implementation-ready from the audit plus current code context:

| Audit # | Issue                                             | Why it is ready                                           |
| ------- | ------------------------------------------------- | --------------------------------------------------------- |
| 1       | Mahjong button pulsing during Charleston          | Existing code path is identified and behavior is concrete |
| 5       | Leave Game overlaps Log Out                       | Placement bug with known container                        |
| 6       | Empty space above AI Hint in right rail           | Existing spacer behavior is explicit                      |
| 7       | Right rail dark-mode theme mismatch               | Surface tokens can be corrected directly                  |
| 15      | Green felt bleed-through on dark surfaces         | Same surface-token cleanup as #7                          |
| 16      | Instruction text contrast                         | Styling-only correction                                   |
| 17      | Board width formula off by 1rem                   | Concrete layout math bug                                  |
| 18      | No right-side viewport padding on lg              | Concrete layout padding change                            |
| 19      | TurnIndicator fixed to viewport instead of board  | Positioning model is clearly wrong                        |
| 21      | Fixed 1038px player rack causes horizontal scroll | Hardcoded width is explicitly identified                  |

### Needs Compact Spec First

These items describe valid problems, but still need exact layout rules before implementation:

| Audit # | Issue                                                      | What is missing                                                 |
| ------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| 2       | Staging area + action pane not one fixed unit              | Container ownership, bounds, fixed anchors, breakpoint behavior |
| 3       | Side opponent racks inset from board perimeter             | Exact board square contract and rack edge alignment rules       |
| 4       | Player rack bleeds into right rail                         | Depends on final board-region ownership and width rules         |
| 8       | ActionBar instruction text may be cut off                  | Depends on final fixed action container dimensions              |
| 9       | `0/3 selected` counter placement                           | Needs agreed location inside the shared interaction region      |
| 10      | Opponent racks feel cramped / no spatial edge relationship | Needs final gap and perimeter geometry decisions                |
| 11      | Side rack wood texture may not fit dark mode               | Needs visual direction decision, not just bug-fix styling       |
| 12      | Competing z-index layers                                   | Needs documented z-index scale and ownership                    |
| 13      | Rack width not constrained to board                        | Depends on player-zone and board-width contract                 |
| 14      | Rack background extends beyond board                       | Same as #13                                                     |
| 20      | Fixed headers can collide at top                           | Needs top-chrome stacking and spacing rules                     |

---

## Existing Story Reality Check

Several audit items overlap with already-written or already-completed stories. That means the next move should not be "write more of the same" without changing the verification method.

Examples:

- [US-078-charleston-action-bar-hierarchy-and-rare-mahjong-demotion.md](C:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-078-charleston-action-bar-hierarchy-and-rare-mahjong-demotion.md)
  The story is marked completed, but [ActionBarPhaseActions.tsx](C:/Repos/mpmahj/apps/client/src/components/game/ActionBarPhaseActions.tsx) still computes Charleston demotion as `!canDeclareMahjong`, which leaves the Mahjong button visually promoted during normal Charleston.
- [US-080-right-rail-width-and-theme-correct-hint-surfaces.md](C:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-080-right-rail-width-and-theme-correct-hint-surfaces.md)
  The audit still reports translucent green bleed and weak dark-mode surfaces, so completion needs revalidation.

Working rule from this point:

- A story is not "done" until the intended viewport and theme are visually checked after implementation.
- Layout stories need explicit geometry assertions, not just unit tests on conditionals and rendering.

---

## Proposed Delivery Batches

### Batch A — Action Hierarchy and Rail Surface Cleanup

**Goal:** remove the most distracting Charleston UI problems without refactoring board geometry.

**Audit items:** 1, 6, 7, 15, 16

**Implementation ticket:** [US-084-charleston-cta-and-right-rail-surface-recovery.md](C:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-084-charleston-cta-and-right-rail-surface-recovery.md)

**Expected files:**

- `apps/client/src/components/game/ActionBar.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.tsx`
- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/RightRailHintSection.tsx`

**Verification target:**

- dark mode
- Charleston active
- right rail visible at `lg`
- one screenshot comparison before/after

### Batch B — Layout Math and Fixed Positioning Cleanup

**Goal:** remove avoidable overflow and viewport-relative positioning bugs before deeper layout refactor work.

**Audit items:** 5, 17, 18, 19, 21

**Implementation ticket:** [US-085-board-width-math-and-fixed-positioning-recovery.md](C:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-085-board-width-math-and-fixed-positioning-recovery.md)

**Expected files:**

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/TurnIndicator.tsx`
- `apps/client/src/components/game/PlayerRack.tsx`

**Verification target:**

- mid-width desktop viewport where scrollbar currently appears
- large desktop viewport with right rail visible
- no control overlap
- no horizontal scroll caused by rack width

### Batch C — Charleston Board Geometry Spec

**Goal:** define the board-region contract before touching the layout items that are currently underspecified.

**Audit items:** 2, 3, 4, 8, 9, 10, 12, 13, 14, 20

**Deliverable is a compact spec, not code first.**

**Compact spec:** [charleston-board-geometry-compact-spec-2026-03-24.md](C:/Repos/mpmahj/docs/implementation/frontend/charleston-board-geometry-compact-spec-2026-03-24.md)
**Implementation story:** [US-086-charleston-board-region-ownership-and-chrome-stacking.md](C:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-086-charleston-board-region-ownership-and-chrome-stacking.md)

The spec should answer:

- What is the exact square-board boundary?
- Which component owns the fixed interaction region between discard area and player rack?
- Where do staging slots anchor when counts change?
- Where do Proceed, Mahjong, and selection count live permanently?
- How are side racks aligned to the outside square?
- What z-index scale is reserved for chrome, overlays, transient feedback, and phase-local UI?
- What top-of-board components participate in shared vertical flow versus fixed overlay placement?

### Batch D — Optional Visual Surface Follow-Up

**Goal:** resolve stylistic but non-blocking issues after geometry is stable.

**Audit items:** 11 and any remaining theme polish from Batch A

---

## Minimal Spec Templates

### Compact Spec Template

Use this for Batch C items instead of a full story:

1. Problem statement
2. In-scope components
3. Geometry rules
4. Fixed-position rules
5. Theme/surface rules
6. Breakpoint behavior
7. Test assertions
8. Screenshot states to verify

### Full User Story Threshold

Escalate from compact spec to full story only if one of these is true:

- multiple user interactions change meaningfully
- new settings or persistence are introduced
- server/client contract assumptions matter
- accessibility behavior needs explicit acceptance criteria
- work crosses enough components that deferrals must be tracked formally

---

## Verification Upgrade

For UI audit remediation, require all three:

1. Component or integration tests where practical
2. Typecheck and normal frontend validation
3. Named visual verification states

Suggested named visual states for this audit:

- `charleston-dark-lg`
- `charleston-dark-midwidth`
- `playing-dark-lg`

Each batch should list exactly which of those states must be checked before calling it complete.

---

## Next Practical Step

Implement in this order:

1. Batch A
2. Batch B
3. Write the Batch C compact spec
4. Only then decide whether Batch C becomes one refactor story or several small implementation tickets

This keeps the obvious bugs moving while preventing another round of vague layout work that looks complete in code but fails on screen.
