# Docs Index

This folder holds the repo's live shared documentation.

## Use These First

| Document | Purpose |
| --- | --- |
| [../README.md](../README.md) | Repo-level source of truth for setup, architecture, workflows, and commands |
| [../Agents.md](../Agents.md) | Assistant execution policy and process guardrails |
| [../TODO.md](../TODO.md) | Current backlog and follow-up work |

## Live Doc Areas

| Path | Purpose | Notes |
| --- | --- | --- |
| [adr/](./adr/) | Architecture decision records | Historical decisions that still govern current design |
| [implementation/frontend/README.md](./implementation/frontend/README.md) | Current frontend doc map | Active frontend docs only |
| [nmjl_mahjongg-rules.md](./nmjl_mahjongg-rules.md) | NMJL rules reference transcription | Reference material, not implementation authority over code |
| [nmjl_mahjongg_2025_card.md](./nmjl_mahjongg_2025_card.md) | 2025 card reference transcription | Reference material for rule/card review |
| [strategy-guide.md](./strategy-guide.md) | Strategy/domain reference notes | Supplemental player/domain context |
| [tsdoc/](./tsdoc/) | Generated TypeDoc output | Generated artifact |

## Historical Material

- Historical plans, audits, and completed implementation notes live under `.archive/docs/`.
- Archived docs are context only. They are not the source of truth for current behavior or current backlog.

## Documentation Rules

- Update canonical docs instead of adding parallel summaries.
- Prefer `README.md`, `TODO.md`, ADRs, and the active frontend doc set over new planning files.
- If a doc describes completed work and no longer drives implementation, archive it.

Last reviewed: 2026-04-19
