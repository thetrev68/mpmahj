# 06. Testing Implementation Spec

This document specifies the required testing layers and minimum tests.

---

## 1. Testing Pyramid

- Unit: `mahjong_core`
- Integration: `mahjong_server` + headless clients
- E2E: browser-based UI flows

---

## 2. Core Unit Tests (Required)

- Tile creation and equality
- Meld creation and validation (Pung/Kong/Quint)
- Charleston stage transitions:
  - FirstRight → FirstAcross → FirstLeft → VotingToContinue
  - Vote Continue → SecondLeft → SecondAcross → SecondRight → CourtesyAcross
  - Vote Stop → CourtesyAcross
  - CourtesyAcross → Complete
- Turn stage transitions:
  - Drawing → Discarding → CallWindow
  - CallWindow (all pass) → next player Drawing
  - CallWindow (call) → caller Discarding
- Command validation failure cases:
  - WrongPhase, NotYourTurn, TileNotInHand
  - CannotPassJoker, InvalidPassCount
  - CannotCallOwnDiscard, CallWindowExpired
- Deterministic deal with seed (same seed → same hands)
- Call conflict priority rules (Mahjong > proximity)
- Validation engine tests (see validation spec)

---

## 3. Property Tests

- `validate_hand` never panics
- Random hands must return either Valid or Invalid

---

## 4. Server Integration Tests

Required test scenarios:

- **Full 4-player lifecycle**: Setup → Charleston → Playing → Mahjong → GameOver
- **Reconnect mid-game**: Player disconnects, reconnects with session token, receives full state
- **Call window conflict resolution**:
  - Multiple players call same discard → turn order proximity wins
  - Mahjong call beats Pung/Kong call
  - All players pass → next player draws
- **Charleston voting**:
  - All 4 players vote Continue → Second Charleston begins
  - Any player votes Stop → Courtesy Pass begins
- **Charleston tile count mismatch**: Player submits wrong count → rejected, must resubmit
- **Blind pass execution**: Incoming tiles routed directly to next player without revealing
- **Courtesy pass mismatch**: Partners propose different counts → smallest wins, blocking wins over non-zero
- **Joker exchange**: Valid replacement tile → Joker moved to player's hand, replacement added to meld
- **Wall exhaustion**: No tiles left → GameOver with draw result

---

## 5. Client Tests

- Store update by event
- Animation queue behavior
- Seat rotation mapping

---

## 6. E2E Smoke Tests

- Create room
- Four players join
- Charleston pass
- First discard
- Call window pass
- Declare Mahjong (valid case)

---

## 7. CI Gates

- `cargo fmt --check`
- `cargo clippy`
- `cargo test`
- `npm run lint`
- `npm run test`
