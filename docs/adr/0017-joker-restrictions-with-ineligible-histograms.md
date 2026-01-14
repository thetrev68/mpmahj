# ADR 0017: Enforce joker restrictions via ineligible histograms

## Status

Accepted

## Context

NMJL rules restrict jokers: they cannot complete singles or pairs, cannot substitute for flowers, but can be used in 3+ identical groups.

## Decision

Add an `ineligible_histogram` alongside each pattern variation to mark tiles that must be natural. Use the CSV card source of truth and force flowers to be ineligible during conversion.

## Consequences

Validation can enforce joker rules without special-case logic scattered across the codebase. Card tooling must maintain the additional histogram field.
