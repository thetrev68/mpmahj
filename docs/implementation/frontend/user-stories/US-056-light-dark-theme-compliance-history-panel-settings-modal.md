# US-056: Light/Dark Theme Compliance — History Panel + Settings Modal

## Status

- State: Proposed
- Priority: High
- Batch: E

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

| Hardcoded class | Theme-aware replacement |
|---|---|
| `bg-slate-800` | `bg-card` |
| `bg-slate-900`, `bg-slate-950` | `bg-background` or `bg-popover` |
| `bg-slate-950/80` | `bg-muted` or `bg-card` |
| `text-slate-100`, `text-white` (generic) | `text-foreground` or `text-card-foreground` |
| `text-slate-300` | `text-muted-foreground` |
| `text-slate-400` | `text-muted-foreground` |
| `text-slate-200` | `text-foreground` |
| `border-slate-700` | `border` (uses `--border` variable) |
| `border-blue-300/30` | `border` |
| `border-red-700 bg-red-950/60 text-red-200` | `border-destructive bg-destructive/10 text-destructive-foreground` |
| `border-cyan-700/60 bg-cyan-950/30` | `border bg-muted` |
| `bg-yellow-200 text-black` (mark) | `bg-yellow-200 dark:bg-yellow-700 text-black dark:text-yellow-50` |
| `bg-blue-900/95` (HistoricalViewBanner) | `bg-blue-800 dark:bg-blue-900/95` — retains blue identity; light-mode value is darker so it is visible on light page backgrounds |
| `text-white` (HistoricalViewBanner) | `text-white dark:text-white` is fine if the bg is always a dark blue; alternatively use `text-blue-50` which has more contrast in edge cases |

### Why HintSettingsSection inner controls are deferred

US-057 removes the verbosity dropdown, all four preview buttons, the preview output box, the
sound checkbox, the sound type select, the test button, and the reset button. Theming those
elements now and deleting them in the next story creates unnecessary churn. Fix only:

1. The `Card` container's three hardcoded overrides (`border-slate-700 bg-slate-950/80
   text-slate-100`).
2. The `hint-preview-output` div's hardcoded border and background.

Leave the inner control elements' colors for US-057 to clean up during its delete pass.

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
