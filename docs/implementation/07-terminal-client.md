# 07. Terminal Client Implementation Spec

This document specifies a minimal text-based client for testing the backend without building the full UI.

---

## 1. Scope

The terminal client is a testing tool, not a production feature.

Goals:

- Connect to `mahjong_server` via WebSocket
- Send commands and display events in real-time
- Allow manual testing of full game flow
- Support both local and remote server connections
- Enable automated bot testing

Not in scope:

- Visual tile rendering
- Animations
- Rich formatting
- Production deployment

---

## 2. Architecture

Terminal client is a standalone Rust binary in `crates/mahjong_terminal/`.

```
crates/
  mahjong_terminal/
    src/
      main.rs           # CLI entry point
      client.rs         # WebSocket client
      ui.rs             # Terminal rendering (crossterm)
      input.rs          # Command parsing
      bot.rs            # Simple bot AI for testing
```

Dependencies:

- `tokio-tungstenite` - WebSocket client
- `crossterm` - Terminal UI (raw mode, colors, cursor control)
- `serde_json` - JSON serialization
- `clap` - CLI argument parsing

---

## 3. Command Line Interface

```bash
# Connect to local server
cargo run --bin mahjong_terminal

# Connect to remote server
cargo run --bin mahjong_terminal -- --server wss://api.example.com

# Auto-play as bot
cargo run --bin mahjong_terminal -- --bot

# Spectate mode (read-only)
cargo run --bin mahjong_terminal -- --spectate --game-id abc123
```

Arguments:

- `--server <url>` - WebSocket server URL (default: `ws://localhost:8080`)
- `--bot` - Enable bot mode (auto-play, no user input)
- `--spectate` - Spectate mode (no commands sent)
- `--game-id <id>` - Join specific game (default: create new)
- `--seat <seat>` - Request specific seat (East/South/West/North)
- `--auth-token <token>` - Authenticate with session token

---

## 4. Terminal UI Layout

The terminal displays game state in sections:

```
┌─────────────────────────────────────────────────────────────┐
│ American Mahjong Terminal Client                           │
│ Connected: ws://localhost:8080 | Seat: East | Phase: Playing│
├─────────────────────────────────────────────────────────────┤
│ GAME STATE:                                                 │
│   Turn: South (Drawing)                                     │
│   Wall: 83 tiles remaining                                  │
│   Round: East 1                                             │
├─────────────────────────────────────────────────────────────┤
│ YOUR HAND (14 tiles):                                       │
│   [1] 1-Dots  [2] 2-Dots  [3] 3-Dots  [4] Joker            │
│   [5] 5-Bams  [6] 5-Bams  [7] 7-Cracks [8] Red Dragon      │
│   [9] Flower  [10] North  [11] 3-Dots [12] 4-Dots          │
│   [13] 6-Bams [14] 8-Cracks                                 │
│                                                              │
│ EXPOSED MELDS:                                              │
│   (none)                                                    │
├─────────────────────────────────────────────────────────────┤
│ DISCARD PILE:                                               │
│   East: 2-Bams, 7-Dots                                      │
│   South: 1-Cracks                                           │
│   West: 9-Dots                                              │
│   North: Green Dragon                                       │
├─────────────────────────────────────────────────────────────┤
│ OTHER PLAYERS:                                              │
│   South: 14 tiles, 0 exposed | West: 13 tiles, 1 pung      │
│   North: 13 tiles, 0 exposed                                │
├─────────────────────────────────────────────────────────────┤
│ RECENT EVENTS:                                              │
│   [12:34:56] TurnChanged: South is now active               │
│   [12:34:55] TileDiscarded: East discarded 7-Dots           │
│   [12:34:50] CallWindowClosed: No calls                     │
├─────────────────────────────────────────────────────────────┤
│ > discard 5                                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Command Input

User types commands at the `>` prompt.

Available commands:

### Game Actions

```bash
# Discard tile by index
discard 5

# Call a discard to form a meld
call pung 1 2      # Use tiles at index 1 and 2 with called tile

# Pass on a call window
pass

# Declare Mahjong
mahjong

# Exchange Joker from exposed meld
exchange-joker <player> <meld-index> <replacement-tile-index>

# Charleston - pass tiles
pass-tiles 1 2 3                    # Standard pass
pass-tiles 1 2 3 --blind 2          # Blind pass 2 tiles

# Vote on Charleston continuation
vote continue
vote stop

# Courtesy pass
courtesy-pass 3                     # Propose 3 tiles
courtesy-accept 1 5 7               # Accept and submit tiles
```

### Utility Commands

```bash
# Show full game state
state

