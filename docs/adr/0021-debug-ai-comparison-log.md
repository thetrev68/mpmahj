# ADR 0021: Debug-only AI comparison log

## Status
Accepted

## Context
Comparing AI strategies during development requires visibility into what different bots would do at the same decision point.

## Decision
Record per-turn AI recommendations across multiple strategies when `DEBUG_AI_COMPARISON=1` is enabled. Keep logs in memory and optionally attach them to admin replay responses.

## Consequences
Debugging and tuning are easier without affecting production behavior. Memory usage is bounded and only enabled in debug mode.
