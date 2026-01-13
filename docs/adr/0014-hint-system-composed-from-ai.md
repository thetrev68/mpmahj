# ADR 0014: Compose hints from AI + analysis with verbosity control

## Status
Accepted

## Context
Hints should be consistent with bot behavior and avoid duplicating decision logic.

## Decision
Generate hints by composing Always-On Analyst results with AI helper recommendations. Use a `HintVerbosity` setting to control how much text is shown while keeping the same underlying recommendations.

## Consequences
Hint quality improves as AI improves, and the server remains the single place that composes hint payloads. The UI only renders data and respects verbosity settings.
