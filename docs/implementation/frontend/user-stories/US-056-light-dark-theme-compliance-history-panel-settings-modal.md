# US-056: Light/Dark Theme Compliance — History Panel + Settings Modal

## Status

- State: Completed
- Priority: High
- Batch: E
- Implementation Ready: Yes, with sequencing note

## Problem

### TH-1 — History Panel: Hardcoded Dark Colors

`HistoryPanel.tsx`, `TimelineScrubber.tsx`, and `HistoricalViewBanner.tsx` all use hardcoded
Tailwind dark-palette class names (e.g., `bg-slate-800`, `bg-slate-900/95`, `text-slate-300`,
`border-slate-700`) instead of Shadcn/ui theme tokens. In light mode these elements render with
dark backgrounds and light text, ignoring the active theme entirely.

The outer `Sheet` wrapper of `HistoryPanel` already uses Shadcn/ui and inherits the active theme.
The inner layout elements override its CSS variables with hardcoded slate values, defeating the
inheritance. Specific offenders:

- Header row: `border-b border-slate-700`
- Filter summary text: `text-slate-300`
- Action filter labels: `rounded border border-slate-700`
- Move entries: `rounded border border-slate-700 bg-slate-800`
- Move timestamps: `text-slate-400`
- Expanded detail text: `text-slate-300`
- Expanded pre-block: `bg-slate-950/80 text-slate-200`
- Expanded move divider: `border-t border-slate-700`
- Error banner: `border-red-700 bg-red-950/60 text-red-200`
- Overlay message: `bg-slate-950/60 text-slate-100`
- Search `<mark>`: `bg-yellow-200 text-black` — works in light mode but has no `dark:` variant,
  making highlighted text unreadable against dark move-entry cards

`TimelineScrubber` renders a fixed-position overlay with `bg-slate-900/95 text-slate-100
border-blue-300/30`. It is always dark regardless of the active theme.

`HistoricalViewBanner` uses `bg-blue-900/95 border-b border-blue-300/40 text-white`. The blue
accent is intentional — it signals read-only / historical-view mode — but `text-white` is
invisible against a light background and the `bg-blue-900/95` appears as a dark block on a
light-themed page.

### TH-2 — Settings Modal: Hardcoded Dark Colors

The settings modal (`hint-settings-dialog`) wraps `HintSettingsSection` and `AnimationSettings`
inside a Shadcn/ui `Dialog`, which is theme-aware at the wrapper level. The inner components
override that inheritance:

- `HintSettingsSection` wraps all content in
  `<Card className="border-slate-700 bg-slate-950/80 text-slate-100">` — hardcoded dark overrides
  on a theme-aware `Card`.
- The preview output div uses `border-cyan-700/60 bg-cyan-950/30` — hardcoded dark accent.
- `AnimationSettings` (also inside this dialog) has not been audited; may contain similar
  hardcoded classes.

Because US-057 will replace most of `HintSettingsSection`'s inner controls (verbosity dropdown,
preview buttons, sound section, reset button), this story targets structural wrappers only — the
`Card` container and the preview output `div` — and defers inner-control color cleanup to US-057.

## Scope

**In scope:**

- Fix all hardcoded dark-palette overrides in `HistoryPanel.tsx`: header border, filter section
  border, action filter labels, move entries, timestamps, expanded detail, expanded pre-block,
  expanded divider, error banner, overlay message, and search `<mark>` highlight.
- Fix hardcoded dark overrides in `TimelineScrubber.tsx`: container background, text, and border.
- Fix `HistoricalViewBanner.tsx`: add `dark:` variants so the blue accent renders correctly in
  both light and dark mode without removing the intentional blue identity.
- Fix `HintSettingsSection.tsx` `Card` wrapper overrides and preview output container.
- Audit `AnimationSettings.tsx`; fix any hardcoded dark-palette overrides found.
- Write component tests asserting the correct themed class names on affected elements.
- Manual visual verification in both light and dark modes (see Test Plan).

**Sequencing note:**

- Prefer landing this story before `US-057`. `US-057` rebuilds most of `HintSettingsSection`, so
  doing the theme-token cleanup first avoids mixing structural settings changes with unrelated
  color-token churn in the same implementation PR.

**Out of scope:**

- Inner controls of `HintSettingsSection` (verbosity dropdown, preview buttons, sound section,
  reset button) — replaced wholesale in US-057; no color cleanup warranted here.
