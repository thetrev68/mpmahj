# Code Review Prompts

Use these templates to get consistent, high-signal LLM reviews for this repo.

## Which prompt to use

- [comprehensive.md](comprehensive.md): Full production-readiness review across correctness, architecture, reliability, performance, maintainability, and tests.
- [fast.md](fast.md): Quick PR triage focused on merge blockers and high-impact issues.
- [security.md](security.md): Security-only review for exploitability, trust boundaries, auth/authz, and abuse risks.

## Recommended workflow

1. Start with [fast.md](fast.md) on each PR.
2. Use [security.md](security.md) for auth, networking, persistence, or input-parsing changes.
3. Run [comprehensive.md](comprehensive.md) before larger merges or release branches.

## Inputs that improve review quality

Include these in your request:

- Scope: exact diff or file list
- Context: feature intent and constraints
- Risk areas: known hotspots or suspected weak points
- Output expectations: severity levels and concrete fixes

## Repo-specific reminders for the reviewer

- Rust backend is authoritative; frontend must not enforce game rules as trust boundaries.
- Preserve command -> validation -> event flow.
- Respect websocket envelope and auth-first handshake behavior.
- Prefer concrete, file-specific findings over generic style advice.
