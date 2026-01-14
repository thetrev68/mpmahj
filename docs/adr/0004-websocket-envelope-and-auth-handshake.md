# ADR 0004: WebSocket envelope and auth-first handshake

## Status

Accepted

## Context

The server needs a consistent, language-agnostic protocol for client/server messages, plus a predictable authentication flow for session recovery.

## Decision

Use a JSON WebSocket protocol with a top-level envelope `{ kind, payload }`. Require the first client message to be `Authenticate`, and return an `AuthSuccess` payload that includes a session token for reconnects.

## Consequences

All clients implement a small, shared envelope parser and a mandatory auth-first connection flow. Reconnects are simple, but the server must enforce auth ordering and session token validation.
