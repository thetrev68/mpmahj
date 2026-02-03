# Test Scenario: Abandon Game (Consensus)

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-033 - Abandon Game (Consensus)
**Component Specs**: GameTable.md, AbandonVoteDialog.md, VotingPanel.md
**Fixtures**: `playing-mid-game.json`, `abandon-vote-sequence.json`
**Manual Test**: Manual Testing Checklist #33

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-mid-game.json`
- **Mock WebSocket**: Connected
- **User seated as**: East
- **Current turn**: South (not user's turn)
- **Game phase**: Playing (mid-game)
- **Player hand**: 13 tiles (standard hand, no winning patterns)
- **Discard pile**: 25 tiles
- **Exposed melds**: Each player has 1-2 exposed melds
- **Abandon vote**: Not in progress

## Steps (Act)

### Step 1: Verify game state

- UI shows Game table with:
  - All players' hands (concealed)
  - Discard pile with 25 tiles
  - Exposed melds for each player
  - Turn indicator: "South's turn"
  - "Request Abandon" button in toolbar or menu

### Step 2: User initiates abandon vote

- User clicks "Request Abandon" button
- Abandon Vote Dialog slides in from center of screen
- UI shows Abandon Vote Dialog with:
  - **Header**: "Request Game Abandonment"
  - **Message**: "Do you want to request to abandon this game? All players must agree to abandon."
  - **Reason Input**: [Optional] (text input)
  - **Buttons**: "Request Vote", "Cancel"

### Step 3: User enters reason

- User clicks "Reason" input
- User types "Game is taking too long"
- Reason updates: "Game is taking too long"

### Step 4: User requests abandon vote

- User clicks "Request Vote" button
- WebSocket sends `RequestAbandonVote` command:
  - `reason: "Game is taking too long"`
- Abandon Vote Dialog shows spinner: "Requesting vote..."

### Step 5: Server initiates voting

- Server initiates abandon vote for all players
- WebSocket receives `AbandonVoteStarted` event:
  - `initiated_by: "East"`
  - `reason: "Game is taking too long"`
  - `voting_players: ["East", "South", "West", "North"]`
  - `time_remaining: 60` (seconds)
- Abandon Vote Dialog closes

### Step 6: Voting panel appears

- UI shows Voting Panel overlay:
  - **Header**: "Abandon Game Vote"
  - **Message**: "East requested to abandon the game. Reason: Game is taking too long"
  - **Votes**: "0/4 votes"
  - **Timer**: "60 seconds remaining"
  - **Buttons**: "Agree", "Disagree"
- User's vote: "Agree" (pre-selected since user initiated)

### Step 7: User confirms their vote

- User clicks "Agree" button
- WebSocket sends `CastAbandonVote` command:
  - `vote: "Agree"`
- Voting Panel updates:
  - Votes: "1/4 votes"
  - User's vote: "Agreed ✓"

### Step 8: Other players vote

- Simulated: South votes "Agree"
- WebSocket receives `AbandonVoteCast` event:
  - `player: "South"`
  - `vote: "Agree"`
- Voting Panel updates:
  - Votes: "2/4 votes"
  - South's vote: "Agreed ✓"

- Simulated: West votes "Disagree"
- WebSocket receives `AbandonVoteCast` event:
  - `player: "West"`
  - `vote: "Disagree"`
- Voting Panel updates:
  - Votes: "2/4 votes (1 Disagree)"
  - West's vote: "Disagreed ✗"

- Simulated: North votes "Agree"
- WebSocket receives `AbandonVoteCast` event:
  - `player: "North"`
  - `vote: "Agree"`
- Voting Panel updates:
  - Votes: "3/4 votes (1 Disagree)"
  - North's vote: "Agreed ✓"

### Step 9: Vote fails (not unanimous)

- Timer expires (60 seconds)
- Server checks vote results: 3 Agree, 1 Disagree
- Vote is not unanimous (West disagreed)
- WebSocket receives `AbandonVoteFailed` event:
  - `reason: "Vote not unanimous"`
  - `votes: { East: Agree, South: Agree, West: Disagree, North: Agree }`
- Voting Panel closes
- UI shows toast: "Abandon vote failed - not all players agreed"
- Game continues normally

### Step 10: User initiates another abandon vote

- Later in game, user clicks "Request Abandon" button
- Abandon Vote Dialog slides in
- User types "Connection issues for West"
- User clicks "Request Vote" button
- WebSocket sends `RequestAbandonVote` command:
  - `reason: "Connection issues for West"`

### Step 11: Server initiates second voting

- WebSocket receives `AbandonVoteStarted` event:
  - `initiated_by: "East"`
  - `reason: "Connection issues for West"`
  - `voting_players: ["East", "South", "West", "North"]`
  - `time_remaining: 60`
- Voting Panel appears again

### Step 12: All players vote "Agree"

- User clicks "Agree" button
- WebSocket sends `CastAbandonVote` command:
  - `vote: "Agree"`

- Simulated: South votes "Agree"
- WebSocket receives `AbandonVoteCast` event:
  - `player: "South"`
  - `vote: "Agree"`

- Simulated: West votes "Agree" (changed mind)
- WebSocket receives `AbandonVoteCast` event:
  - `player: "West"`
  - `vote: "Agree"`

- Simulated: North votes "Agree"
- WebSocket receives `AbandonVoteCast` event:
  - `player: "North"`
  - `vote: "Agree"`

### Step 13: Vote succeeds (unanimous)

- Server checks vote results: 4 Agree, 0 Disagree
- Vote is unanimous
- WebSocket receives `AbandonVoteSucceeded` event:
  - `votes: { East: Agree, South: Agree, West: Agree, North: Agree }`
- Voting Panel closes with success animation

### Step 14: Game is abandoned

- WebSocket receives `GameAbandoned` event:
  - `reason: "Unanimous abandon vote"`
  - `initiated_by: "East"`
- UI shows "Game Abandoned" overlay:
  - **Message**: "Game abandoned by unanimous vote"
  - **Reason**: "Connection issues for West"
  - **Buttons**: "Return to Lobby"
- All players receive same overlay

### Step 15: User returns to lobby

- User clicks "Return to Lobby" button
- UI transitions to Lobby screen
- Game history shows abandoned game

## Expected Outcome (Assert)

- ✅ Abandon Vote Dialog opened and closed correctly
- ✅ User successfully initiated abandon vote
- ✅ Voting Panel appeared and displayed vote progress
- ✅ First vote failed (not unanimous)
- ✅ Second vote succeeded (unanimous)
- ✅ Game was abandoned when all players agreed
- ✅ All players were notified of vote results
- ✅ UI transitioned correctly (Game → Lobby)
- ✅ WebSocket command/event sequence correct (RequestAbandonVote → AbandonVoteStarted → CastAbandonVote × 4 → AbandonVoteSucceeded → GameAbandoned)

## Error Cases

### Initiating vote during user's turn

- **When**: User clicks "Request Abandon" during their turn
- **Expected**: Abandon Vote Dialog shows warning about abandoning turn
- **Assert**:
  - Dialog message: "Are you sure you want to request abandon? You have 15 seconds remaining on your turn."
  - User can still request if confirmed

### Initiating vote with winning hand

- **When**: User has a winning hand but requests abandon
- **Expected**: Abandon Vote Dialog shows warning about potential win
- **Assert**:
  - Dialog message: "⚠️ You have a winning hand! Are you sure you want to request abandon?"
  - User can still request if confirmed

### Voting after timer expires

- **When**: User tries to vote after 60 seconds
- **Expected**: Voting buttons disabled, vote already closed
- **Assert**: Buttons' `disabled` state reflects `votingClosed === true`

### Changing vote after casting

- **When**: User tries to change vote after already voting
- **Expected**: Voting buttons disabled, vote already cast
- **Assert**: Buttons' `disabled` state reflects `voteCast === true`

### Server rejects vote (invalid state)

- **When**: Server receives abandon vote request in invalid state (e.g., game already over)
- **Expected**: Server rejects and shows error
- **Assert**:
  - WebSocket receives `AbandonVoteFailed` event:
    - `reason: "Cannot abandon in current state"`
  - Abandon Vote Dialog shows error: "Unable to request abandon - please try again"

### WebSocket disconnect during voting

- **When**: Connection lost during voting
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**:
  - On reconnect, client checks vote status
  - If vote succeeded: shows abandon result
  - If vote failed: shows game screen
  - If vote in progress: shows voting panel with remaining time

### Multiple abandon vote requests

- **When**: User clicks "Request Abandon" multiple times rapidly
- **Expected**: Only first click sends command, subsequent clicks ignored
- **Assert**: WebSocket receives only one `RequestAbandonVote` command

## Abandon Vote Behavior

### Vote Requirements

| Requirement | Description |
|-------------|-------------|
| Unanimous | All players must vote "Agree" |
| Time Limit | 60 seconds to complete voting |
| Minimum Players | All 4 players must vote |

### Vote Outcomes

| Outcome | Condition | Result |
|---------|-----------|---------|
| Succeeded | All players vote "Agree" | Game abandoned |
| Failed | Any player votes "Disagree" | Game continues |
| Failed | Timer expires without unanimous vote | Game continues |
| Failed | Not all players vote | Game continues |

### Vote Timer

| Time Remaining | Action |
|---------------|---------|
| 60-31 seconds | Normal voting |
| 30-11 seconds | Warning: "30 seconds remaining" |
| 10-6 seconds | Warning: "10 seconds remaining" |
| 5-1 seconds | Warning: "5 seconds remaining" |
| 0 seconds | Vote closes, result determined |

## Cross-References

### Related Scenarios

- `leave-game.md` - Leave game (ends game for all players)
- `forfeit-game.md` - Forfeit game (individual player leaves)
- `undo-voting.md` - Smart undo voting (similar voting mechanism)

### Related Components

- [GameTable](../../component/specs/game/GameTable.md)
- [AbandonVoteDialog](../../component/specs/game/AbandonVoteDialog.md)
- [VotingPanel](../../component/specs/game/VotingPanel.md)

### Backend References

- Commands: `mahjong_core::command::RequestAbandonVote`, `CastAbandonVote`
- Events: `mahjong_core::event::AbandonVoteStarted`, `AbandonVoteCast`, `AbandonVoteSucceeded`, `AbandonVoteFailed`, `GameAbandoned`
- State: `GameState::Playing`, `GameState::Voting`
- Logic: `mahjong_server::game::initiate_abandon_vote()`, `process_abandon_vote()`

### Accessibility Notes

- "Request Abandon" button announced: "Request game abandonment"
- Abandon Vote Dialog announced: "Request game abandonment dialog opened. Do you want to request to abandon this game? All players must agree to abandon."
- Reason input announced: "Reason for abandonment, text input, optional"
- "Request Vote" button announced: "Request abandon vote, Game is taking too long"
- Voting Panel announced: "Abandon game vote started. East requested to abandon the game. Reason: Game is taking too long. 0 of 4 votes. 60 seconds remaining."
- "Agree" button announced: "Agree to abandon game"
- "Disagree" button announced: "Disagree to abandon game"
- Vote cast announced: "You voted: Agree"
- Other player vote announced: "South voted: Agree"
- Vote failed announced: "Abandon vote failed - not all players agreed. West voted: Disagree"
- Vote succeeded announced: "Abandon vote succeeded - all players agreed"
- Game abandoned overlay announced: "Game abandoned by unanimous vote. Reason: Connection issues for West. Return to Lobby button available."
