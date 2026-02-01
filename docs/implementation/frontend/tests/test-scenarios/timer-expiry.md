# Test Scenario: Timer Expiry - Auto-Action on Timeout

**User Story**: US-033 (Turn Timer Management)
**Component Specs**: TurnTimer.md, ActionBar.md, GameBoard.md
**Fixtures**: `game-states/playing-user-turn.json`, `event-sequences/timer-expiry-discard.json`

## Setup (Arrange)

- Game state: Playing phase, user's turn to discard
- Mock WebSocket: connected
- User seated as: North (seat 2)
- User has 14 tiles (just drew)
- Turn timer: 30 seconds configured, 2 seconds remaining
- No user interaction during countdown

## Steps (Act)

### Normal Timer Flow

1. User's turn begins, server emits `TurnStarted` event with timer: 30 seconds
2. TurnTimer component displays countdown: "30s"
3. Timer ticks down: 30 → 29 → 28 → ... → 3 → 2 → 1
4. At 10 seconds remaining: UI shows warning (timer turns yellow/orange)
5. At 5 seconds remaining: UI shows urgent warning (timer turns red, may pulse)

### Timer Expiry

6. Timer reaches 0 seconds
7. Client has not sent `DiscardTile` command
8. Server detects timer expiry for player North
9. Server auto-selects a tile using configured strategy:
   - **Default**: Random tile from hand
   - **Strategic**: Least valuable tile (if AI engine available)
10. Server emits `TileDiscarded` event with `auto_action: true` flag
11. Server emits `TurnEnded` event
12. Server advances to next player

### UI Updates

13. UI receives `TileDiscarded` event with auto-action flag
14. Toast/notification appears: "Time expired - tile auto-discarded"
15. Discarded tile animates from user's hand to discard pool
16. Discard pool tile shows indicator: "(auto)" or special styling
17. Next player's turn begins

## Expected Outcome (Assert)

- Timer countdown displays correctly: 30s → 0s
- Visual warnings appear at 10s (yellow) and 5s (red)
- At 0s, auto-discard action occurs server-side
- Client receives `TileDiscarded` event with `auto_action: true`
- UI shows notification: "Time expired - [TileName] was auto-discarded"
- User's hand updates (tile removed)
- Discard pool updates with auto-discarded tile (marked distinctly)
- Turn advances to next player
- No client command was required (server acted autonomously)

## Error Cases

- **Command sent just before expiry**: Server should honor first action (command or timer), ignore second
- **Network delay**: If client sends command during network lag, server timestamp determines priority
- **Timer desync**: Server timer is authoritative, client timer is visual only
- **Disconnect during timer**: Timer continues on server, auto-action occurs, user sees result on reconnect
- **Multiple timers active**: Charleston timer vs turn timer → each tracked independently

## Technical Notes

### Server-Side Timer Logic (from mahjong_server)

```rust
// Pseudo-code from backend:
impl GameSession {
    fn start_turn_timer(&mut self, player: Seat, duration: Duration) {
        self.timer = Some(Timer::new(player, duration));
    }

    fn check_timer_expiry(&mut self) -> Option<Event> {
        if let Some(timer) = &self.timer {
            if timer.expired() {
                match self.table.current_phase() {
                    Playing(Discarding) => {
                        // Auto-select random tile
                        let tile = self.select_random_tile(timer.player);
                        self.execute_command(Command::DiscardTile {
                            tile,
                            auto_action: true
                        })
                    }
                    Charleston(_) => {
                        // Auto-select random tiles for charleston
                        self.auto_complete_charleston(timer.player)
                    }
                    _ => None
                }
            }
        }
    }
}
```

### Client-Side Timer Display

```typescript
// useTimer hook responsibilities:
- Receive TurnStarted event with timer duration
- Start local countdown for UI display only
- Warn at 10s remaining (yellow)
- Urgent warn at 5s remaining (red, pulse animation)
- At 0s: disable action buttons, wait for server event
- Handle timer cancellation on user action
- Sync with server on reconnect (use server timestamp)
```

### Auto-Action Strategies

1. **Random** (default, simple):
   - Select random tile from hand
   - Used in production to ensure fairness

2. **Strategic** (optional, if AI available):
   - Query AI engine for "least valuable" tile
   - Only if server has AI engine enabled
   - Fallback to random if AI unavailable

3. **Charleston Auto-Complete**:
   - If timer expires during Charleston tile selection:
   - Auto-select N random tiles to complete required pass
   - Server ensures valid charleston action

### Configurable Timer Durations

- Charleston: 60 seconds per pass (configurable)
- Turn (discard): 30 seconds (configurable)
- Call window: 10 seconds (configurable)
- Configuration via server settings or room creation options

## Cross-References

- **Related Scenarios**:
  - `disconnect-reconnect.md` (timer continues during disconnect)
  - `charleston-standard.md` (Charleston timer variant)
  - `calling-priority-mahjong.md` (call window timer)
- **Component Tests**: TurnTimer component with mock time progression
- **Integration Tests**: Full turn cycle with timer expiry
- **Manual Testing**: User Testing Plan - Timer Behavior section

## Test Variations

### Variant A: Charleston Timer Expiry
- Setup: Charleston FirstRight phase, user selected 0/3 tiles
- Timer expires → server auto-selects 3 random tiles → pass completes

### Variant B: Call Window Timer Expiry
- Setup: Playing phase, discard occurs, user can call for Pung
- Timer expires → user loses opportunity, turn advances

### Variant C: Multiple Players with Timers
- Setup: Charleston phase, all 4 players have 60s timer
- Player 1 timer expires first → auto-select → other players continue
- Ensures timers are independent per player

### Variant D: User Acts Just Before Expiry
- Setup: Timer at 1 second remaining
- User clicks discard at 0.5s remaining
- Command arrives at server 0.2s before expiry
- Server should honor user action, cancel auto-action

### Variant E: Reconnect with Active Timer
- Setup: Timer at 15s remaining, user disconnects
- User reconnects after 10s
- Server should send updated timer value: 5s remaining
- Client resumes countdown from 5s
