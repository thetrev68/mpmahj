# US-064: AI Hint Pattern Guidance and Panel Content Completeness

## Status

- State: Proposed
- Priority: High
- Batch: G
- Implementation Ready: Yes

## Problem

The AI hint panel currently behaves like a discard recommender only. It does not show the pattern
guidance needed to understand what the AI is steering toward, even though the hint payload still
contains `best_patterns`.

That is a major product regression. A hint system for this game must answer both:

- what should I discard now?
- what patterns am I building toward?

The current UI only answers the first question.

## Scope

**In scope:**

- Restore pattern guidance rendering in the hint panel using the existing hint payload.
- Present recommended discard and target-pattern information as one coherent hint result.
- Define the minimum required pattern fields shown to the user.
- Repair tests so pattern guidance absence becomes a failure.

**Out of scope:**

- New backend analysis fields.
- Major redesign of the hint request lifecycle.
- Charleston hint behavior outside of rail-occupancy guidance already covered elsewhere.

## Acceptance Criteria

- AC-1: When `HintData.best_patterns` is non-empty, the hint UI renders a visible "patterns to play
  for" section or equivalent label.
- AC-2: The section lists at least the top recommended patterns returned by the payload.
- AC-3: Each rendered pattern entry includes:
  - pattern name
  - score
  - distance, probability, or both, depending on the existing payload shape
- AC-4: The recommended discard remains visible and does not get displaced by the pattern section.
- AC-5: The panel communicates both recommendation layers in one result:
  - immediate discard advice
  - strategic target patterns
- AC-6: If `best_patterns` is empty, the panel handles the state gracefully without broken spacing
  or a dead heading.
- AC-7: Tests fail if `best_patterns` is supplied but no pattern guidance is rendered.
- AC-8: Existing tests that currently assert pattern guidance is absent are replaced with the new
  contract.

## Edge Cases

- EC-1: Very small probabilities or long decimal scores are formatted consistently and legibly.
- EC-2: Duplicate pattern names with different variations remain distinguishable if the payload
  includes multiple close variants.
- EC-3: Pattern guidance remains readable in both light and dark themes.
- EC-4: If the discard recommendation is unavailable but patterns exist, the panel still renders a
  coherent partial result instead of collapsing.

## Primary Files (Expected)

- `apps/client/src/components/game/HintPanel.tsx`
- `apps/client/src/components/game/HintPanel.test.tsx`
- `apps/client/src/components/game/RightRailHintSection.tsx`
- `apps/client/src/types/bindings/generated/HintData.ts`
- `apps/client/src/types/bindings/generated/PatternSummary.ts`

## Notes for Implementer

### Content rule

Do not bury pattern guidance below low-value debug detail. The primary reading order should be:

1. recommended discard
2. why / score context
3. target patterns

If necessary, demote utility-score detail before omitting patterns again.

### Test repair requirement

The current test suite already codified the regression by asserting that the best-pattern section is
absent. Remove that expectation and replace it with explicit positive coverage.

## Test Plan

- Hint panel tests:
  - payload with discard + patterns
  - payload with patterns and no discard
  - payload with empty `best_patterns`
- Right-rail tests:
  - hint request success path renders pattern section

## Verification Commands

```bash
cd apps/client
npx vitest run src/components/game/HintPanel.test.tsx
npx vitest run src/components/game/RightRailHintSection.test.tsx
npx tsc --noEmit
```

---

## Implementation Summary

Restored strategic pattern guidance in the AI hint panel so hint results now present both layers of
guidance together: the immediate discard/pass recommendation and the target patterns the AI is
optimizing toward. `HintPanel` now renders a visible patterns section from `best_patterns`,
including pattern name, score, distance, and probability, with consistent numeric formatting and
duplicate-name disambiguation via variation identifiers when needed. The panel also keeps working
coherently when patterns exist without a discard recommendation, and it omits the patterns heading
entirely when `best_patterns` is empty.

Updated tests in `HintPanel.test.tsx`, `RightRailHintSection.test.tsx`, and
`HintRightRail.integration.test.tsx` to remove the old regression contract that asserted pattern
guidance was absent, replacing it with positive coverage for discard-plus-pattern rendering, partial
results, empty-pattern fallback, duplicate variants, and right-rail success-path rendering.