# Show The Card patterns
card
card 2025                           # Show specific year

# Show possible winning hands
hint

# Quit
quit
exit
```

---

## 6. Event Display

Events are displayed in the "RECENT EVENTS" section with timestamp and color coding:

- **Green** - Your actions succeeded
- **Red** - Errors or rejections
- **Yellow** - Important game state changes (phase transitions)
- **White** - Other players' actions
- **Cyan** - System messages

Examples:

```
[12:34:56] TileDrawn: You drew 3-Bams
[12:34:55] TurnChanged: Your turn (Discarding)
[12:34:50] TileDiscarded: South discarded 7-Dots
[12:34:45] CallWindowOpened: 5 seconds to call 7-Dots
[12:34:40] ERROR: InvalidCommand - Not your turn
```

---

## 7. Bot Mode

When run with `--bot`, the client plays automatically using simple heuristics.

Bot Strategy (Simple):

- **Charleston**: Pass highest-value tiles (Dragons, Winds, 1s, 9s)
- **Discard**: Discard tiles that don't fit any pattern
- **Call**: Only call if tile completes a pung/kong and hand is 80%+ towards a pattern
- **Mahjong**: Declare when validation confirms winning hand

Bot is intentionally weak - goal is testing, not competition.

---

## 8. WebSocket Protocol

The terminal client uses the same protocol as the React client (see [03-networking.md](03-networking.md)).

Message Flow:

```rust
// Connect
ws.connect("ws://localhost:8080").await?;

// Authenticate
ws.send(Message {
    kind: "Authenticate",
    payload: AuthRequest::Guest,
}).await?;

// Receive auth response
let msg = ws.recv().await?;
// AuthSuccess { session_token, player_id }

// Send commands
ws.send(Message {
    kind: "Command",
    payload: Command::DiscardTile { player: Seat::East, tile: ... },
}).await?;

// Receive events
loop {
    let msg = ws.recv().await?;
    match msg.kind {
        "Event" => handle_event(msg.payload),
        "Error" => display_error(msg.payload),
        _ => {},
    }
}
```

---

## 9. State Management

Terminal client maintains a local copy of game state (mirror of server).

State updates on events:

- `TileDrawn` → Add to hand (if visible)
- `TileDiscarded` → Add to discard pile
- `TileCalled` → Move tiles from hand to exposed melds
- `TurnChanged` → Update active player
- `PhaseChanged` → Update game phase

State is rebuilt from scratch on reconnect using `RequestState` command.

---

## 10. Testing Utilities

The terminal client supports automated testing scenarios:

```bash
# Run a scripted game (commands from file)
cargo run --bin mahjong_terminal -- --script tests/scenarios/basic_win.txt

# Four bots play a full game
cargo run --bin mahjong_terminal -- --bot --seats 4

# Record a game session to file
cargo run --bin mahjong_terminal -- --record game_001.log
```

Script format (`.txt` file):

```
# Lines starting with # are comments
connect ws://localhost:8080
auth guest
wait GameStarting
wait TurnChanged
discard 1
wait TileDiscarded
pass
# ... etc
```

---

## 11. Error Handling

Terminal client must handle:

- **Connection failures** - Retry with exponential backoff
- **Invalid commands** - Display error, don't crash
- **Server errors** - Display `CommandError` message
- **Disconnections** - Attempt reconnect with session token
- **Malformed events** - Log and skip, don't crash

All errors logged to `terminal_client.log` for debugging.

---

## 12. Development Workflow

Typical testing flow:

1. Start server: `cargo run --bin mahjong_server`
2. Start 4 terminal clients in separate terminals
3. Manually issue commands to test game flow
4. Observe events and state changes
5. Verify backend behavior

For automated testing:

1. Start server
2. Run 3 bots + 1 human in separate terminals
3. Let bots play automatically, human observes or intervenes
4. Complete full game and verify win validation

---

## 13. Implementation Checklist

- [ ] WebSocket client connection
- [ ] Authentication (guest mode)
- [ ] Command parsing from user input
- [ ] Event reception and display
- [ ] Game state mirroring
- [ ] Terminal UI rendering (crossterm)
- [ ] Bot AI (simple strategy)
- [ ] Reconnection with session token
- [ ] Script playback for automated tests
- [ ] Error handling and logging

---

## 14. Nice-to-Have (Post-MVP)

- Color-coded tiles by suit
- ASCII art tile representations
- Sound effects (terminal beeps)
- Interactive tile selection (arrow keys)
- Split-screen multiplayer (4 panes in one terminal)
- Replay viewer (load and step through game logs)
