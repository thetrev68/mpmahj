# ADR 0022: History viewer with snapshot-based time travel

## Status

Accepted

## Context

Practice mode needs a full move history with time travel, not just undo. Jumping to arbitrary points requires fast reconstruction and readable move descriptions.

## Decision

Store a per-move history entry with a full table snapshot and a human-readable description. Implement history logic in a dedicated server module (RoomHistory) and keep Room changes minimal.

## Consequences

History view and resume are fast at the cost of higher memory usage per game. The feature remains scoped to practice mode, and future optimization (e.g., fewer snapshots) can be added later.
