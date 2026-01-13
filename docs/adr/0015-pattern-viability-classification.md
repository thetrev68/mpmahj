# ADR 0015: Pattern viability classification and analysis updates

## Status

Accepted

## Context

Players need a concise, actionable view of pattern viability rather than raw analysis output.

## Decision

Classify each pattern into a discrete difficulty class (Easy/Medium/Hard/Impossible) and expose pattern viability via a private `AnalysisUpdate` event.

## Consequences

Clients can render stable, user-friendly viability indicators. The server controls visibility and keeps per-player analysis private.
