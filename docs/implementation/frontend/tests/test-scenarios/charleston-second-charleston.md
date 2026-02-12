# Test Scenario: Charleston Second Charleston (Optional)

**User Story**: US-006 - Charleston Second Charleston (Optional)
**Fixtures**: `charleston-second-left.json`, `charleston-second-across.json`, `charleston-second-right.json`

## Setup

- Game state: Voting phase after First Left, all players voted Continue
- User seated as: East
- Player hand: 13 tiles (after First Charleston)

## Second Charleston Stage Order

**Second Charleston**: SecondLeft → SecondAcross → SecondRight → CourtesyAcross

## Test Flow (Act & Assert)

### Happy Path: Vote Continue, Complete Second Charleston

1. **When**: All players voted "Continue" in VotingToContinue stage
2. **Receive**: `CharlestonPhaseChanged { stage: SecondLeft }`
3. **Assert**: Tracker shows "Pass Left ←", "Blind Pass Available", "2nd Charleston – Pass 1 of 3"
4. **Act**: Select 3 tiles, click "Pass Tiles"
5. **Send**: `PassTiles { player: East, tiles: [t1, t2, t3], blind_pass_count: null }`
6. **Receive**: `TilesPassed`, `TilesReceived`

7. **Receive**: `CharlestonPhaseChanged { stage: SecondAcross }`
8. **Assert**: Tracker shows "Pass Across ↔", no BlindPassPanel, "2nd Charleston – Pass 2 of 3"
9. **Act**: Select 3 tiles, click "Pass Tiles"
10. **Send**: `PassTiles { player: East, tiles: [t1, t2, t3], blind_pass_count: null }`
11. **Receive**: `TilesPassed`, `TilesReceived`

12. **Receive**: `CharlestonPhaseChanged { stage: SecondRight }`
13. **Assert**: Tracker shows "Pass Right →", "Blind Pass Available", "2nd Charleston – Pass 3 of 3"
14. **Act**: Select 3 tiles, click "Pass Tiles"
15. **Send**: `PassTiles { player: East, tiles: [t1, t2, t3], blind_pass_count: null }`
16. **Receive**: `TilesPassed`, `TilesReceived`

17. **Receive**: `CharlestonPhaseChanged { stage: CourtesyAcross }`
18. **Assert**: Tracker shows "Courtesy Pass Negotiation", no BlindPassPanel, no "Pass Tiles" button

## Error Cases

### Error: Timer expiry during voting

- **When**: User does not vote within timeout
- **Expected**: Server auto-votes Continue
- **Receive**: `CharlestonVoteResolved { result: Continue }`
- **Assert**: Game proceeds with Second Charleston (SecondLeft first)

### Error: Vote to stop Charleston

- **When**: User (and majority) vote Stop
- **Send**: `CharlestonVote { player: East, vote: Stop }`
- **Receive**: `CharlestonVoteResolved { result: Stop }`
- **Receive**: `PhaseChanged { to: Playing }`
- **Assert**: Charleston ends, game proceeds to main gameplay (no Second Charleston)

### Error: Jokers in Second pass

- **Send**: `PassTiles` with Joker during SecondAcross
- **Expected**: `CommandError::ContainsJokers`
- **Assert**: Hand unchanged

## Success Criteria

- ✅ Voted to continue Second Charleston
- ✅ SecondLeft: Pass Left ← with blind pass option
- ✅ SecondAcross: Pass Across ↔ standard 3-tile
- ✅ SecondRight: Pass Right → with blind pass option
- ✅ Advances to CourtesyAcross with correct label (no pass button)
- ✅ Hand maintains 13 tiles throughout
- ✅ Event sequence correct (CharlestonVote → CharlestonVoteResolved → SecondLeft → SecondAcross → SecondRight → CourtesyAcross)
