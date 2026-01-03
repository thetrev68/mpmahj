# 06. Testing Implementation Spec

This document specifies the required testing layers and minimum tests.

---

## 1. Testing Pyramid

- Unit: `mahjong_core`
- Integration: `mahjong_server` + headless clients
- E2E: browser-based UI flows

---

## 2. Core Unit Tests (Required)

- Tile creation
- Meld creation
- Charleston stage transitions
- Turn stage transitions
- Command validation failure cases
- Deterministic deal with seed
- Validation engine tests (see validation spec)

---

## 3. Property Tests

- `validate_hand` never panics
- Random hands must return either Valid or Invalid

---

## 4. Server Integration Tests

- Full 4-player lifecycle
- Reconnect mid-game
- Call window conflict resolution
- Joker exchange

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
