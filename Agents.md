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

---

**Cross-References**:

- Project context, architecture, domain rules: [CLAUDE.md](CLAUDE.md)
- User requirements and stories: [PLANNING.md](PLANNING.md)
- Architecture decisions: [docs/adr/](docs/adr/)
- Test strategy: [apps/client/TESTING.md](apps/client/TESTING.md)

---

**Last Updated**: 2026-02-04 (based on usage insights analysis)
