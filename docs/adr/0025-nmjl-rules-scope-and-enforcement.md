# ADR 0025: NMJL Rules Scope and Server-Side Enforcement

## Status

Accepted

## Context

The backend game engine must implement the National Mah Jongg League (NMJL) ruleset to ensure fair, competitive play. However, not all NMJL rules are practical or enforceable in a digital environment, and some require architectural decisions about scoring models, game flow, and configuration flexibility.

The [rules audit checklist](../implementation/backend/rules-audit-checklist.md) identified numerous gaps between the current implementation and the official NMJL rules documented in `nmjl_mahjongg-rules.md`. Before implementing these rules, we must decide:

1. Which penalty rules apply in a digital game vs. in-person only
2. Whether advanced features like Sextets are required for MVP and future card years
3. How to handle scoring: strict NMJL vs. configurable house rules
4. Dealer rotation mechanics and seat assignment
5. Support for rare but valid scenarios (Heavenly hand, blind pass/steal, IOU)

These decisions affect core architecture, validation logic, scoring systems, and configuration models.

## Decision

### 1. Penalty Rules Enforcement

**All NMJL penalty rules are in scope**, with the following enforcement approach:

- **Wrong tile count** → Dead hand: Enforceable via server-side tile tracking. Player cannot draw/discard once detected. Must pay full value to winner.
- **Mahjong in error** → Dead hand recovery: Primary enforceable penalty during active gameplay. If a player incorrectly claims Mahjong, their hand becomes dead but play continues. Winner collects from dead hands at full value.
- **Picking from wrong wall/end** → Not applicable in digital implementation (server controls wall distribution).
- **Other penalties** (dogging, verbal call violations, touching tiles) → Out of scope as in-person etiquette rules.

### 2. Sextet Support

**Sextets MUST be implemented** to support older and future card years (2017-2025 and beyond). This affects:

- `Meld` enum: Add `Sextet` variant
- Call priority resolution: Sextets have same priority as other melds
- Validation: Sextets may be all jokers per NMJL (no minimum natural tiles)

### 2.1. Joker Rules for Melds

**NMJL allows all-joker melds** for Pung/Kong/Quint/Sextet (no minimum natural tiles).

- Meld validation must accept zero natural tiles
- Joker exchange is only possible when a natural base tile exists

### 3. Scoring Model

#### Hybrid approach: Default NMJL with configurable house rules

- **Base implementation**: Strict NMJL scoring
  - Per-pattern card values (not fixed 25 points)
  - Called discard: discarder pays 2x, others pay 1x
  - Self-draw: all 3 losers pay equal amounts (2x multiplier applied)
  - Jokerless bonus: 2x for eligible patterns (not singles/pairs)

- **Configurable house rules** (via room/game settings):
  - Concealed hand bonus (on/off, multiplier)
  - Dealer bonus (on/off, multiplier)
  - Custom point values or multipliers
  - Alternative jokerless bonus rules

This allows competitive NMJL play by default while supporting casual/house-rule games.

### 4. Dealer Rotation

#### East starts as room creator, then rotates every game

- Initial game: East (dealer) = player who created the room
- After each hand (win or wall exhaustion): East rotates clockwise
- Rotation is independent of who wins (differs from some house rules where East retains on win)

This follows standard NMJL tournament rules and simplifies implementation.

### 5. Charleston Advanced Features

#### Blind pass/steal and IOU MUST be implemented

- **Blind pass/steal**: Required for FirstLeft and SecondRight passes (1-3 tiles)
  - Blind tiles are forwarded from the incoming pass (not chosen from the passer's own hand)
  - Receiver may steal the blind tiles during that same pass, per NMJL

- **IOU rule**: When all 4 players blind pass 3 tiles, IOU is resolved within the Charleston pass
  - IOUs are settled immediately during the pass (no in-play IOU claiming)

These are core NMJL Charleston mechanics, not optional features.

### 6. Heavenly Hand

#### Heavenly hand detection MUST be included

- Check East's initial 14 tiles before Charleston begins
- If East has a winning hand, declare Heavenly Hand victory
- Skip Charleston entirely
- Apply double payment (special Heavenly Hand multiplier)

While extremely rare (~0.001% probability), this is a valid NMJL rule and must be supported for completeness and rule compliance.

## Consequences

### Positive

- **Complete NMJL compliance**: Supports all official rules, enabling tournament-level play
- **Flexibility**: House rules configuration allows casual games without sacrificing competitive integrity
- **Future-proof**: Sextet support and penalty enforcement cover all card years (2017-2025+)
- **User trust**: Proper Heavenly Hand and rare-case handling demonstrates thoroughness

### Negative

- **Implementation complexity**: Blind pass/steal, IOU, and Sextet support add significant code complexity
- **Testing burden**: Rare scenarios (Heavenly Hand, IOU, dead hand recovery) require specialized tests
- **Configuration overhead**: House rules settings increase UI complexity and testing matrix

### Implementation Impact

The following systems require significant changes:

1. **Core validation** (`crates/mahjong_core/src/table/validation.rs`): Add penalty detection (wrong tile count, mahjong in error)
2. **Meld system** (`crates/mahjong_core/src/meld.rs`): Add Sextet variant and allow all-joker melds per NMJL
3. **Charleston** (`crates/mahjong_core/src/flow/charleston/`): Implement blind pass/steal and IOU resolution during the Charleston pass
4. **Scoring** (`crates/mahjong_core/src/scoring.rs`): Refactor to use pattern values, add house rules configuration
5. **Game flow** (`crates/mahjong_core/src/flow/mod.rs`): Add Heavenly Hand detection and dealer rotation
6. **Configuration** (game settings): Add house rules toggles and multipliers

See the [implementation plan](../implementation/backend/rules-audit-checklist.md#implementation-plan) for detailed phases and tasks.

### Testing Requirements

- Integration tests for all penalty scenarios (dead hand, mahjong in error)
- Sextet call and validation tests
- Blind pass/steal and Charleston-only IOU resolution tests (with randomness seed control)
- Heavenly Hand detection (synthetic winning hands)
- House rules toggle tests (verify NMJL default vs. house rule variants)
- Dealer rotation tests across multiple games

### Migration Path

No existing game data is affected, as these are new rule enforcements. However:

- Clients must be updated to support new commands (`AddToExposure`, etc.)
- Scoring changes may affect historical game statistics (document as breaking change for v1.0)
