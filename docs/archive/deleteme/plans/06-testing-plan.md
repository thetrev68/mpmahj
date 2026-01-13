# 06. Testing - Implementation Plan

This plan translates `docs/implementation/06-testing.md` into concrete steps and file-level guidance.

## Sources

- `docs/implementation/06-testing.md`
- `docs/architecture/12-testing-strategy.md`
- `docs/architecture/09-network-protocol.md`
- `docs/architecture/06-command-event-system-api-contract.md`
- `docs/architecture/03-module-architecture.md`

## Scope

Implement the required unit, integration, client, and E2E tests described in the testing spec. Ensure CI gates align with project expectations.

## Plan

### 1) Core unit tests (`mahjong_core`)

Add or expand tests under `crates/mahjong_core/tests` or `crates/mahjong_core/src` test modules.

Required coverage (from spec):

- Tile creation and equality
- Meld creation and validation (Pung/Kong/Quint)
- Charleston stage transitions:
  - FirstRight -> FirstAcross -> FirstLeft -> VotingToContinue
  - Vote Continue -> SecondLeft -> SecondAcross -> SecondRight -> CourtesyAcross
  - Vote Stop -> CourtesyAcross
  - CourtesyAcross -> Complete
- Turn stage transitions:
  - Drawing -> Discarding -> CallWindow
  - CallWindow (all pass) -> next player Drawing
  - CallWindow (call) -> caller Discarding
- Command validation failure cases:
  - WrongPhase, NotYourTurn, TileNotInHand
  - CannotPassJoker, InvalidPassCount
  - CannotCallOwnDiscard, CallWindowExpired
- Deterministic deal with seed (same seed -> same hands)
- Call conflict priority rules (Mahjong > proximity)
- Histogram-based validation tests:
  - Hand histogram updates on add/remove tile
  - Deficiency calculation accuracy (exact match = 0)
  - Near-win detection (1 tile away = deficiency 1)
  - Joker substitution in groups (reduces deficiency)
  - Joker in pairs (does not reduce deficiency)
  - Concealed pattern filtering
  - Load `unified_card2025.json` (1,002 variations)

Guidance:

- Keep tests deterministic by fixing RNG seeds.
- Use small helper builders for tiles, melds, and hands to reduce boilerplate.

### 2) Property tests (`mahjong_core`)

Add property tests (likely using `proptest` or `quickcheck`).

Required coverage:

- `validate_hand` never panics
- Random hands return either Valid or Invalid

Guidance:

- Limit hand size to 14 and tile counts to legal limits.
- Use a shrinker-friendly representation (counts array or vec of tiles).

### 3) Server integration tests (`mahjong_server`)

Add integration tests under `crates/mahjong_server/tests` using WebSocket clients.

Required scenarios:

- Full 4-player lifecycle: Setup -> Charleston -> Playing -> Mahjong -> GameOver
- Reconnect mid-game: disconnect, reconnect with token, receive full state
- Call window conflict resolution:
  - Multiple players call same discard -> turn order proximity wins
  - Mahjong call beats Pung/Kong call
  - All players pass -> next player draws
- Charleston voting:
  - All 4 vote Continue -> Second Charleston begins
  - Any vote Stop -> Courtesy Pass begins
- Charleston tile count mismatch: wrong count rejected, must resubmit
- Blind pass execution: incoming tiles routed to next player without revealing
- Courtesy pass mismatch: partners propose different counts -> smallest wins, blocking wins over non-zero
- Joker exchange: valid replacement moves joker to hand, replacement added to meld
- Wall exhaustion: no tiles left -> GameOver with draw result

Guidance:

- Use a helper to spawn 4 WebSocket clients.
- Ensure tests assert event ordering and visibility.
- Apply timeouts to avoid hanging tests.

### 4) Client tests (`apps/client`)

Add unit tests for the client state and animation queue.

Required coverage:

- Store update by event (`applyEvent` behavior)
- Animation queue defers state updates until completion
- Seat rotation mapping

Guidance:

- Use a lightweight test runner (e.g., Vitest) if not already configured.
- Mock timers for animation queue timeouts.

### 5) E2E smoke tests

Add a minimal E2E suite (Playwright or Cypress) for:

- Create room
- Four players join
- Charleston pass
- First discard
- Call window pass
- Declare Mahjong (valid case)

Guidance:

- This can be a separate test target or manually run script.
- If multi-client UI is complex, test a single client while mocking others via server hooks.

### 6) CI gates alignment

Ensure CI commands match the spec:

- `cargo fmt --check`
- `cargo clippy` (zero warnings)
- `cargo test` (72 tests: 67 unit + 5 integration)
- `cargo bench`
- `npm run lint`
- `npm run test`

If the repo CI differs, update workflows or document the delta.

## Open questions / decisions

- Decide property test framework (`proptest` vs `quickcheck`).
- Confirm where to place E2E tests and whether to run in CI for MVP.
- Validate exact test counts if they are used as a CI gate.

## Suggested file list

- `crates/mahjong_core/tests/`
- `crates/mahjong_core/src/*` (module tests)
- `crates/mahjong_server/tests/`
- `apps/client/src/store/__tests__/`
- `apps/client/src/hooks/__tests__/`
- `.github/workflows/` (if CI updates are needed)
