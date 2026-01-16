# American Mahjong Terminal Client

A text-based client for testing the `mahjong_server` without building the full UI.

## Purpose

This is a **testing tool**, not a production feature. It allows manual and automated testing of the game server during development.

## Installation

```bash
cargo build --bin mahjong_terminal
```

## Usage

### Basic Connection

Connect to the local server (default: `ws://localhost:3000/ws`):

```bash
cargo run --bin mahjong_terminal
```

### Connect to Remote Server

```bash
cargo run --bin mahjong_terminal -- --server wss://api.example.com/ws
```

### Bot Mode (Auto-play)

```bash
cargo run --bin mahjong_terminal -- --bot --game-id ROOM_ID
```

### Other Options

```bash
# Authenticate with session token
cargo run --bin mahjong_terminal -- --auth-token YOUR_TOKEN

# Join specific game
cargo run --bin mahjong_terminal -- --game-id abc123

# Request specific seat
cargo run --bin mahjong_terminal -- --seat East

# Run commands from script file
cargo run --bin mahjong_terminal -- --script tests/scenarios/basic_win.txt

# Record session to file
cargo run --bin mahjong_terminal -- --record game_001.log

# Spectate mode (read-only)
cargo run --bin mahjong_terminal -- --spectate --game-id abc123
```

## Available Commands

### Game Actions

```bash
# Discard tile by index (0-based index into your hand)
discard 5

# Call a discard to form a meld (server determines tiles from your hand)
call pung
call kong
call quint

# Pass on a call window
pass

# Declare Mahjong
mahjong

# Exchange Joker from another player's exposed meld
# Usage: exchange-joker <player> <meld-index> <your-tile-index>
exchange-joker South 0 5
```

### Charleston Commands

```bash
# Pass tiles (standard 3-tile pass)
pass-tiles 1 2 3

# Pass tiles with blind pass
pass-tiles 1 2 3 --blind 2

# Vote on Charleston continuation
vote continue
vote stop

# Courtesy pass negotiation (two-step process)
courtesy-pass 3          # Step 1: Propose 3 tiles
courtesy-accept 1 5 7    # Step 2: Submit tiles after both proposed
```

### Room Commands

```bash
# Create a new room (returns room ID)
create

# Join an existing room
join ROOM_ID
```

### Utility Commands

```bash
# Show full game state
state

# Show help
help

# Quit
quit
exit
```

## Terminal UI Layout

The terminal displays:

1. **Header** - Connection status, player ID, seat
2. **Game State** - Current phase, turn, wall remaining
3. **Your Hand** - Tiles in your hand (numbered for easy reference)
4. **Exposed Melds** - Your exposed pungs/kongs
5. **Recent Events** - Last 5-10 events from the server
6. **Command Prompt** - Input area for commands

## Development Workflow

### Manual Testing (1 Human + 3 Bots)

The game requires exactly 4 players. When all 4 join, the server automatically
rolls dice, deals tiles, and starts the Charleston phase.

1. **Start the server** (in its own terminal):

   ```bash
   cargo run --bin mahjong_server
   ```

2. **Start the human player** and create a room:

   ```bash
   cargo run --bin mahjong_terminal
   ```

   Then type `create` to create a new room. Copy the room ID from the output.

3. **Start 3 bots** in separate terminals, each joining the same room:

   ```bash
   # Terminal 2
   cargo run --bin mahjong_terminal -- --bot --game-id 39b9c1c6-bb0c-4a4d-8194-6904d751c08e

   # Terminal 3
   cargo run --bin mahjong_terminal -- --bot --game-id ROOM_ID

   # Terminal 4
   cargo run --bin mahjong_terminal -- --bot --game-id ROOM_ID
   ```

   Replace `ROOM_ID` with the ID from step 2.

4. **Game starts automatically** when the 4th player joins. The bots will
   auto-play through Charleston and the main game. You can play manually
   using the commands below.

### Fully Automated Testing (4 Bots)

To watch a fully automated game:

1. Start the server
2. Start 1 bot that creates a room:

   ```bash
   cargo run --bin mahjong_terminal -- --bot
   ```

   Copy the room ID from the output.

3. Start 3 more bots joining that room:

   ```bash
   cargo run --bin mahjong_terminal -- --bot --game-id 0656e067-0f98-4499-8d91-4639cd674ae4
   cargo run --bin mahjong_terminal -- --bot --game-id ROOM_ID
   cargo run --bin mahjong_terminal -- --bot --game-id ROOM_ID
   ```

### Manual Testing (4 Humans)

1. Start the server
2. First player creates the room:

   ```bash
   cargo run --bin mahjong_terminal
   ```

   Type `create`, then share the room ID with other players.

3. Other players join:

   ```bash
   cargo run --bin mahjong_terminal
   ```

   Type `join ROOM_ID` to join.

4. Game starts when the 4th player joins.

### Script Testing

Create a script file (e.g., `test_scenario.txt`):

```text
# Test scenario: basic discard flow
create
wait GameStarting
wait TurnChanged
discard 1
wait TileDiscarded
pass
```

Run the script:

```bash
cargo run --bin mahjong_terminal -- --script test_scenario.txt
```

## Architecture

```text
mahjong_terminal/
├── src/
│   ├── main.rs       # CLI entry point
│   ├── client.rs     # WebSocket client
│   ├── ui.rs         # Terminal rendering (crossterm)
│   ├── input.rs      # Command parsing
│   └── bot.rs        # Simple bot AI for testing
├── Cargo.toml
└── README.md
```

## Current Status

**Implemented:**

- [x] CLI argument parsing
- [x] WebSocket connection
- [x] Authentication (guest mode)
- [x] Command parsing
- [x] Terminal UI rendering (basic)
- [x] Event display

**TODO:**

- [ ] Complete game state tracking
- [ ] Full hand rendering with tiles
- [ ] Bot AI implementation
- [ ] Script playback
- [ ] Session recording
- [ ] Reconnection with session token
- [ ] Color-coded tiles by suit
- [ ] Pattern hint system

## Dependencies

- `tokio` - Async runtime
- `tokio-tungstenite` - WebSocket client
- `crossterm` - Terminal UI
- `clap` - CLI argument parsing
- `serde` / `serde_json` - JSON serialization
- `tracing` - Logging

## Related Documentation

- [Terminal Client Spec](../../docs/implementation/07-terminal-client.md)
- [Command/Event System](../../docs/architecture/06-command-event-system-api-contract.md)
- [State Machine Design](../../docs/architecture/04-state-machine-design.md)