- Playwright or visual snapshot tests for the settings modal content — the surface is unstable
  pending US-057; a snapshot would become stale within one story.
- Theme toggle UI or theme persistence — the active theme is controlled by the existing
  Tailwind/Shadcn CSS variable setup; this story only fixes components that ignore it.
- Any component outside the three history components and the two settings modal content
  components (`HintSettingsSection`, `AnimationSettings`).
- New `dark:` variant authoring for elements not yet covered — the fix is Shadcn/ui token
  adoption, not a dark-variant authoring pass.

## Acceptance Criteria

### History Panel (TH-1)

- AC-1: `HistoryPanel` header row uses `border-b` with no hardcoded color class
  (`border-slate-700` is removed); border color inherits from the active theme.
- AC-2: Filter summary paragraph uses `text-muted-foreground` (not `text-slate-300`).
- AC-3: Filter section container uses `border-b` with no hardcoded color.
- AC-4: Action filter checkbox labels use `border` with no hardcoded color (`border-slate-700`
  is removed).
- AC-5: Move entry `article` elements use `bg-card` and `border` (not `bg-slate-800` /
  `border-slate-700`).
- AC-6: Move timestamp text uses `text-muted-foreground` (not `text-slate-400`).
- AC-7: Expanded detail paragraph uses `text-muted-foreground` (not `text-slate-300`).
- AC-8: Expanded JSON `pre` block uses `bg-muted text-muted-foreground` (not
  `bg-slate-950/80 text-slate-200`).
- AC-9: Expanded detail divider uses `border-t` with no hardcoded color (`border-slate-700`
  is removed).
- AC-10: Error banner uses Shadcn/ui destructive semantic tokens (`border-destructive`,
  `bg-destructive/10`, `text-destructive-foreground`) instead of hardcoded red palette classes.
- AC-11: Overlay message uses `bg-background/80 text-foreground` (not `bg-slate-950/60
text-slate-100`).
- AC-12: Search `<mark>` element uses a dark-mode-aware color pair (e.g.,
  `bg-yellow-200 dark:bg-yellow-700 text-black dark:text-yellow-50`) so highlighted text is
  legible in both themes. Plain `bg-yellow-200 text-black` with no `dark:` variant is not
  acceptable.

### TimelineScrubber (TH-1)

- AC-13: Container uses `bg-popover text-popover-foreground` (or equivalent Shadcn/ui token) in
  place of `bg-slate-900/95 text-slate-100`.
- AC-14: Container border uses `border` with no hardcoded color (`border-blue-300/30` is
  removed).

### HistoricalViewBanner (TH-1)

- AC-15: Banner background uses a `dark:`-aware expression so it does not appear as a
  dark-on-light block in light mode. The blue identity (`bg-blue-900` or equivalent) is
  preserved in dark mode.
- AC-16: Banner text does not use plain `text-white` without a `dark:` modifier; uses
  `text-foreground` or an explicit light/dark-aware color pair.

### Settings Modal (TH-2)

- AC-17: `HintSettingsSection` `Card` wrapper has no hardcoded dark overrides
  (`border-slate-700`, `bg-slate-950/80`, `text-slate-100` are removed); the `Card` inherits
  Shadcn/ui theme defaults.
- AC-18: Preview output `div` (`data-testid="hint-preview-output"`) uses `bg-muted` or
  `bg-accent` and `border` with no hardcoded color (removes `bg-cyan-950/30 border-cyan-700/60`).
- AC-19: `AnimationSettings` audit passes — no hardcoded dark-palette overrides remain on
  container or section elements; fix any found.
- AC-20: `hint-settings-dialog` renders without visible dark/light contrast inversion when the
  active theme is light.

## Edge Cases

- EC-1: The `Sheet` in `HistoryPanel` uses `modal={false}`. After the theming fix, verify the
  sheet still renders correctly in light mode — `SheetContent` may carry a dark default in the
  app's Shadcn config; the inner layout must not re-darken it.
- EC-2: `HistoricalViewBanner` must remain visually distinct from the normal top status bar
  (`CharlestonTracker` / `GameplayStatusBar`) in both themes. The blue accent signaling
  historical / read-only mode must be preserved — do not neutralize it to a colorless token.
- EC-3: The `<mark>` search highlight must have sufficient contrast against `bg-card` in dark mode.
  A single `bg-yellow-200` without a dark variant fails dark-mode contrast on a dark card.
