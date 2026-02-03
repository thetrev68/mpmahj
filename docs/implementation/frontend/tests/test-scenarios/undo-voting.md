# Test Scenario: Smart Undo (Multiplayer Voting)

**User Story**: US-023 - Smart Undo Voting
**Fixtures**: `playing-drawing.json`, `undo-vote.json`

## Setup

- Game mode: Multiplayer (4 players)
- User has just completed a move
- Undo requires unanimous vote from all players
- Players: East (initiator), South, West, North

## Test Flow (Act & Assert)

1. **When**: East (user) clicks "Undo" button
2. **Send**: `SmartUndo` command
3. **Receive**: `UndoRequested { initiator: East, reason: "..." }`
4. **All players see**: "Undo Requested by East" dialog with "Approve/Reject" buttons
5. **South player**: Clicks "Approve", sends `VoteUndo { vote: Approve }`
6. **West player**: Clicks "Approve", sends `VoteUndo { vote: Approve }`
7. **North player**: Clicks "Approve", sends `VoteUndo { vote: Approve }`
8. **Receive**: `UndoVoteRegistered { player: South, vote: Approve }`
9. **Receive**: `UndoVoteRegistered { player: West, vote: Approve }`
10. **Receive**: `UndoVoteRegistered { player: North, vote: Approve }`
11. **All votes unanimous**: Server accepts undo
12. **Receive**: `StateRestored { mode: Normal, state: {...} }`
13. **UI updates**: Shows "Undo approved" notification, restores game state

## Success Criteria

- ✅ UndoRequested event sent to all players
- ✅ All players see vote dialog
- ✅ Votes registered for each player
- ✅ Unanimous approval confirmed
- ✅ StateRestored event received
- ✅ Game state rewound correctly
- ✅ All players see undo confirmation

## Error Cases

### Non-unanimous vote (reject)

- **When**: One player votes "Reject"
- **Expected**: Undo is denied, game state unchanged
- **Assert**: `UndoVoteDenied` event received, players see "Undo rejected"

### Vote timeout

- **When**: One player doesn't vote within 30 seconds
- **Expected**: Vote times out, defaults to "Reject"
- **Assert**: Game continues, undo not applied

### Player disconnects during vote

- **When**: North disconnects before voting
- **Expected**: Vote treated as pending, timeout applied
- **Assert**: On reconnect, player can vote or timeout already applied
