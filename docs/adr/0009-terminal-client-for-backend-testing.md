# ADR 0009: Terminal client for backend testing

## Status

Accepted

## Context

Backend development needs a low-overhead way to drive the server without waiting on a full UI.

## Decision

Provide a minimal Rust terminal client that connects via WebSocket, sends commands, and displays events. Treat it as a testing tool rather than a production UI.

## Consequences

Server workflows can be exercised manually or via scripts in a lightweight environment. The terminal client remains intentionally simple and focuses on correctness over presentation.