- EC-4: `TimelineScrubber` uses a `fixed z-30` overlay. After swapping to `bg-popover`, verify
  the scrubber remains legible against board content in both themes (popover token should be
  opaque enough not to bleed board graphics through).
- EC-5: After replacing `bg-slate-800` on move entries, the accent rings (`ring-1 ring-cyan-400/70`
  for most-recent, `ring-2 ring-blue-400` for active jump target) must still have sufficient
  contrast against `bg-card` in both themes.

## Primary Files (Expected)

- `apps/client/src/components/game/HistoryPanel.tsx` — remove all hardcoded dark overrides
  listed in the offenders section; update `<mark>` to use dark-mode-aware classes
- `apps/client/src/components/game/HistoryPanel.test.tsx` — add/update class assertions for AC-1
  through AC-12
- `apps/client/src/components/game/TimelineScrubber.tsx` — replace container classes per AC-13,
  AC-14
- `apps/client/src/components/game/TimelineScrubber.test.tsx` — add/update class assertions for
  AC-13, AC-14
- `apps/client/src/components/game/HistoricalViewBanner.tsx` — add `dark:` variants per AC-15,
  AC-16
- `apps/client/src/components/game/HistoricalViewBanner.test.tsx` — add/update class assertions
  for AC-15, AC-16
- `apps/client/src/components/game/HintSettingsSection.tsx` — remove `Card` wrapper overrides
  and preview output hardcoded colors per AC-17, AC-18
- `apps/client/src/components/game/HintSettingsSection.test.tsx` — add/update class assertions
  for AC-17, AC-18
- `apps/client/src/components/game/AnimationSettings.tsx` — audit; fix any hardcoded dark
  overrides found per AC-19

## Notes for Implementer

### Class substitution reference

The project uses Shadcn/ui with CSS variables. The Shadcn token names map to `--background`,
`--foreground`, `--card`, `--card-foreground`, `--muted`, `--muted-foreground`, `--popover`,
`--popover-foreground`, `--border`, and `--destructive` CSS variables defined in the global
stylesheet. Use the matching Tailwind utility names.

