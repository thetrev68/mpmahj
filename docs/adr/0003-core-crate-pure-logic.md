# ADR 0003: Keep mahjong_core as pure, synchronous game logic

## Status

Accepted

## Context

The core logic is shared by multiple clients and services. Mixing IO, network, or async concerns makes it harder to test and reuse in different runtimes.

## Decision

Keep the core crate synchronous and focused on deterministic game state transitions and validation. Only allow file IO for card data loading when necessary.

## Consequences

The core is highly reusable and easy to test in isolation. Callers handle async orchestration, transport, and persistence outside the core crate.