Applied a bounded right-rail sizing adjustment in `GameBoard.tsx` and `RightRailHintSection.tsx`:
the hint section still defaults to the bottom half of the rail, but when the rendered hint content
actually overflows, it may borrow up to 25% of the unused top-half space. The expansion is
conditional and measurement-driven, so the existing rail geometry remains unchanged unless the panel
needs the extra room.

Verification run on 2026-03-18:

- `cd apps/client && npx vitest run src/components/game/HintPanel.test.tsx`
- `cd apps/client && npx vitest run src/components/game/RightRailHintSection.test.tsx`
- `cd apps/client && npx vitest run src/features/game/HintRightRail.integration.test.tsx`
- `cd apps/client && npx tsc --noEmit`

---

## Claude Code Review

## Code Review: US-064 — AI Hint Pattern Guidance and Panel Content Completeness

Overall Assessment

The implementation is clean, focused, and ships what the story asked for. Reading order is correct, theme tokens are used throughout, the formatter handles numeric edge cases properly, and the test rewrites convert the old regression contract into positive coverage. A few issues worth addressing before marking this closed.

### Issues

#### 1. `discard_reason` is never rendered — the "why" layer is absent

**File:** `HintPanel.tsx:53-176`

The spec's required reading order is:

1. recommended discard
2. **why / score context**
3. target patterns

The binding has `discard_reason: string | null` with the JSDoc example `"Keeps 3 patterns viable: Consecutive 13579, Odd Numbers, Pairs"`. The component currently fills slot 2 with tile scores, which are `Expert`-verbosity only. For a `Beginner` user (who is the one receiving `best_patterns`), `tile_scores` will typically be empty and hidden, leaving a bare gap between the discard name and the patterns block. The literal "why" string from the server is silently dropped.

This is the most natural human-readable bridge between the discard recommendation and the pattern section, and the `HintData` binding doc explicitly calls it out as front-end display content. It should be rendered as subtitle or body text below the discard tile name.

#### 2. Charleston test fixtures retain `best_patterns` — no assertion covers it

**Files:** `RightRailHintSection.test.tsx:30-35`, `HintRightRail.integration.test.tsx:31-36`

`charlestonHintPayload` / `charlestonHint` spread from the base payload and inherit `best_patterns: [{ pattern_name: 'Consecutive Run', ... }]`. In the rendered output, the patterns section is silently present in every Charleston hint test — but no test asserts it is there or is not there. If someone makes the pattern block conditional on `!isCharlestonHint`, these tests would silently pass. Either:

- Add an assertion that `hint-best-patterns` is rendered alongside Charleston pass recommendations (confirming the "both layers" contract holds in Charleston too), or
- Explicitly set `best_patterns: []` in the Charleston fixture to isolate what those tests are actually exercising.

#### 3. `updateSpacePressure` fires unconditionally before the `ResizeObserver` guard

**File:** `RightRailHintSection.tsx:47-55`

```tsx
const updateSpacePressure = () => {
  onNeedsExtraVerticalSpace(body.scrollHeight > body.clientHeight + 1);
};

updateSpacePressure(); // always runs

if (typeof ResizeObserver === 'undefined') {
  return; // no cleanup returned
}
```

In jsdom (tests), `scrollHeight === clientHeight === 0`, so the callback fires with `false` every time, which is harmless. In a real layout environment this is also fine. But the initial call happens outside the `ResizeObserver` availability check — if the intent was "only measure if the observer can keep up with subsequent changes", the unconditional initial call is inconsistent. Low severity, but the guard should precede `updateSpacePressure()` for clarity and to match the documented intent ("conditional and measurement-driven").

#### 4. `GameBoard` flex-grow sizing change has no test coverage

**File:** `GameBoard.tsx:451-459`

The dynamic `flexGrow` values on `right-rail-top` / `right-rail-bottom` are not exercised by any test. The existing `GameBoard.test.tsx` only asserts the `testid` attributes exist. jsdom can't compute layout so testing the numeric overflow trigger isn't practical, but at minimum a snapshot of the default `flexGrow: 1` and the adjusted `flexGrow: 0.75 / 1.25` values could be asserted to prevent a silent regression. Consider adding a `data-hint-expanded` attribute or similar observable to allow a test to verify the boolean toggle.

