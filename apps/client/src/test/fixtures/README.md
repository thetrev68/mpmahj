# Test Fixtures

This directory contains mock data for testing. Fixtures are organized by type.

## Structure

```text
fixtures/
├── game-states/     # Complete game state snapshots (3 fixtures)
├── hands/           # Sample player hands (4 fixtures)
├── events/          # Event sequences (3 fixtures)
├── index.ts         # Central import point
└── README.md        # This file
```

## Usage

### Option 1: Import from Index (Recommended)

```typescript
import { gameStates, hands, eventSequences } from '@/test/fixtures';

test('loads charleston state', () => {
  const state = gameStates.charlestonFirstRight;
  expect(state.phase).toEqual({ Charleston: 'FirstRight' });
});

test('uses winning hand', () => {
  const hand = hands.winningHandConsecutive;
  expect(hand.tiles).toHaveLength(14);
  expect(hand.is_winning).toBe(true);
});
```

### Option 2: Direct Import

```typescript
import charlestonState from '@/test/fixtures/game-states/charleston-first-right.json';

test('loads charleston state', () => {
  expect(charlestonState.phase).toBeDefined();
});
```

## Available Fixtures

### Game States (3 fixtures)

- ✅ **charleston-first-right.json** - Charleston phase, first right pass
- ✅ **playing-drawing.json** - Playing phase, drawing stage
- ✅ **playing-call-window.json** - Playing phase, call window open with multiple intents

### Hands (4 fixtures)

- ✅ **charleston-standard-hand.json** - Standard mixed hand (13 tiles)
- ✅ **winning-hand-consecutive.json** - Complete winning hand with consecutive run (14 tiles)
- ✅ **near-win-one-away.json** - One tile from winning (13 tiles)
- ✅ **with-jokers.json** - Hand with 3 jokers (13 tiles)

### Event Sequences (3 fixtures)

- ✅ **charleston-pass-sequence.json** - Charleston first right pass flow (5 events)
- ✅ **call-window-sequence.json** - Call window with priority resolution (6 events)
- ✅ **turn-flow-sequence.json** - Standard turn draw and discard (6 events)

## Creating New Fixtures

Fixtures follow the TypeScript bindings from the backend. See [src/types/bindings/](../../types/bindings/) for type definitions.

Fixtures can be:

1. Hand-written JSON files (like current fixtures)
2. Exported from backend Rust tests
3. Captured from real game sessions

### Adding a New Fixture

1. Create JSON file in appropriate subdirectory
2. Add import to `index.ts`
3. Add to the appropriate export object
4. Update this README
