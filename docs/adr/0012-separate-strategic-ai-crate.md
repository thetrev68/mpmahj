# ADR 0012: Separate strategic AI crate with MCTS-based expert mode

## Status
Accepted

## Context
AI decision-making is probabilistic and compute-heavy, while core game logic must remain deterministic and fast. The project also needs multiple difficulty tiers.

## Decision
Implement strategy in a dedicated `mahjong_ai` crate that consumes `mahjong_core` validation. Provide random and greedy strategies for lower difficulties and an MCTS-based strategy for expert play.

## Consequences
AI can evolve independently of core rules, and difficulty scaling stays modular. The AI crate may require additional tuning and performance work without affecting core stability.
