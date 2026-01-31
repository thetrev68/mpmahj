# US-014: Exchanging Joker (Single)

## Story

**As a** player on my turn
**I want** to exchange a Joker from another player's exposed meld with a matching tile from my hand
**So that** I can acquire a Joker to use as a wild tile in my hand

## Acceptance Criteria

### AC-1: Joker Exchange Opportunity

**Given** it is my turn and I am in the `Discarding` stage
**When** another player has an exposed meld containing a Joker
**And** I have the matching tile in my hand (the tile the Joker represents)
**Then** the Joker in their meld is highlighted as "exchangeable"
**And** a visual indicator appears: "Click to exchange Joker"

### AC-2: Initiate Exchange

**Given** I have Dot5 in my hand
**When** South has an exposed Pung with [Dot5, Dot5, Joker]
**And** I click on the Joker in South's meld
**Then** a confirmation dialog appears: "Exchange your 5 Dots for this Joker?"
**And** my Dot5 tile is highlighted in my hand

### AC-3: Confirm Exchange

**Given** the exchange confirmation dialog is open
**When** I click "Confirm Exchange"
**Then** a `ExchangeJoker { player: me, target_seat: South, meld_index: 0, replacement: Dot5 }` command is sent
**And** the dialog shows a loading state

### AC-4: Exchange Complete

**Given** I sent the `ExchangeJoker` command
**When** the server emits `JokerExchanged { player: me, target_seat: South, joker: Joker, replacement: Dot5 }`
**Then** the Joker is removed from South's meld
**And** my Dot5 tile is inserted into South's meld in the Joker's position
**And** the Joker is added to my hand
**And** my Dot5 is removed from my hand
**And** an animation plays (Joker slides from meld to my hand, Dot5 slides from hand to meld, 0.5s)
**And** a message appears: "Exchanged 5 Dots for Joker from South's meld"

### AC-5: Exchange Before Discard

**Given** I exchanged a Joker
**When** the exchange completes
**Then** I am still in the `Discarding` stage
**And** I can exchange additional Jokers if available (see US-015)
**And** I must still discard a tile to complete my turn

### AC-6: Cannot Exchange During Drawing

**Given** it is my turn and I am in the `Drawing` stage
**When** I try to click on an exchangeable Joker
**Then** the Joker is not clickable
**And** a tooltip appears: "Can only exchange Jokers after drawing"

### AC-7: Bot Joker Exchange

**Given** it is a bot's turn
**When** the bot has a matching tile and can exchange a Joker
**Then** the bot evaluates whether to exchange based on strategy
**And** bots (Medium/Hard) prioritize acquiring Jokers
**And** the bot sends `ExchangeJoker` command if beneficial

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  ExchangeJoker: {
    player: Seat,
    target_seat: Seat,     // Player whose meld has the Joker
    meld_index: 0,         // Index in target's exposed melds
    replacement: Tile      // My matching tile
  }
}
```

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    JokerExchanged: {
      player: Seat,          // Who initiated exchange
      target_seat: Seat,     // Whose meld was affected
      joker: Tile,           // Joker tile
      replacement: Tile      // Replacement tile
    }
  }
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `ExchangeJoker`
  - `crates/mahjong_core/src/event/public_events.rs` - `JokerExchanged`
- **Game Design Doc**: Section 3.4 (Joker Exchange)

## Components Involved

- **`<ExposedMeldsArea>`** - Shows exchangeable Jokers
- **`<JokerExchangeIndicator>`** - Highlights exchangeable Jokers
- **`<ExchangeConfirmationDialog>`** - Confirmation dialog
- **`<ExchangeAnimationLayer>`** - Swap animation

**Component Specs:**

- `component-specs/presentational/JokerExchangeIndicator.md` (NEW)
- `component-specs/presentational/ExchangeConfirmationDialog.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/joker-exchange-single.md`**
- **`tests/test-scenarios/joker-exchange-validation.md`**
- **`tests/test-scenarios/joker-exchange-bot.md`**

## Edge Cases

### EC-1: Must Have Matching Tile

Can only exchange if I have the exact tile the Joker represents in the meld.

### EC-2: Only During Discarding Stage

Cannot exchange during Drawing stage.

### EC-3: Can Exchange Multiple (See US-015)

Can exchange multiple Jokers in one turn before discarding.

### EC-4: Cannot Exchange Pair Jokers

Some patterns allow Joker pairs; those cannot be exchanged per NMJL rules.

## Related User Stories

- **US-013**: Calling Pung/Kong/Quint - Exposes melds with Jokers
- **US-015**: Exchanging Joker (Multiple) - Multiple exchanges in one turn

## Accessibility Considerations

### Keyboard Navigation

- **J Key**: Focus on exchangeable Jokers
- **Enter**: Initiate exchange
- **Escape**: Cancel exchange dialog

### Screen Reader

- **Exchangeable**: "Joker in South's meld is exchangeable with your 5 Dots."
- **Exchanged**: "Exchanged your 5 Dots for Joker from South's meld."

### Visual

- **High Contrast**: Exchangeable Jokers have pulsing border
- **Animation**: Swap animation clearly shows tile movement

## Priority

**HIGH** - Important strategic mechanic

## Story Points / Complexity

**5** - Medium-High complexity

- Detect exchangeable Jokers
- Confirmation dialog
- Exchange animation
- Meld update logic
- Multiple meld types

## Definition of Done

- [ ] Exchangeable Jokers highlighted during Discarding stage
- [ ] Click Joker opens confirmation dialog
- [ ] Confirm sends `ExchangeJoker` command
- [ ] `JokerExchanged` event updates meld and hand
- [ ] Swap animation plays
- [ ] Joker added to my hand
- [ ] Replacement tile added to target's meld
- [ ] Still in Discarding stage after exchange
- [ ] Can exchange multiple times (US-015)
- [ ] Bot exchange behavior works
- [ ] Component tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Accessibility tests pass
- [ ] Code reviewed and approved

## Notes for Implementers

### Detecting Exchangeable Jokers

```typescript
function findExchangeableJokers(
  exposedMelds: Record<Seat, Meld[]>,
  myHand: Tile[]
): ExchangeOpportunity[] {
  const opportunities = [];
  for (const [seat, melds] of Object.entries(exposedMelds)) {
    melds.forEach((meld, index) => {
      meld.tiles.forEach((tile, tileIndex) => {
        if (tile === 'Joker') {
          const representedTile = meld.getRepresentedTile(tileIndex);
          if (myHand.includes(representedTile)) {
            opportunities.push({
              targetSeat: seat,
              meldIndex: index,
              tileIndex,
              representedTile,
            });
          }
        }
      });
    });
  }
  return opportunities;
}
```

### Exchange Animation

```typescript
<ExchangeAnimation
  jokerFrom={targetMeldPosition}
  jokerTo={myHandPosition}
  replacementFrom={myHandPosition}
  replacementTo={targetMeldPosition}
  duration={500}
  onComplete={() => {
    updateMeld(targetSeat, meldIndex, replacement);
    addTileToHand(joker);
    removeTileFromHand(replacement);
  }}
/>
```

### Zustand Store Updates

```typescript
case 'JokerExchanged':
  if (event.player === mySeat) {
    state.yourHand = state.yourHand.filter(t => t !== event.replacement);
    state.yourHand.push('Joker');
    state.yourHand = sortHand(state.yourHand);
  }
  state.exposedMelds[event.target_seat][meldIndex].replaceTile('Joker', event.replacement);
  break;
```
