# US-006: Charleston Second Charleston (Optional)

## Story

**As a** player in any seat
**I want** to participate in a second Charleston (Left → Across → Right passes) after voting to continue
**So that** I can further refine my hand through additional tile exchanges

## Acceptance Criteria

### AC-1: Second Charleston Initiation (After Continue Vote)

**Given** all 4 players voted "Continue" in the voting phase
**When** the server emits `CharlestonPhaseChanged { stage: SecondLeft }`
**Then** the Charleston tracker displays "Second Charleston: Pass Left ← (Blind Pass Available)"
**And** a timer starts (default: 60 seconds)
**And** the second Charleston indicator shows "2nd Charleston - Pass 1 of 3"
**And** my hand becomes interactive for tile selection
**And** the blind pass panel appears (same as FirstLeft)

### AC-2: Second Left Pass (Mirror of FirstLeft)

**Given** I am in the `Charleston(SecondLeft)` stage
**When** I select tiles to pass (standard or blind pass options)
**Then** the selection logic is identical to US-004 (Charleston First Left)
**And** I can choose 0-3 blind pass tiles + remaining from hand (total 3)
**And** Jokers are blocked from hand selection
**And** IOU detection applies if all 4 players blind pass 3

### AC-3: Second Across Pass

**Given** Second Left pass has completed
**When** the server emits `CharlestonPhaseChanged { stage: SecondAcross }`
**Then** the Charleston tracker displays "Second Charleston: Pass Across ↔"
**And** the second Charleston indicator shows "2nd Charleston - Pass 2 of 3"
**And** the selection logic is identical to US-003 (Charleston First Across)
**And** I select 3 tiles from hand (no blind pass option)
**And** tiles are exchanged with across partner

### AC-4: Second Right Pass

**Given** Second Across pass has completed
**When** the server emits `CharlestonPhaseChanged { stage: SecondRight }`
**Then** the Charleston tracker displays "Second Charleston: Pass Right → (Blind Pass Available)"
**And** the second Charleston indicator shows "2nd Charleston - Pass 3 of 3"
**And** the blind pass panel appears (same as SecondLeft)
**And** I can choose 0-3 blind pass tiles + remaining from hand (total 3)
**And** IOU detection applies if all 4 players blind pass 3

### AC-5: Second Charleston Completion

**Given** Second Right pass has completed
**When** all players have received their tiles
**Then** the server emits `CharlestonPhaseChanged { stage: CourtesyAcross }`
**And** the Charleston tracker displays "Courtesy Pass Negotiation"
**And** the courtesy pass negotiation UI appears (see US-007)

### AC-6: Direction Indicators for Second Charleston

**Given** I am in any Second Charleston stage
**Then** the direction indicators are:

- **SecondLeft**: Left arrow ← (opposite of FirstRight)
- **SecondAcross**: Bidirectional arrow ↔ (same as FirstAcross)
- **SecondRight**: Right arrow → (opposite of FirstLeft)

### AC-7: Bot Behavior in Second Charleston

**Given** one or more players are bots
**When** Second Charleston stages occur
**Then** bots use the same strategies as First Charleston
**And** bots auto-pass with delays (0.5-1.5s)
**And** bots may use blind pass strategies in SecondLeft and SecondRight

## Technical Details

### Commands (Frontend → Backend)

Same as First Charleston passes:

````typescript
// SecondLeft with blind pass
{
  PassTiles: {
    player: Seat,
    tiles: [Tile],
    blind_pass_count: 2
  }
}

// SecondAcross (standard)
{
  PassTiles: {
    player: Seat,
    tiles: [Tile, Tile, Tile],
    blind_pass_count: null
  }
}

// SecondRight with full blind
{
  PassTiles: {
    player: Seat,
    tiles: [],
    blind_pass_count: 3
  }
}
```text

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    CharlestonPhaseChanged: {
      stage: { Charleston: "SecondLeft" }  // or "SecondAcross", "SecondRight"
    }
  }
}

// All other events identical to First Charleston:
// - CharlestonTimerStarted
// - PlayerReadyForPass
// - BlindPassPerformed (SecondLeft, SecondRight only)
// - IOUDetected / IOUResolved (if applicable)
// - TilesPassing
```text

**Private Events (same as First Charleston):**

