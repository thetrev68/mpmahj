# Implementation Plan Best Practices

**Purpose:** Lessons learned from AI-to-AI handoffs (Phase 0.6 implementation by Gemini 3.0 Pro)

**Last Updated:** 2026-01-08

---

## What Makes Plans Work (9/10 Quality)

### 1. **Pre-Solved Architectural Decisions**

**Why:** Prevents hallucination and "agent wandering" during implementation.

**Example from Phase 0.6:**

```markdown
## Timestamp Strategy (IMPORTANT - Read First!)

**Problem:** Events need `started_at_ms` timestamps, but `mahjong_core` is a pure library.

**Solution:** Use `0` as placeholder in core crate. Server enriches later.
```

**Impact:** Gemini didn't waste time trying to inject `SystemTime` into core library or creating complex time providers.

### 2. **Specific Constraints with Numbers**

**Why:** Forces thoroughness and prevents incomplete work.

**Example:**

- ✅ "Charleston timer events need **7 locations**" → Agent knows it's not done until 7 spots found
- ❌ "Add timer events to Charleston stages" → Agent might miss some

### 3. **Search Patterns Over Line Numbers**

**Why:** 100% accuracy vs. drift-prone line references.

**Example:**

```markdown
**Search for:** `CallWindowOpened {` (currently around line 114)
```

**Format:** `Search for: <pattern>` (line XXX as of YYYY-MM-DD)

De-emphasize line numbers by putting them in parentheses at the end.

### 4. **Code Snippets That Match Project Style**

**Why:** Reduces decision paralysis on naming/structure.

**Include:**

- Exact field names
- Comment style
- Error handling patterns
- Existing code context

---

## What Caused Issues (Lost Points)

### 1. **Session Boundary Logic Mismatch** ⚠️ CRITICAL

**Problem:** Session 1 said "verify with tests" but test creation was in Session 2.

**Impact:** Can't verify new logic works, only that old tests don't break.

**Fix:**

```text
Session 1: Core Implementation + Basic Verification Tests
- Implement features (0.X.1-0.X.6)
- Create MINIMAL tests to verify NEW behavior (subset of test creation)
- Fix broken tests (0.X.10)
- ✅ Exit: All tests pass, new features verified

Session 2: Comprehensive Testing + Documentation
- Add edge case tests (rest of comprehensive tests)
- Update docs
- Regen bindings
```

**Rule:** Implementation and its basic verification should be atomic.

### 2. **Missing Testing Context**

**Problem:** Plan didn't mention that `table.transition_phase()` doesn't return events, but `table.process_command()` does.

**Impact:** Tests initially used wrong method, had to refactor.

**Fix:** Add an "Implementation Notes" section:

```markdown
### Testing Note

- `table.transition_phase()` changes state but doesn't return events
- Use `table.process_command()` in tests that need to assert on emitted events
- Event replay requires raw/unfiltered event log (not player-filtered)
```

### 3. **No Linting/Cleanup Step**

**Problem:** Left unused imports, no explicit cleanup reminder.

**Fix:** Add to final checklist:

```markdown
- [ ] Run `cargo clippy` and fix warnings
- [ ] Remove unused imports
- [ ] Run `cargo fmt`
```

---

## Plan Structure Template

### Header

```markdown
# Phase X.Y: [Feature Name] - Detailed Implementation Plan

**Status:** PLANNED
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD (if revised)

**Goal:** [One sentence describing what this achieves]

**Note:** Line numbers are approximate as of YYYY-MM-DD. Use search patterns to locate code.
```

### Critical Sections (In Order)

1. **Current State Analysis** - What exists, what's missing
2. **[Architecture Decision Section]** - Pre-solve key design choices (like "Timestamp Strategy")
3. **Implementation Steps** - Numbered, with search patterns
4. **Implementation Sessions** - 2-3 sessions with clear boundaries
5. **Files Modified** - Summary table
6. **Exit Criteria** - Checklist of what "done" means
7. **Implementation Notes** - Edge cases, testing context, gotchas

### Implementation Step Format

```markdown
### X.Y.Z: [Component] - [What It Does]

**File:** `path/to/file.rs`

**Search for:** `fn function_name(` (currently around line 123)

**What to do:**

[Clear instructions with code snippet]

**Why:** [Brief rationale if non-obvious]
```

### Session Checklist Format

```markdown
### Session 1: Core Implementation + Basic Verification

**Goal:** [One sentence]

**Steps to complete:** X.Y.1 - X.Y.6, X.Y.10

**Checklist:**

- [ ] X.Y.1: [Task description]
  - [ ] Sub-task 1
  - [ ] Sub-task 2 (verify with grep/command)
- [ ] **Verify:** Run `cargo test --package mahjong_core` - all tests should pass
- [ ] **Verify:** Run grep to confirm [specific thing]

**Exit criteria:**

- Code compiles without errors
- All existing tests pass
- Basic verification tests for new features pass
- [Specific verification via grep/command]

**Estimated time:** X-Y hours
```

---

## Specific Patterns That Work

### 1. Verification via Grep

Include commands to verify completeness:

````markdown
**Verify:** Run this to confirm all 7 Charleston stage changes emit timer events:

```bash
grep -n "CharlestonTimerStarted" crates/mahjong_core/src/table/handlers/charleston.rs
```text

Expected: 7 matches
````

### 2. Breaking Changes Call-Out

```markdown
**Breaking change:** `CharlestonState::new()` now requires a `timer_seconds` parameter.

**Update these 7 locations:**

1. `crates/mahjong_core/src/flow.rs:828` - Change: `CharlestonState::new()` → `CharlestonState::new(60)`
2. [etc...]
```

### 3. Pre-Solved Architectural Decisions

Start with a special section (before Implementation Steps):

```markdown
## [Topic] Strategy (IMPORTANT - Read First!)

**Problem:** [Why this is tricky]

**Solution:** [How we're solving it]

**Why this approach:**

- Reason 1
- Reason 2

**For this phase:**

- What to implement
- What to defer
```

### 4. Testing Context Notes

```markdown
### Implementation Notes

**Testing Note:**

- `table.transition_phase()` changes state but doesn't return events
- Use `table.process_command()` in tests that assert on events
- Event replay requires unfiltered event log (not player-filtered)

**Event Emission Context:**

- [Other gotchas specific to this phase]
```

---

## Checklist for Plan Review

Before handing off a plan, verify:

- [ ] **Session 1 includes basic verification tests** (not deferred to Session 2)
- [ ] **All search patterns provided** (not just line numbers)
- [ ] **Specific numbers for completeness checks** ("7 locations", "6 tests", etc.)
- [ ] **Pre-solved architectural decisions** (no "figure out how to..." tasks)
- [ ] **Testing context included** (event emission gotchas, etc.)
- [ ] **Linting/cleanup step** in final checklist
- [ ] **Exit criteria are verifiable** (commands to run, expected output)
- [ ] **Breaking changes called out** with exact locations to update

---

## Gemini's Verbatim Feedback (Phase 0.6)

> **What Worked Well (The "Gold Standard" parts)**
>
> 1. The "Key Points" Section: This was the MVP of your prompt.
>    - "Timestamps use placeholder 0": This saved significant time. Without this, I might have wasted cycles trying to inject SystemTime into a core library.
>    - "Charleston timer events need 7 locations": This specific number forced me to be thorough.
>    - "Breaking change" warning: Allowed me to proactively search for broken tests before running cargo test.
> 2. Code Snippets in the Plan: Were excellent. They were idiomatic to the project and reduced cognitive load.
> 3. Explicit "Search for" Patterns: Made locating code 100% accurate.
>
> **What Was Less Effective / Could Be Improved**
>
> 1. Session Boundary Logic (Testing):
>    - The Issue: Session 1 said "Verify completion... Run cargo test" but new tests were in Session 2.
>    - The Friction: Could verify I didn't break existing code, but couldn't verify my new code worked.
>    - Recommendation: Move "Create basic unit tests" into same session as "Implement core logic."
> 2. Line Numbers: Relied on them but I largely ignored in favor of search patterns. They clutter the doc.
>
> **What Was Missing / "The Gotchas"**
>
> 1. Event Emission Nuance: Didn't mention `transition_phase()` doesn't emit events vs. `process_command()` does.
> 2. Linting/Cleanup Step: No explicit "fix warnings/lints" step.
>
> **Verdict: 9/10.** The specific constraints and pre-solved architectural decisions made this smooth and deterministic.

---

## Summary: The 9/10 Formula

1. **Pre-solve architecture** (not during implementation)
2. **Give specific numbers** (forces thoroughness)
3. **Search patterns > line numbers** (accuracy)
4. **Code snippets in project style** (reduces decisions)
5. **Session 1 = implementation + basic verification** (atomic)
6. **Call out testing context** (event emission gotchas)
7. **Explicit cleanup step** (linting, unused imports)
8. **Verifiable exit criteria** (commands with expected output)

**Avoid:** "Figure out how to...", vague tasks, deferred verification