| Hardcoded class                             | Theme-aware replacement                                                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg-slate-800`                              | `bg-card`                                                                                                                                    |
| `bg-slate-900`, `bg-slate-950`              | `bg-background` or `bg-popover`                                                                                                              |
| `bg-slate-950/80`                           | `bg-muted` or `bg-card`                                                                                                                      |
| `text-slate-100`, `text-white` (generic)    | `text-foreground` or `text-card-foreground`                                                                                                  |
| `text-slate-300`                            | `text-muted-foreground`                                                                                                                      |
| `text-slate-400`                            | `text-muted-foreground`                                                                                                                      |
| `text-slate-200`                            | `text-foreground`                                                                                                                            |
| `border-slate-700`                          | `border` (uses `--border` variable)                                                                                                          |
| `border-blue-300/30`                        | `border`                                                                                                                                     |
| `border-red-700 bg-red-950/60 text-red-200` | `border-destructive bg-destructive/10 text-destructive-foreground`                                                                           |
| `border-cyan-700/60 bg-cyan-950/30`         | `border bg-muted`                                                                                                                            |
| `bg-yellow-200 text-black` (mark)           | `bg-yellow-200 dark:bg-yellow-700 text-black dark:text-yellow-50`                                                                            |
| `bg-blue-900/95` (HistoricalViewBanner)     | `bg-blue-800 dark:bg-blue-900/95` — retains blue identity; light-mode value is darker so it is visible on light page backgrounds             |
| `text-white` (HistoricalViewBanner)         | `text-white dark:text-white` is fine if the bg is always a dark blue; alternatively use `text-blue-50` which has more contrast in edge cases |

### Why HintSettingsSection inner controls are deferred

US-057 removes the verbosity dropdown, all four preview buttons, the preview output box, the
sound checkbox, the sound type select, the test button, and the reset button. Theming those
elements now and deleting them in the next story creates unnecessary churn. Fix only:

1. The `Card` container's three hardcoded overrides (`border-slate-700 bg-slate-950/80
text-slate-100`).
2. The `hint-preview-output` div's hardcoded border and background.

Leave the inner control elements' colors for US-057 to clean up during its delete pass.

If `US-057` lands first, re-scope AC-17 and AC-18 against the rebuilt `HintSettingsSection`
instead of the current pre-rebuild control tree.

### Test strategy for theme compliance

Component tests asserting class presence are preferred over Playwright visual snapshots for this
story because:

- The settings modal content is being replaced in US-057; a snapshot would become stale
  immediately.
- Class assertions are CI-stable and do not require a real browser.

Use `render` + `getByTestId` + `toHaveClass` / `not.toHaveClass` from Testing Library to assert
the correct Tailwind token names. Example pattern:

```ts
const entry = getByTestId('history-entry-1');
expect(entry).toHaveClass('bg-card');
expect(entry).not.toHaveClass('bg-slate-800');
```

### Manual verification procedure

After implementation, toggle between light and dark mode (set / remove the `dark` class on the
root `<html>` element in devtools, or use the existing theme toggle if one exists) and confirm:

1. History panel in both modes: text is legible, move cards are distinguishable from the
   panel background, borders are visible.
2. Timeline scrubber in light mode: background is not a dark block floating over the board.
3. Historical view banner in light mode: blue tint is visible and text is readable; in dark mode,
   no regression from current appearance.
4. Settings modal in light mode: card interior matches the dialog tone, no white-text-on-white
   or dark-card-on-light surfaces.

## Test Plan

- `HistoryPanel.test.tsx` (update or create):
  - Assert move entry `article` has `bg-card`; assert it does **not** have `bg-slate-800`.
  - Assert filter summary `p` has `text-muted-foreground`; assert it does not have `text-slate-300`.
  - Assert error banner has `border-destructive` when `error` is non-null.
  - Assert search `<mark>` element has `dark:bg-yellow-700` (or equivalent dark variant).
  - Assert overlay message element has `bg-background/80`; assert it does not have `bg-slate-950/60`.
- `TimelineScrubber.test.tsx` (update or create):
  - Assert `timeline-scrubber` container has `bg-popover`; assert it does not have `bg-slate-900`.
  - Assert container does not have `border-blue-300/30`.
- `HistoricalViewBanner.test.tsx` (update or create):
  - Assert `historical-view-banner` has `bg-blue-800` (or the light-mode value chosen) and not
    only `bg-blue-900/95`.
  - Assert banner text element does not use bare `text-white` (assert presence of the chosen
    dark-mode-aware class instead).
- `HintSettingsSection.test.tsx` (update or create):
  - Assert `hint-settings-section` does not have `bg-slate-950/80`.
  - Assert `hint-settings-section` does not have `border-slate-700`.
  - Assert `hint-preview-output` does not have `bg-cyan-950/30`.
- `AnimationSettings.test.tsx` (update or create if any hardcoded overrides found):
  - Assert no hardcoded dark-palette background or text class on root container.
- Manual checklist (not automated — record outcome in PR description):
  - [ ] History panel — light mode: legible, no dark-on-dark
  - [ ] History panel — dark mode: no regression from current
  - [ ] Timeline scrubber — light mode: background not a dark block
  - [ ] Historical view banner — light mode: blue accent visible, text readable
  - [ ] Historical view banner — dark mode: no regression from current
  - [ ] Settings modal — light mode: no inverted contrast surfaces

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/HistoryPanel.test.tsx
npx vitest run apps/client/src/components/game/TimelineScrubber.test.tsx
npx vitest run apps/client/src/components/game/HistoricalViewBanner.test.tsx
npx vitest run apps/client/src/components/game/HintSettingsSection.test.tsx
npx tsc --noEmit
npx prettier --write \
  apps/client/src/components/game/HistoryPanel.tsx \
  apps/client/src/components/game/TimelineScrubber.tsx \
  apps/client/src/components/game/HistoricalViewBanner.tsx \
  apps/client/src/components/game/HintSettingsSection.tsx \
  docs/implementation/frontend/user-stories/US-056-light-dark-theme-compliance-history-panel-settings-modal.md \
  docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md
```

## Codex Implementation Summary

- Implementation date: 2026-03-14
- Commit hash: `819b768`
- Files changed:
  - `apps/client/src/components/game/HistoryPanel.tsx`
  - `apps/client/src/components/game/HistoryPanel.test.tsx`
  - `apps/client/src/components/game/TimelineScrubber.tsx`
  - `apps/client/src/components/game/TimelineScrubber.test.tsx`
  - `apps/client/src/components/game/HistoricalViewBanner.tsx`
  - `apps/client/src/components/game/HistoricalViewBanner.test.tsx`
  - `apps/client/src/components/game/HintSettingsSection.tsx`
  - `apps/client/src/components/game/HintSettingsSection.test.tsx`
  - `apps/client/src/components/game/AnimationSettings.tsx`
  - `apps/client/src/components/game/AnimationSettings.test.tsx`
