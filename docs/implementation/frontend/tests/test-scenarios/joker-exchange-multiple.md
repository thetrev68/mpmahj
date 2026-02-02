# Test Scenario: Exchanging Jokers (Multiple in One Turn)

**User Story**: US-014 (Exchanging Joker - Multiple)
**Component Specs**: JokerExchangeDialog.md, ActionBar.md
**Fixtures**: `playing-drawing.json`, `with-jokers.json`

## Setup (Arrange)

- User's turn, 14 tiles in hand, multiple exchange opportunities available.

## Steps (Act)

1. User exchanges one Joker from an exposed meld.
2. UI keeps "Exchange Joker" enabled (house rule/variant).
3. User performs a second exchange in the same turn.

## Expected Outcome (Assert)

- Two `ExchangeJoker` commands sent.
- Two `JokerExchanged` events received.
- User still must discard after exchanges.

## Error Cases

- If multiple exchanges are not allowed, ensure button disables after first exchange.
