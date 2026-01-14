# ADR 0008: Testing pyramid and CI gates

## Status

Accepted

## Context

The project spans core logic, server networking, and client UX. We need a layered test strategy that protects correctness while keeping feedback fast.

## Decision

Adopt a testing pyramid: unit tests in `mahjong_core`, integration tests in `mahjong_server` with headless clients, and targeted end-to-end smoke tests. CI must gate on `cargo fmt`, `cargo clippy`, `cargo test`, and performance checks, plus frontend lint/test when applicable.

## Consequences

Core logic gets fast, deterministic coverage, while integration tests validate protocol flows. CI enforces minimum quality gates across Rust and frontend work.
