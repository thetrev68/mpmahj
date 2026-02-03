# Test Scenario: Charleston Second Charleston (Optional)

**User Story**: US-006 - Charleston Second Charleston (Optional)
**Fixtures**: `charleston-second-charleston.json`

## Setup

- Game state: Voting phase after First Left
- User seated as: East
- Player hand: 13 tiles (after First Left pass)

## Test Flow (Act & Assert)

### Happy Path: Vote Continue, Complete Second Charleston

1. **When**: Voting phase after First Left pass, user votes to continue
2. **Send**: `CharlestonVote { player: East, vote: Continue }`
3. **Receive**: `CharlestonVoteResolved { result: Continue }`
4. **Assert**: Vote recorded
5. **Receive**: `CharlestonPhaseChanged { stage: SecondRight }`
6. **Complete**: Second Right, Across, Left passes (each: select 3, PassTiles, receive tiles)
7. **Receive**: `PhaseChanged { to: Playing }`
8. **Assert**: Game advances to main gameplay

## Error Cases

### Error: Timer expiry during voting

- **When**: User does not vote within timeout
- **Expected**: Server auto-votes Continue
- **Receive**: `CharlestonVoteResolved { result: Continue }`
- **Assert**: Game proceeds with Second Charleston

### Error: Vote to stop Charleston

- **When**: User (and majority) vote Stop
- **Send**: `CharlestonVote { player: East, vote: Stop }`
- **Receive**: `CharlestonVoteResolved { result: Stop }`
- **Receive**: `PhaseChanged { to: Playing }`
- **Assert**: Charleston ends, game proceeds to main gameplay (no Second Charleston)

### Error: Jokers in Second pass

- **Send**: `PassTiles` with Joker during Second Across
- **Expected**: `CommandError::ContainsJokers`
- **Assert**: Hand unchanged

## Success Criteria

- ✅ Voted to continue Second Charleston
- ✅ Second Charleston completed (3 passes)
- ✅ Hand maintains 13 tiles throughout
- ✅ Game transitioned to Playing phase
- ✅ Event sequence correct (CharlestonVote → CharlestonVoteResolved → PassTiles → PhaseChanged)
