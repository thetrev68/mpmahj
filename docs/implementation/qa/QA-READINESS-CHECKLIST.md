# QA Readiness Checklist

Last updated: 2026-02-15
Owner: Engineering
Status: Pre-QA gate document

Use this checklist before handing a build to QA. Goal: QA validates behavior, not basic breakage.

## 1) Scope Freeze

- [ ] Feature freeze is active (bug fixes only).
- [ ] Release candidate commit SHA is selected and recorded.
- [ ] Any deferred work is listed and approved.

## 2) Must-Close Functional Gaps (from `TODO.md`)

These should be resolved or explicitly de-scoped before QA starts:

- [ ] US-016 frontend meld-upgrade flow (`AddToExposure` / `MeldUpgraded`) is implemented or explicitly out of scope.
- [ ] Mahjong confirmation AC-2 preview/score UI is implemented or AC updated to remove requirement.
- [ ] NMJL year support decision is final (add 2021-2024 data or constrain supported years in UX/docs).
- [ ] Create Room retry behavior is implemented or explicitly retired.
- [ ] History cap behavior is implemented or explicitly deferred with known test expectation updates.

## 3) Security and Correctness Review

- [ ] RLS/auth TODOs in DB migrations are reviewed and dispositioned for this release.
- [ ] Known TODO/FIXME/HACK items were reviewed with severity labels (`blocker`, `post-QA`, `deferred`).
- [ ] TypeScript bindings regenerated if Rust types changed:

```bash
npm run bindings:generate
```

- [ ] Rust doc tests pass:

```bash
cargo test --doc
```

## 4) Full Validation Gate (Required)

Run from repo root:

```bash
npm run check:all
cargo test --workspace --no-fail-fast
cargo test --doc
npm run test:e2e:critical
```

Pass criteria:

- [ ] All commands above pass with zero failures.
- [ ] No flaky failures ignored without a tracked issue and owner.
- [ ] No local-only assumptions (validate on clean environment/CI at least once).

## 5) Performance and Stability Sanity

- [ ] Baseline runtime for critical suites captured and compared to last stable run.
- [ ] Reconnect/recovery flows pass (`test:e2e:phase3`).
- [ ] Protocol robustness flows pass (`test:e2e:phase4`).
- [ ] Race/chaos flows pass (`test:e2e:phase5`).
- [ ] Production build succeeds for frontend and server:

```bash
npm run build:client
npm run build:server
```

## 6) Observability and Operability

- [ ] Logs are readable for common failure types (auth, room join, websocket disconnects, command rejection).
- [ ] Critical metrics/dashboard links are known by QA (error rates, reconnect failures, latency where available).
- [ ] Rollback path is documented and tested at least once for this release candidate.

## 7) QA Handoff Packet (Required)

Provide all of the following in the QA handoff note:

- [ ] Release candidate commit SHA
- [ ] Environment URL(s)
- [ ] Server build/version identifier
- [ ] Test accounts and roles
- [ ] Seed/setup steps
- [ ] Exact in-scope test areas for this cycle
- [ ] Explicit out-of-scope/deferred items
- [ ] Known issues list with severity and workaround (if any)
- [ ] Evidence links (CI run, e2e artifacts, traces/videos on failures)

## 8) Go/No-Go Decision

Release is QA-ready only if all are true:

- [ ] No open Sev-1 defects
- [ ] No open Sev-2 defects on critical user flows
- [ ] Full Validation Gate passed
- [ ] Handoff packet complete
- [ ] Engineering owner approval

If any item is unchecked, do not hand off to QA yet.

## QA Handoff Template

Copy/paste and fill:

```text
QA HANDOFF - <release-name>

Date:
Commit SHA:
Environment:
Server Version:

In Scope:
- ...

Out of Scope / Deferred:
- ...

Known Issues:
- [Severity] <Issue> | Workaround: <if any>

Validation Results:
- npm run check:all: PASS/FAIL
- cargo test --workspace --no-fail-fast: PASS/FAIL
- cargo test --doc: PASS/FAIL
- npm run test:e2e:critical: PASS/FAIL

Artifacts:
- CI run:
- E2E report:
- Traces/videos:

Approvals:
- Engineering:
- QA Lead:
```
