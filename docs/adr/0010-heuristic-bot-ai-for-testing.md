# ADR 0010: Heuristic bot AI for testing

## Status
Accepted

## Context
Single-player testing and automation require bots that can play legal hands without expensive AI work.

## Decision
Use a rule-based, heuristic bot for decision-making (Charleston passes, discards, calls) with deterministic validation checks. Bots run server-side for automation and takeover scenarios.

## Consequences
Bots are reliable for testing and regression coverage, but do not model advanced strategy. Future difficulty tiers can evolve without changing the core protocol.
