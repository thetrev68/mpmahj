# Code Review Report: mpmahj (American Mahjong)

## Executive Summary

This is a well-structured monorepo (Rust backend + React/TS frontend) with solid architecture fundamentals — server-authoritative design, generated bindings, type-safe state machines. However, there are clear signs of AI-assisted development debt accumulated over ~73 user stories. The codebase is functionally sound but has cruft around the edges.

Overall grade: B- — Good architecture, clean Rust core, but frontend and docs have accumulated bloat.

### Repo Hygiene (Severity: Medium)

#### Committed artifacts that don't belong

These files are tracked in git but should be gitignored:

| File | Size | Issue |
| ---- | ---- | ----- |
| cloc.exe | 9.5 MB | Binary executable committed to git. Use a package manager or CI artifact instead |
| patch.diff | 122 B | Stale diff file (`// test` → `// test2`) — looks like a debugging leftover |
| tree.txt | 47 KB | Generated tree output — regenerate on demand |
| tree_scanner.py | 7 KB | One-off utility script in repo root |
| cloc-report.txt | 94 KB | Generated report |
| cloc-latest-report.txt | 3 KB | Generated report |
| copy-transparent-tiles.sh | 5 KB | One-off asset script in repo root |
| scripts/*.py | Various | 7 Python scripts for card/PDF processing — likely one-time tooling |

Untracked but also cluttering: `check-all.log` (173 KB), `checkall.log` (508 KB), `vitest.full.log` (457 KB) — these are gitignored by `*.log` but should be cleaned up locally.

#### `.gitignore` gap

`Cargo.lock` is gitignored, but for a binary/application project (which this is — it has a server), **Cargo.lock should be committed** per Rust convention. Libraries gitignore it; applications commit it.

### Frontend Code Quality (Severity: Medium)

#### Console logging in production code

29 `console.*` calls across production source files (not tests). Most are `console.log` in `useGameEvents.ts` (lines 140, 142, 160, 295, 303) and `useGameSocket.ts`. These should use a proper logging abstraction or be behind a `DEBUG` flag:

```tsx
useGameEvents.ts:140   console.log(`[useGameEvents] Sending command: ${commandType}`, command);
useGameEvents.ts:295   console.log('[useGameEvents] Subscribing to Event...');
useGameSocket.ts:158   console.log('WebSocket connected');
eventDispatchers.ts:104 console.log('[useGameEvents] Received state snapshot:', ...);
```

#### Duplicate fallback object

In `GameBoard.tsx:580-588 and 599-608`, the same `gameResult` fallback object is copy-pasted:

```tsx
// Appears twice — extract to a constant
{
  winner: null, winning_pattern: null, score_breakdown: null,
  final_scores: {}, final_hands: {},
  next_dealer: 'East', end_condition: 'WallExhausted',
}
```

#### Unused export

Knip detected `ErrorBoundary.tsx:75` — `DefaultFallback` is exported but never imported elsewhere.

#### Sound effects placeholder

`useSoundEffects.ts:146-175` falls back to oscillator-generated beep tones when audio files aren't configured. The `SoundEffect` type defines 8 variants, but event handlers dispatch at least 5 additional sound names (`'game-draw'`, `'mahjong-win'`, `'dead-hand-penalty'`, `'tile-place'`, `'undo-whoosh'`) that silently fall through. This is documented in TODO.md but represents a runtime behavior gap.

#### Large components

Several components are quite large (this may be justified by complexity, but worth noting):

- `GameBoard.tsx` — 617 lines
- `CharlestonPhase.tsx` — 570 lines, with 3 `eslint-disable-next-line` `react-hooks/exhaustive-deps` suppressions
- `PlayingPhasePresentation.tsx` — 464 lines

#### eslint-disable suppressions

3 exhaustive-deps suppressions in `CharlestonPhase.tsx:256, 277, 316`. These often indicate effects that should be restructured.

### Documentation Issues (Severity: Medium-High)

#### User story doc bloat

7 user story docs exceed 400 lines, with the largest at 849 lines (US-053). The bloat comes from two sources:

1. **Over-specified acceptance criteria** — some stories have 25+ ACs (US-057 has 25 ACs + 7 ECs), which reads like implementation verification rather than user-facing requirements
2. **Implementation summaries appended to spec docs** — completed stories have "Codex Implementation Summary" and "Claude Code Review" sections appended, turning spec docs into audit trails

**Recommendation**: Separate spec from verification. Keep user stories as requirements; move implementation summaries to commit messages or a separate review log.

#### AI-generated batch commit

Commit `23b39b6` adds 9 user stories in a single commit: _"feat: add user stories for duplicate-safe tile highlighting, play surface theme integrity, AI hint capability reconciliation, board layout cleanup, audio settings integrity, reduced-motion compliance, error boundaries, keyboard accessibility for tile selection, and background music controls UX honesty"_

This is a classic AI-batch pattern. The stories themselves are well-structured, but the batch approach means they weren't individually reviewed before being committed.

#### Stale refactor references

The `gameUIStore.ts` header comment (lines 12-13) references "migration in slices 4.2–4.4" as future work, but per your MEMORY.md, Phase 4 is complete. The comment is stale.

### Rust Backend (Severity: Low)

The Rust code is generally clean. Highlights:

#### Good

- `unwrap()` calls in non-test code are limited to doc examples (which is appropriate)
- Only 2 `#[allow(dead_code)]` annotations, both justified:
  - `dispatcher.rs:15` — helper for future replay/storage use
  - `history_websocket_e2e.rs:85` — test-only struct (normal for integration tests)
- Clean module structure, proper error types

#### Minor concern

- `room_actions.rs` has 18 `.clone()` calls, and `admin.rs` has 13. Some may be avoidable with borrowed references, but without deep auditing each call site, these could be necessary due to ownership constraints.
- Some large files: `command.rs` (653 lines), `scoring.rs` (638 lines), `validation.rs` (575 lines). These are acceptable for their complexity domains.

### Test Quality (Severity: Low-Medium)

#### Good Findings

- **126 test files** with 29 integration tests — excellent coverage
- 1,434 tests passing
- Test infrastructure is well-organized: fixtures, mocks, integration patterns
- Tests use real implementations where possible, mocks where necessary

#### Concerns

- `@ts-expect-error` appears 8 times in test files for WebSocket overrides. A cleaner approach would be proper test doubles or dependency injection.
- Test files are quite large — `PlayingPhasePresentation.test.tsx` at 478 lines, `useGameEvents.test.ts` at 452 lines.

### Tooling Issues (Severity: Low)

#### Broken knip reporter

`npx knip --reporter compact` crashes with `ERR_INVALID_ARG_TYPE`. The JSON reporter works but the compact reporter (likely what developers use day-to-day) is broken. This should be fixed or the knip version pinned.

#### Stale/unused npm scripts

- `todo:rust` references `cargo todo` which likely doesn't exist
- `todo:ts` uses Windows `findstr` — won't work in the bash shell configured for this repo
- `tiles:add-numbers`, `mcp:render:bootstrap`, `mcp:render:diag` — unclear if these are still used

### AI Slop Assessment

**Verdict: Moderate**. This is better than most AI-heavy codebases, but there are telltale signs:

1. **Module-level JSDoc blocks** that restate what the code does (e.g., GameBoard.tsx:1-24 — 24 lines of header comment that adds little over reading the imports)
2. **User story over-specification** — stories with 25+ acceptance criteria feel like AI-generated checklists rather than human-authored requirements
3. **Batch-committed documentation** — 9 user stories in one commit suggests automated generation
4. **"Notes for Implementer"** sections in user stories that are essentially AI instructions for AI (e.g., US-073's suggested implementation is verbatim what was implemented)
5. **Implementation summaries in spec docs** — appending "Claude Code Review" sections to specs is a paper trail of AI-driven development

**What's NOT slop**: The actual code quality is good. The Rust core is clean and idiomatic. The React patterns are reasonable. The architecture is sound. The AI assistance has been well-directed; the slop is primarily in documentation and process artifacts, not in the code itself.

### Priority Recommendations

#### Quick wins (do now)

- Remove `cloc.exe`, `patch.diff`, `tree.txt`, `tree_scanner.py` from git tracking
- Remove the `DefaultFallback` unused export
- Extract the duplicate `gameResult` fallback in `GameBoard.tsx`

#### Medium-term

- Add a logging abstraction to replace raw `console.log` calls
- Separate user story specs from implementation verification reports
- Fix the broken knip compact reporter
- Commit `Cargo.lock` (it's an application, not a library)
- Clean up stale npm scripts

#### Low priority / ongoing

- Trim module-level JSDoc blocks to only document non-obvious behavior
- Address the 3 `eslint-disable` suppressions in `CharlestonPhase`
- Audit `.clone()` usage in mahjong_server for unnecessary copies

### Supplemental Findings (Frontend Agent)

These are additional issues beyond my initial report:

#### O(n²) hand removal (Low-Med severity)

**publicEventHandlers.playing.ts:86** — `indexOf(tile)` is called inside a `.filter()` loop. Should compute the index once before filtering.

#### Dispatcher factory pattern

**useGameEvents.ts:200-223** — `getDispatchers()` is a `useCallback` that returns a new dispatcher object each call, and `handleEventEnvelope` invokes it per event. The dispatchers should be memoized as an instance (`useMemo`), not as a factory.

#### Excessive prop drilling

**PlayerRack.tsx:32-77** — 26 props. Many are UI animation state and callbacks that could be read directly from `useGameUIStore`.

#### State duplication risk

**gameUIStore.ts:118-121** — `currentTurn` and `turnStage` mirror server snapshot fields. The store comment acknowledges these are "secondary" to the snapshot, but there's no enforced sync guarantee.

#### Stale backward-compat re-export

**GameBoard.tsx:58-60** — Re-exports `ClientGameState as GameState` for backward compatibility. The comment says "new code should import directly from `@/types/clientGameState"` — should have a deprecation plan or just remove it.

The other 3 agents (Rust, docs, tests) are still running and I'll share their findings when they complete.

### Supplemental Findings (Docs Agent)

#### Stale docs (High severity)

- **layout-polish-plan.md** references removing `AnimationSettings` and `HouseRulesPanel` — both components still exist in the codebase. Status says "Reviewed" but no last-updated date.

#### Self-referential ADR

- **ADR 0014** line 43 says "This supersedes ADR 0014's prior verbosity-control decision" — referencing itself, which is confusing.

#### Unactionable architectural review

- **architectural_review_mpmahj.md** identifies severe anti-patterns (Redux without devtools, stale closures, phantom type casts) but has zero links to stories or action items. It's a dead document — informational but not connected to any work.

#### Implementation gaps framed as complete

- **US-067** audit findings F-3/F-4/F-5 document real correctness issues (`pattern_name` set to `pattern_id`, Charleston branch omits `utility_scores`, silent no-op on hint request) but the story is marked "Implemented."

#### User story that validated existing code

- **US-072** implementation summary says "Finding: Already Implemented" — the story discovered the feature already existed. This is a waste of doc surface area.

#### Incomplete messaging reference

- **messaging-reference.md** line 174: "All other Charleston stages — (TBD)" — incomplete by design with no follow-up story assigned.

### Supplemental Findings (Rust Agent)

#### Unwraps in production code (Medium severity)

**analysis/worker.rs:147-159** — Double-checks `is_none()` then `unwrap()`s the same field. Should use `if let Some(table) = &room.table` instead. The validator unwrap at line 159 has no fallback.

#### Silent error skipping

Same file — when `validator.is_none()`, analysis is silently skipped with `continue`. Should log at debug level.

#### Large handler files

- **handlers/playing.rs** — 523 lines with recursive `draw_tile()` for dead-player skipping (line 87). Safe (max 4 seats) but a loop would be clearer.
- **handlers/charleston.rs** — 655 lines, monolithic.

#### Public API over-exposure

**lib.rs** exports `test_utils` and `bot_utils` as `pub mod` — names suggest internal use only.

#### Unbounded cache

**greedy.rs:71-72** — Evaluation cache has no eviction policy or documented size expectations.

#### Good news

Clippy passes with zero warnings. No circular dependencies. Crate hierarchy is clean (`mahjong_core` ← `mahjong_ai` ← `mahjong_server`). The Rust code is the strongest part of this codebase.

### Supplemental Findings (Test Agent)

#### Smoke tests that test nothing (Low severity)

- **setup.test.ts:6** — `expect(true).toBe(true)`
- **useGameAnimations.test.ts:272** — same pattern

#### Brittle CSS class assertions (Medium severity)

Multiple test files assert on exact Tailwind class names rather than behavior:

- **DiscardPool.test.tsx:60-87** — asserts 11 specific Tailwind classes and the absence of 8 others
- **AnimationSettings.test.tsx:32-42** — tests exact class names like `text-muted-foreground`
- **HintPanel.test.tsx:37-56** — tests absence of `border-cyan-400/50`, `bg-slate-950/95`

These will all break on any styling refactor and don't test actual visual behavior.

#### Duplicated test infrastructure (Medium severity)

`matchMedia` mock is implemented independently in 3+ test files:

- `useAnimationSettings.test.ts`
- `DiceOverlay.test.tsx`
- `ExposedMeldsArea.test.tsx`

Should be consolidated into a shared mock at `test/mocks/mediaQuery.ts`.

#### Copy-pasted test blocks (Low severity)

**CallWindowPanel.test.tsx:59-117** — 5 near-identical tests for Pung/Kong/Quint/Sextet/Mahjong button clicks. Should use parameterized tests (`forEach` or `test.each`).

#### Missing edge cases (Medium severity)

- `CharlestonTracker.test.tsx` tests 0/4, 2/4, 4/4 ready players but skips 1/4 and 3/4
- `GameOverPanel.test.tsx` tests `WallExhausted` end condition but not `Abandoned` or `AllDead`
- `CallWindowPanel.test.tsx` never tests `canCallForMahjong={false}`

### Complete Review Summary

All 4 agents have finished. Here's the consolidated picture:

| **Area** | **Grade** | **Key Issues** |
| -------- | --------- | -------------- |
| **Rust backend** | A- | Clean code, zero clippy warnings. Minor: unwraps in worker.rs, large handler files |
| **Frontend code** | B | Sound architecture, but console.log pollution, duplicate objects, prop drilling |
| **Documentation** | C+ | Heavy AI slop in user stories, stale docs, unactionable architectural review |
| **Tests** | B- | Good coverage (1434 tests), but brittle CSS assertions, smoke tests, duplicated mocks |
| **Repo hygiene** | C | 9.5MB binary in git, stale artifacts, broken knip, Cargo.lock gitignored |

The codebase works well and the architecture is solid. The debt is primarily in **documentation bloat**, **test brittleness**, and **repo hygiene** — not in the core logic.
