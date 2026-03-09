# Recovery Implementation Prompt

Use this prompt in a fresh chat when implementing one of the recovery stories (`US-042` through `US-045`).

```text
You are implementing [STORY_ID] in the mpmahj repo.

Read first:
1. AGENTS.md
2. docs/implementation/frontend/user-stories/US-041-frontend-regression-recovery-program.md
3. The target story file for [STORY_ID]
4. The actual source files and tests named in that story before proposing changes

This is recovery work after failed prior implementations. The previous failure pattern was:
- browser-visible layout bugs were "verified" only with unit/class assertions
- Charleston/staging state was split across multiple owners
- stories were marked complete with visual/manual proof deferred

Non-negotiable execution rules:
1. Reproduce the reported bug first with a failing automated test or a clearly documented failing browser check.
2. State the invariant you are protecting before editing code.
3. Identify the single authoritative owner for each affected gameplay concept.
   - especially hand contents
   - staged incoming tiles
   - outgoing staged order
   - commit eligibility
4. Do not introduce a second source of truth for the same concept.
5. Do not rely on isolated component tests for layout or multi-step gameplay regressions.
6. Add the guardrail that would have caught the original regression.
7. Do not mark the story complete if the required proof type is missing.

Before editing, give me a scope checklist with:
- in-scope AC/EC
- files you expect to change
- tests you will add or update
- explicit deferred items, if any

While implementing:
- prefer minimal structural changes over broad refactors, unless the current structure makes the invariant impossible
- if you hit two failed attempts on the same approach, stop and follow the debugging protocol from AGENTS.md
- if the story is visual/layout focused, use browser-level evidence
- if the story is Charleston/state focused, use multi-step integration evidence

At the end, report:
1. The invariant implemented
2. The state owner(s) after the change
3. Tests added/updated
4. Verification commands run
5. Any residual risk or deferred proof
```

## Suggested Use

- Replace `[STORY_ID]` with `US-042`, `US-043`, `US-044`, or `US-045`.
- Paste the prompt into a new chat with the story name in the first line.
- If the chat is for `US-045`, require CI/script integration evidence before calling it done.
