# ADR 0016: Ruleset metadata and card-year selection

## Status
Accepted

## Context
Games need to preserve the exact ruleset used, including NMJL card year and timer configuration, for validation, replays, and client display.

## Decision
Expand house rules to include a full ruleset (card year, timer mode, timer durations, and rule flags). Persist these settings in snapshots and server state, and use the card year to select the correct validation data.

## Consequences
Rulesets become explicit and replayable. Validators and room creation must respect card year, and timer behavior can be configured per game without changing core logic.
