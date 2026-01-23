# ADR 0024: Smart Undo with Decision Points and Consensus

## Status

Accepted

## Context

Players in Practice Mode often wish to correct mistakes or explore alternative strategies ("what if I discarded X instead?"). While the underlying architecture supports time-travel via snapshots (ADR 0022), the current interface only allows jumping to arbitrary move indices, which is not user-friendly. A high-level "Undo" command is needed that understands gameplay context.

## Decision

We will implement a "Smart Undo" system with the following characteristics:

1. **Decision-Point Navigation:** Undo operations will not merely "go back one event" (which might be a system event like `DrawTile`) but will rewind to the most recent _decision point_ for the requesting player or the game loop (e.g., before a discard, before a Charleston pass, or before a Call/Pass declaration).
2. **Scope:** The undo stack is bounded by the start of the game. Players can theoretically undo all the way back to the initial deal.
3. **Destructive Truncation:** When a game state is restored and a _new_ action is taken, the previous "future" is discarded (history is truncated). We will not support branching history trees at this time.
4. **Consensus Confirmation:** In multiplayer scenarios, an Undo request requires confirmation from all other human players to prevent disruption. In solo play (with bots), confirmation is instant or strictly a UI safety prompt.
5. **Implementation:** "Smart Undo" will be implemented as a command that:
   - Identifies the target move index (last decision point).
   - Executes the existing logic for `JumpToMove` (restoring the snapshot).
   - Broadcasts the state change to all clients (including bots, which will reset their internal context).

6. **Consensus Confirmation:**
   - **Multiplayer:** Undo requests require **unanimous** confirmation from all other human players. This prevents griefing and ensures all players agree to alter the timeline.
   - **Solo/Bot Games:** Confirmation is instant (or handled via a simple safety prompt), as bots are stateless and will automatically re-evaluate the restored state without needing a "memory wipe".

7. **Implementation:** "Smart Undo" will be implemented as a command that:
   - Identifies the target move index (last _decision point_).
   - **Decision Points** are defined as states waiting for user input (e.g., `DrawTile`, `CallWindowOpened`, `CharlestonTimerStarted`). Automatic transitions (e.g., `CallWindowClosed`, `DiscardTile`) are skipped during undo traversal to ensure the player lands in an actionable state.
   - Executes the existing logic for `JumpToMove` (restoring the snapshot).
   - Truncates the history timeline (deleting the "future") to maintain a clean linear history.

## Consequences

- **UX:** Users get a familiar "Undo" button that behaves intuitively.
- **Complexity:** The server must accurately tag "decision points" in the event stream to know where to rewind to.
- **Storage:** Truncating history simplifies storage management compared to branching, but means lost data if a user "undoes" by accident and then overwrites the history.
- **Multiplayer:** The consensus flow adds a layer of state (waiting for votes) but prevents griefing.
