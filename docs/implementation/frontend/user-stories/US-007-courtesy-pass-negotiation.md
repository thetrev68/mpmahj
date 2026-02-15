# US-007: Courtesy Pass Negotiation

## Story

**As a** player in any seat
**I want** to negotiate a courtesy pass with my across partner (0-3 tiles) after Charleston completes
**So that** I can make one final optional tile exchange before main gameplay begins

## Acceptance Criteria

### AC-1: Courtesy Pass Phase Entry

**Given** the Charleston has completed (either after FirstLeft or SecondRight)
**When** the server emits `CharlestonPhaseChanged { stage: CourtesyAcross }`
**Then** the Charleston tracker displays "Courtesy Pass Negotiation"
**And** a timer starts (default: 30 seconds)
**And** a courtesy pass panel appears with options: 0, 1, 2, or 3 tiles
**And** a message displays: "Negotiate with across partner - select 0-3 tiles"
**And** my hand becomes interactive for tile selection (but selection is pending negotiation)

### AC-2: Proposing Courtesy Pass Count

**Given** I am in the `Charleston(CourtesyAcross)` stage
**When** I select a tile count (0, 1, 2, or 3) from the courtesy pass panel
**Then** a `ProposeCourtesyPass { player: me, tile_count: N }` command is sent
**And** the panel shows a loading state
**And** a message appears: "Proposed N tiles. Waiting for [AcrossPartner]..."

### AC-3: Both Partners Propose Same Count (Agreement)

**Given** I proposed 2 tiles and my across partner also proposed 2 tiles
**When** the server emits `CourtesyPairReady { pair: (me, across), tile_count: 2 }`
**Then** the negotiation UI dismisses
**And** a message appears: "Agreed to pass 2 tiles with [AcrossPartner]"
**And** my hand becomes interactive for tile selection
**And** the selection counter shows "0/2 selected"
**And** the "Pass Tiles" button appears (disabled until 2 selected)

### AC-4: Partners Propose Different Counts (Mismatch - Lower Wins)

**Given** I proposed 3 tiles and my across partner proposed 1 tile
**When** the server emits `CourtesyPassMismatch { pair: (me, across), proposed: (3, 1), agreed_count: 1 }`
**Then** a message appears: "Mismatch! You proposed 3, [Partner] proposed 1. Agreed on 1 tile (lower count wins)"
**And** my hand becomes interactive for tile selection
**And** the selection counter shows "0/1 selected"
**And** the "Pass Tiles" button appears (disabled until 1 selected)

### AC-5: Proposing Zero Tiles (No Exchange)

**Given** I proposed 0 tiles
**When** my across partner also proposed 0 tiles
**Then** the server emits `CourtesyPairReady { pair: (me, across), tile_count: 0 }`
**And** a message appears: "No courtesy pass with [AcrossPartner]"
**And** I skip tile selection
**And** I wait for other pairs to complete their exchanges

**Given** I proposed 0 tiles and my across partner proposed 2 tiles
**Then** the server emits `CourtesyPassMismatch { pair: (me, across), proposed: (0, 2), agreed_count: 0 }`
**And** a message appears: "No courtesy pass (you proposed 0)"
**And** I skip tile selection

### AC-6: Tile Selection After Agreement

**Given** my across partner and I agreed on 2 tiles
**When** I select 2 tiles from my hand
**Then** the tiles are visually highlighted (raised 10px, yellow border)
**And** the selection counter shows "2/2 selected"
**And** the "Pass Tiles" button becomes enabled
**And** Jokers are blocked from selection (same as Charleston)

### AC-7: Pass Submission

**Given** I have selected the agreed number of tiles
**When** I click the "Pass Tiles" button
**Then** a `AcceptCourtesyPass { player: me, tiles: [...] }` command is sent
**And** the button shows a loading state
**And** my hand becomes non-interactive
**And** a message appears: "Waiting for [AcrossPartner]..."

### AC-8: Tiles Exchange (Across Only)

**Given** both I and my across partner submitted our tiles
**When** the server emits `TilesPassing { direction: Across }`
**Then** a brief animation shows tiles moving between across partners (0.6s bidirectional)

**When** the server emits `TilesReceived { player: me, tiles: [...], from: Some(across) }`
**Then** the received tiles slide into my hand (0.3s)
**And** my hand auto-sorts
**And** my tile count remains 13
**And** newly received tiles are briefly highlighted (2s)

### AC-9: Other Pair Completes Independently

**Given** I (South) and my across partner (North) are negotiating
**When** the other pair (East-West) completes their courtesy pass first
**Then** I see a message: "East and West completed courtesy pass (2 tiles)"
**And** I continue my negotiation/selection independently
**And** the phase does not advance until ALL pairs complete

### AC-10: Courtesy Pass Completion

**Given** both pairs (East-West and South-North) have completed their courtesy passes
**When** the server emits `CourtesyPassComplete`
**Then** the Charleston tracker updates to "Charleston Complete"
**And** the server emits `CharlestonComplete`
**And** the phase advances to `Playing`
**And** a message appears: "Charleston complete. Main game starting..."

### AC-11: Timer Expiry (Auto-Propose 0)

