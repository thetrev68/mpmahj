# Plan: Smart Undo & Multiplayer Consensus

## Phase 1: Core Undo Infrastructure (Backend)

1.  Decision Point Tagging:
    - Modify: mahjong_core::history::MoveHistoryEntry - Add is_decision_point: bool.
    - Modify: mahjong_server::network::history::RoomHistory::record_history_entry - Logic to auto-flag events (DrawTile,
      CallWindowOpened, CharlestonTimerStarted) as decision points.

## 2. Undo Command & Helper:

       * Modify: mahjong_core::command::GameCommand - Add SmartUndo { player: Seat }.
       * Modify: mahjong_server::network::history::RoomHistory - Add find_last_decision_point(current_move: u32) ->
         Option<u32>.

## Phase 2: Consensus System (Backend)

This is the new "complex" part. We need a way to pause the game and ask for votes.

1.  New State for Consensus:
    - We need to track active voting requests.
    - Modify: crates/mahjong_server/src/network/state.rs (or room.rs struct) to add:

1 struct UndoRequest {
2 requester: Seat,
3 target_move: u32,
4 votes: HashMap<Seat, bool>, // Seat -> Approved/Denied
5 created_at: Instant,
6 } \* Add undo_request: Option<UndoRequest> to Room struct.

2.  New Commands & Events:
    - Commands:
      - VoteUndo { player: Seat, approve: bool }
    - Events:
      - UndoRequested { requester: Seat, target_move: u32 } (Broadcast to all)
      - UndoVoteRegistered { voter: Seat, approved: bool } (Feedback)
      - UndoRequestResolved { approved: bool } (Outcome)

3.  Refine `SmartUndo` Handler:
    - Logic:
      - Calculate target_move.
      - If Room::is_solo_play() (only 1 human): Execute immediately (Jump + Truncate).
      - If Multiplayer:
        - Create UndoRequest state.
        - Auto-vote "Yes" for the requester.
        - Broadcast UndoRequested.
        - (Game effectively pauses or UI blocks actions? We might not hard pause, but users shouldn't make moves while
          deciding).

4.  Implement Voting Handler:
    - Handle VoteUndo.
    - Update votes.
    - Check for unanimity (All humans must vote).
      - If All Humans Approve -> Execute Undo.
      - If Any Human Denies -> Cancel Request, Emit UndoRequestResolved(false).

### Phase 3: Integration & Testing

1.  Unit Tests: Verify find_last_decision_point works on various history sequences.
2.  Integration Tests:
    - Test Solo Undo (Immediate).
    - Test Multiplayer Undo (Request -> Vote -> Success).
    - Test Multiplayer Denial (Request -> Vote No -> Fail).
