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

## Test Flow (Act & Assert)

1. **When**: Charleston FirstLeft pass completes, voting phase begins
2. **Receive**: `CharlestonPhaseChanged { stage: VotingToContinue }`
3. **User votes**: Stop Charleston
4. **Send**: `VoteCharleston { player: West, vote: Stop }`
5. **Receive**: `CharlestonVoteRegistered { player: West, vote: Stop }`
6. **Receive**: `CharlestonVoteRegistered { player: East, vote: Stop }`
7. **Receive**: `CharlestonVoteRegistered { player: South, vote: Stop }`
8. **Receive**: `CharlestonVoteRegistered { player: North, vote: Stop }`
9. **Assert**: All 4 players voted Stop
10. **Receive**: `CharlestonVoteResolved { result: Stop, tally: { stop: 4, continue: 0 } }`
11. **Receive**: `PhaseChanged { phase: Playing }`
12. **Assert**: Charleston ended, main game begins

## Success Criteria

- ✅ VoteCharleston command sent by user
- ✅ CharlestonVoteRegistered events received for all 4 players
- ✅ CharlestonVoteResolved event shows unanimous Stop vote
- ✅ PhaseChanged event transitions to Playing phase
- ✅ Charleston skipped (no Second Charleston)

## Error Cases

### Non-Unanimous Vote (One Player Votes Continue)

- **When**: West, East, South vote Stop; North votes Continue
- **Receive**: `CharlestonVoteResolved { result: Stop, tally: { stop: 3, continue: 1 } }`
- **Assert**: Charleston stops (unanimous Continue required to proceed to Second Charleston)
- **Receive**: `PhaseChanged { phase: Playing }`

### Timer Expiry Before All Votes

- **When**: Only 2 players vote within time limit, 2 timeout
- **Expected**: Server auto-votes Stop for non-voters
- **Receive**: `CharlestonVoteRegistered { player: [timed_out], vote: Stop, auto: true }`
- **Assert**: Vote completes with auto-votes counted

### Disconnect During Voting

- **When**: Connection lost after sending VoteCharleston
- **Expected**: Vote preserved on server
- **Assert**: On reconnect, receive CharlestonVoteResolved with final result

### Alternate: Unanimous Continue Vote

- **When**: All 4 players vote Continue
- **Send**: `VoteCharleston { player: West, vote: Continue }`
- **Receive**: `CharlestonVoteResolved { result: Continue, tally: { stop: 0, continue: 4 } }`
- **Receive**: `CharlestonPhaseChanged { stage: SecondLeft }`
- **Assert**: Second Charleston begins with SecondLeft pass