- AC/EC coverage summary:
  - Implemented AC-1 through AC-19 across the scoped history, replay, and settings surfaces using Shadcn/ui theme tokens instead of hardcoded dark-palette classes.
  - Preserved the historical-view blue identity with light/dark-aware banner styling and updated the search `<mark>` styling for dark-mode legibility.
  - Addressed the scoped edge cases around theme inheritance, overlay readability, and contrast on history-entry cards.
  - AC-20 was covered by the wrapper-content cleanup inside the existing `hint-settings-dialog`, but no broader dialog-wide theme refactor was added.
- Test/verification summary:
  - Passed targeted component tests for `HistoryPanel`, `TimelineScrubber`, `HistoricalViewBanner`, `HintSettingsSection`, and `AnimationSettings`.
  - Passed `npx tsc --noEmit`.
  - Ran the full validation pipeline from `AGENTS.md`, including Rust format/check/test/clippy and `npx prettier --write .`.
  - `npm run check:all` failed on unrelated discard-pool integration assertions in the already-dirty worktree (`DiscardPool` / historical discard layout), not on US-056 surfaces.
- Known follow-ups or deferred items:
  - Inner `HintSettingsSection` control cleanup remains deferred to `US-057` per the sequencing note.
  - `USER-TESTING-BACKLOG.md` was not updated because it already had unrelated unstaged edits.

---

## Claude Code Review — 2026-03-14

Reviewed against the spec by reading source files directly. Each AC and EC is quoted from the
implementation and given a verdict. No test pass/fail was used to infer correctness.

### AC-1 — HistoryPanel header row: `border-b` with no hardcoded color

**Source** (`HistoryPanel.tsx:205`):

```tsx
<header className="border-b p-4">
```

No `border-slate-700`. **PASS.**

---

### AC-2 — Filter summary uses `text-muted-foreground`

**Source** (`HistoryPanel.tsx:246`):

```tsx
<p className="mt-2 text-xs text-muted-foreground">{filterSummary}</p>
```

No `text-slate-300`. **PASS.**

**Test** (`HistoryPanel.test.tsx:154–155`):

```ts
expect(screen.getByText('Showing all 2 moves')).toHaveClass('text-muted-foreground');
expect(screen.getByText('Showing all 2 moves')).not.toHaveClass('text-slate-300');
```

Test asserts both positive and negative. **PASS.**

---

### AC-3 — Filter section container uses `border-b` with no hardcoded color

**Source** (`HistoryPanel.tsx:252`):

```tsx
<div className="space-y-3 border-b p-4">
```

No `border-slate-700`. **PASS.**

No dedicated test assertion for this element; the spec test plan does not list one either.
Minor coverage gap but not a spec violation.

---

### AC-4 — Action filter checkbox labels use `border` with no hardcoded color

**Source** (`HistoryPanel.tsx:282`):

```tsx
<label key={filter} className="flex items-center gap-2 rounded border px-2 py-1 text-xs">
```

No `border-slate-700`. **PASS.**

No dedicated test assertion; spec test plan does not require one. Minor gap only.

---

### AC-5 — Move entry `article` uses `bg-card` and `border`

**Source** (`HistoryPanel.tsx:330–335`):

```tsx
className={cn(
  'rounded border bg-card p-3 text-sm',
  isMostRecent && 'ring-1 ring-cyan-400/70',
  activeMoveNumber === move.move_number && 'ring-2 ring-blue-400',
  isPulsing && 'animate-pulse'
)}
```

`bg-card` and `border` present; `bg-slate-800` and `border-slate-700` absent. **PASS.**

**Test** (`HistoryPanel.test.tsx:151–152`):

```ts
expect(entry).toHaveClass('bg-card');
expect(entry).not.toHaveClass('bg-slate-800');
```

**PASS.**

---

### AC-6 — Move timestamp uses `text-muted-foreground`

**Source** (`HistoryPanel.tsx:357`):

```tsx
<span className="text-xs text-muted-foreground" title={move.timestamp}>
```

No `text-slate-400`. **PASS.**

