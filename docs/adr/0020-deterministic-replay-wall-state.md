# ADR 0020: Deterministic replay persists wall seed, break point, and draw index

## Status

Accepted

## Context

Exact replay and time-travel require reproducing wall order and replacement draws, which cannot be reconstructed from event logs alone.

## Decision

Persist wall seed, break point, and draw index in snapshots, and record replacement draws explicitly. Use phase-boundary snapshots to balance replay speed and storage.

## Consequences

Replays become exact and reproducible. Snapshot storage grows moderately but stays bounded, and replay code must apply events from known wall state.
