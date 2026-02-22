# AI Working Guidelines

Purpose: define assistant execution policy for this repo. Keep this procedural. Put project context in `README.md` and product intent in `PLANNING.md`.

## 1) Core Rules

- Prefer changing code over proposing code unless user asks for planning only.
- Never assume structure. Read existing files/folders first.
- If stuck after 2 attempts on the same approach, stop and follow the debugging protocol.
- Before `git add`, run the full validation pipeline.
- For modern behavior/feature work, follow the TDD user-story protocol.

## 2) Structured Debugging Protocol

Trigger: 2 failed attempts with the same approach.

1. Document failure:
   - exact error message
   - what you tried
   - expected vs actual
2. Generate 3 distinct hypotheses.
3. Test one hypothesis at a time with minimal checks.
4. If unresolved after 3 hypotheses, escalate to user with findings.

Do not attempt a 4th variation without user discussion.

## 3) Read Before Proposing

- Use file discovery first (`rg --files`, targeted globs).
- Read representative files before proposing new hierarchy/patterns.
- Adapt to existing conventions; do not impose a default template.

## 4) Validation Pipeline (Pre-Commit)

Run before `git add`:

```bash
# Rust
cargo fmt --all
cargo check --workspace
cargo test --workspace
cargo clippy --all-targets --all-features

# TypeScript/frontend
npx prettier --write .
npx tsc --noEmit

# Monorepo gate
npm run check:all
```

Notes:

- Run after module restructuring.
- Do not rely on partial test subsets as final verification.

## 5) Documentation Standards

- Markdown for architecture/planning/workflows.
- Rustdoc for implementation/API details.
- Check existing format before adding docs.
- Component specs: target 100–150 lines.
- Test scenarios: align with `PLANNING.md` and existing scenario format.
- Respect `.markdownlint.json`.

## 6) Multi-File Rust Changes

After Rust module restructuring, explicitly verify:

1. Workspace imports compile across crates.
1. Doc tests pass (`cargo test --doc`).
1. TS bindings regenerated if `#[derive(TS)]` types changed:

```bash
cd crates/mahjong_core
cargo test export_bindings
# outputs to apps/client/src/types/bindings/generated/
```

1. Parent `pub mod` declarations and relative paths are correct.

## 7) TDD User Story Protocol

Apply for user-story implementation work.

### Phase 1: Scope Agreement (before coding)

1. Read full story (AC, EC, accessibility, components, DoD, notes).
1. Read linked test scenario(s).
1. Read linked component spec(s) if present.
1. Share scope checklist:
   - in-scope AC/EC
   - new/updated test files
   - explicitly deferred items
1. Get user approval before edits.

### Phase 2: Implementation

1. Every new component must include `*.test.tsx`.
1. Every new hook must include `*.test.ts`.
1. Match binding shapes from generated TS files (not pseudo-code snippets).
1. Run targeted tests as you implement and fix failures immediately.
1. Follow notes-for-implementers; avoid parallel abstractions unless discussed.

### Phase 3: Verification

1. AC walkthrough: behavior implemented + test exists + test validates behavior.
1. EC walkthrough: handled + tested.
1. Component checklist: file exists, test exists, interface matches scope.
1. Run verification commands:

```bash
npx vitest run
npx tsc --noEmit
```

1. Run Prettier on modified files.
1. Report implementation summary:
   - implemented AC/EC
   - deferred items
   - test summary (files + counts)

## 8) Quick Checklist

- Stuck after 2 tries: stop and debug structurally.
- Read existing structure before proposing new structure.
- New component/hook => matching test file.
- Before staging: full validation pipeline.

## References

- Technical source of truth: `README.md`
- Product requirements and UX scope: `PLANNING.md`
- Architecture decisions: `docs/adr/`
- Frontend testing strategy: `apps/client/TESTING.md`

Last Updated: 2026-02-22