No dedicated test assertion; spec test plan does not require one.

---

### AC-7 — Expanded detail paragraph uses `text-muted-foreground`

**Source** (`HistoryPanel.tsx:365`):

```tsx
<p className="text-xs text-muted-foreground">{move.description}</p>
```

No `text-slate-300`. **PASS.**

No dedicated test assertion; spec test plan does not require one.

---

### AC-8 — Expanded JSON `pre` block uses `bg-muted text-muted-foreground`

**Source** (`HistoryPanel.tsx:366`):

```tsx
<pre className="max-h-28 overflow-auto rounded bg-muted p-2 text-[11px] text-muted-foreground">
```

Both `bg-muted` and `text-muted-foreground` present; `bg-slate-950/80` and `text-slate-200` absent.
**PASS.**

No dedicated test assertion; spec test plan does not require one.

---

### AC-9 — Expanded detail divider uses `border-t` with no hardcoded color

**Source** (`HistoryPanel.tsx:364`):

```tsx
<div className="mt-2 space-y-2 border-t pt-2">
```

`border-t` only; no `border-slate-700`. **PASS.**

No dedicated test assertion; spec test plan does not require one.

---

### AC-10 — Error banner uses destructive semantic tokens

**Source** (`HistoryPanel.tsx:296`):

```tsx
<div className="flex items-center justify-between rounded border border-destructive bg-destructive/10 px-2 py-1 text-xs text-destructive-foreground">
```

`border-destructive`, `bg-destructive/10`, `text-destructive-foreground` all present;
`border-red-700`, `bg-red-950/60`, `text-red-200` all absent. **PASS.**

**Test** (`HistoryPanel.test.tsx:169–174`):

```ts
expect(banner).toHaveClass(
  'border-destructive',
  'bg-destructive/10',
  'text-destructive-foreground'
);
expect(banner).not.toHaveClass('border-red-700', 'bg-red-950/60', 'text-red-200');
```

**PASS.**

---

### AC-11 — Overlay message uses `bg-background/80 text-foreground`

**Source** (`HistoryPanel.tsx:387`):

```tsx
<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 px-4 text-center text-sm text-foreground">
```

`bg-background/80` and `text-foreground` present; `bg-slate-950/60` and `text-slate-100` absent.
**PASS.**

**Test** (`HistoryPanel.test.tsx:191–192`):

```ts
expect(overlay).toHaveClass('bg-background/80', 'text-foreground');
expect(overlay).not.toHaveClass('bg-slate-950/60', 'text-slate-100');
```

**PASS.**

---

### AC-12 — Search `<mark>` uses dark-mode-aware color pair

**Source** (`HistoryPanel.tsx:110–114`):

```tsx
<mark
  key={`${index}-${match}`}
  className="bg-yellow-200 px-0.5 text-black dark:bg-yellow-700 dark:text-yellow-50"
>
```

Both light (`bg-yellow-200 text-black`) and dark (`dark:bg-yellow-700 dark:text-yellow-50`)
variants present. **PASS.**

**Test** (`HistoryPanel.test.tsx:106`):

```ts
expect(highlight).toHaveClass('bg-yellow-200', 'dark:bg-yellow-700', 'text-black');
```

**PASS.**

---

### AC-13 — TimelineScrubber container uses `bg-popover text-popover-foreground`

**Source** (`TimelineScrubber.tsx:51`):

```tsx
className =
  'fixed top-14 left-1/2 z-30 w-[min(760px,92vw)] -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-sm';
```

`bg-popover` and `text-popover-foreground` present; `bg-slate-900/95` and `text-slate-100` absent.
**PASS.**

**Test** (`TimelineScrubber.test.tsx:14–15`):

```ts
expect(scrubber).toHaveClass('bg-popover', 'text-popover-foreground');
expect(scrubber).not.toHaveClass('bg-slate-900/95', 'text-slate-100', 'border-blue-300/30');
```

**PASS.**

---

### AC-14 — TimelineScrubber border uses `border` with no hardcoded color

**Source** (`TimelineScrubber.tsx:51`): same class string as above — `border` only; `border-blue-300/30`
absent. **PASS.**

**Test** (`TimelineScrubber.test.tsx:15`): asserts `not.toHaveClass('border-blue-300/30')`. **PASS.**

---

### AC-15 — HistoricalViewBanner background is dark-aware; blue identity preserved in dark mode

