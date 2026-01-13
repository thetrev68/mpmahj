# ADR 0001: Histogram-first core tile and hand models

## Status

Accepted

## Context

The core game logic needs fast, deterministic validation and state updates across many calls per turn. Naive list-based tile operations make repeated lookups and counts expensive.

## Decision

Represent tiles and hands with fixed-size histograms as the primary data model. Use a compact tile index (u8) and maintain histogram counts alongside any ordered view needed for UI or display.

## Consequences

This enables O(1) tile lookups and fast deficiency calculations, at the cost of more bookkeeping when mutating a hand. The histogram format becomes a shared primitive across validation, AI, and game-state logic.