```typescript
{
  kind: 'Private',
  event: {
    TilesPassed: { player: Seat, tiles: [...] }
  }
}

{
  kind: 'Private',
  event: {
    TilesReceived: { player: Seat, tiles: [...], from: Some(Seat) }
  }
}
```text

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/flow/charleston/stage.rs` - SecondLeft, SecondAcross, SecondRight stages
  - `crates/mahjong_core/src/flow/charleston/mod.rs` - Charleston state machine
  - Commands and events are identical to First Charleston
- **Game Design Doc**:
  - Section 2.2.7 (Second Charleston - Optional)
  - Section 2.2.8 (Pass 4: Second Left)
  - Section 2.2.9 (Pass 5: Second Across)
  - Section 2.2.10 (Pass 6: Second Right)

## Components Involved

All components from US-002, US-003, US-004:

- **`<CharlestonTracker>`** - Shows "2nd Charleston - Pass X of 3"
- **`<CharlestonTimer>`** - 60s timer for each pass
- **`<BlindPassPanel>`** - For SecondLeft and SecondRight
- **`<TileSelectionPanel>`** - Tile selection logic
- **`<ConcealedHand>`** - Hand display with selection
- **`<ActionBar>`** - "Pass Tiles" button
- **`<PassAnimationLayer>`** - Directional animations
- **`<IOUOverlay>`** - If IOU triggered

**Component Specs:**

- All specs from US-002, US-003, US-004 apply
- `component-specs/presentational/CharlestonTracker.md` - Update to show "2nd Charleston" indicator

## Test Scenarios

- **`tests/test-scenarios/charleston-second-charleston-full.md`** - Complete 2nd Charleston (all 3 passes)
- **`tests/test-scenarios/charleston-second-left-blind.md`** - SecondLeft with blind pass
- **`tests/test-scenarios/charleston-second-right-iou.md`** - SecondRight IOU scenario
- Reuse test scenarios from US-002, US-003, US-004 with "Second" prefix

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/charleston-second-left.json`
- `tests/fixtures/game-states/charleston-second-across.json`
- `tests/fixtures/game-states/charleston-second-right.json`
- `tests/fixtures/events/charleston-second-charleston-sequence.json`

## Edge Cases

### EC-1: IOU in Second Charleston

**Given** all players blind pass 3 tiles in SecondLeft or SecondRight
**When** IOU is detected
**Then** the IOU resolution flow is identical to FirstLeft IOU
**And** the server emits `IOUDetected` and `IOUResolved` events

### EC-2: Timer Expiry in Second Charleston

**Given** timer expires in any Second Charleston stage
**Then** auto-pass behavior is identical to First Charleston
**And** 3 tiles from hand are auto-selected (or 0 blind + 3 hand)

### EC-3: Disconnection During Second Charleston

**Given** I disconnect during SecondAcross
**When** I reconnect
**Then** selection state is reset (same as First Charleston)
**And** timer continues from server time

### EC-4: Network Error During Second Charleston

**Given** network fails during tile pass submission
**Then** retry logic is identical to First Charleston
**And** max 3 retries with error messages

## Related User Stories

- **US-005**: Charleston Voting - Previous stage (Continue vote triggers Second)
- **US-007**: Courtesy Pass Negotiation - Next stage after SecondRight
- **US-002**: Charleston First Right - Similar logic for standard pass
- **US-003**: Charleston First Across - SecondAcross mirrors this
- **US-004**: Charleston First Left - SecondLeft and SecondRight mirror this

## Accessibility Considerations

### Keyboard Navigation

Same as US-002, US-003, US-004

### Screen Reader

- **Stage Announcement**: "Second Charleston, pass 1 of 3. Pass left. Select 3 tiles."
- **Pass Type**: "Second left pass with blind pass option available."
- **Progress**: "Second Charleston, pass 2 of 3. Pass across."

### Visual

- **Second Charleston Indicator**: Clear visual distinction (e.g., "2nd" badge or different color)
- **Progress Bar**: Shows 1/3, 2/3, 3/3 for Second Charleston passes
- All other accessibility features same as First Charleston

## Priority

**HIGH** - Optional but important Charleston feature

## Story Points / Complexity

**8** - High complexity

- Mirrors all First Charleston logic (3 passes)
- SecondLeft: blind pass + IOU (like FirstLeft)
- SecondAcross: standard pass (like FirstAcross)
- SecondRight: blind pass + IOU (like FirstLeft but right direction)
- Direction changes: Left → Across → Right (reverse of First)
- All selection, validation, animation, and bot logic applies
- Requires comprehensive testing of all 3 stages

## Definition of Done

