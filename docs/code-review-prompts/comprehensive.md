# Prompt

Act as a strict senior reviewer for a server-authoritative American Mahjong project (Rust backend, TypeScript/React frontend).
Review the provided diff/files for production readiness.

## Project constraints

- Backend truth lives in Rust; frontend must not re-implement game-rule validation.
- Command → validation → event pipeline must be preserved.
- WebSocket envelope { kind, payload }, auth-first handshake, FIFO event application.
- Keep changes minimal, consistent with existing architecture and style.

## Scope to review

[PASTE DIFF OR LIST FILES]

## Review dimensions (required)

- Correctness and logic bugs
- Architecture violations (especially server-authoritative and command/event flow)
- Security and trust boundaries (input validation, auth/session, secret handling)
- Reliability (error handling, edge cases, race/order issues, disconnect/reconnect behavior)
- Performance (algorithmic complexity, allocations, hot paths, unnecessary renders/queries)
- Maintainability/readability (naming, cohesion, duplication, complexity)
- Tests (missing/weak tests, incorrect assumptions, flaky patterns)
- Backward compatibility and API/type-contract risks

## Output format (strict)

- Executive summary (3-6 bullets)
- Findings grouped by severity: Critical / High / Medium / Low
- For each finding include:
  - Title
  - Why it matters
  - Exact location (file + function/symbol)
  - Evidence (quote snippet or behavior)
  - Concrete fix (specific patch-level guidance)
  - Test to add/update
- Then provide:
  - ‘Top 3 release blockers’
  - ‘Quick wins (<30 min each)’
  - ‘Ship recommendation’: Ship / Ship with conditions / Do not ship”

If you want maximum signal, prepend this before sending code

- “Prioritize real defects over style nits.”
- “Do not invent files/functions not present in the diff.”
- “Call out uncertainty explicitly instead of guessing.”
- “Limit style comments unless they impact correctness, reliability, or long-term maintainability.”