**Source** (`HistoricalViewBanner.tsx:44`):

```tsx
className =
  'fixed top-0 left-0 right-0 z-30 border-b border-blue-300 bg-blue-100 px-4 py-3 text-blue-950 dark:border-blue-300/40 dark:bg-blue-900/95 dark:text-blue-50';
```

Light mode: `bg-blue-100` (soft blue, not a dark block). Dark mode: `dark:bg-blue-900/95` (deep blue,
preserves blue identity). The spec's substitution table suggested `bg-blue-800` for light mode, but
the AC text only requires "does not appear as a dark-on-light block" and "blue identity preserved in
dark mode." `bg-blue-100` satisfies both constraints. **PASS.**

**Test** (`HistoricalViewBanner.test.tsx:21–27`):

```ts
expect(banner).toHaveClass(
  'bg-blue-100',
  'text-blue-950',
  'dark:bg-blue-900/95',
  'dark:text-blue-50'
);
expect(banner).not.toHaveClass('text-white');
```

**PASS.**

---

### AC-16 — Banner text does not use bare `text-white`

**Source** (`HistoricalViewBanner.tsx:44`): `text-blue-950 dark:text-blue-50` — no `text-white` anywhere
in the file. **PASS.**

**Test** (`HistoricalViewBanner.test.tsx:27`): `expect(banner).not.toHaveClass('text-white')`. **PASS.**

---

### AC-17 — HintSettingsSection `Card` wrapper has no hardcoded dark overrides

**Source** (`HintSettingsSection.tsx:92`):

```tsx
<Card className="space-y-4 p-4" data-testid="hint-settings-section">
```

`border-slate-700`, `bg-slate-950/80`, `text-slate-100` all absent from the `Card` className. **PASS.**

**Test** (`HintSettingsSection.test.tsx:41`):

```ts
expect(section).not.toHaveClass('bg-slate-950/80', 'border-slate-700', 'text-slate-100');
```

**PASS.**

**Note:** Inner controls at lines 120 and 128 still carry hardcoded slate classes:

- `HintSettingsSection.tsx:120`: `<p className="text-sm text-slate-300">Preview each verbosity level</p>`
- `HintSettingsSection.tsx:128`: `<div className="text-slate-400">{option.description}</div>`

These are inner controls explicitly deferred to US-057. They are out-of-scope for AC-17 per the spec's
"Notes for Implementer" section. **Acknowledged scope deferral — not a failure for this story.**

---

### AC-18 — Preview output `div` uses `bg-muted border` with no hardcoded cyan classes

**Source** (`HintSettingsSection.tsx:140`):

```tsx
<div className="rounded border bg-muted p-2 text-sm" data-testid="hint-preview-output">
```

`bg-muted` and `border` present; `bg-cyan-950/30` and `border-cyan-700/60` absent. **PASS.**

**Test** (`HintSettingsSection.test.tsx:44–45`):

```ts
expect(preview).toHaveClass('bg-muted', 'border');
expect(preview).not.toHaveClass('bg-cyan-950/30', 'border-cyan-700/60');
```

**PASS.**

---

### AC-19 — AnimationSettings audit: no hardcoded dark-palette overrides

**Source** (`AnimationSettings.tsx:15–23`):

```tsx
<Card className="space-y-3 p-4" data-testid="animation-settings-card">
  <h3 className="text-lg font-semibold">Animations</h3>
  <p className="text-sm text-muted-foreground" data-testid="animation-policy-status">
```

`Card` className: `space-y-3 p-4` — no dark overrides. Status text: `text-muted-foreground` — no
`text-slate-300`. No other elements in the file. **PASS.**

**Test** (`AnimationSettings.test.tsx:35–42`):

```ts
expect(screen.getByTestId('animation-settings-card')).not.toHaveClass(
  'border-slate-700',
  'bg-slate-950/80',
  'text-slate-100'
);
expect(screen.getByTestId('animation-policy-status')).toHaveClass('text-muted-foreground');
expect(screen.getByTestId('animation-policy-status')).not.toHaveClass('text-slate-300');
```

**PASS.**

---

### AC-20 — `hint-settings-dialog` renders without contrast inversion in light mode

The two structural surfaces targeted by this story (the `Card` wrapper and `hint-preview-output`)
have been fixed per AC-17 and AC-18. The dialog inherits Shadcn/ui defaults for those surfaces.