- [ ] Charleston tracker shows "2nd Charleston - Pass X of 3"
- [ ] SecondLeft stage works with blind pass options (0-3)
- [ ] SecondAcross stage works with standard 3-tile selection
- [ ] SecondRight stage works with blind pass options (0-3)
- [ ] Direction indicators correct (← for Left, ↔ for Across, → for Right)
- [ ] IOU detection works in SecondLeft and SecondRight
- [ ] All animations show correct directions (left, across, right)
- [ ] Timer starts at 60s for each pass
- [ ] Bot auto-pass behavior works in all 3 stages
- [ ] Tiles received from correct partners (East→South→West→North→East for left, etc.)
- [ ] Hand auto-sorts after each pass
- [ ] Phase advances to CourtesyAcross after SecondRight completes
- [ ] Component tests pass (all Charleston components)
- [ ] Integration tests pass (full Second Charleston flow)
- [ ] E2E test passes (Continue vote → 3 Second passes → Courtesy)
- [ ] Accessibility tests pass (keyboard nav, screen reader)
- [ ] Visual regression tests pass (2nd Charleston indicator, direction arrows)
- [ ] IOU scenario tested in SecondLeft and SecondRight
- [ ] Timer expiry tested in all 3 stages
- [ ] Network error handling tested
- [ ] Manually tested against `user-testing-plan.md` (Part 3, Second Charleston)
- [ ] Code reviewed and approved
- [ ] Performance tested (no lag during 6 total passes)
- [ ] No console errors or warnings

## Notes for Implementers

### Second Charleston Sequence

The Second Charleston mirrors the First but with opposite directions:

**First Charleston**: Right → Across → Left
**Second Charleston**: Left → Across → Right

### Direction Calculation

```typescript
function getSecondCharlestonDirection(stage: CharlestonStage): PassDirection {
  switch (stage) {
    case 'SecondLeft':
      return 'Left'; // Opposite of FirstRight
    case 'SecondAcross':
      return 'Across'; // Same as FirstAcross
    case 'SecondRight':
      return 'Right'; // Opposite of FirstLeft
  }
}
```text

### Partner Calculation

```typescript
function getPartnerForStage(mySeat: Seat, stage: CharlestonStage): Seat {
  switch (stage) {
    case 'SecondLeft':
      // I receive from East (right), pass to South (left)
      return getLeftPartner(mySeat);
    case 'SecondAcross':
      return getAcrossPartner(mySeat);
    case 'SecondRight':
      // I receive from West (left), pass to North (right)
      return getRightPartner(mySeat);
  }
}
```text

### Blind Pass Availability

- **SecondLeft**: Blind pass available (last pass of sequence, like FirstLeft)
- **SecondAcross**: No blind pass (middle pass, like FirstAcross)
- **SecondRight**: Blind pass available (last pass of sequence, like FirstLeft)

### Reusing First Charleston Components

All components from US-002, US-003, US-004 can be reused:

```typescript
// SecondLeft uses FirstLeft logic with different direction
<CharlestonPassContainer
  stage="SecondLeft"
  direction="Left"
  allowBlindPass={true}
  charlestonNumber={2}  // Indicates 2nd Charleston
/>

// SecondAcross uses FirstAcross logic
<CharlestonPassContainer
  stage="SecondAcross"
  direction="Across"
  allowBlindPass={false}
  charlestonNumber={2}
/>

// SecondRight uses FirstLeft logic with different direction
<CharlestonPassContainer
  stage="SecondRight"
  direction="Right"
  allowBlindPass={true}
  charlestonNumber={2}
/>
```text

### Charleston Progress Indicator

```typescript
<CharlestonProgressIndicator
  charlestonNumber={2}
  stage={currentStage}
  passNumber={passNumber}  // 1, 2, or 3
  totalPasses={3}
/>
```text

Display: "2nd Charleston - Pass 1 of 3" → "2nd Charleston - Pass 2 of 3" → "2nd Charleston - Pass 3 of 3"

### Event Sequencing

Each Second Charleston pass follows the same event sequence as its First Charleston counterpart:

**SecondLeft** → Same as FirstLeft (TilesPassed, BlindPassPerformed, TilesPassing, TilesReceived)
**SecondAcross** → Same as FirstAcross (TilesPassed, TilesPassing, TilesReceived)
**SecondRight** → Same as FirstLeft (TilesPassed, BlindPassPerformed, TilesPassing, TilesReceived)

### Zustand Store Updates

No new store logic required - reuse First Charleston handlers:

```typescript
case 'CharlestonPhaseChanged':
  state.phase = { Charleston: event.stage };
  state.charlestonNumber = event.stage.startsWith('Second') ? 2 : 1;
  state.passNumber = getPassNumber(event.stage); // 1, 2, or 3
  break;
```text

### Testing Strategy

Test Second Charleston by:

1. Voting "Continue" in voting phase
2. Running through SecondLeft, SecondAcross, SecondRight
3. Verifying directions, partner calculations, animations
4. Testing IOU in SecondLeft and SecondRight
5. Ensuring all First Charleston test scenarios pass with "Second" stages

### Instant Animation Mode

Same instant animation behavior as First Charleston:

- Skip all animations
- Tiles instantly disappear/appear
- Sound effects still play
````
