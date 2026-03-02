# Prompt

Act as a senior application security reviewer for a server-authoritative American Mahjong project (Rust backend, TypeScript/React frontend).
Perform a security-only code review of the provided diff/files.

## Project constraints

- Backend truth lives in Rust; frontend must not enforce game rules as trust boundaries.
- Command → validation → event pipeline is the primary integrity control.
- WebSocket envelope { kind, payload }, auth-first handshake, FIFO event application.
- Assume internet-exposed service behavior and untrusted clients.

## Scope to review

[PASTE DIFF OR LIST FILES]

## Security review dimensions (required)

- Authentication and authorization flaws (session handling, privilege checks, room/table access)
- Input validation and parsing risks (malformed payloads, type confusion, unsafe deserialization)
- Injection risks (SQL, command, template, log injection)
- Data exposure risks (PII/secrets in logs, over-broad event visibility, sensitive error leakage)
- Integrity risks in game/event flow (bypassing command validation, direct state mutation)
- DoS/resource abuse (unbounded loops, expensive per-message work, missing limits/rate controls)
- Dependency and configuration risks (unsafe defaults, insecure env handling, missing security headers)

## Output format (strict)

- Threat summary (2-5 bullets)
- Findings grouped by severity: Critical / High / Medium / Low
- For each finding include:
  - Title
  - CWE category (if applicable)
  - Attack scenario (how it can be exploited)
  - Exact location (file + function/symbol)
  - Concrete remediation (minimal patch guidance)
  - Verification test (security regression test to add)
- Then provide:
  - ‘Exploitable now’ list
  - ‘Defense-in-depth improvements’ list
  - ‘Security release recommendation’: Ship / Ship with mitigations / Do not ship

If you want maximum signal, prepend this before sending code

- “Assume attacker controls all client input.”
- “Prioritize exploitable issues over style/perf concerns.”
- “Call out false-positive risk when confidence is low.”
- “Map each finding to a specific threat and remediation test.”