**Given** the timer reaches 0 and I haven't proposed a count
**When** timeout occurs
**Then** an automatic proposal of 0 tiles is sent
**And** a message appears: "Time expired - auto-proposed 0 tiles (no courtesy pass)"

### AC-12: Bot Behavior

**Given** my across partner is a bot
**When** the courtesy pass negotiation begins
**Then** the bot automatically proposes a count (0-3) after a delay (0.5-1.5s)
**And** the bot's strategy:

- **Basic**: Always 0 (no courtesy pass)
- **Easy**: Random 0-2
- **Medium**: Based on hand analysis (if needs specific tiles, propose 1-3)
- **Hard**: Strategic analysis (evaluate expected value of courtesy pass)

## Technical Details

### Commands (Frontend → Backend)

```typescript
// Propose tile count
{
  ProposeCourtesyPass: {
    player: Seat,
    tile_count: 2  // 0, 1, 2, or 3
  }
}

// Submit tiles after agreement
{
  AcceptCourtesyPass: {
    player: Seat,
    tiles: [Tile, Tile]  // Must match agreed_count
  }
}
```

### Events (Backend → Frontend)

**Private Events (pair-scoped):**

```typescript
{
  kind: 'Private',
  event: {
    CourtesyPassProposed: {
      player: Seat,  // The proposer
      tile_count: 2
    }
  }
}

{
  kind: 'Private',
  event: {
    CourtesyPassMismatch: {
      pair: [Seat, Seat],  // E.g., [South, North]
      proposed: [3, 1],    // Each partner's proposal
      agreed_count: 1      // Lower count wins
    }
  }
}

{
  kind: 'Private',
  event: {
    CourtesyPairReady: {
      pair: [Seat, Seat],
      tile_count: 2  // Agreed count
    }
  }
}

{
  kind: 'Private',
  event: {
    TilesPassed: {
      player: Seat,
      tiles: [Tile, Tile]
    }
  }
}

{
  kind: 'Private',
  event: {
    TilesReceived: {
      player: Seat,
      tiles: [Tile, Tile],
      from: Some(Seat)  // Across partner
    }
  }
}
```

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    CharlestonPhaseChanged: {
      stage: { Charleston: "CourtesyAcross" }
    }
  }
}

{
  kind: 'Public',
  event: {
    CharlestonTimerStarted: {
      stage: "CourtesyAcross",
      duration: 30,
      started_at_ms: 1706634240000,
      timer_mode: "Standard"
    }
  }
}

{
  kind: 'Public',
  event: {
    CourtesyPassComplete: {}
  }
}

{
  kind: 'Public',
  event: {
    CharlestonComplete: {}
  }
}

