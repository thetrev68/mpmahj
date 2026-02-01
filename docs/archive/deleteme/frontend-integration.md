# Frontend Integration Guide

**Backend Version:** v0.1.0  
**Last Updated:** 2025-01-09

This document provides the authoritative reference for integrating a frontend client with the American Mahjong backend server. The backend is complete and server-authoritative—all game logic, validation, and state management happens on the Rust backend. The frontend's role is to present state and send user commands.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [WebSocket Connection](#websocket-connection)
3. [Message Protocol](#message-protocol)
4. [TypeScript Bindings](#typescript-bindings)
5. [Command Reference](#command-reference)
6. [Event Reference](#event-reference)
7. [Integration Patterns](#integration-patterns)
8. [Example Flows](#example-flows)

---

## Architecture Overview

### Server-Authoritative Design

- **Backend holds truth**: All game state lives in Rust (`mahjong_core` crate)
- **Commands → Events pattern**: Client sends commands, server validates and emits events
- **Type-safe protocol**: Rust types auto-generate TypeScript bindings via `ts-rs`
- **WebSocket communication**: JSON envelope messages over WebSocket

### Crate Structure

```text
mahjong_core/     Pure game logic (commands, events, validation)
mahjong_server/   Axum + WebSocket server (session, rooms, auth)
```text

Frontend never performs game logic validation—only input format validation (e.g., "did user select 3 tiles?").

---

## WebSocket Connection

### Connection URL

```text
ws://localhost:3000/ws
```text

(Production URL will vary based on deployment)

### Connection Flow

1. **Connect** to WebSocket endpoint
2. **Authenticate** immediately after connection
3. **Receive** `AuthSuccess` with player ID and session token
4. **Create/Join Room** to enter a game
5. **Send Commands** and **Receive Events** during gameplay

---

## Message Protocol

All messages use a JSON envelope with `kind` discriminator:

```typescript
{
  "kind": "Command" | "Event" | "Authenticate" | "AuthSuccess" | ...,
  "payload": { ... }
}
```text

See [crates/mahjong_server/src/network/messages.rs](../../../crates/mahjong_server/src/network/messages.rs) for full Envelope definition.

### Client → Server Messages

- `Authenticate` - Initial authentication
- `Command` - Game command (contains `GameCommand`)
- `CreateRoom` - Create a new game room
- `JoinRoom` - Join existing room by ID
- `LeaveRoom` - Leave current room
- `CloseRoom` - Close current room
- `Pong` - Heartbeat response

### Server → Client Messages

- `AuthSuccess` / `AuthFailure` - Authentication result
- `Event` - Game event (contains `GameEvent`)
- `RoomJoined` - Room join confirmation with seat assignment
- `RoomLeft` - Room leave confirmation
- `RoomClosed` - Room closed notification
- `RoomMemberLeft` - Another player left the room
- `Error` - Error response (with error code and message)
- `Ping` - Heartbeat request (respond with `Pong`)
- `StateSnapshot` - Full game state (for reconnection)

---

## TypeScript Bindings

### Auto-Generated Types

TypeScript definitions are auto-generated from Rust types using `ts-rs`:

**Location**: `apps/client/src/types/bindings/generated/`

**Key Types**:

- `GameCommand.ts` - All player commands
- `GameEvent.ts` - All game events
- `Seat.ts` - Player seat enum (East, South, West, North)
- `Tile.ts` - Tile representation
- `Hand.ts` - Hand structure
- `Meld.ts` - Meld (Pung/Kong/Quint) structure
- `CharlestonStage.ts` - Charleston phase states
- `GamePhase.ts` - Overall game phase
- Many more...

### Regenerating Bindings

When Rust types change:

```bash
cd crates/mahjong_core
cargo test export_bindings
```text

Output files are written to `apps/client/src/types/bindings/generated/`.

**Note**: Bindings are generated via tests, not build. Run tests to update types.

---

## Command Reference

Commands are sent from client to server. The server validates each command against current game state and responds with events.

**Source**: [crates/mahjong_core/src/command.rs](../../../crates/mahjong_core/src/command.rs)

### Setup Phase

#### `RollDice`

```typescript
{
  player: Seat;
}
```text

East rolls dice to determine wall break point. Only valid during `Setup(RollingDice)` phase.

#### `ReadyToStart`

```typescript
{
  player: Seat;
}
```text

Player indicates they've finished organizing initial hand. Only valid during `Setup(OrganizingHands)` phase.

---

### Charleston Phase

#### `PassTiles`

```typescript
{
  player: Seat,
  tiles: Tile[],
  blind_pass_count?: number  // 1-3, only on FirstLeft/SecondRight
}
```text

Submit tiles to pass during Charleston.

- **Standard pass**: 3 tiles from hand
- **Blind pass**: Can specify tiles to pass directly from incoming tiles (FirstLeft/SecondRight only)
- **Validation**: `tiles.length + (blind_pass_count || 0) === 3`
- **Jokers cannot be passed**

#### `VoteCharleston`

```typescript
{
  player: Seat,
  vote: CharlestonVote  // Continue | Stop
}
```text

Vote to continue or stop after First Charleston. Only valid during `Charleston(VotingToContinue)` phase.

#### `ProposeCourtesyPass`

```typescript
{
  player: Seat,
  tile_count: number  // 0-3
}
```text

Propose courtesy pass tile count (with across partner). Only valid during `Charleston(CourtesyAcross)` phase.

#### `AcceptCourtesyPass`

```typescript
{
  player: Seat,
  tiles: Tile[]
}
```text

Confirm and submit tiles for courtesy pass. Only valid after successful negotiation.

---

### Main Game Phase

#### `DrawTile`

```typescript
{
  player: Seat;
}
```text

Draw a tile from the wall. Only valid during `Playing(Drawing { player })` when it's the player's turn.

#### `DiscardTile`

```typescript
{
  player: Seat,
  tile: Tile
}
```text

Discard a tile from hand. Only valid during `Playing(Discarding { player })` when it's the player's turn. Tile must be in player's concealed hand.

#### `DeclareCallIntent`

```typescript
{
  player: Seat,
  intent: CallIntentKind  // Mahjong | Meld
}
```text

Declare intent to call a discarded tile during CallWindow. Server buffers intents and resolves by priority when all players pass or timer expires.

**Replaces `CallTile`** (deprecated).

#### `Pass`

```typescript
{
  player: Seat;
}
```text

Pass on calling the current discard. Only valid during `Playing(CallWindow)`. Removes player from set of players who can act on this discard.

#### `DeclareMahjong`

```typescript
{
  player: Seat,
  hand: Hand,
  winning_tile?: Tile  // Present if calling from discard, absent if self-draw
}
```text

Declare Mahjong (winning hand). Server validates hand matches a pattern on current card. Can be called during `Discarding` (self-draw) or `CallWindow` (calling for win).

#### `ExchangeJoker`

```typescript
{
  player: Seat,
  target_seat: Seat,
  meld_index: number,
  replacement: Tile
}
```text

Exchange a Joker from an exposed meld with a real tile.

- Player must have replacement tile in concealed hand
- Replacement must match the tile Joker represents
- Player receives the Joker

#### `ExchangeBlank`

```typescript
{
  player: Seat,
  discard_index: number
}
```text

Exchange a blank tile with any tile from discard pile (if house rule enabled). Done secretly—other players don't know which tile was taken.

---

### Game Management

#### `RequestState`

```typescript
{
  player: Seat;
}
```text

Request current game state (for reconnection or UI refresh). Always allowed. Server responds with `StateSnapshot`.

#### `GetAnalysis`

```typescript
{
  player: Seat;
}
```text

Request full hand analysis (all pattern evaluations). Always allowed during active game. Returns complete analysis with viable patterns, probabilities, and scores.

#### `RequestHint`

```typescript
{
  player: Seat,
  verbosity: HintVerbosity  // Beginner | Intermediate | Expert | Disabled
}
```text

Request hint data for current game state. Server responds with `HintUpdate` event containing recommendations.

#### `SetHintVerbosity`

```typescript
{
  player: Seat,
  verbosity: HintVerbosity
}
```text

Set hint verbosity preference for this game. Persists for current game session only.

#### `LeaveGame`

```typescript
{
  player: Seat;
}
```text

Leave the game. Always allowed. Player's status set to `Disconnected`.

#### `AbandonGame`

```typescript
{
  player: Seat,
  reason: AbandonReason
}
```text

Abandon the game early. Requires majority agreement (3/4 players) or single player if `InsufficientPlayers`. Game ends immediately with no winner.

---

### History Navigation

#### `RequestHistory`

```typescript
{
  player: Seat;
}
```text

Request full history list (all moves). Server responds with `HistoryList` event.

#### `JumpToMove`

```typescript
{
  player: Seat,
  move_number: number
}
```text

Jump to a specific move in history (view mode). Does not change game state—for review only.

#### `ReturnToPresent`

```typescript
{
  player: Seat;
}
```text

Return to present (exit history view mode).

#### `ResumeFromHistory`

```typescript
{
  player: Seat,
  move_number: number
}
```text

Resume playing from current history point. Discards all future moves from that point.

---

## Event Reference

Events are sent from server to client. They represent validated state changes.

**Source**: [crates/mahjong_core/src/event.rs](../../../crates/mahjong_core/src/event.rs)

### Game Lifecycle

#### `GameCreated`

```typescript
{
  game_id: string;
}
```text

Game was created and is waiting for players.

#### `PlayerJoined`

```typescript
{
  player: Seat,
  player_id: string,
  is_bot: boolean
}
```text

A player joined the game.

#### `GameStarting`

No payload. All players joined, game is starting.

---

### Setup Phase Events

#### `DiceRolled`

```typescript
{
  roll: number; // 2-12
}
```text

East rolled the dice.

#### `WallBroken`

```typescript
{
  position: number;
}
```text

Wall was broken at dice position.

#### `TilesDealt`

```typescript
{
  your_tiles: Tile[]
}
```text

Initial tiles dealt to all players. **Private event**—server sends different versions to each client.

---

### Charleston Phase Events

#### `CharlestonPhaseChanged`

```typescript
{
  stage: CharlestonStage;
}
```text

Charleston phase changed (FirstRight, FirstAcross, FirstLeft, etc.).

#### `PlayerReadyForPass`

```typescript
{
  player: Seat;
}
```text

A player submitted their tiles for the current pass.

#### `TilesPassing`

```typescript
{
  direction: PassDirection;
}
```text

All players ready, tiles are being passed now.

#### `TilesPassed`

```typescript
{
  player: Seat,
  tiles: Tile[]
}
```text

You passed tiles. **Private event**.

#### `TilesReceived`

```typescript
{
  player: Seat,
  tiles: Tile[],
  from?: Seat
}
```text

You received tiles from a Charleston pass. **Private event**.

#### `PlayerVoted`

```typescript
{
  player: Seat;
}
```text

A player voted during the continue/stop decision. (Vote is hidden until all votes are in.)

#### `VoteResult`

```typescript
{
  result: CharlestonVote; // Continue | Stop
}
```text

Voting complete, result announced.

#### `CharlestonComplete`

No payload. Charleston is complete, main game starting.

#### `CharlestonTimerStarted`

```typescript
{
  stage: CharlestonStage,
  duration: number,       // seconds
  started_at_ms: number,  // epoch ms timestamp
  timer_mode: TimerMode
}
```text

Charleston timer started for current pass stage.

#### `CourtesyPassProposed`

```typescript
{
  player: Seat,
  tile_count: number
}
```text

Player proposed a courtesy pass tile count. **Pair-private** (sent only to the pair).

#### `CourtesyPassMismatch`

```typescript
{
  pair: [Seat, Seat],
  proposed: [number, number],
  agreed_count: number  // smallest wins
}
```text

Both players in a pair proposed, but counts don't match. **Pair-private**.

#### `CourtesyPairReady`

```typescript
{
  pair: [Seat, Seat],
  tile_count: number
}
```text

A courtesy pair has agreed and is ready to exchange. **Pair-private**.

#### `CourtesyPassComplete`

No payload. Courtesy pass complete for the entire table.

---

### Main Game Phase Events

#### `PhaseChanged`

```typescript
{
  phase: GamePhase;
}
```text

Game phase changed (Setup, Charleston, Playing, GameOver).

#### `TurnChanged`

```typescript
{
  player: Seat,
  stage: TurnStage
}
```text

Turn changed to a new player.

#### `TileDrawn`

```typescript
{
  tile?: Tile,           // Present for the player who drew, absent for others
  remaining_tiles: number
}
```text

A tile was drawn from the wall. **Private version** (tile present) sent to player who drew. **Public version** (tile absent) sent to others.

#### `ReplacementDrawn`

```typescript
{
  player: Seat,
  tile: Tile,
  reason: ReplacementReason  // Kong | Quint | BlankExchange
}
```text

Player drew a replacement tile (Kong, Quint, or blank exchange). Distinct from normal `TileDrawn` to track replacement draws explicitly.

#### `TileDiscarded`

```typescript
{
  player: Seat,
  tile: Tile
}
```text

A tile was discarded.

#### `CallWindowOpened`

```typescript
{
  tile: Tile,
  discarded_by: Seat,
  can_call: Seat[],      // Players who can call (excludes discarder)
  timer: number,         // Timer duration in seconds
  started_at_ms: number, // Server start timestamp (epoch ms)
  timer_mode: TimerMode
}
```text

Call window opened—other players can call or pass.

#### `CallWindowClosed`

No payload. Call window closed, no one called.

#### `CallResolved`

```typescript
{
  resolution: CallResolution;
}
```text

Call window resolved after buffering intents. Emitted when all players pass or timer expires.

#### `TileCalled`

```typescript
{
  player: Seat,
  meld: Meld,
  called_tile: Tile
}
```text

A player called the discard and exposed a meld.

---

### Special Actions

#### `JokerExchanged`

```typescript
{
  player: Seat,
  target_seat: Seat,
  joker: Tile,
  replacement: Tile
}
```text

A Joker was exchanged from an exposed meld.

#### `BlankExchanged`

```typescript
{
  player: Seat;
}
```text

A blank tile was exchanged (secret, no tile revealed).

---

### Win/Scoring

#### `MahjongDeclared`

```typescript
{
  player: Seat;
}
```text

A player declared Mahjong.

#### `HandValidated`

```typescript
{
  player: Seat,
  valid: boolean,
  pattern?: string
}
```text

Hand validation result.

#### `WallExhausted`

```typescript
{
  remaining_tiles: number;
}
```text

Wall exhausted with no winner (draw).

#### `GameAbandoned`

```typescript
{
  reason: AbandonReason,
  initiator?: Seat
}
```text

Game was abandoned before completion.

#### `GameOver`

```typescript
{
  winner?: Seat,
  result: GameResult
}
```text

Game over.

---

### Analysis

#### `HandAnalysisUpdated`

```typescript
{
  distance_to_win: number,
  viable_count: number,
  impossible_count: number
}
```text

Hand analysis updated. **Private event**—sent only to the player. Emitted after state changes that affect pattern viability.

**Frontend Integration Point**: See `GameEvent.ts` for `AnalysisUpdate` event structure containing pattern viability data for Card Viewer UI.

---

### History

#### `HistoryList`

```typescript
{
  entries: MoveHistorySummary[]
}
```text

Full history list sent to client.

#### `StateRestored`

```typescript
{
  move_number: number,
  description: string,
  mode: HistoryMode
}
```text

State restored to a specific move.

#### `HistoryTruncated`

```typescript
{
  from_move: number;
}
```text

Future moves deleted when resuming from history.

#### `HistoryError`

```typescript
{
  message: string;
}
```text

Error: invalid history request.

---

## Integration Patterns

### State Management

- **Store all events**: Build client state by applying events in order
- **Never compute game logic**: All validation happens server-side
- **Private events**: Some events contain player-specific data (your hand, your analysis)
- **Event replay**: Backend can replay event history for reconnection

### Error Handling

Server sends `Error` envelope with error code and message:

```typescript
{
  "kind": "Error",
  "payload": {
    "code": "InvalidCommand",
    "message": "Cannot discard tile: tile not in hand"
  }
}
```text

Common error codes:

- `Unauthorized` - Authentication failed or session expired
- `InvalidCommand` - Command not valid for current game state
- `InvalidForPhase` - Command not valid for current game phase
- `RateLimitExceeded` - Too many requests
- `RoomNotFound` - Room ID doesn't exist
- `RoomFull` - Room already has 4 players

### Reconnection

1. **Connect** to WebSocket
2. **Authenticate** with `Token` method using saved session token
3. **Receive** `AuthSuccess` with `room_id` and `seat` (if still in game)
4. **Send** `RequestState` command
5. **Receive** `StateSnapshot` with full game state

### Heartbeat

Server sends `Ping` messages periodically. Client must respond with `Pong`:

```typescript
// Receive Ping
{
  "kind": "Ping",
  "payload": {
    "timestamp": "2025-01-09T12:00:00Z"
  }
}

// Respond with Pong
{
  "kind": "Pong",
  "payload": {
    "timestamp": "2025-01-09T12:00:00Z"  // Echo the timestamp
  }
}
```text

---

## Example Flows

### 1. Connect and Join Game

```typescript
// 1. Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');

// 2. Authenticate as guest
ws.send(JSON.stringify({
  kind: 'Authenticate',
  payload: {
    method: 'guest',
    version: '0.1.0'
  }
}));

// 3. Receive AuthSuccess
{
  kind: 'AuthSuccess',
  payload: {
    player_id: 'player_12345',
    display_name: 'Guest_12345',
    session_token: 'token_abcdef',
    room_id: null,
    seat: null
  }
}

// 4. Create a room
ws.send(JSON.stringify({
  kind: 'CreateRoom',
  payload: {}
}));

// 5. Receive RoomJoined
{
  kind: 'RoomJoined',
  payload: {
    room_id: 'room_xyz',
    seat: 'East'
  }
}

// 6. Wait for other players to join (receive PlayerJoined events)
{
  kind: 'Event',
  payload: {
    event: {
      PlayerJoined: {
        player: 'South',
        player_id: 'player_67890',
        is_bot: false
      }
    }
  }
}
```text

---

### 2. Setup Phase

```typescript
// 7. Game starts (receive GameStarting event)
{
  kind: 'Event',
  payload: {
    event: 'GameStarting'
  }
}

// 8. East rolls dice
ws.send(JSON.stringify({
  kind: 'Command',
  payload: {
    command: {
      RollDice: {
        player: 'East'
      }
    }
  }
}));

// 9. Receive DiceRolled and WallBroken events
{
  kind: 'Event',
  payload: {
    event: {
      DiceRolled: { roll: 7 }
    }
  }
}

{
  kind: 'Event',
  payload: {
    event: {
      WallBroken: { position: 42 }
    }
  }
}

// 10. Receive initial tiles (private event)
{
  kind: 'Event',
  payload: {
    event: {
      TilesDealt: {
        your_tiles: [/* 13 tiles */]
      }
    }
  }
}

// 11. Mark ready after organizing hand
ws.send(JSON.stringify({
  kind: 'Command',
  payload: {
    command: {
      ReadyToStart: {
        player: 'East'
      }
    }
  }
}));
```text

---

### 3. Charleston Phase

```typescript
// 12. Receive CharlestonPhaseChanged event
{
  kind: 'Event',
  payload: {
    event: {
      CharlestonPhaseChanged: {
        stage: 'FirstRight'
      }
    }
  }
}

// 13. Pass 3 tiles to the right
ws.send(JSON.stringify({
  kind: 'Command',
  payload: {
    command: {
      PassTiles: {
        player: 'East',
        tiles: [tile1, tile2, tile3],
        blind_pass_count: null
      }
    }
  }
}));

// 14. Receive TilesPassed (private) and TilesReceived (private) events
{
  kind: 'Event',
  payload: {
    event: {
      TilesPassed: {
        player: 'East',
        tiles: [tile1, tile2, tile3]
      }
    }
  }
}

{
  kind: 'Event',
  payload: {
    event: {
      TilesReceived: {
        player: 'East',
        tiles: [tile4, tile5, tile6],
        from: 'North'
      }
    }
  }
}

// ... Continue Charleston passes (FirstAcross, FirstLeft, etc.)

// 15. Vote to continue or stop after First Charleston
ws.send(JSON.stringify({
  kind: 'Command',
  payload: {
    command: {
      VoteCharleston: {
        player: 'East',
        vote: 'Continue'
      }
    }
  }
}));
```text

---

### 4. Main Game Phase

```typescript
// 16. Game phase changes to Playing
{
  kind: 'Event',
  payload: {
    event: {
      PhaseChanged: {
        phase: { Playing: { stage: 'Drawing' } }
      }
    }
  }
}

// 17. Draw a tile
ws.send(JSON.stringify({
  kind: 'Command',
  payload: {
    command: {
      DrawTile: {
        player: 'East'
      }
    }
  }
}));

// 18. Receive TileDrawn (private for you, public for others)
{
  kind: 'Event',
  payload: {
    event: {
      TileDrawn: {
        tile: { suit: 'Bam', value: 5 },
        remaining_tiles: 83
      }
    }
  }
}

// 19. Discard a tile
ws.send(JSON.stringify({
  kind: 'Command',
  payload: {
    command: {
      DiscardTile: {
        player: 'East',
        tile: { suit: 'Crak', value: 3 }
      }
    }
  }
}));

// 20. Receive TileDiscarded event
{
  kind: 'Event',
  payload: {
    event: {
      TileDiscarded: {
        player: 'East',
        tile: { suit: 'Crak', value: 3 }
      }
    }
  }
}

// 21. Call window opens for other players
{
  kind: 'Event',
  payload: {
    event: {
      CallWindowOpened: {
        tile: { suit: 'Crak', value: 3 },
        discarded_by: 'East',
        can_call: ['South', 'West', 'North'],
        timer: 10,
        started_at_ms: 1704801600000,
        timer_mode: 'Visible'
      }
    }
  }
}

// 22. Another player declares call intent (Meld or Mahjong)
ws.send(JSON.stringify({
  kind: 'Command',
  payload: {
    command: {
      DeclareCallIntent: {
        player: 'South',
        intent: 'Meld'
      }
    }
  }
}));

// 23. Receive CallResolved event
{
  kind: 'Event',
  payload: {
    event: {
      CallResolved: {
        resolution: {
          winner: 'South',
          intent: 'Meld'
        }
      }
    }
  }
}

// 24. Receive TileCalled event
{
  kind: 'Event',
  payload: {
    event: {
      TileCalled: {
        player: 'South',
        meld: {
          kind: 'Pung',
          tiles: [/* 3 tiles */]
        },
        called_tile: { suit: 'Crak', value: 3 }
      }
    }
  }
}
```text

---

### 5. Declare Mahjong and End Game

```typescript
// 25. Declare Mahjong (winning hand)
ws.send(JSON.stringify({
  kind: 'Command',
  payload: {
    command: {
      DeclareMahjong: {
        player: 'South',
        hand: {
          concealed: [/* remaining tiles */],
          exposed: [/* exposed melds */]
        },
        winning_tile: { suit: 'Bam', value: 8 }
      }
    }
  }
}));

// 26. Receive MahjongDeclared event
{
  kind: 'Event',
  payload: {
    event: {
      MahjongDeclared: {
        player: 'South'
      }
    }
  }
}

// 27. Receive HandValidated event
{
  kind: 'Event',
  payload: {
    event: {
      HandValidated: {
        player: 'South',
        valid: true,
        pattern: '2025 #1: 2468'
      }
    }
  }
}

// 28. Receive GameOver event
{
  kind: 'Event',
  payload: {
    event: {
      GameOver: {
        winner: 'South',
        result: {
          winner: 'South',
          pattern: '2025 #1: 2468',
          score: 25
        }
      }
    }
  }
}
```text

---

## Additional Resources

- **Backend Source**: [crates/mahjong_core/](../../../crates/mahjong_core/)
- **Server Source**: [crates/mahjong_server/](../../../crates/mahjong_server/)
- **TypeScript Bindings**: [apps/client/src/types/bindings/generated/](../../../apps/client/src/types/bindings/generated/)
- **Architecture Docs**: [docs/architecture/](../../architecture/)
- **Implementation Docs**: [docs/implementation/](../../implementation/)
- **ADRs**: [docs/adr/](../../adr/)

For questions or clarifications about the backend API, consult the Rust source code and inline rustdoc comments. All commands and events have detailed validation rules and examples in their source files.

---

End of Frontend Integration Guide
