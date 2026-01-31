# US-008: Charleston IOU Detection (Edge Case)

## Story

**As a** player participating in blind pass
**I want** the system to automatically detect and resolve IOU scenarios when all players attempt full blind pass
**So that** the Charleston can proceed correctly per NMJL rules

## Acceptance Criteria

### AC-1: IOU Detection Trigger

**Given** I am in `Charleston(FirstLeft)` or `Charleston(SecondRight)` stage (blind pass stages)
**When** all 4 players submit `PassTiles` with `blind_pass_count: 3`
**Then** the server emits `IOUDetected { debts: [(East, 3), (South, 3), (West, 3), (North, 3)] }`
**And** the normal pass flow pauses
**And** an IOU overlay appears for all players

### AC-2: IOU Overlay Display

**Given** the server emitted `IOUDetected`
**When** the IOU overlay appears
**Then** it displays:

- **Title**: "IOU Scenario Detected!"
- **Explanation**: "All 4 players attempted to blind pass all 3 tiles. Per NMJL rules, IOU resolution is triggered."
- **Visual**: Diagram showing the circular debt (all players owe each other 3 tiles)
- **Status**: "Resolving IOU automatically..."
- **Loading Spinner**: Server is calculating resolution

### AC-3: IOU Resolution (Server-Side)

**Given** IOU was detected
**When** the server calculates resolution per NMJL rules
**Then** the server emits `IOUResolved { summary: "..." }`
**And** the summary explains: "Each player passed 1-2 tiles. East picked up final pass to resolve debts."
**Note:** Frontend does NOT implement resolution logic; server handles this automatically.

### AC-4: IOU Resolution Display

**Given** the server emitted `IOUResolved`
**When** the IOU overlay updates
**Then** it displays:

- **Title**: "IOU Resolved!"
- **Summary**: Server-provided summary text
- **Outcome**: "Charleston continues normally."
- **Auto-dismiss**: Overlay dismisses after 5 seconds

### AC-5: Charleston Continues After IOU

**Given** IOU was resolved
**When** the overlay dismisses
**Then** the Charleston phase advances normally:

- **If FirstLeft**: Advance to `VotingToContinue`
- **If SecondRight**: Advance to `CourtesyAcross`
  **And** the timer resets for the next phase

### AC-6: Partial Blind Pass (No IOU)

**Given** I blind pass 3 tiles but at least one other player blind passes < 3
**When** all players submit their passes
**Then** NO `IOUDetected` event is emitted
**And** the normal pass flow continues (no IOU overlay)

### AC-7: IOU in SecondRight

**Given** I am in `Charleston(SecondRight)` stage
**When** all 4 players blind pass 3 tiles
**Then** IOU detection and resolution occur identically to FirstLeft
**And** after resolution, phase advances to `CourtesyAcross`

## Technical Details

### Commands (Frontend → Backend)

No special commands - standard `PassTiles` with `blind_pass_count: 3`:

```typescript
{
  PassTiles: {
    player: Seat,
    tiles: [],  // No tiles from hand
    blind_pass_count: 3  // Full blind pass
  }
}
```

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    IOUDetected: {
      debts: [
        [Seat.East, 3],
        [Seat.South, 3],
        [Seat.West, 3],
        [Seat.North, 3]
      ]
    }
  }
}

