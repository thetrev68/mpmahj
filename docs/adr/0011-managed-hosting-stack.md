# ADR 0011: Managed hosting stack for MVP deployment

## Status
Accepted

## Context
The MVP needs a low-ops deployment path for frontend, WebSocket backend, and Postgres persistence.

## Decision
Host the frontend on Vercel, the WebSocket server on Render, and persistence plus auth on Supabase. Configure services via environment variables and keep the deployment stack minimal.

## Consequences
Operations are simplified with managed services, but deployment flows depend on third-party platforms. Infra configuration should remain explicit in repo config and CI workflows.
