# ADR 0006: Server-authoritative client state with FIFO event application

## Status
Accepted

## Context
Clients receive an ordered event stream that represents authoritative state changes. Optimistic updates risk divergence and complicate reconciliation.

## Decision
Maintain a server-authoritative game store on clients that is mutated only by applying events in FIFO order. UI-only state is kept separate and does not affect game truth.

## Consequences
Clients may feel less responsive without optimistic updates, but state remains consistent. Animations must not reorder events, and reconnects can safely replace local state from server snapshots.
