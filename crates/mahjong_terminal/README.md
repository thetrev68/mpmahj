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

Connect to the local server (default: `ws://localhost:8080`):

```bash
cargo run --bin mahjong_terminal
```

### Connect to Remote Server

```bash
cargo run --bin mahjong_terminal -- --server wss://api.example.com
```

### Bot Mode (Auto-play)

```bash
cargo run --bin mahjong_terminal -- --bot
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
# Discard tile by index
discard 5

# Call a discard to form a meld
call pung 1 2          # Use tiles at index 1 and 2
call kong 1 2 3        # Use tiles at index 1, 2, and 3

# Pass on a call window
pass

# Declare Mahjong
mahjong

# Exchange Joker from exposed meld
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

# Courtesy pass negotiation
courtesy-pass 3
courtesy-accept 1 5 7
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

### Manual Testing (4 Players)

1. Start the server:

   ```bash
   cargo run --bin mahjong_server
   ```

2. Open 4 terminal windows and start clients:

   ```bash
   # Terminal 1
   cargo run --bin mahjong_terminal

   # Terminal 2
   cargo run --bin mahjong_terminal

   # Terminal 3
   cargo run --bin mahjong_terminal

   # Terminal 4
   cargo run --bin mahjong_terminal
   ```

3. Play manually by issuing commands

### Automated Testing (3 Bots + 1 Human)

1. Start the server
2. Start 3 bots in background:

   ```bash
   cargo run --bin mahjong_terminal -- --bot &
   cargo run --bin mahjong_terminal -- --bot &
   cargo run --bin mahjong_terminal -- --bot &
   ```

3. Start your client:

   ```bash
   cargo run --bin mahjong_terminal
   ```

4. Let bots play, observe or intervene

### Script Testing

Create a script file (e.g., `test_scenario.txt`):

```text
# Test scenario: basic discard flow
connect ws://localhost:8080
auth guest
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
