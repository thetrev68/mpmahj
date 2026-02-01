# US-015: Exchanging Joker (Multiple in One Turn)

## Story

**As a** player on my turn
**I want** to exchange multiple Jokers from exposed melds in a single turn
**So that** I can acquire multiple Jokers before discarding

## Acceptance Criteria

### AC-1: Multiple Exchange Opportunities

**Given** it is my turn (Discarding stage)
**When** multiple exposed melds contain exchangeable Jokers
**And** I have the matching tiles in my hand
**Then** all exchangeable Jokers are highlighted
**And** I can exchange them one at a time

### AC-2: Sequential Exchanges

**Given** I exchanged one Joker
**When** other exchangeable Jokers remain
**Then** those Jokers remain highlighted
**And** I can click on another to exchange it
**And** I repeat the exchange process (US-014)

### AC-3: Exchange Limit (Hand Size)

**Given** I have already exchanged 3 Jokers in this turn
**When** I still have matching tiles for additional Jokers
**Then** I can continue exchanging until I run out of matching tiles
**Note:** No arbitrary limit, only limited by hand contents

### AC-4: Discard After All Exchanges

**Given** I have exchanged all desired Jokers
**When** I am ready to complete my turn
**Then** I must select and discard a tile
**And** I cannot exchange more Jokers after discarding

## Technical Details

### Commands (Frontend → Backend)

Same as US-014, sent multiple times:

````typescript
{
  ExchangeJoker: {
    player: Seat,
    target_seat: Seat,
    meld_index: number,
    replacement: Tile
  }
}
```text

### Events (Backend → Frontend)

Multiple `JokerExchanged` events:

```typescript
{
  kind: 'Public',
  event: {
    JokerExchanged: {
      player: Seat,
      target_seat: Seat,
      joker: Tile,
      replacement: Tile
    }
  }
}
```text

### Backend References

- **Rust Code**: Same as US-014
- **Game Design Doc**: Section 3.4.2 (Multiple Joker Exchanges)

## Components Involved

- Same as US-014
- **`<ExchangeCounter>`** - Shows "X Jokers exchanged this turn"

**Component Specs:**

- Reuse US-014 specs

## Test Scenarios

- **`tests/test-scenarios/joker-exchange-multiple.md`**
- **`tests/test-scenarios/joker-exchange-sequential.md`**

## Edge Cases

### EC-1: No Limit on Exchanges

Can exchange as many Jokers as you have matching tiles.

### EC-2: Must Complete Turn

After exchanges, must still discard to complete turn.

### EC-3: Jokers Remain Available

After each exchange, re-scan for newly exchangeable Jokers (in case hand composition changed).

## Related User Stories

- **US-014**: Exchanging Joker (Single) - Base functionality
- **US-010**: Discarding a Tile - Must discard after exchanges

## Accessibility Considerations

### Keyboard Navigation

- **J Key**: Cycle through exchangeable Jokers
- **Enter**: Exchange focused Joker

### Screen Reader

- **Multiple**: "3 exchangeable Jokers available. 1 of 3 focused."
- **Exchanged**: "Exchanged 2 Jokers this turn. 1 more available."

### Visual

- **Counter**: Shows exchange count prominently

## Priority

**HIGH** - Important for advanced play

## Story Points / Complexity

**3** - Medium complexity (extends US-014)

## Definition of Done

- [ ] Multiple Jokers highlighted simultaneously
- [ ] Can exchange Jokers sequentially
- [ ] No limit on number of exchanges per turn
- [ ] Exchange counter shows count
- [ ] Must discard after exchanges to complete turn
- [ ] Re-scan for new opportunities after each exchange
- [ ] Component tests pass
- [ ] Integration tests pass
- [ ] E2E test passes (exchange 3+ Jokers in one turn)
- [ ] Code reviewed and approved

## Notes for Implementers

### Exchange Counter UI

```typescript
{exchangeCount > 0 && (
  <ExchangeCounter count={exchangeCount} />
)}
```text

Display: "2 Jokers exchanged this turn"

### Re-scan After Exchange

After each exchange, re-calculate exchangeable Jokers:

```typescript
function handleJokerExchanged() {
  setExchangeCount((prev) => prev + 1);
  // Re-scan for new opportunities
  const newOpportunities = findExchangeableJokers(exposedMelds, yourHand);
  setExchangeOpportunities(newOpportunities);
}
```text

### Zustand Store Updates

```typescript
case 'JokerExchanged':
  // Same as US-014, but also increment counter
  state.jokerExchangeCount += 1;
  break;

case 'TileDiscarded':
  // Reset counter when turn ends
  state.jokerExchangeCount = 0;
  break;
```text

```text

```text
````