{
  kind: 'Public',
  event: {
    PhaseChanged: {
      phase: "Playing"
    }
  }
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `ProposeCourtesyPass`, `AcceptCourtesyPass`
  - `crates/mahjong_core/src/flow/charleston/mod.rs` - Courtesy pass logic
  - `crates/mahjong_core/src/event/private_events.rs` - Courtesy pass events (pair-private)
- **Game Design Doc**:
  - Section 2.2.11 (Courtesy Pass - Optional Across Exchange)

## Components Involved

- **`<CharlestonTracker>`** - Shows "Courtesy Pass Negotiation"
- **`<CourtesyPassPanel>`** - New component: tile count selector (0-3)
- **`<CourtesyNegotiationStatus>`** - New component: shows proposal status and mismatch messages
- **`<TileSelectionPanel>`** - Tile selection after agreement
- **`<ConcealedHand>`** - Hand display with selection
- **`<ActionBar>`** - "Pass Tiles" button
- **`<PassAnimationLayer>`** - Across direction animation

**Component Specs:**

- `component-specs/presentational/CourtesyPassPanel.md` (NEW)
- `component-specs/presentational/CourtesyNegotiationStatus.md` (NEW)
- `component-specs/container/TileSelectionPanel.md`

## Test Scenarios

- **`tests/test-scenarios/courtesy-pass-agreement.md`** - Both propose same count
- **`tests/test-scenarios/courtesy-pass-mismatch.md`** - Different counts, lower wins
- **`tests/test-scenarios/courtesy-pass-zero.md`** - One or both propose 0
- **`tests/test-scenarios/courtesy-pass-both-pairs.md`** - Two pairs complete independently

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/charleston-courtesy-pass.json`
- `tests/fixtures/events/courtesy-pass-agreement.json`
- `tests/fixtures/events/courtesy-pass-mismatch.json`

## Edge Cases

### EC-1: Mismatch Resolution (Lower Wins)

**Given** I propose 3 and partner proposes 1
**Then** agreed count is 1 (lower wins per NMJL rules)

### EC-2: Zero Proposal (No Exchange)

**Given** either partner proposes 0
**Then** agreed count is 0 and tile selection is skipped

### EC-3: Timer Expiry

**Given** timer expires before I propose
**Then** auto-propose 0 tiles (no courtesy pass)

### EC-4: Invalid Tile Count in AcceptCourtesyPass

**Given** I agreed to 2 tiles but submit 3 tiles
**Then** server rejects with error: "Tile count must match agreed count (2)"

### EC-5: Pair Independence

**Given** East-West complete before South-North
**Then** each pair operates independently
**And** phase advances only when both pairs complete

## Related User Stories

- **US-004**: Charleston First Left - Previous stage (if no Second Charleston)
- **US-006**: Charleston Second Charleston - Previous stage (if Second Charleston occurred)
- **US-009**: Drawing a Tile - Next stage (main game starts)

## Accessibility Considerations

### Keyboard Navigation

- **0-3 Number Keys**: Shortcut for proposing 0, 1, 2, or 3 tiles
- **Tab**: Navigate tile count buttons
- **Arrow Keys**: Navigate between tiles after agreement
- **Space/Enter**: Toggle tile selection

### Screen Reader

- **Negotiation**: "Courtesy pass negotiation. Select 0 to 3 tiles to propose to across partner."
- **Proposal**: "You proposed 2 tiles. Waiting for across partner's proposal."
- **Agreement**: "Agreement reached. You and North will pass 2 tiles."
- **Mismatch**: "Mismatch. You proposed 3, North proposed 1. Agreed on 1 tile."

### Visual

- **High Contrast**: Tile count buttons have clear borders
- **Color-Blind**: Use numbers and text, not just colors
- **Motion**: Respect `prefers-reduced-motion` for tile animations

## Priority

**HIGH** - Optional Charleston feature, commonly used

## Story Points / Complexity

**8** - High complexity

- Pair-based negotiation (2 independent pairs)
- Proposal/agreement/mismatch logic
- Variable tile count (0-3)
- Pair-private events (not visible to other pair)
- Synchronization (both pairs must complete)
- Lower-wins rule for mismatches
- Timer and bot behavior

## Definition of Done

- [ ] Charleston tracker shows "Courtesy Pass Negotiation"
- [ ] Timer starts at 30 seconds
- [ ] Tile count selector (0-3) appears
- [ ] User can propose tile count
- [ ] `ProposeCourtesyPass` command sent
- [ ] `CourtesyPairReady` event on agreement (same count)
- [ ] `CourtesyPassMismatch` event on mismatch (lower wins)
- [ ] Tile selection UI appears after agreement with correct count
- [ ] Jokers blocked from selection
- [ ] `AcceptCourtesyPass` command sent with tiles
- [ ] Tiles animate across to partner
- [ ] Received tiles added to hand and highlighted
- [ ] Hand auto-sorts
- [ ] Both pairs operate independently
- [ ] `CourtesyPassComplete` advances to main game
- [ ] Timer expiry auto-proposes 0
- [ ] Bot behavior works (strategy-based proposals)
- [ ] Component tests pass
- [ ] Integration tests pass (agreement, mismatch, zero)
- [ ] E2E test passes (both pairs complete)
- [ ] Accessibility tests pass
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### Across Partner Calculation

```typescript
function getAcrossPartner(seat: Seat): Seat {
  return {
    [Seat.East]: Seat.West,
    [Seat.South]: Seat.North,
    [Seat.West]: Seat.East,
    [Seat.North]: Seat.South,
  }[seat];
}
```

### Lower-Wins Rule

```typescript
function resolveCourtesyCount(count1: number, count2: number): number {
  return Math.min(count1, count2);
}
```

### Pair-Private Events

Events like `CourtesyPassMismatch` are visible only to the two players in the pair:

```typescript
if (event.kind === 'Private' && event.event.CourtesyPassMismatch) {
  const { pair, proposed, agreed_count } = event.event.CourtesyPassMismatch;
  if (pair.includes(mySeat)) {
    // Show mismatch message
    showCourtesyMismatch(proposed, agreed_count);
  }
}
```

### Bot Strategy

```typescript
function getBotCourtesyProposal(hand: Tile[], difficulty: BotDifficulty): number {
  switch (difficulty) {
    case 'Basic':
      return 0; // Never courtesy pass
    case 'Easy':
      return randomInt(0, 2);
    case 'Medium':
      // If hand needs specific tiles, propose 1-3
      return analyzeHandNeedsCourtesy(hand) ? randomInt(1, 3) : 0;
    case 'Hard':
      return evaluateCourtesyPassEV(hand); // Expected value calculation
  }
}
```

### Event Sequencing

Courtesy pass sequence (per pair):

1. `CharlestonPhaseChanged { stage: CourtesyAcross }`
2. `ProposeCourtesyPass { player, tile_count }`
3. **If agreement**: `CourtesyPairReady { pair, tile_count }`
4. **If mismatch**: `CourtesyPassMismatch { pair, proposed, agreed_count }`
5. **If agreed_count > 0**:
   - Select tiles
   - `AcceptCourtesyPass { player, tiles }`
   - `TilesPassed { player, tiles }` (private)
   - `TilesPassing { direction: Across }` (public, but may be per-pair)
   - `TilesReceived { player, tiles, from }` (private)
6. When both pairs complete: `CourtesyPassComplete` → `CharlestonComplete` → `PhaseChanged { Playing }`

### Instant Animation Mode

- Skip all tile movement animations
- Proposals and agreements appear instantly
- Sound effects still play
