# Test Scenario: Charleston Courtesy Pass

**User Story**: US-007 - Charleston Courtesy Pass Negotiation
**Fixtures**: `charleston-courtesy.json`, `courtesy-pass-sequence.json`

## Setup

- **Game state**: Load `fixtures/game-states/charleston-courtesy.json`
- **Mock WebSocket**: Connected
- **User seated as**: East (dealer)
- **Player hand**: 13 tiles (after Second Charleston)
- **Charleston stage**: CourtesyAcross
- **Time remaining**: 30 seconds
- **Opponent**: West (player across)

## Test Flow

1. User sees "Charleston: Courtesy Pass" header with "Skip Courtesy Pass" and "Pass 1-3 Tiles" buttons
2. User clicks "Pass 1-3 Tiles" button
3. UI shows "Select 1-3 tiles to pass across" with counter "0/3 tiles selected (min: 0)"
4. User selects tile at index 2 - Counter: "1/3 tiles selected"
5. User selects tile at index 7 - Counter: "2/3 tiles selected"
6. User clicks "Confirm Courtesy Pass" button
7. WebSocket sends `ProposeCourtesyPass { tile_count: 2 }`
8. UI shows "Waiting for West to decide..." spinner
9. WebSocket receives `CourtesyPassProposed { player: "West", tile_count: 0 }`
10. WebSocket receives `CourtesyPassMismatch { pair: (East, West), proposed: (2, 0), agreed_count: 0 }`
11. UI shows "West declined courtesy pass"
12. No tiles exchanged, hand still 13 tiles
13. WebSocket receives `CourtesyPassComplete` event
14. WebSocket receives `PhaseChanged { phase: "Playing" }`
15. UI transitions to main game board

## Expected Outcome

- ✅ Successfully proposed courtesy pass (2 tiles)
- ✅ Opponent declined
- ✅ Hand remained at 13 tiles (no exchange)
- ✅ Charleston ended, game transitioned to Playing
- ✅ WebSocket command/event sequence correct

## Error Cases

### Both Players Skip

- **When**: User clicks "Skip Courtesy Pass"
- **Expected**: WebSocket sends `ProposeCourtesyPass { tile_count: 0 }`
- **Assert**: Charleston ends immediately if both skip

### Attempting to Pass Jokers

- **When**: User selects a Joker during courtesy pass
- **Expected**: Joker tile disabled, cannot be selected
- **Assert**: Joker tiles have `disabled` attribute

### Timer Expiry During Selection

- **When**: User selects 2 tiles but doesn't confirm within 30 seconds
- **Expected**: Server auto-skips or auto-confirms
- **Assert**: UI shows "Auto-passed due to timeout" or "Auto-skipped"

### Alternate: Successful Mutual Exchange

1. User proposes 2 tiles
2. WebSocket receives `CourtesyPairReady { pair: (East, West), tile_count: 2 }`
3. User sends `AcceptCourtesyPass` with 2 tiles
4. WebSocket receives `TilesReceived { player: "East", tiles: [...] }`
5. UI removes 2 passed tiles, adds 2 received
6. Hand returns to 13 tiles
7. Assert: Mutual courtesy pass successful
