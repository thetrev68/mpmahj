# ADR 0026: Blind pass uses a receive-first UI model with rack-preserving staging

## Status

Accepted

## Context

NMJL blind pass exists to soften Charleston's requirement to pass 3 tiles when a player wants to preserve their current hand. In physical play, this happens on the last pass of the Charleston: a player may satisfy some or all of the outgoing pass by forwarding tiles they have just received and have not yet looked at.

In the current client flow, blind pass behavior has been difficult to understand and easy to mis-model because it sits between two different pass orders:

- normal Charleston feel: pass 3, then receive 3
- blind pass intent: preserve the current rack by using newly received blind tiles as outgoing candidates

This ambiguity has led to UX and state-model confusion:

- the rack can appear to lose tiles before the blind-pass decision is actually made
- blind-pass staging can imply a "peek" interaction that conflicts with the rules concept
- the pass-2 to pass-3 transition can blur "tiles that are now part of my hand" with "tiles I may forward blindly"

This decision affects frontend state ownership, rack counts, staging behavior, prompt copy, test fixtures, and future Charleston stories.

## Decision

Model blind pass in the client as a receive-first decision moment.

### 1. Rack preservation during blind pass

- During blind-pass selection, the player's concealed rack remains visually intact.
- The rack shows the player's full legal pre-pass hand count for that seat/stage.
- Blind-pass candidates are not treated as replacements for already-removed rack tiles.

### 2. Separate blind staging

- Blind-pass candidates appear as a separate incoming staging group.
- The outgoing 3 tiles may be chosen from:
  - rack tiles
  - blind staging tiles
  - a mix of both

### 3. Pass-2 to pass-3 transition

- End-of-pass-2 received tiles auto-absorb into the rack.
- The rack auto-sorts after that absorb step.
- Newly absorbed tiles remain visually identifiable for a short period.
- Once blind pass begins, staging shows only the 3 blind-pass candidates.
- The client must not require an extra user confirmation just to move pass-2 received tiles into the rack.
- The client must not show a combined 6-tile staging state for "3 just received + 3 blind candidates."

### 4. Count and test invariant

- East shows 14 concealed rack tiles during Charleston before the first discard.
- Non-East players show 13 concealed rack tiles.
- Blind-pass candidates are additive to the decision surface, not subtractive from the rack count.

### 5. Reveal behavior

- Reveal-on-click is not the defining blind-pass interaction model.
- If reveal remains in the product, it is a secondary UI behavior and must not change the receive-first rack/staging model.

## Consequences

### Positive

- Blind pass matches the player mental model: "keep my current hand and use the newly received blind tiles if I want."
- Rack counts remain understandable and seat-correct during blind-pass selection.
- The pass-2 to pass-3 transition becomes clearer and less mechanically clunky.
- Future Charleston stories can share one stable interpretation for copy, tests, and state ownership.

### Negative

- The frontend must explicitly distinguish:
  - rack-owned tiles
  - just-received-and-now-absorbed tiles
  - blind-pass candidates still in staging
- Auto-sort after absorb requires a separate visual affordance so players can still identify what changed.
- Existing tests and UI copy that imply "peek" or a rack drop to 11 will need revision.

### Implementation impact

The following areas must follow this model:

1. `CharlestonPhase` orchestration for pass transition and outgoing eligibility
2. `StagingStrip` blind-pass presentation and labeling
3. `PlayerRack` sorting/highlight treatment for newly absorbed tiles
4. action-bar instruction copy
5. integration tests for `FirstLeft`, `SecondRight`, and reconnect/remount reconciliation

### Relationship to existing ADRs

- This refines ADR 0025's decision that blind pass/steal is in scope for NMJL compliance.
- This remains consistent with ADR 0006's server-authoritative client state model:
  - server state remains the source of truth
  - the receive-first interpretation is a client UX/state-presentation contract, not a move away from server authority
