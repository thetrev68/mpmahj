# Test Scenario: Timer Expiry - Auto-Action on Timeout

**User Story**: US-036 (Timer Configuration)
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

### Step 1: User's turn begins with timer

- WebSocket receives `TurnChanged` event:
  - `player: "North"` (user)
  - `stage: "Discarding"`
  - `time_limit: 30` (seconds)
- TurnTimer component mounts and displays: "30s"
- ActionBar shows "Discard a tile" prompt
- User's 14 tiles are interactive (clickable)
- Timer begins countdown immediately

### Step 2: Timer countdown progresses (no user action)

- **30s → 20s**: Timer displays in neutral color (white/gray)
  - User sees countdown tick: "30s" → "29s" → "28s" → ...
  - No visual warnings yet
  - Action buttons remain enabled

- **20s → 10s**: Timer continues normal countdown
  - Still in neutral state
  - User has not clicked any tiles
  - Discard button remains disabled (no tile selected)

### Step 3: First warning at 10 seconds

- Timer reaches 10 seconds remaining
- UI changes to warning state:
  - Timer text color changes to yellow/orange
  - Timer background may pulse gently
  - Optional: subtle sound effect (configurable)
- Toast notification appears briefly: "⚠️ 10 seconds remaining"
- User still has not taken action

### Step 4: Urgent warning at 5 seconds

- Timer reaches 5 seconds remaining
- UI changes to urgent state:
  - Timer text color changes to red
  - Timer background pulses more prominently
  - Font size may increase slightly for emphasis
  - Optional: more urgent sound effect
- Toast notification appears: "⚠️ 5 seconds! Discard a tile now!"
- User still has not selected or discarded a tile

### Step 5: Final countdown (3, 2, 1, 0)

