# ADR 0007: Persist event logs with sequence numbers and snapshots

## Status
Accepted

## Context
Replays and audits require a stable, ordered event history that can reconstruct final game state and support privacy filtering.

## Decision
Persist every game event with a monotonically increasing sequence number and visibility metadata. Optionally store periodic snapshots to accelerate replay reconstruction.

## Consequences
Storage grows with game length and must be indexed by game_id and seq. Replay logic must be deterministic and compatible with schema versioning.
