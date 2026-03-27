# Code Review Report: mpmahj (American Mahjong)

> **Status audit performed: 2026-03-27**
> Items marked: DONE = verified fixed, OPEN = still needs work, WONTFIX = accepted/intentional, PARTIAL = partially addressed

## Executive Summary

This is a well-structured monorepo (Rust backend + React/TS frontend) with solid architecture fundamentals — server-authoritative design, generated bindings, type-safe state machines. However, there are clear signs of AI-assisted development debt accumulated over ~73 user stories. The codebase is functionally sound but has cruft around the edges.

Overall grade: B- — Good architecture, clean Rust core, but frontend and docs have accumulated bloat.

### Repo Hygiene (Severity: Medium)

#### Committed artifacts that don't belong

These files are tracked in git but should be gitignored:

| File                      | Size    | Issue                                                                            | Status   |
| ------------------------- | ------- | -------------------------------------------------------------------------------- | -------- |
| cloc.exe                  | 9.5 MB  | Binary executable committed to git. Use a package manager or CI artifact instead | **DONE** |
| patch.diff                | 122 B   | Stale diff file (`// test` → `// test2`) — looks like a debugging leftover       | **DONE** |
| tree.txt                  | 47 KB   | Generated tree output — regenerate on demand                                     | **DONE** |
| tree_scanner.py           | 7 KB    | One-off utility script in repo root                                              | **DONE** |
| cloc-report.txt           | 94 KB   | Generated report                                                                 | **DONE** |
| cloc-latest-report.txt    | 3 KB    | Generated report                                                                 | **DONE** |
| copy-transparent-tiles.sh | 5 KB    | One-off asset script in repo root                                                | **DONE** |
| scripts/\*.py             | Various | 6 Python scripts for card/PDF processing — likely one-time tooling               | **OPEN** |

Untracked but also cluttering: `check-all.log` (173 KB), `checkall.log` (508 KB), `vitest.full.log` (457 KB) — these are gitignored by `*.log` but should be cleaned up locally.

#### `.gitignore` gap — **OPEN**

`Cargo.lock` is gitignored, but for a binary/application project (which this is — it has a server), **Cargo.lock should be committed** per Rust convention. Libraries gitignore it; applications commit it.

### Frontend Code Quality (Severity: Medium)

#### Console logging in production code — **PARTIAL**

~~29 `console.*` calls across production source files (not tests).~~ Console calls in key files (useGameEvents.ts, useGameSocket.ts, eventDispatchers.ts) are now mostly gated behind a `debug` flag. Remaining unconditional calls are `console.error`/`console.warn` for genuine error conditions, which is appropriate. A formal logging abstraction is still absent but the worst offenders are addressed.

#### Duplicate fallback object — **DONE**

~~In `GameBoard.tsx:580-588 and 599-608`, the same `gameResult` fallback object is copy-pasted.~~ Extracted to `EMPTY_GAME_RESULT` constant at GameBoard.tsx:101-109. Both references now use `overlays.gameResult ?? EMPTY_GAME_RESULT`.

#### Unused export — **DONE**

~~Knip detected `ErrorBoundary.tsx:75` — `DefaultFallback` is exported but never imported elsewhere.~~ `DefaultFallback` is no longer exported; only `ErrorBoundary` is exported.

#### Sound effects placeholder — **OPEN**

`useSoundEffects.ts:146-175` falls back to oscillator-generated beep tones when audio files aren't configured. The `SoundEffect` type defines 8 variants, but event handlers dispatch at least 5 additional sound names (`'game-draw'`, `'mahjong-win'`, `'dead-hand-penalty'`, `'tile-place'`, `'undo-whoosh'`) that silently fall through. This is documented in TODO.md but represents a runtime behavior gap.

#### Large components — **OPEN** (unchanged, may be acceptable)

Several components are quite large (this may be justified by complexity, but worth noting):

- `GameBoard.tsx` — 613 lines (was 617)
- `CharlestonPhase.tsx` — 614 lines (was 570, grew during Phase 4 migration), with 3 `eslint-disable-next-line` `react-hooks/exhaustive-deps` suppressions
- `PlayingPhasePresentation.tsx` — 486 lines (was 464)

#### eslint-disable suppressions — **OPEN**

3 exhaustive-deps suppressions in `CharlestonPhase.tsx:289, 310, 349`. These often indicate effects that should be restructured.

