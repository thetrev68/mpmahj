# Test Fixtures

This directory contains mock data for testing. Fixtures are organized by type.

## Structure

```
fixtures/
├── game-states/     # Complete game state snapshots
├── hands/           # Sample player hands
├── events/          # Event sequences
└── README.md        # This file
```

## Usage

```typescript
import charlestonState from '@/test/fixtures/game-states/charleston-first-right.json';

test('loads charleston state', () => {
  // Use fixture in test
});
```

## Creating Fixtures

Follow the format described in [docs/implementation/frontend/tests/fixtures/README.md](../../../../docs/implementation/frontend/tests/fixtures/README.md).

Fixtures can be:
1. Hand-written JSON files
2. Exported from backend Rust tests
3. Captured from real game sessions
