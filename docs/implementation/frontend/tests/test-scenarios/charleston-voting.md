# Test Scenario: Charleston Stop Voting

**User Story**: US-005 - Charleston Voting to Stop/Continue
**Fixtures**: `charleston-voting.json`, `charleston-vote-sequence.json`

## Setup

- **Game state**: Load `fixtures/game-states/charleston-voting.json`
- **Mock WebSocket**: Connected
- **User seated as**: West
- **Player hand**: 13 tiles (after FirstLeft pass)
- **Charleston stage**: VotingToContinue
- **Time remaining**: 30 seconds
- **Other players**: East, South, North also voting

## Test Flow

1. User sees "Charleston: Vote to Continue" header
2. User sees two vote buttons: "Stop Charleston" (green) and "Continue to Second Charleston" (blue)
3. UI shows all players in waiting state (East/South/North: Waiting; West: You)
4. User clicks "Stop Charleston" button
5. WebSocket sends `VoteCharleston { vote: "Stop" }`
6. Vote buttons disabled, UI shows "West: Voted to Stop"
7. WebSocket receives `PlayerVoted { player: "East" }` - UI updates "East: Voted to Stop"
8. WebSocket receives `PlayerVoted { player: "South" }` - UI updates, progress "3/4 players voted"
9. WebSocket receives `PlayerVoted { player: "North" }` - UI updates "North: Voted to Stop"
10. WebSocket receives `VoteResult { result: "Stop" }`
11. UI shows overlay "Charleston stopped by unanimous vote"
12. WebSocket receives `PhaseChanged { phase: "Playing" }`
13. UI transitions to main game board

## Expected Outcome

- ✅ Successfully voted to stop Charleston
- ✅ All 4 players' votes collected
- ✅ Vote tally: 4-0 to stop
- ✅ Charleston ended, game proceeded to Playing phase
- ✅ WebSocket command/event sequence correct

## Error Cases

### One Player Votes Continue (Vote Fails)

- **When**: User and 2 others vote Stop, 1 votes Continue
- **Expected**: Charleston still stops (unanimous Continue required)
- **Assert**: `VoteResult { result: "Stop" }`, UI shows "Not all players agreed to continue"

### Timer Expiry Before All Votes

- **When**: Only 2 players vote; 2 players timeout
- **Expected**: Server auto-votes "Stop" for non-voters
- **Assert**: `PlayerVoted` events emitted, UI shows auto-votes

### WebSocket Disconnect After Voting

- **When**: Connection lost after vote but before result received
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**: On reconnect, vote preserved on server

### Alternate: Unanimous Continue Vote

1. User clicks "Continue to Second Charleston" instead
2. WebSocket sends `VoteCharleston { vote: "Continue" }`
3. All other players vote Continue
4. WebSocket receives `VoteResult { result: "Continue" }`
5. UI shows "All players voted to continue!"
6. Charleston advances to SecondLeft stage
7. Assert: Second Charleston begins with SecondLeft pass
