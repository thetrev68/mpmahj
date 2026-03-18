# US-063: Play Surface Theme Ownership and Board Chrome Compliance

Absorbs: `US-066` (Play Surface Theme Root Ownership and Board Chrome Integrity)

## Status

- State: Implemented
- Priority: Critical
- Batch: G
- Implementation Ready: Yes

## Problem

The play surface currently cheats on theme handling at two levels:

### P-1 -- Forced Dark Root (previously US-066)

`GameBoard.tsx` line 230 forces a `dark` class on the board wrapper:

```tsx
<div className="dark relative w-full h-screen bg-[image:var(--table-felt-gradient)]" ...>
```

This means the game surface does not inherit the app's active light/dark theme. The board is a
theme island locked to dark mode regardless of user preference. Every downstream component inherits
this forced context, which masks theme bugs and prevents light-mode from working on the board.

### P-2 -- Board Chrome Token Noncompliance (previously US-063)

`US-056` fixed themed internals for the history panel and settings modal content, but the board
chrome that launches and surrounds those surfaces is still inconsistent:

- top-right Settings / History controls do not visually integrate in light mode
- right-rail wrappers and hint states use hardcoded `bg-slate-900`, `bg-slate-800`, `text-slate-400`
  classes that assume a dark context
- overlay banners and board-adjacent status elements ignore the active theme

These two problems are coupled: fixing theme tokens (P-2) is meaningless while the root forces dark
(P-1), because you cannot test or verify light-mode compliance. They must be solved together, with
the root fix landing first.

## Scope

**In scope:**

- Remove the forced `dark` class from the `GameBoard` root wrapper.
- Make the play surface inherit the active app theme from the normal document/theme provider chain.
- Repair board-level controls and wrappers that only looked acceptable because the board was
  artificially dark:
  - top-right Settings and History buttons
  - right-rail container, separators, and hint section states (idle, loading, error)
  - playing-phase overlays and banners adjacent to the board
  - mobile trigger controls if present
- Replace hardcoded slate/dark palette classes with theme-aware tokens or explicit `dark:` / light
  pairs.
- Add tests that assert the absence of the forced dark root and verify theme token usage.

**Out of scope:**

- Rebuilding settings functionality.
- Rewriting history panel internals already covered by `US-056`.
- Right-rail edge geometry, staging clipping, or alignment-grid work (covered by `US-062`).
- Reworking the table-felt visual direction itself (the felt gradient token is theme-compatible).

## Acceptance Criteria

### Root Theme Fix (from US-066)

- AC-1: `GameBoard` does not apply a forced `dark` class to the play-surface root.
- AC-2: The play surface inherits the active app theme from the normal document/theme provider
  chain rather than creating a local theme island.
- AC-3: Tests explicitly assert the absence of a forced `dark` class on the `game-board` root.
- AC-4: If any board-level element still requires explicit light/dark styling after the root fix,
  it uses theme-aware tokens or explicit `dark:` pairs rather than relying on a forced dark root.

### Board Chrome Compliance (from US-063)

- AC-5: The desktop Settings button renders legibly and intentionally in both light and dark mode.
- AC-6: The desktop History button renders legibly and intentionally in both light and dark mode.
- AC-7: The mobile hint/history/settings trigger set, if present in the same surface, follows the
  same theme-token rules as desktop controls.
- AC-8: No board-level settings/history trigger relies on hardcoded slate text/background classes
  that invert poorly in light mode.
- AC-9: `RightRailHintSection` uses theme-aware tokens for container, idle, loading, success, and
  error states rather than fixed dark palette classes.
- AC-10: Playing-phase overlays or banners adjacent to the board use theme-aware tokens or explicit
  light/dark pairs; no unreadable hardcoded dark-on-light combinations remain.
- AC-11: The repaired tests include explicit assertions for the top-right control chrome and the
  right-rail container in both themed class paths.

## Edge Cases

- EC-1: The table felt background token remains visible and intentional in both themes.
- EC-2: Overlays that are intentionally color-coded (dead hand, call window) remain distinguishable
  after the root theme fix.
- EC-3: The board does not become unreadable in light mode because downstream chrome was authored
  against hardcoded dark assumptions.
- EC-4: Disabled or read-only trigger states remain legible in both themes.
- EC-5: Error banners in the right rail remain visually distinct without falling back to hardcoded
  dark red surfaces.
