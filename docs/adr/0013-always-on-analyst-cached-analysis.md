# ADR 0013: Always-on analyst with cached analysis and delta updates

## Status

Accepted

## Context

Strategic analysis powers bots, hints, and pattern viability. Running analysis on-demand makes features inconsistent and can miss state changes.

## Decision

Run analysis as part of the server loop and cache results per seat. Trigger analysis after key state changes (e.g., deal, draw, calls, turn changes) with configurable modes. Emit lightweight delta updates (`HandAnalysisUpdated`) and allow on-demand full analysis via `GetAnalysis`.

## Consequences

The server owns analysis orchestration and cache management. Clients receive small, privacy-aware updates by default, with an explicit request path for full data.
