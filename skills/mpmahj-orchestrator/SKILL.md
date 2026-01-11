---
name: mpmahj-orchestrator
description: Orchestrate the mpmahj project by producing a layperson-friendly status ledger, identifying missing work, and recommending the next best actions based on evidence (not claims).
---

# mpmahj Orchestrator Skill

Use this skill when the user wants a project orchestrator view: status clarity,
backlog generation, or next-step recommendations for mpmahj.

## Core Principles

- Evidence over claims: prefer code/tests or recent usage over doc assertions.
- Layperson-first: explain in plain English; avoid deep implementation detail.
- Honest uncertainty: mark unknowns explicitly; do not guess completeness.
- Actionable output: every pass should end with clear next actions.

## Default Outputs

Produce a small set of artifacts the user can re-use:

1) `docs/BACKEND_STATUS.md` (plain-English status with confidence)
2) `docs/BACKLOG.md` (short, prioritized backlog)
3) `docs/FEATURE_MAP.md` (verification ledger, not a completion list)

If the user asks for less, only create what they request.

## Workflow (Minimal, Repeatable)

### 1) Establish Sources

Use these first:

- `README.md` for claimed status
- `docs/implementation/13-backend-gap-analysis.md` for feature scope
- `docs/archive/summaries/` for claimed completions
- `tree.txt` for code inventory

If time allows, skim only the most relevant plans in `docs/archive/plans/`.

### 2) Build a Status Ledger (Layperson-Friendly)

For each major backend feature:

- What it does (1 sentence)
- What exists (code/tests/docs)
- Missing pieces (especially frontend blockers)
- Confidence (High/Medium/Low)

Prefer a short table format.

### 3) Identify Gaps (Two Categories)

Split gaps into:

- Missing implementation (no evidence in code/tests)
- Unverified implementation (claims exist, not validated)

### 4) Generate a Backlog

Create `docs/BACKLOG.md` with two sections:

- Decisions (rulesets, scope, policies)
- Work items (missing or unverified)

Each backlog item should include:

- Feature name
- Why it matters
- Small next step

### 5) Recommend Next Actions

Recommend 3-5 next actions maximum.
Prioritize:

- End-to-end blockers
- High-risk uncertainty
- Missing core rules

## Output Format (Plain English)

- Use simple headings and short paragraphs.
- Avoid code-level detail unless requested.
- Use “Confidence: High/Medium/Low” labels.

## Safety Rules

- Do not mark anything “complete” without evidence.
- If unsure, say “Unknown” and add to backlog.
- Do not rely on archived plans as truth; treat them as claims.

## Prompt Header (Paste This)

Use mpmahj-orchestrator.
Scope: backend only.
Time budget: 3-minute pass.
Focus: history/replay and scoring gaps.
Trust level: ignore README claims; treat archive as claims.
Deliverables: BACKEND_STATUS + BACKLOG.
