# AI Working Guidelines

**Purpose**: This document defines how AI assistants should work on this codebase. For project context (architecture, domain rules, tech stack), see [CLAUDE.md](CLAUDE.md).

---

## 1. Debugging Protocol

**Problem**: Going in circles trying the same approaches wastes time.

**Rule**: When stuck after 2 attempts with the same approach, STOP.

### Structured Debugging Process

1. **Document the failure**:
   - Exact error message (copy verbatim)
   - What you tried (commands, changes made)
   - What you expected vs. what happened

2. **Generate 3 alternative hypotheses**:
   - Different root causes (not variations of the same fix)
   - Rank by likelihood

3. **Test systematically**:
   - Create minimal test for each hypothesis
   - Execute one at a time
   - Document results before moving to next

4. **Escalate if needed**:
   - After testing 3 distinct hypotheses, present findings to user
   - Do NOT try a fourth variation without discussion

### Example (Wrong)

```
Attempt 1: cargo test fails → try changing import path
Attempt 2: still fails → try different import path
Attempt 3: still fails → try another import path variation
[Stuck in loop]
```

### Example (Right)

```
Attempt 1: cargo test fails with "module not found"
Attempt 2: tried fixing import, still fails

STOP. Three hypotheses:
1. Workspace structure issue (Cargo.toml misconfigured)
2. Module visibility (missing pub mod declaration)
3. Path resolution (relative vs absolute imports)

Testing hypothesis 1: Check Cargo.toml workspace members...
```

---

## 2. Before Proposing Structure

**Rule**: Always READ existing files/folders before proposing any structure.

### Never Assume

- Don't assume default layouts (e.g., "docs should have intro/guide/api sections")
- Don't claim something is "new" without checking first
- Don't propose hierarchies without reading current structure

### Always Do

1. Use `Glob` to discover existing structure: `Glob("docs/**/*.md")`
2. Read representative files to understand conventions
3. Adapt to what exists, don't impose external patterns

---

## 3. Validation Pipeline (Pre-Commit)

**Rule**: Run the FULL validation pipeline before ANY `git add`.

### Complete Validation Checklist

```bash
# Rust workspace
cargo fmt --all
cargo check --workspace
cargo test --workspace
cargo clippy --all-targets --all-features

# TypeScript/Frontend
npx prettier --write .
npx tsc --noEmit

# Or use monorepo check
npm run check:all
```

### What This Prevents

- Pre-push hook failures after commit (Prettier formatting)
- TypeScript type errors discovered at push time
- Failing doc tests missed by unit tests
- Import path errors across workspace

### When to Run

- ✅ After every Edit/Write operation on Rust files
- ✅ After module restructuring
- ✅ Before `git add` (always)
- ❌ NOT after commit (too late)
- ❌ NOT only unit tests (must include doctests, clippy, formatting)

---

## 4. Documentation Standards

### Component Specs

- **Target length**: 100-150 lines
- **Ask if unclear**: Don't assume — ask for length constraints upfront
- **Check existing format**: Read 2-3 existing specs before creating new ones

### Test Scenarios

- **No hallucinated features**: Cross-reference [PLANNING.md](PLANNING.md) and user stories
- **Follow existing format**: Read `docs/implementation/frontend/tests/test-scenarios/` examples
- **Update index**: Maintain README.md in scenario directories

### General Documentation

- **Markdown only for**: architecture, planning, workflows
- **Rustdoc for**: implementation details, API docs
- **Always check**: `.markdownlint.json` rules before committing markdown

---

## 5. Multi-File Rust Changes (Special Attention)

### After Module Restructuring

This project is a Rust workspace with TypeScript bindings. Module changes have cascading effects.

#### Must Verify

1. **Workspace imports**: Check all crates can import restructured modules
2. **Doc tests**: Run `cargo test --doc` explicitly (not just unit tests)
3. **TypeScript bindings**: Regenerate if types with `#[derive(TS)]` changed:

   ```bash
   cd crates/mahjong_core
   cargo test export_bindings
   # Outputs to: apps/client/src/types/bindings/generated/
   ```

4. **Relative paths**: Pay special attention when moving modules (common source of import failures)

#### Common Pitfalls

- Unit tests pass but doc tests fail (different import resolution)
- Bindings not regenerated after type changes
- Workspace import paths incorrect after folder restructuring
- Missing `pub mod` declarations in parent modules

---

## 6. Project-Specific Context

For detailed project context, see [CLAUDE.md](CLAUDE.md). Key points:

### Architecture

- Server-authoritative design (Rust backend is source of truth)
- Command/Event pattern (never client-side validation)
- Type-driven state machine (Rust enums prevent invalid states)

### Tech Stack

- Rust workspace: `mahjong_core`, `mahjong_server`, `mahjong_ai`
- TypeScript frontend: React + Vite + optional Tauri
- WebSocket protocol with auth-first handshake
- Multi-year NMJL card data (2017-2025)

### Key Files

- Backend API: `crates/mahjong_core/src/` (command.rs, event.rs, table.rs, flow.rs)
- Server: `crates/mahjong_server/src/`
- Frontend: `apps/client/src/`
- Card data: `data/cards/unified_cardYYYY.json`
- Architecture decisions: `docs/adr/`

---

## Quick Reference Card

