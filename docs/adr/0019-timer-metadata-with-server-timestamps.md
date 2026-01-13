# ADR 0019: Timer metadata is emitted by core and timestamped by server

## Status
Accepted

## Context
Clients need timer durations and start times, but `mahjong_core` should remain pure and deterministic with no wall-clock dependencies.

## Decision
Include timer metadata (duration, mode, started_at_ms) in core events with a placeholder timestamp (0). The server layer is responsible for injecting real timestamps before broadcasting.

## Consequences
Core remains deterministic and testable, while clients still get consistent timer data. Server event broadcasting must enrich timer events with wall-clock time.
