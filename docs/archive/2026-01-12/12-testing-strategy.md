---
Archived-Date: 2026-01-12
Source-Path: docs/architecture/12-testing-strategy.md
Note: Archived copy. See README-STEROIDS.md for context.
---

# 12. Testing Strategy

This document outlines the strategy for ensuring the reliability, correctness, and performance of the American Mahjong system. We employ a "Test Pyramid" approach, emphasizing fast, reliable unit tests for the core logic while using integration and E2E tests for system cohesion.

---

## 12.1 Testing Layers

| Layer           | Scope                                            | Tools                      | Frequency     |
| :-------------- | :----------------------------------------------- | :------------------------- | :------------ |
| **Unit**        | Individual functions/structs (Rules, Hand, Deck) | `cargo test`, `vitest`     | Every commit  |
| **Integration** | Module interaction (Game Loop, WebSocket)        | `cargo test`, `tokio-test` | Pull Requests |
| **E2E**         | Full user flows (Browser, Network)               | `Playwright`               | Pre-release   |

---

## 12.2 Backend Testing (`mahjong_core`)

The `mahjong_core` crate contains the "Truth" of the game. It must be bug-free.

### 12.2.1 Unit Tests

Every module (`hand.rs`, `tile.rs`, `flow.rs`) has a companion `tests` module.

```rust
// crates/mahjong_core/src/hand.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pung_creation() {
        let tiles = vec![
            Tile::new_number(Suit::Dots, 1).unwrap(),
            Tile::new_number(Suit::Dots, 1).unwrap(),
            Tile::new_number(Suit::Dots, 1).unwrap(),
        ];
        let meld = Meld::new(MeldType::Pung, tiles, None).unwrap();
        assert_eq!(meld.tile_count(), 3);
    }
}
```

### 12.2.2 Property-Based Testing (Proptest)

American Mahjong has millions of hand permutations. Standard unit tests can't cover them all. We use `proptest` to generate random inputs.

- **Goal**: Ensure `Validator` never panics and always returns a valid result.
- **Strategy**: Generate 1,000 random hands + random card definitions and feed them to the validator.

```rust
proptest! {
    #[test]
    fn validator_never_crashes(tiles in vector(any_tile(), 14)) {
        let hand = Hand::new(tiles);
        let _ = validate_hand(&hand, &mock_card());
    }
}
```

### 12.2.3 Deterministic Game Replay

Since `mahjong_core` logic is pure (given a seed), we can record a game's seed and command history to replay bugs.

- **Test**: `tests/simulation.rs`
- **Action**: Load a recorded "crash" scenario (JSON) and assert the state matches.

---

## 12.3 Server Testing (`mahjong_server`)

Focuses on concurrency, networking, and state synchronization.

### 12.3.1 Integration Tests (Headless Clients)

We spin up a real Axum server in-memory and connect 4 "Headless" WebSocket clients (Rust test code).

```rust
#[tokio::test]
async fn test_full_game_lifecycle() {
    // 1. Start Server
    let server = TestServer::new().await;

    // 2. Connect 4 Clients
    let mut c1 = server.connect_client("Alice").await;
    let mut c2 = server.connect_client("Bob").await;
    let mut c3 = server.connect_client("Charlie").await;
    let mut c4 = server.connect_client("Dave").await;

    // 3. Setup Game
    c1.send(Command::CreateGame);
    // ... others join ...

    // 4. Assert Events
    assert_matches!(c1.recv().await, GameEvent::GameStarting);
}
```

---

## 12.4 Frontend Testing (`apps/client`)

### 12.4.1 Unit Tests (Vitest)

Logic that resides on the client (e.g., helpers, formatters) is tested with Vitest.

```typescript
// utils/tile.test.ts
import { sortHand } from './tile';

test('sorts tiles by suit then rank', () => {
  const input = [
    /*...*/
  ];
  const sorted = sortHand(input);
  expect(sorted[0].suit).toBe('Dots');
});
```

### 12.4.2 Component Tests (React Testing Library)

Verify that components render correctly given specific props.

```typescript
test('Tile renders generic back if hidden', () => {
    render(<Tile hidden={true} />);
    expect(screen.getByTestId('tile-back')).toBeInTheDocument();
});
```

---

## 12.5 End-to-End (E2E) Testing

We use **Playwright** to test the full application running in a browser environment.

- **Scenario**: 4 browser tabs controlled by Playwright.
- **Flow**:
  1. Launch App.
  2. Player A creates game.
  3. Players B, C, D join (simulated via API or other tabs).
  4. Verify Board renders for all.
  5. Verify Drag-and-Drop works (visual regression optional).

---

## 12.6 Manual Testing & QA

### 12.6.1 The "Debug Menu"

A hidden developer menu in the client allows:

- **Force Deal**: Give Player 1 a specific hand (e.g., "Joker Pung").
- **God Mode**: See all other players' hands.
- **Speed Run**: Reduce all timers to 1 second.

### 12.6.2 Bot Match

Developers verify changes by playing a full game against 3 "RandomBots".

---

## 12.7 CI/CD Pipeline (GitHub Actions)

Every Push/PR triggers:

1. **Backend Check**: `cargo fmt --check`, `cargo clippy`, `cargo test`.
2. **Frontend Check**: `npm run lint`, `npm run test`.
3. **Build Check**: Verify `cargo build` and `npm run build` succeed.
4. **Security**: `cargo audit` to check for vulnerable dependencies.