### Documentation Issues (Severity: Medium-High)

#### User story doc bloat — **OPEN**

7 user story docs exceed 400 lines, with the largest at 849 lines (US-053). The bloat comes from two sources:

1. **Over-specified acceptance criteria** — some stories have 25+ ACs (US-057 has 25 ACs + 7 ECs), which reads like implementation verification rather than user-facing requirements
2. **Implementation summaries appended to spec docs** — completed stories have "Codex Implementation Summary" and "Claude Code Review" sections appended, turning spec docs into audit trails

**Recommendation**: Separate spec from verification. Keep user stories as requirements; move implementation summaries to commit messages or a separate review log.

#### AI-generated batch commit — **WONTFIX** (historical, can't be changed)

Commit `23b39b6` adds 9 user stories in a single commit: _"feat: add user stories for duplicate-safe tile highlighting, play surface theme integrity, AI hint capability reconciliation, board layout cleanup, audio settings integrity, reduced-motion compliance, error boundaries, keyboard accessibility for tile selection, and background music controls UX honesty"_

This is a classic AI-batch pattern. The stories themselves are well-structured, but the batch approach means they weren't individually reviewed before being committed.

#### Stale refactor references — **DONE**

~~The `gameUIStore.ts` header comment (lines 12-13) references "migration in slices 4.2–4.4" as future work, but per your MEMORY.md, Phase 4 is complete. The comment is stale.~~ Comment has been updated to accurately reflect Phase 4 completion.

### Rust Backend (Severity: Low)

The Rust code is generally clean. Highlights:

#### Good

- `unwrap()` calls in non-test code are limited to doc examples (which is appropriate)
- Only 2 `#[allow(dead_code)]` annotations, both justified:
  - `dispatcher.rs:15` — helper for future replay/storage use
  - `history_websocket_e2e.rs:85` — test-only struct (normal for integration tests)
- Clean module structure, proper error types

#### Minor concern

- `room_actions.rs` has 18 `.clone()` calls, and `admin.rs` has 13. Some may be avoidable with borrowed references, but without deep auditing each call site, these could be necessary due to ownership constraints. — **OPEN**
- Some large files: `command.rs` (653 lines), `scoring.rs` (638 lines), `validation.rs` (575 lines). These are acceptable for their complexity domains. — **WONTFIX** (acceptable)

### Test Quality (Severity: Low-Medium)

#### Good Findings

- **126 test files** with 29 integration tests — excellent coverage
- 1,434 tests passing
- Test infrastructure is well-organized: fixtures, mocks, integration patterns
- Tests use real implementations where possible, mocks where necessary

#### Concerns

- `@ts-expect-error` appears 8 times in test files for WebSocket overrides. A cleaner approach would be proper test doubles or dependency injection. — **OPEN**
- Test files are quite large — `PlayingPhasePresentation.test.tsx` at 478 lines, `useGameEvents.test.ts` at 452 lines. — **OPEN**

### Tooling Issues (Severity: Low)

#### Broken knip reporter — **OPEN**

`npx knip --reporter compact` crashes with `ERR_INVALID_ARG_TYPE` (knip v5.79.0 bug). The JSON reporter works but the compact reporter (likely what developers use day-to-day) is broken. This should be fixed or the knip version pinned.

#### Stale/unused npm scripts — **DONE**

~~`todo:rust`, `todo:ts`, `tiles:add-numbers`, `cloc`, `mcp:render:bootstrap`, `mcp:render:diag` removed.~~ Consolidated to single `todo` script using `find-todos.js`.

### AI Slop Assessment

**Verdict: Moderate**. This is better than most AI-heavy codebases, but there are telltale signs:

