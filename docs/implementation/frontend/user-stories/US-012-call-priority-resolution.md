# US-012: Call Priority Resolution

## Story

**As a** player observing multiple call intents
**I want** to see how the system resolves conflicts when multiple players call the same discard
**So that** I understand why a specific player won the call

## Acceptance Criteria

### AC-1: Priority Rule Display

**Given** multiple players declared call intent
**When** the server emits `CallResolved { resolution }`
**Then** a priority resolution overlay appears
**And** it displays the priority rules:

- **Rule 1**: Mahjong > Pung/Kong/Quint
- **Rule 2**: If tied, closest player to discarder wins (clockwise)

### AC-2: Mahjong Beats Meld

**Given** South called for Mahjong and West called for Pung
**When** call resolves
**Then** South wins (Mahjong priority)
**And** overlay shows: "South wins: Mahjong beats Pung"

### AC-3: Closest Player Wins (Meld Tie)

**Given** South and West both called for Pung
**When** East discarded (turn order: East → South → West → North)
**Then** South wins (closer to East)
**And** overlay shows: "South wins: Closest to discarder"

### AC-4: Closest Player Wins (Mahjong Tie)

**Given** South and North both called for Mahjong
**When** East discarded
**Then** South wins (closer to East)
**And** overlay shows: "South wins: Both Mahjong, South is closer"

## Technical Details

### Events (Backend → Frontend)

````typescript
{
  kind: 'Public',
  event: {
    CallResolved: {
      resolution: {
        winner: Seat,
        intent: "Mahjong",  // or "Meld"
        tile: Tile,
        all_callers: [
          { seat: Seat.South, intent: "Mahjong" },
          { seat: Seat.West, intent: "Meld" }
        ]
      }
    }
  }
}
```text

### Backend References

- **Rust Code**: `crates/mahjong_core/src/call_resolution.rs`
- **Game Design Doc**: Section 3.2.3 (Priority Resolution Rules)

## Components Involved

- **`<CallResolutionOverlay>`** - Shows priority explanation
- **`<PriorityDiagram>`** - Visual of turn order and priorities

**Component Specs:**

- `component-specs/presentational/CallResolutionOverlay.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/call-priority-mahjong-wins.md`**
- **`tests/test-scenarios/call-priority-closest-meld.md`**
- **`tests/test-scenarios/call-priority-closest-mahjong.md`**

## Related User Stories

- **US-011**: Call Window & Intent Buffering

## Priority

**HIGH** - Important for player understanding

## Story Points / Complexity

**3** - Medium complexity

## Definition of Done

- [ ] Call resolution overlay shows winner and reason
- [ ] Mahjong priority displayed correctly
- [ ] Closest player logic displayed correctly
- [ ] All callers listed with their intents
- [ ] Turn order diagram shown
- [ ] Component tests pass
- [ ] Integration tests pass

## Notes for Implementers

### Turn Order for Proximity

```typescript
function getProximity(from: Seat, to: Seat): number {
  const order = [Seat.East, Seat.South, Seat.West, Seat.North];
  const fromIndex = order.indexOf(from);
  const toIndex = order.indexOf(to);
  return (toIndex - fromIndex + 4) % 4;
}
```text

Closest = smallest proximity value (1 < 2 < 3).
````
