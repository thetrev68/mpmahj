# ADR 0018: Courtesy pass negotiation is per-pair with minimum-count resolution

## Status

Accepted

## Context

Courtesy pass rules require across partners to negotiate independently, with mismatched proposals resolving to the smaller count, and privacy between pairs.

## Decision

Track proposals per seat and resolve each pair independently. Emit pair-scoped events for proposals, mismatches, and readiness, and treat the agreed count as the minimum proposal.

## Consequences

Charleston state needs per-seat proposal tracking, and event visibility must be pair-private. This brings the implementation in line with official rules.