| Situation                | Action                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| Stuck after 2 tries      | STOP. Document failure, generate 3 hypotheses, test systematically |
| Creating new file/folder | READ existing structure first with Glob/Read                       |
| Before `git add`         | Run full validation (cargo fmt/check/test, prettier, tsc)          |
| Writing docs             | Check existing format, ask for length constraints if unclear       |
| After Rust refactor      | Verify workspace imports, doc tests, TS bindings, relative paths   |
| Uncertain about approach | Ask user before major changes (architecture is intentional)        |
| Starting a user story    | Follow §7 TDD Protocol: scope checklist → implement → verify      |
| Creating a component     | MUST also create matching .test.tsx file (no exceptions)           |
| Declaring story done     | Walk through every in-scope AC/EC, verify test exists for each     |

---

## 7. TDD User Story Implementation Protocol

**Problem**: Implementing a user story and missing ACs, edge cases, or producing code that doesn't match the spec. Formatting/linting issues are caught by tooling — functional mismatches are not.

**Rule**: Every user story implementation follows these 3 phases. Do NOT skip steps.

### Phase 1: Scope Agreement (Before Writing Any Code)

1. **Read the full user story** — every section:
   - Acceptance Criteria (AC-1, AC-2, ...)
   - Edge Cases (EC-1, EC-2, ...)
   - Accessibility Considerations
   - Components Involved
   - Definition of Done checklist
   - Notes for Implementers

2. **Read the linked test scenario** (e.g., `charleston-standard.md`)

3. **Read the linked component specs** (if they exist)

4. **Produce a scope checklist** — present to user for approval:

   ```
   ## Scope for US-XXX

   ### In Scope (will implement)
   - [ ] AC-1: Charleston Phase Entry
   - [ ] AC-2: Tile Selection
   - [ ] EC-4: Double-Submit Prevention
   - [ ] Test file: ComponentName.test.tsx
   - [ ] Integration test: flow.integration.test.tsx

   ### Deferred (out of scope this pass)
   - EC-1: Timer Expiry (backend handles auto-pass)
   - EC-5: Network Error Retry (future story)
   - Keyboard navigation (future accessibility story)
   - E2E tests (no infrastructure yet)
   - Visual regression tests (no infrastructure yet)
   ```

5. **Get explicit user approval** before proceeding. Do not assume.

### Phase 2: Implementation (TDD Cycle)

1. **Every component you create MUST have a test file**
   - Create `Foo.tsx` → must also create `Foo.test.tsx`
   - No exceptions. Integration tests do not replace unit tests.

2. **Every hook you create MUST have a test file**
   - Create `useFoo.ts` → must also create `useFoo.test.ts`

3. **Match event/command shapes exactly to bindings**
   - Read the generated binding files, not the user story examples
   - User story TypeScript snippets may be pseudo-code

4. **Run tests after each component** — don't batch
   - `npx vitest run src/components/game/Foo.test.tsx`
   - Fix failures immediately, don't accumulate

5. **Match the "Notes for Implementers" section**
   - If the spec says use `useTileSelection` hook, use it
   - If the spec says use `sortHand()` utility, use it
   - Don't invent parallel abstractions

### Phase 3: Verification (Before Declaring Done)

1. **AC Walkthrough** — for each in-scope AC:
   - [ ] Is the behavior implemented?
   - [ ] Is there a test that verifies this specific AC?
   - [ ] Does the test check correct data (not just "renders")?

2. **EC Walkthrough** — for each in-scope EC:
   - [ ] Is the edge case handled in code?
   - [ ] Is there a test for it?

3. **Component checklist** — for each component in the spec's "Components Involved":
   - [ ] Component file exists (or justified why not)
   - [ ] Test file exists
   - [ ] Props/interface matches spec

4. **Run full test suite**:

   ```bash
   npx vitest run
   npx tsc --noEmit
   ```

5. **Run Prettier on modified files**:

   ```bash
   npx prettier --write <files>
   ```

6. **Report coverage summary** to user:

   ```
   ## US-XXX Implementation Complete

   ### Implemented (X/Y ACs, Z/W ECs)
   - ✅ AC-1: Charleston Phase Entry
   - ✅ AC-2: Tile Selection
   - ✅ EC-4: Double-Submit Prevention

   ### Deferred (as agreed)
   - EC-1: Timer Expiry
   - Keyboard navigation

   ### Test Summary
   - ComponentA.test.tsx: 8 tests passing
   - ComponentB.test.tsx: 5 tests passing
   - flow.integration.test.tsx: 6 tests passing
   - Total: 19 new tests, all passing
   ```

### Common Mistakes to Avoid

| Mistake | Prevention |
|---------|------------|
| Creating component without test file | Phase 2, Rule 1: every file gets a test |
| Testing "renders without error" instead of behavior | Phase 3, Rule 1: test must verify specific AC |
| Implementing against spec pseudo-code instead of bindings | Phase 2, Rule 3: always read generated bindings |
| Skipping edge cases silently | Phase 1: explicitly list deferred items |
| Inventing components not in the spec | Phase 2, Rule 5: follow spec's component list |
| Declaring done without running tests | Phase 3, Rule 4: full suite must pass |

---

**Cross-References**:

- Project context, architecture, domain rules: [CLAUDE.md](CLAUDE.md)
- User requirements and stories: [PLANNING.md](PLANNING.md)
- Architecture decisions: [docs/adr/](docs/adr/)
- Test strategy: [apps/client/TESTING.md](apps/client/TESTING.md)

---

**Last Updated**: 2026-02-06 (added TDD Implementation Protocol)
