# Test Scenario: Timer Expiry - Auto-Action on Timeout

**User Story**: US-036 - Timer Configuration
**Fixtures**: `playing-user-turn.json`, `timer-expiry-discard.json`

## Setup (Arrange)

- Game state: Playing phase, Discarding stage
- User seated as: North (seat 2)
- User has 14 tiles (just drew)
- Turn timer: 30 seconds configured
- No user interaction during countdown

## Test Flow (Act & Assert)

### Happy Path: Timer Expires, Auto-Discard Occurs

1. **Receive**: `TurnChanged { player: North, stage: Discarding, time_limit: 30 }`
2. **Timer starts**: Client begins countdown from 30 seconds
3. **User does not act**: No tile selected, no DiscardTile command sent
4. **Timer reaches 0**: Client timer expires locally
5. **Server timer expires**: Server detects timeout for player North
6. **Server auto-action**: Selects random non-Joker tile from hand
7. **Receive**: `TileDiscarded { player: North, tile: 4, auto_action: true }`
8. **Assert**:
   - Tile removed from hand (14 → 13 tiles)
   - Discard event flagged as auto_action
   - No user command was sent
9. **Receive**: `TurnChanged { player: East, stage: Drawing }`
10. **Assert**: Turn advanced to next player

## Success Criteria

- ✅ Turn timer starts when TurnChanged received
- ✅ Timer counts down for configured duration (30s)
- ✅ Server auto-discards tile when timer expires
- ✅ TileDiscarded event received with auto_action flag
- ✅ Hand updated correctly (tile removed)
- ✅ Turn advances to next player
- ✅ No client command required (server autonomous action)

## Error Cases

### User Acts at Last Second (Race Condition)

- **When**: Timer at 1s, user sends DiscardTile command
- **Expected**: Server receives command before timeout (0.5s remaining)
- **Assert**: User's chosen tile discarded, NOT auto-selected
- **Receive**: `TileDiscarded { tile: [user_choice], auto_action: false }`
- **Note**: Server timestamp is authoritative, not client timer

### Network Delay - Command Arrives After Expiry

- **When**: User clicks discard at 2s, network lag delays command
- **Expected**: Server timer expires first, executes auto-discard
- **Receive**: `TileDiscarded { auto_action: true }`
- **Assert**: Late command rejected, auto-action stands
- **Note**: Server shows "action not received in time" message

### Timer Display Desync (Client vs Server)

- **When**: Client shows "3s" but server already at "0s" (network lag)
- **Expected**: TileDiscarded event arrives while client still counting
- **Assert**: Client syncs to server reality, processes auto-discard
- **Note**: Events override local timer display

### Disconnect During Timer

- **When**: Timer at 15s, connection drops
- **Expected**: Server timer continues, auto-discards at 0s
- **Assert**: User reconnects, sees turn already advanced
- **Receive**: GameStateSnapshot showing next player's turn
- **Note**: Timer runs server-side, continues during disconnect

### Charleston Timer Variant

- **When**: Charleston FirstRight phase, timer expires
- **Expected**: Server auto-selects 3 random non-Joker tiles
- **Receive**: `TilesPassed { tiles: [auto-selected], auto_action: true }`
- **Assert**: Charleston pass completes automatically

### Call Window Timer Variant

- **When**: Call window open, timer expires without user action
- **Expected**: Treated as Pass (decline to call)
- **Receive**: `CallResolved { resolution: NoAction }` or another player's call
- **Assert**: Call opportunity lost, turn advances

## Technical Notes

**Server Timer Logic**:

- Timers are server-side only (authoritative)
- Client timer is for display/UX only
- Server commands have reception timestamps
- Auto-action triggered at server 0s, not client 0s

**Timer Durations** (configurable via room settings):

- Charleston: 60 seconds per pass
- Turn (discard): 30 seconds
- Call window: 10 seconds

**Auto-Action Strategy**:

- Discard: Random non-Joker tile
- Charleston: Random 3 non-Joker tiles
- Call window: Pass (no action)