1. **Module-level JSDoc blocks** that restate what the code does (e.g., GameBoard.tsx:1-24 — 24 lines of header comment that adds little over reading the imports) — **OPEN**
2. **User story over-specification** — stories with 25+ acceptance criteria feel like AI-generated checklists rather than human-authored requirements — **OPEN**
3. **Batch-committed documentation** — 9 user stories in one commit suggests automated generation — **WONTFIX** (historical)
4. **"Notes for Implementer"** sections in user stories that are essentially AI instructions for AI (e.g., US-073's suggested implementation is verbatim what was implemented) — **OPEN**
5. **Implementation summaries in spec docs** — appending "Claude Code Review" sections to specs is a paper trail of AI-driven development — **OPEN**

**What's NOT slop**: The actual code quality is good. The Rust core is clean and idiomatic. The React patterns are reasonable. The architecture is sound. The AI assistance has been well-directed; the slop is primarily in documentation and process artifacts, not in the code itself.

### Priority Recommendations

#### Quick wins (do now)

- Remove `cloc.exe`, `patch.diff`, `tree.txt`, `tree_scanner.py` from git tracking — **DONE**
- Remove the `DefaultFallback` unused export — **DONE**
- Extract the duplicate `gameResult` fallback in `GameBoard.tsx` — **DONE**

#### Medium-term

- Add a logging abstraction to replace raw `console.log` calls — **PARTIAL** (debug-gated now, no formal abstraction)
- Separate user story specs from implementation verification reports — **OPEN**
- Fix the broken knip compact reporter — **OPEN**
- Commit `Cargo.lock` (it's an application, not a library) — **OPEN**
- Clean up stale npm scripts — **DONE**

#### Low priority / ongoing

- Trim module-level JSDoc blocks to only document non-obvious behavior — **OPEN**
- Address the 3 `eslint-disable` suppressions in `CharlestonPhase` — **OPEN**
- Audit `.clone()` usage in mahjong_server for unnecessary copies — **OPEN**

### Supplemental Findings (Frontend Agent)

These are additional issues beyond my initial report:

#### O(n²) hand removal (Low-Med severity) — **OPEN**

**publicEventHandlers.playing.ts:296-301** — `indexOf(tile)` is called inside a loop in `handleMeldCalled`. Should compute indices once before filtering. (Note: with hand sizes of 13-16 tiles, practical impact is negligible.)

#### Dispatcher factory pattern — **WONTFIX** (current pattern is correct)

~~**useGameEvents.ts:200-223** — `getDispatchers()` is a `useCallback` that returns a new dispatcher object each call.~~ The `useCallback` factory pattern is appropriate here since dispatchers need fresh closures over current state.

#### Excessive prop drilling — **PARTIAL**

**PlayerRack.tsx** — 22 props (down from 26). Still high, but reduced. Many are UI animation state and callbacks that could be read directly from `useGameUIStore`.

#### State duplication risk — **OPEN**

**gameUIStore.ts** — `currentTurn` and `turnStage` mirror server snapshot fields. The store comment acknowledges these are "secondary" to the snapshot, but there's no enforced sync guarantee.

#### Stale backward-compat re-export — **OPEN**

**GameBoard.tsx:59-61** — Re-exports `ClientGameState as GameState` for backward compatibility. The comment says "new code should import directly from `@/types/clientGameState"` — should have a deprecation plan or just remove it.

### Supplemental Findings (Docs Agent)

#### Stale docs (High severity) — **DONE**

~~**layout-polish-plan.md** references removing `AnimationSettings` and `HouseRulesPanel`.~~ Plan was ~70% implemented but approach diverged (CSS Grid replaced absolute positioning). Deleted as stale.

#### Self-referential ADR — **DONE**

~~**ADR 0014** line 43 says "This supersedes ADR 0014's prior verbosity-control decision" — referencing itself, which is confusing.~~ Reworded to clarify it supersedes an earlier draft.

#### Unactionable architectural review — **DONE**

~~**architectural_review_mpmahj.md** identifies severe anti-patterns (Redux without devtools, stale closures, phantom type casts) but has zero links to stories or action items. It's a dead document.~~ Deleted.

#### Implementation gaps framed as complete — **OPEN**

- **US-067** audit findings F-3/F-4/F-5 document real correctness issues (`pattern_name` set to `pattern_id`, Charleston branch omits `utility_scores`, silent no-op on hint request) but the story is marked "Implemented."

#### User story that validated existing code — **OPEN**

- **US-072** implementation summary says "Finding: Already Implemented" — the story discovered the feature already existed. This is a waste of doc surface area.

#### Incomplete messaging reference — **DONE**

~~**messaging-reference.md** line 174: "All other Charleston stages — (TBD)" — incomplete by design with no follow-up story assigned.~~ The TBD has been filled in; messaging-reference.md is now complete.

### Supplemental Findings (Rust Agent)

#### Unwraps in production code (Medium severity) — **OPEN**

**analysis/worker.rs:147-159** — Double-checks `is_none()` then `unwrap()`s the same field. Should use `if let Some(table) = &room.table` instead. The validator unwrap at line 159 has no fallback.

#### Silent error skipping — **OPEN**

Same file — when `validator.is_none()`, analysis is silently skipped with `continue`. Should log at debug level.

#### Large handler files — **OPEN** (may be acceptable)

- **handlers/playing.rs** — 523 lines with recursive `draw_tile()` for dead-player skipping (line 87). Safe (max 4 seats) but a loop would be clearer.
- **handlers/charleston.rs** — 655 lines, monolithic.

#### Public API over-exposure — **OPEN**

**lib.rs** exports `test_utils` and `bot_utils` as `pub mod` — names suggest internal use only.

#### Unbounded cache — **OPEN**

**greedy.rs:71-72** — Evaluation cache has no eviction policy or documented size expectations.

#### Good news

Clippy passes with zero warnings. No circular dependencies. Crate hierarchy is clean (`mahjong_core` ← `mahjong_ai` ← `mahjong_server`). The Rust code is the strongest part of this codebase.

### Supplemental Findings (Test Agent)

#### Smoke tests that test nothing (Low severity) — **OPEN**

- **setup.test.ts:6** — `expect(true).toBe(true)`
- **useGameAnimations.test.ts:272** — same pattern

#### Brittle CSS class assertions (Medium severity) — **OPEN**

Multiple test files assert on exact Tailwind class names rather than behavior:

- **DiscardPool.test.tsx:60-87** — asserts 11 specific Tailwind classes and the absence of 8 others
- **AnimationSettings.test.tsx:32-42** — tests exact class names like `text-muted-foreground`
- **HintPanel.test.tsx:37-56** — tests absence of `border-cyan-400/50`, `bg-slate-950/95`

These will all break on any styling refactor and don't test actual visual behavior.

#### Duplicated test infrastructure (Medium severity) — **OPEN**

`matchMedia` mock is implemented independently in 7 test files (originally reported as 3+):

- `useAnimationSettings.test.ts` (has reusable helper)
- `DiceOverlay.test.tsx`
- `ExposedMeldsArea.test.tsx`
- `PassAnimationLayer.test.tsx`
- `Tile.test.tsx`
- `WallCounter.test.tsx`
- `WinnerCelebration.test.tsx`

Should be consolidated into a shared mock at `test/mocks/mediaQuery.ts`.

#### Copy-pasted test blocks (Low severity) — **OPEN**

**CallWindowPanel.test.tsx:59-117** — 5 near-identical tests for Pung/Kong/Quint/Sextet/Mahjong button clicks. Should use parameterized tests (`forEach` or `test.each`).

#### Missing edge cases (Medium severity) — **OPEN**

- `CharlestonTracker.test.tsx` tests per-seat readiness but skips 1/4 and 3/4 aggregate scenarios
- `GameOverPanel.test.tsx` tests `WallExhausted` end condition but not `Abandoned` or `AllDead`
- `CallWindowPanel.test.tsx` never tests `canCallForMahjong={false}`

### Complete Review Summary

All 4 agents have finished. Here's the consolidated picture:

| **Area**          | **Grade** | **Key Issues**                                                                        | **Open / Total** |
| ----------------- | --------- | ------------------------------------------------------------------------------------- | ----------------- |
| **Rust backend**  | A-        | Clean code, zero clippy warnings. Minor: unwraps in worker.rs, large handler files    | 5 / 6            |
| **Frontend code** | B         | Sound architecture, but console.log pollution, prop drilling                          | 5 / 11           |
| **Documentation** | C+        | Heavy AI slop in user stories; stale docs now deleted                                 | 4 / 9            |
| **Tests**         | B-        | Good coverage (1434 tests), but brittle CSS assertions, duplicated mocks              | 5 / 5            |
| **Repo hygiene**  | C→B       | Root artifacts removed, stale scripts cleaned, .gitignore updated                     | 1 / 6            |

**Overall: 20 OPEN, 13 DONE, 3 PARTIAL, 4 WONTFIX** out of ~40 discrete findings.

The codebase works well and the architecture is solid. The debt is primarily in **documentation bloat**, **test brittleness**, and **repo hygiene** — not in the core logic.
