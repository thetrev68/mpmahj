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

TBD
