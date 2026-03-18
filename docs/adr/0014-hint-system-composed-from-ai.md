# ADR 0014: Hint system uses a single toggle and full payload contract

## Status

Accepted

## Context

The original hint design used `HintVerbosity` as both a user-facing concept and a server-side field gate. That no longer matches the product.

The client settings surface is a single "Use Hints" toggle with no verbosity selector. Keeping verbosity in the protocol would preserve a distinction the product no longer has and would continue to invite partial-payload behavior at the contract boundary.

For the product we are building, hints are either on or off. When they are on, the UI should be able to render the complete hint surface from one response.

## Decision

Treat hint availability as a single enabled/disabled capability.

- Remove `HintVerbosity` from the protocol entirely.
- Remove verbosity-bearing hint commands and request payloads from the protocol entirely.
- Hint-enabled state is represented directly by the simplified hint contract.
- Hint-disabled state means no hint payload should be delivered.
- The hint payload contract includes all available hint content in one response:
  - `recommended_discard`
  - `best_patterns`
  - `tile_scores`
  - `charleston_pass_recommendations` when Charleston context exists
- The frontend must treat hints as a single on/off feature and render every populated field without verbosity-conditional branches.

Implementation detail: the server may continue composing hints from cached analysis plus AI recommendation logic, but that composition is no longer exposed as separate verbosity levels in the product contract.

## Consequences

- The hint protocol now matches the UI: one toggle, one complete payload shape.
- Pattern guidance and tile scoring can coexist in the same user flow instead of competing behind hidden verbosity gates.
- Backend hint-generation internals can evolve without reintroducing user-visible capability tiers.
- The protocol becomes smaller and harder to misuse because there is no dormant verbosity abstraction to reconcile.
- Tests should enforce the simplified on/off contract and full-payload behavior.

### Relationship to existing ADRs

- This builds on ADR 0013: the server still owns analysis orchestration and hint composition.
- This supersedes ADR 0014's prior verbosity-control decision. Verbosity is no longer a product feature or protocol concept.