{
  kind: 'Public',
  event: {
    IOUResolved: {
      summary: "IOU resolved: Each player passed 1-2 tiles. East picked up final pass to resolve debts."
    }
  }
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/flow/charleston/mod.rs` - IOU detection and resolution
  - `crates/mahjong_core/src/event/public_events.rs` - `IOUDetected`, `IOUResolved` events
- **Game Design Doc**:
  - Section 2.2.5 (IOU Scenario - All Players Full Blind)

## Components Involved

- **`<IOUOverlay>`** - Modal overlay for IOU detection and resolution
- **`<IOUDiagram>`** - Visual representation of circular debt
- **`<BlindPassPanel>`** - Triggers IOU when all select 3 blind (from US-004)

**Component Specs:**

- `component-specs/presentational/IOUOverlay.md` (NEW)
- `component-specs/presentational/IOUDiagram.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/charleston-iou-first-left.md`** - IOU in FirstLeft stage
- **`tests/test-scenarios/charleston-iou-second-right.md`** - IOU in SecondRight stage
- **`tests/test-scenarios/charleston-iou-partial-blind.md`** - Partial blind (no IOU)

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/charleston-iou-detected.json`
- `tests/fixtures/events/charleston-iou-sequence.json`

**Sample IOU Event Sequence:**

```json
{
  "scenario": "IOU Detection and Resolution",
  "events": [
    {
      "kind": "Public",
      "event": {
        "IOUDetected": {
          "debts": [
            ["East", 3],
            ["South", 3],
            ["West", 3],
            ["North", 3]
          ]
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "IOUResolved": { "summary": "Each player passed 1-2 tiles. East picked up final pass." }
      }
    },
    {
      "kind": "Public",
      "event": { "CharlestonPhaseChanged": { "stage": "VotingToContinue" } }
    }
  ]
}
```

## Edge Cases

### EC-1: Only IOU on Full Blind

**Given** not all players blind pass 3
**Then** no IOU is triggered
**And** normal pass flow continues

### EC-2: IOU Only in FirstLeft and SecondRight

**Given** I am in FirstRight, FirstAcross, SecondLeft, or SecondAcross
**Then** blind pass is not available, so IOU cannot occur

### EC-3: IOU Resolution is Server-Side

**Given** IOU is detected
**Then** frontend does NOT calculate resolution
**And** frontend only displays server-provided summary

## Related User Stories

- **US-004**: Charleston First Left (Blind Pass) - IOU can occur here
- **US-006**: Charleston Second Charleston - IOU can occur in SecondRight

## Accessibility Considerations

### Keyboard Navigation

- **Enter/Space**: Dismiss IOU overlay after resolution
- **Escape**: Cannot dismiss during resolution (must wait)

### Screen Reader

- **Detection**: "IOU scenario detected. All players attempted to blind pass 3 tiles. Server is resolving IOU per NMJL rules."
- **Resolution**: "IOU resolved. Each player passed 1 to 2 tiles. East picked up final pass. Charleston continues."

### Visual

- **High Contrast**: IOU overlay has clear, high-contrast text
- **Diagram**: Visual representation of circular debt with arrows
- **Motion**: Respect `prefers-reduced-motion` for overlay animations

## Priority

**MEDIUM** - Edge case scenario, rare in practice

## Story Points / Complexity

**5** - Medium complexity

- Detection logic (frontend only displays overlay)
- Overlay UI with diagram
- Server-side resolution (frontend receives summary)
- Auto-dismiss after resolution
- Integration with FirstLeft and SecondRight flows

## Definition of Done

- [ ] `IOUDetected` event triggers IOU overlay
- [ ] Overlay displays explanation and loading state
- [ ] Circular debt diagram shown
- [ ] `IOUResolved` event updates overlay with summary
- [ ] Overlay auto-dismisses after 5 seconds
- [ ] Charleston advances to next phase after resolution
- [ ] IOU only triggers on full blind (all 4 players, 3 tiles each)
- [ ] IOU works in both FirstLeft and SecondRight
- [ ] Partial blind passes do not trigger IOU
- [ ] Component tests pass (IOUOverlay, IOUDiagram)
- [ ] Integration tests pass (IOU detection and resolution)
- [ ] E2E test passes (full IOU scenario)
- [ ] Accessibility tests pass
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### IOU Detection Logic (Server-Side)

Frontend does NOT implement detection. Server detects when all 4 players submit `blind_pass_count: 3`.

### IOU Overlay Component

```typescript
<IOUOverlay
  debts={event.debts}  // Array of [Seat, debt_count]
  summary={event.summary}  // Null until resolved
  onResolved={() => {
    setTimeout(() => dismissOverlay(), 5000);  // Auto-dismiss after 5s
  }}
/>
```

### IOU Diagram

Visual representation:

```
    East (3) ←──┐
      ↓          │
    South (3) ←──┤
      ↓          │
    West (3) ←───┤
      ↓          │
    North (3) ←──┘
```

All players owe each other 3 tiles in a circular pattern.

### Event Handling

```typescript
case 'IOUDetected':
  state.iouScenario = {
    active: true,
    debts: event.debts,
    resolved: false,
    summary: null
  };
  break;

case 'IOUResolved':
  state.iouScenario = {
    ...state.iouScenario,
    resolved: true,
    summary: event.summary
  };
  break;
```

### Instant Animation Mode

- IOU overlay appears/dismisses instantly (no fade)
- Diagram appears without animation
- Sound effects still play (if any)
