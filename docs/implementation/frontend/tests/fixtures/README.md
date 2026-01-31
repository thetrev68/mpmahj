# Test Fixtures

Mock data for testing without a live backend. All fixtures are JSON files representing game state snapshots or event sequences.

## Directory Structure

````text
fixtures/
├── game-states/     # Complete game state snapshots (GameStateSnapshot)
├── hands/           # Sample player hands (Tile[])
└── events/          # Event sequences for testing flows
```text

## File Format

### Game States (`game-states/`)

Complete snapshots matching the `GameStateSnapshot` TypeScript binding:

```json
{
  "phase": { "Charleston": "FirstRight" },
  "dealer": "East",
  "currentTurn": null,
  "remainingTiles": 72,
  "players": {
    "East": { "seat": "East", "tileCount": 13, "exposedMelds": [] },
    "South": { "seat": "South", "tileCount": 13, "exposedMelds": [] },
    "West": { "seat": "West", "tileCount": 13, "exposedMelds": [] },
    "North": { "seat": "North", "tileCount": 13, "exposedMelds": [] }
  },
  "yourSeat": "South",
  "yourHand": [...]
}
```text

**Naming Convention**: `[phase]-[substage]-[variant].json`

Examples:

- `charleston-first-right.json`
- `playing-drawing-normal.json`
- `playing-call-window-open.json`

### Hands (`hands/`)

Arrays of tiles for specific test scenarios:

```json
{
  "name": "Sample Winning Hand - Consecutive Run",
  "tiles": [
    "Bam1",
    "Bam2",
    "Bam3",
    "Bam4",
    "Bam5",
    "Bam6",
    "Bam7",
    "Bam8",
    "Bam9",
    "Crak1",
    "Crak1",
    "Crak1",
    "Dragon1",
    "Dragon1"
  ],
  "description": "Complete Mahjong hand with consecutive Bams run",
  "matchesPattern": "Consecutive Run 1-9 + Pung + Pair"
}
```text

### Events (`events/`)

Sequences of events for testing flows:

```json
{
  "scenario": "Charleston First Right Standard Pass",
  "events": [
    {
      "kind": "Public",
      "event": {
        "CharlestonPhaseChanged": { "stage": "FirstRight" }
      }
    },
    {
      "kind": "Public",
      "event": {
        "CharlestonTimerStarted": {
          "stage": "FirstRight",
          "duration": 60,
          "started_at_ms": 1234567890,
          "timer_mode": "Standard"
        }
      }
    },
    {
      "kind": "Private",
      "event": {
        "TilesPassed": {
          "player": "South",
          "tiles": ["Bam1", "Bam2", "Bam3"]
        }
      }
    }
  ]
}
```text

## How to Use in Tests

```typescript
import charlestonState from '@/tests/fixtures/game-states/charleston-first-right.json';
import winningHand from '@/tests/fixtures/hands/winning-hand-consecutive.json';
import charlestonEvents from '@/tests/fixtures/events/charleston-sequence.json';

describe('Charleston Flow', () => {
  test('handles standard pass', () => {
    const { applySnapshot } = useGameStore.getState();
    applySnapshot(charlestonState);

    // Test logic...
  });
});
```text

## Generating Fixtures

### From Backend Tests

```bash
cd crates/mahjong_core
cargo test export_fixtures --features test-fixtures
# Outputs to apps/client/src/tests/fixtures/
```text

### Manual Creation

Use the TypeScript bindings as a guide:

- `apps/client/src/types/bindings/generated/GameStateSnapshot.ts`
- `apps/client/src/types/bindings/generated/Event.ts`
- `apps/client/src/types/bindings/generated/Tile.ts`

Validate JSON with:

```bash
npm run validate-fixtures  # TODO: Add script to package.json
```text

## Index of Fixtures

### Game States

- [ ] `charleston-first-right.json`
- [ ] `charleston-first-left-blind-pass.json`
- [ ] `charleston-voting.json`
- [ ] `charleston-courtesy-pass.json`
- [ ] `playing-drawing.json`
- [ ] `playing-discarding.json`
- [ ] `playing-call-window-open.json`
- [ ] `playing-awaiting-mahjong.json`

### Hands

- [ ] `winning-hand-consecutive.json`
- [ ] `winning-hand-pung-kong.json`
- [ ] `charleston-hand-standard.json`
- [ ] `dead-hand-wrong-count.json`

### Events

- [ ] `charleston-sequence.json`
- [ ] `call-window-sequence.json`
- [ ] `joker-exchange-sequence.json`
- [ ] `mahjong-self-draw-sequence.json`
````