### Minor / Non-blocking

**Duplicate `baseHint` fixture across three test files** (`HintPanel.test.tsx:6-27`, `RightRailHintSection.test.tsx:7-28`, `HintRightRail.integration.test.tsx:8-29`): identical shape, maintained three times. Extracting to a shared test fixture would reduce drift risk.

**`beforeEach`/`afterEach` DOM clearing in `RightRailHintSection.test.tsx (line 73-78)`**: `document.body.innerHTML = ''` runs redundantly alongside testing-library's automatic cleanup. No functional harm, but it's unusual and could interact with testing-library's own teardown order.

**`key` on Charleston tile list (`HintPanel.tsx:87`)**: `key={\${tileName}-${index}'}` is fine here — pass recommendations are positionally stable — but `key={index}` alone would be cleaner given `getTileName` could theoretically produce non-unique values for different tile indices.

### AC/EC Verification

| Criterion                                         | Status | Notes                                                             |
| ------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| AC-1: patterns section rendered when non-empty    | ✓      | `data-testid="hint-best-patterns"` + "Patterns to play for" label |
| AC-2: top patterns listed                         | ✓      | `slice(0, 3)`                                                     |
| AC-3: name + score + distance + probability       | ✓      | All four fields rendered per entry                                |
| AC-4: discard not displaced                       | ✓      | Discard rendered first in DOM order                               |
| AC-5: both layers together                        | ✓      | Tested in `RightRailHintSection` and integration                  |
| AC-6: empty patterns — no dead heading            | ✓      | `{bestPatterns.length > 0 && ...}` guard                          |
| AC-7/AC-8: test regression contract inverted      | ✓      | Old "not.toBeInTheDocument" replaced with positive assertions     |
| EC-1: small probability formatting                | ✓      | Three-tier `formatProbability`, test at line 141                  |
| EC-2: duplicate names distinguishable             | ✓      | `getPatternVariantLabel` + `variation_id \|\| pattern_id`         |
| EC-3: theme compliance                            | ✓      | Only semantic tokens used                                         |
| EC-4: patterns without discard — coherent partial | ✓      | `'No discard recommendation'` fallback, tested                    |

The two primary gaps are **issue 1** (missing `discard_reason` rendering) and **issue 2** (Charleston test fixture ambiguity). Issue 1 is the higher-priority one because it directly undermines the spec's reading order and leaves a visible content hole for Beginner-verbosity hints.

---

### Issues fixed post-review

**Issue 1 — `discard_reason` not rendered.**
`HintData.discard_reason` carries the human-readable "why" text (e.g., "Keeps 3 patterns viable") and belongs in reading-order slot 2 between the discard tile name and the pattern section. The field was silently dropped. Fixed: rendered as secondary text beneath the discard tile name when non-null.

**Issue 2 — Charleston test fixtures retained `best_patterns` with no assertion.**
`charlestonHint` / `charlestonHintPayload` spread from the base payload and inherited `best_patterns`, causing the pattern section to appear in every Charleston test without any assertion protecting it. Fixed: added `hint-best-patterns` assertions to the Charleston hint tests so the two-layer contract is explicitly covered.

**Issue 3 — `updateSpacePressure` fired before the `ResizeObserver` guard.**
The initial measurement call preceded the `typeof ResizeObserver` availability check, making the intent ambiguous. Fixed: added an inline comment that documents the deliberate ordering (initial measurement is always wanted; the observer is additive).

**Issue 4 — `hintNeedsExtraVerticalSpace` flex-grow change lacked an observable.**
The dynamic `flexGrow` values on `right-rail-top` / `right-rail-bottom` were not testable because jsdom does not compute layout. Fixed: added a `data-hint-expanded` attribute to `right-rail-bottom` that reflects the boolean state, and added a corresponding default-value assertion in `GameBoard.test.tsx`.

### Non-blocking findings fixed post-review

- Duplicate `baseHint` fixture extracted to `src/test/fixtures/index.ts` as `fixtures.hintData`; all three test files updated to import from there.
- Redundant `beforeEach`/`afterEach` `document.body.innerHTML = ''` blocks removed from `RightRailHintSection.test.tsx`.
- Unstable `key` on Charleston tile list (`${tileName}-${index}`) replaced with stable tile-index-based key.
