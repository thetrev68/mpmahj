# ADR 0005: Event visibility rules and player-specific replays

## Status
Accepted

## Context
Game events include private information (hands, draws) that cannot be exposed to other players, but still need to be recorded for replays and auditing.

## Decision
Tag events with visibility metadata (`public` vs `private` with a target player). Route private events only to their target in real time, and filter replay streams by viewer seat to preserve secrecy.

## Consequences
Networking and persistence layers must carry visibility metadata. Replays are inherently per-player, with a separate admin replay path for full visibility.