However, the inner controls deferred to US-057 (`text-slate-300` on line 120,
`text-slate-400` on line 128) will still produce near-invisible text on a light card background
until US-057 cleans them up. This is an accepted, explicit scope deferral documented in the
spec's "Notes for Implementer" section.

**PARTIAL PASS.** The wrapper-level contrast inversion is resolved. Residual inner-control
contrast issues remain and are tracked to US-057.

---

### EC-1 — Sheet still renders correctly in light mode after theming fix

**Source** (`HistoryPanel.tsx:198–203`):

```tsx
<Sheet open={isOpen} modal={false} onOpenChange={(open) => !open && onClose()}>
  <SheetContent side="right" aria-label="Game move history" className={cn('p-0', dimmed && 'opacity-70')}>
```

`modal={false}` is unchanged. `SheetContent` receives only `p-0` (plus optional `opacity-70`);
no new dark overrides were added to `SheetContent`. Inner layout elements now use theme tokens
(`border-b`, `bg-card`, `bg-background/80`, etc.) rather than slate overrides, so they inherit
SheetContent's CSS variables rather than fighting them. **PASS (code-level).**

---

### EC-2 — HistoricalViewBanner remains visually distinct with blue accent in both themes

**Source** (`HistoricalViewBanner.tsx:44`): `bg-blue-100` in light mode; `dark:bg-blue-900/95` in dark.
Both are clearly blue. The banner text uses `text-blue-950` (dark navy) in light mode and `dark:text-blue-50`
in dark mode. Blue identity maintained; element is never a neutral/colorless token. **PASS.**

---

### EC-3 — Search `<mark>` has sufficient contrast on dark card

**Source** (`HistoryPanel.tsx:111`): `dark:bg-yellow-700 dark:text-yellow-50` — yellow-700 background
with yellow-50 (near-white) text. Against a dark `bg-card` surface, the yellow-700 block provides
a clearly distinguishable highlight region. **PASS.**

---

### EC-4 — TimelineScrubber remains legible in both themes after `bg-popover` swap

**Source** (`TimelineScrubber.tsx:51`): `bg-popover ... shadow-sm`. The Shadcn/ui `--popover` CSS
variable maps to a fully opaque background in both themes (white in light, dark in dark). No
opacity modifier was applied, so board content does not bleed through. `shadow-sm` provides visual
separation. **PASS (code-level).**

---

### EC-5 — Accent rings remain visible on `bg-card`

**Source** (`HistoryPanel.tsx:332–333`):

```tsx
isMostRecent && 'ring-1 ring-cyan-400/70',
activeMoveNumber === move.move_number && 'ring-2 ring-blue-400',
```

Ring classes are unchanged from before the migration. `bg-card` is typically white (light) or a
dark surface (dark); cyan-400 and blue-400 rings contrast against both. **PASS.**

---

### Overall Verdict

| AC/EC | Verdict                                                                         |
| ----- | ------------------------------------------------------------------------------- |
| AC-1  | PASS                                                                            |
| AC-2  | PASS                                                                            |
| AC-3  | PASS (no test, minor gap)                                                       |
| AC-4  | PASS (no test, minor gap)                                                       |
| AC-5  | PASS                                                                            |
| AC-6  | PASS (no test, minor gap)                                                       |
| AC-7  | PASS (no test, minor gap)                                                       |
| AC-8  | PASS (no test, minor gap)                                                       |
| AC-9  | PASS (no test, minor gap)                                                       |
| AC-10 | PASS                                                                            |
| AC-11 | PASS                                                                            |
| AC-12 | PASS                                                                            |
| AC-13 | PASS                                                                            |
| AC-14 | PASS                                                                            |
| AC-15 | PASS                                                                            |
| AC-16 | PASS                                                                            |
| AC-17 | PASS (inner controls deferred per spec)                                         |
| AC-18 | PASS                                                                            |
| AC-19 | PASS                                                                            |
| AC-20 | PARTIAL — wrapper fixed; inner-control slate classes remain, deferred to US-057 |
| EC-1  | PASS                                                                            |
| EC-2  | PASS                                                                            |
| EC-3  | PASS                                                                            |
| EC-4  | PASS                                                                            |
| EC-5  | PASS                                                                            |

**Blocking issues: none.** The one partial (AC-20) is fully covered by the spec's explicit scope
deferral to US-057. All other ACs and ECs pass based on direct source reading.