- EC-6: Historical/replay overlays remain clearly differentiated from normal live-play status in
  both themes.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx` -- remove forced dark, repair board chrome
- `apps/client/src/components/game/GameBoard.test.tsx` -- assert no forced dark root, theme classes
- `apps/client/src/components/game/RightRailHintSection.tsx` -- theme-aware tokens
- `apps/client/src/components/game/RightRailHintSection.test.tsx` -- theme assertions
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` -- repair
  hardcoded classes
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx` -- repair
  overlay/banner classes

## Notes for Implementer

### Order of operations

1. Remove the forced `dark` class from `GameBoard`'s root `<div>`.
2. Immediately verify what breaks visually in light mode -- this surfaces every hardcoded-dark
   assumption downstream.
3. Repair each broken surface with theme-aware tokens or `dark:` pairs.

Do not attempt step 3 before step 1. The forced dark root masks every downstream problem.

### Root ownership rule

The board wrapper may own layout, felt background, and stacking context. It must **not** own theme
mode. If a component only looks correct because an ancestor forces `dark`, that component is still
broken.

### Prior work

`US-056` solved modal and sheet internals. This story handles the board-level entry points and
adjacent surfaces that `US-056` left behind, plus the forced-dark root that prevented those fixes
from being testable in light mode.

### Testing rule

Do not stop at "button click still works." This story is about theme correctness of visible board
chrome, so the tests need to assert classes/tokens on those surfaces directly.

## Test Plan

- Root wrapper test:
  - assert `game-board` root does not include `dark` class
- Trigger-control tests:
  - settings button classes in light and dark
  - history button classes in light and dark
  - mobile trigger classes if applicable
- Right-rail tests:
  - idle state theme tokens
  - loading state theme tokens
  - error state theme tokens
- Overlay tests:
  - read-only / replay / hint-adjacent banners use theme-safe tokens
- Manual verification:
  - light mode full board
  - dark mode full board
  - modal open over board in both themes

## Verification Commands

```bash
cd apps/client
npx vitest run src/components/game/GameBoard.test.tsx
npx vitest run src/components/game/RightRailHintSection.test.tsx
npx tsc --noEmit
```

---

## Codex Implementation Summary

Implemented `US-063`, including the added `HintPanel` scope.

The board root in [GameBoard.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/GameBoard.tsx) no longer forces `dark`, so the play surface now inherits the app theme normally. I replaced the board-level hardcoded dark chrome with theme-aware tokens across the top controls, right rail shell, right-rail hint states, mobile trigger row, and the playing-phase banners/overlays in [RightRailHintSection.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/RightRailHintSection.tsx), [HintPanel.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/HintPanel.tsx), [PlayingPhasePresentation.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx), and [PlayingPhaseOverlays.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx).

Regression coverage now asserts the absence of the forced root theme and the new themed class paths in [GameBoard.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/GameBoard.test.tsx), [RightRailHintSection.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/RightRailHintSection.test.tsx), [HintPanel.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/HintPanel.test.tsx), [PlayingPhasePresentation.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx), and [PlayingPhaseOverlays.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.test.tsx).

Verified with `npx vitest run apps/client/src/components/game/GameBoard.test.tsx apps/client/src/components/game/RightRailHintSection.test.tsx apps/client/src/components/game/HintPanel.test.tsx apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.test.tsx` and `npx tsc --noEmit`. I also ran Prettier on the touched files. I did not run the full repo-wide AGENTS validation pipeline.

---

## Claude Review Summary

### AC / EC Walkthrough

**AC-1 ✅** `GameBoard.tsx:316` root `<div>` has no `dark` class.

**AC-2 ✅** No local `ThemeProvider` wrapping the board; theme inherits from the document chain.

**AC-3 ✅** `GameBoard.test.tsx:15` — `expect(root).not.toHaveClass('dark')`.

**AC-4 ✗ (partial)** Two board-level surfaces were not converted:

- **Heavenly Hand overlay** (`GameBoard.tsx:504–521`): `bg-gray-900`, `bg-gray-800`,
  `text-gray-300`, `text-green-300`, `text-yellow-300` are all hardcoded dark palette. This dialog
  sits on the board surface and will render visually broken in light mode. It meets EC-2's
  "intentionally color-coded" bar only in the sense that gold-on-black is its design intent, but no
  `dark:` pair exists to handle light mode.
- **Pre-game loading / recovery screens** (`GameBoard.tsx:270, 280, 289, 300`): all four early
  returns use `bg-gray-900 text-white` (and inner `text-gray-300`). These are now outside the felt
  root with no dark ancestor, so they are always rendered dark regardless of user preference.
  Whether these screens are in scope is arguable, but they technically violate AC-4's rule.

**AC-5 ✅** Settings button: `bg-background/80 text-foreground` (`PlayingPhasePresentation.tsx:418`).

**AC-6 ✅** History button: same token set (`PlayingPhasePresentation.tsx:427`).

**AC-7 ✅** Mobile Hints button: `bg-background/80 text-foreground lg:hidden` (`PlayingPhasePresentation.tsx:409`).

**AC-8 ✅** No slate-\* classes remain on any board-level trigger.

**AC-9 ✅** All `RightRailHintSection` states use theme tokens:

- Idle/hints-off: `text-muted-foreground`
- Loading: `bg-card/80 text-card-foreground`
- Error: `border-destructive/50 bg-destructive/10 text-destructive`
- Current hint (via `HintPanel`): `bg-card/90 text-card-foreground`
- Get-hint button: `bg-background/80 hover:bg-accent`

**AC-10 ✗ (partial)** Most banners are correct, but two status lines inside the Settings dialog are
not:

- `PlayingPhaseOverlays.tsx:169` — `text-cyan-300` on `hint-settings-status`
- `PlayingPhaseOverlays.tsx:174` — `text-red-300` on `hint-settings-error`

Both are hardcoded dark-optimised. `text-cyan-300` on a white/light dialog background has contrast
ratio ≈ 1.6:1 (WCAG minimum is 4.5:1). These should use `text-cyan-600 dark:text-cyan-300` (or a
semantic token) and `text-destructive` respectively.

**AC-11 ✅** Tests assert theme classes on leave button, logout button, right rail, right-rail-bottom
separator, hint section states, settings/history/mobile-hints controls, and the history read-only
banner.

**EC-1 ✅** Felt gradient token `bg-[image:var(--table-felt-gradient)]` is preserved.

**EC-2 — partial concern** Heavenly Hand is color-coded but has no light-mode path (see AC-4 note).
Dead hand, call window, mahjong banners all have explicit `dark:` pairs — ✅.

**EC-3 ✅** No unreadable hardcoded-dark-on-light combinations remain in the main playing surface.

**EC-4 ✅** Disabled button states inherit from shadcn/ui token system.

**EC-5 ✅** Error rail uses `border-destructive/50 bg-destructive/10 text-destructive`.

**EC-6 ✅** Historical-view banner uses `border-border/70 bg-background/85 text-foreground`.

---

### Defects

**D-1 — Settings dialog status/error text (AC-10 miss, hardcoded dark palette)**
`PlayingPhaseOverlays.tsx:169,174` — `text-cyan-300` and `text-red-300` will be near-invisible in
light mode. These two lines were inside the hint settings Dialog (`<DialogContent>`) which now
renders in the active theme rather than under a forced dark root. Fix: `text-cyan-600
dark:text-cyan-300` and `text-destructive`.

**D-2 — Heavenly Hand overlay (AC-4 miss, hardcoded dark palette)**
`GameBoard.tsx:504–521` — The entire `DialogContent` uses `bg-gray-900`, `bg-gray-800`,
`text-gray-300`, `text-green-300`, `text-yellow-300`. In light mode the dialog will have a dark
grey box inside a light-themed modal layer. Fix: replace with `bg-card` / `text-card-foreground`
for the shell, and appropriate `dark:` pairs for the accent colours, or explicitly opt this modal
into dark mode if that is the intended visual design.

---

### Test Gaps

**T-1 — Heavenly Hand theme classes not asserted**
`GameBoard.test.tsx` has no test for the Heavenly Hand overlay's class names. Because `bg-gray-900`
is not caught by any existing assertion, D-2 slipped through.

**T-2 — Settings dialog status/error lines not covered**
`PlayingPhaseOverlays.test.tsx:243` ("uses theme-safe classes...") does not render
`hintStatusMessage` alongside `showHintSettings: true`, so `hint-settings-status` and
`hint-settings-error` inside the open dialog are never asserted. Adding a case where the dialog is
open _and_ both messages are non-null would catch D-1.

---

### Non-blocking Observations

**N-1 — Nested `<h2>` heading hierarchy**
`HintPanel.tsx:33` renders `<h2>Current Recommendation</h2>` inside a section whose parent
(`RightRailHintSection`) already has `<h2>AI Hint</h2>`. Two sibling `h2` elements inside the same
landmark region is an ARIA heading-hierarchy issue. The inner element should be `<h3>` or a styled
`<p>`.

**N-2 — `isHistoricalView` duplicated across slices**
`PlayingPhasePresentationProps` carries both `hintSystem.isHistoricalView` and
`historyPlayback.isHistoricalView` as independent booleans. In `createBaseProps` both are set to
`false` separately. If they ever diverge (e.g. only one is updated on state-restored), the hint
section could show request controls during a historical view. Unifying these to a single source
would remove the risk.

**N-3 — Pre-game screen theming**
The four early-return screens in `GameBoard.tsx` (room-waiting, loading-game, login placeholder,
reconnect-lobby) still use `bg-gray-900 text-white`. These are out of the explicit scope of
US-063, but they are now theme-orphaned: without the forced dark root they render dark regardless
of the active theme. A follow-up story or a simple `bg-background text-foreground` substitution
would align them.

**N-4 — Weak wrapper test in `RightRailHintSection.test.tsx`**
The assertion `expect(screen.getByTestId('right-rail-top')).toBeEmptyDOMElement()` (line 84) checks
a DOM node that is purely part of the test fixture wrapper, not the component under test. It
verifies nothing about `RightRailHintSection` itself and could be dropped or replaced with an
assertion about the section's internal structure.

---

### Verdict

The root theme-island fix (P-1) is complete and correct. Most board chrome surfaces (controls strip,
right rail, hint section states, playing-phase banners, mobile trigger row) are properly converted
to theme-aware tokens with good test coverage.

Two surfaces — the Settings dialog's inline status text and the Heavenly Hand overlay — were missed
and will render incorrectly in light mode. Both are straightforward fixes. The test gaps
(T-1, T-2) are what allowed these to slip through; the testing rule in the story notes ("assert
classes/tokens on those surfaces directly") was not applied to either location.

Recommend: fix D-1 and D-2, add T-1 and T-2 assertions, then this story is complete.

---

## Post-Review Remediation Summary

All findings from the Claude Review were resolved. 39 tests pass; `tsc --noEmit` is clean.

**D-1 fixed** (`PlayingPhaseOverlays.tsx`): `text-cyan-300` → `text-cyan-600 dark:text-cyan-300`;
`text-red-300` → `text-destructive` on the settings-dialog status/error paragraphs.

**D-2 fixed** (`GameBoard.tsx`): Heavenly Hand `DialogContent` shell changed from `bg-gray-900` to
`bg-card`; description text from `text-gray-300` to `text-muted-foreground`; score box from
`bg-gray-800` to `bg-muted` (with new `data-testid="heavenly-hand-score-box"`); accent text given
explicit `dark:` pairs (`text-yellow-600 dark:text-yellow-400`, `text-green-600 dark:text-green-300`,
`text-yellow-600 dark:text-yellow-300`).

**N-3 fixed** (`GameBoard.tsx`): All four pre-game early-return screens (room-waiting, loading-game,
login placeholder, reconnect-lobby) changed from `bg-gray-900 text-white` / `text-gray-300` to
`bg-background text-foreground` / `text-muted-foreground`.

**N-1 fixed** (`HintPanel.tsx`): Inner heading changed from `<h2>` to `<h3>` to resolve the nested
`h2`/`h2` ARIA heading-hierarchy violation.

**N-2 fixed** (`PlayingPhasePresentation.tsx`, `usePlayingPhaseViewState.ts`,
`PlayingPhasePresentation.test.tsx`): `isHistoricalView` removed from `HintSystemPresentationSlice`
and from the `presentationHintSystem` memo; both `RightRailHintSection` call sites now read
`historyPlayback.isHistoricalView` directly, eliminating the two-source divergence risk.

**T-1 added** (`GameBoard.test.tsx`): New test dispatches `SET_HEAVENLY_HAND` to the UI store,
renders `GameBoard`, and asserts `bg-card` / `bg-muted` / `text-muted-foreground` and explicit
`dark:` pairs on the overlay — along with the absence of `bg-gray-900` / `bg-gray-800`. A
`beforeEach`/`afterEach` store reset guard was also added to the describe block.

**T-2 added** (`PlayingPhaseOverlays.test.tsx`): New test opens the settings dialog with both
`hintStatusMessage` and `hintError` set and asserts `text-cyan-600 dark:text-cyan-300` on the
status element and `text-destructive` on the error element; also asserts the absence of the former
hardcoded classes.

**N-4 fixed** (`RightRailHintSection.test.tsx`): Replaced the misleading
`toBeEmptyDOMElement()` assertion on the fixture wrapper's `right-rail-top` div with a meaningful
assertion on the component's own `aria-label` attribute. Renamed the test accordingly.