- Timer ticks down: "3s" → "2s" → "1s" → "0s"
- At each second, timer pulses
- At "0s":
  - Timer freezes at "0s" (doesn't go negative)
  - All action buttons become disabled
  - Tile selection is locked
  - UI shows loading spinner or "Processing..." overlay
  - User can no longer take action (window closed)

### Step 6: Server auto-action occurs

- Server detects timer expiry for player North
- Server auto-selects tile using strategy:
  - **Default**: Random non-Joker tile from hand
  - **Strategic** (if configured): Least valuable tile
- Server executes `DiscardTile` command internally (auto-played)
- WebSocket emits `TileDiscarded` event:
  - `player: "North"`
  - `tile: 4 (5 Bam)` (example auto-selected tile)

### Step 7: UI updates with auto-discarded tile

- UI receives `TileDiscarded` event
- Toast notification appears prominently:
  - "⏱️ Time expired - 5 Bam (4) was auto-discarded"
  - Notification persists for 3-5 seconds
- Tile animation:
  - Auto-discarded tile (5 Bam (4)) highlights briefly in user's hand
  - Tile animates from hand to discard pool
  - Discard pool tile has special indicator: "(auto)" badge or different styling
- User's hand updates:
  - Tile removed from hand
  - Hand now shows 13 tiles
  - Tiles may re-sort based on settings

### Step 8: Turn advances to next player

- WebSocket receives `TurnChanged` event:
  - `player: "East"` (next player)
  - `stage: "Drawing"`
- UI transitions:
  - User's turn indicator turns off
  - East's turn indicator turns on
  - TurnTimer component unmounts for user
  - Action buttons remain disabled (not user's turn)
- User can now only observe

## Expected Outcome (Assert)

- Timer countdown displays correctly: 30s → 0s
- Visual warnings appear at 10s (yellow) and 5s (red)
- At 0s, auto-discard action occurs server-side
- Client receives `TileDiscarded` event (auto-played)
- UI shows notification: "Time expired - [TileName] was auto-discarded"
- User's hand updates (tile removed)
- Discard pool updates with auto-discarded tile (marked distinctly)
- Turn advances to next player
- No client command was required (server acted autonomously)

## Error Cases

### User clicks discard at last second (race condition)

- **When**: Timer shows "1s", user clicks discard tile at 0.8s remaining
- **Expected**:
  - Client sends `DiscardTile` command immediately
  - Server receives command at 0.5s remaining (before expiry)
  - Server honors user action, cancels auto-action timer
  - User's chosen tile is discarded (not random)
  - No "auto-played" flag on `TileDiscarded` event
- **Assert**: Server uses command reception timestamp, not client-side timer

### Network delay causes command to arrive after expiry

- **When**: User clicks discard at 2s, but network lag delays command arrival until after timer expires
- **Expected**:
  - Server timer expires first (0s)
  - Server executes auto-discard
  - Late `DiscardTile` command arrives after auto-action
  - Server rejects late command (already discarded)
  - Client receives `TileDiscarded` event for auto-action
  - Client shows notification: "Time expired - your action was not received in time"
- **Assert**: Server-side timer is authoritative, late commands are ignored

### Timer display desync (client slower than server)

- **When**: Client timer shows "3s" but server timer already at "0s" (network lag)
- **Expected**:
  - Client still counting down when `TileDiscarded` event arrives
  - Client immediately syncs to server reality
  - Timer jumps to "0s" and processes auto-discard
  - UI shows event result, not client timer state
- **Assert**: Events override local timer display

### Disconnect during active timer

- **When**: Timer at 15s, user's WebSocket disconnects
- **Expected**:
  - Server timer continues running (doesn't pause)
  - Server auto-discards at 0s
  - User reconnects at 10s elapsed (5s remaining on server)
  - Client receives `GameStateSnapshot` with turn already advanced
  - UI shows notification: "You were disconnected - your turn was auto-played"
- **Assert**: Timer is server-side only, continues during disconnect

### Multiple timers active simultaneously (Charleston + Turn)

- **When**: Hypothetical edge case: Charleston timer and turn timer both active (shouldn't happen)
- **Expected**:
  - Timers are tracked independently per phase/player
  - Only relevant timer for current game state is shown
  - Server enforces phase-appropriate timer
- **Assert**: Timer context is scoped to current game phase

### User attempts action after timer expires but before server response

- **When**: Timer reaches 0s, UI locks, user tries to click anyway before receiving `TileDiscarded` event
- **Expected**:
  - UI prevents click (buttons disabled, tiles not clickable)
  - Click handler returns early with no action
  - Optional: UI shows tooltip "Turn time expired" on hover
- **Assert**: Client-side validation prevents invalid actions during processing window

### Timer expires during call window (other player's discard)

- **When**: Player South discards, user North can call, call window timer expires
- **Expected**:
  - Call window has separate timer (10s)
  - Timer expiry means user declines to call
  - Turn advances to next player
  - No auto-action needed (declining is passive)
  - UI shows brief notification: "Call window expired"
- **Assert**: Different timer behavior for call windows vs active turns

## Technical Notes

⚠️ **NEEDS BACKEND VERIFICATION**: The following event names, command structures, and timer logic should be verified against actual Rust implementation in `mahjong_server` and `mahjong_core`.

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
- Receive TurnChanged event and server timer metadata (room config)
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

## Accessibility Notes

### Screen Reader Announcements

- **Turn start**: "Your turn to discard. 30 seconds remaining."
- **10s warning**: "Warning: 10 seconds remaining to discard."
- **5s urgent**: "Urgent: 5 seconds remaining! Discard a tile now."
- **Expiry**: "Time expired. Tile auto-discarded: 5 Bam (4)."
- **Turn end**: "Your turn has ended. East's turn to draw."

### Visual Indicators

- Timer uses color + icon, not color alone (colorblind-friendly)
  - Neutral: 🕐 gray/white
  - Warning: ⚠️ yellow/orange
  - Urgent: 🚨 red
- Timer text has minimum 4.5:1 contrast ratio
- Pulsing animation respects `prefers-reduced-motion` setting

### Keyboard Navigation

- Focus returns to actionable elements when timer starts
- At expiry, focus moves to next interactive element (if any)
- Timer warnings don't steal focus or interrupt screen reader flow

### Sound Effects (Optional, Configurable)

- Warning beep at 10s (if sound enabled)
- Urgent beep at 5s (if sound enabled)
- Sounds can be disabled in settings
- Visual-only mode available for accessibility
