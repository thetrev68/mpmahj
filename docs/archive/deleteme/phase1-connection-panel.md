# Phase 1: Connection & Room Setup - Implementation Guide

## Overview

Build the **ConnectionPanel** component to handle:

- Server connection status
- Room creation with card year and bot configuration
- Room joining by ID
- Player seat display (player ID and room ID are not currently exposed to the UI)
- Error messaging

This is the foundational UI that enables testing the backend game logic.

---

## Quick Reference

### Type Definitions

```typescript
// From generated bindings
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Difficulty } from '@/types/bindings/generated/Difficulty';
import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';

// Seat: "East" | "South" | "West" | "North"

// Difficulty: "Easy" | "Medium" | "Hard" | "Expert"

// CreateRoomPayload structure
interface CreateRoomPayload {
  card_year: number; // 2017, 2018, 2019, 2020, 2025
  bot_difficulty: Difficulty | null; // null defaults to "Easy"
  fill_with_bots: boolean; // Auto-fill empty seats with bots
}
```

### Store Structures

#### gameStore (read-only for this component)

```typescript
// From apps/client/src/store/gameStore.ts
interface GameState {
  phase: GamePhase; // Current game phase
  yourSeat: Seat | null; // Your assigned seat (null if not in room)
  players: Record<Seat, PublicPlayerInfo>; // All players info
  // ... other game state
}

// Access methods
const yourSeat = useGameStore((state) => state.yourSeat);
const phase = useGameStore((state) => state.phase);
```

#### uiStore (for errors)

```typescript
// From apps/client/src/store/uiStore.ts
interface UIState {
  errors: Array<{ id: string; message: string; timestamp: number }>;
  addError: (message: string) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
}

// Errors auto-dismiss after 5 seconds
```

### WebSocket Hook (useGameSocket)

```typescript
// From apps/client/src/hooks/useGameSocket.ts
const {
  status, // { connected, connecting, error, reconnectAttempts }
  createRoom, // (payload: CreateRoomPayload) => boolean
  joinRoom, // (roomId: string) => boolean
  leaveRoom, // () => boolean
  connect, // () => void
  disconnect, // () => void
} = useGameSocket({
  url: 'ws://localhost:3000/ws',
  gameId: '',
  playerId: 'player_1',
});

// status.connected: boolean - WebSocket is open
// status.connecting: boolean - Connection in progress
// status.error: string | null - Last connection error
// status.reconnectAttempts: number - Number of reconnection attempts
//
// IMPORTANT: useGameSocket auto-connects on mount. Create it once per screen
// and pass the returned functions/status to subcomponents instead of
// calling useGameSocket inside multiple child components.
```

---

## Component Specification

### File Location

`apps/client/src/components/ConnectionPanel.tsx`

### Component Interface

```typescript
interface ConnectionPanelProps {
  status: ConnectionStatus;
  createRoom: (payload: CreateRoomPayload) => boolean;
  joinRoom: (roomId: string) => boolean;
  leaveRoom: () => boolean;
  disconnect: () => void;
}

export function ConnectionPanel(props: ConnectionPanelProps): JSX.Element;
```

### Visual Layout

```text
┌─────────────────────────────────────────────────┐
│ CONNECTION STATUS                               │
│ ● Connected | Seat: East                        │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ CREATE NEW ROOM                             │ │
│ │                                             │ │
│ │ Card Year:     [2025 ▼]                     │ │
│ │ Bot Difficulty: [Default (Easy) ▼]          │ │
│ │ ☑ Fill with Bots                            │ │
│ │                                             │ │
│ │              [Create Room]                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ JOIN EXISTING ROOM                          │ │
│ │                                             │ │
│ │ Room ID: [________________]                 │ │
│ │                                             │ │
│ │              [Join Room]                    │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Disconnect]                                    │
│                                                 │
│ ⚠ Error: Failed to create room                 │
└─────────────────────────────────────────────────┘
```

---

## State Management

### Local Component State

```typescript
const [cardYear, setCardYear] = useState<number>(2025);
const [botDifficulty, setBotDifficulty] = useState<Difficulty | 'Default'>('Default');
const [fillWithBots, setFillWithBots] = useState(false);
const [roomId, setRoomId] = useState('');
```

### Store Access (via Zustand)

```typescript
// Game state
const yourSeat = useGameStore((state) => state.yourSeat);
const phase = useGameStore((state) => state.phase);

// UI state
const errors = useUIStore((state) => state.errors);
const addError = useUIStore((state) => state.addError);
const removeError = useUIStore((state) => state.removeError);

// WebSocket (create once in App and pass into ConnectionPanel)
const { status, createRoom, joinRoom, leaveRoom, disconnect } = useGameSocket({
  url: import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws',
  gameId: '',
  playerId: 'player_1', // TODO: Replace with actual auth
});

// Usage:
<ConnectionPanel
  status={status}
  createRoom={createRoom}
  joinRoom={joinRoom}
  leaveRoom={leaveRoom}
  disconnect={disconnect}
/>;
```

---

## Implementation Details

### Connection Status Display

**Requirements:**

- Show connection state (Connected/Disconnected/Connecting)
- Display current seat (if assigned)
- Display last connection error if present
- Room ID is not currently exposed in the UI; omit it unless you extend the hook/store

**Example:**

```typescript
function ConnectionStatus({ status, yourSeat }: { status: ConnectionStatus; yourSeat: Seat | null }) {
  return (
    <div className="connection-status">
      <span className={status.connected ? 'status-dot connected' : 'status-dot disconnected'}>
        ●
      </span>
      <span>
        {status.connecting && 'Connecting...'}
        {status.connected && 'Connected'}
        {!status.connecting && !status.connected && 'Disconnected'}
      </span>
      {status.connected && yourSeat && <span>Seat: {yourSeat}</span>}
      {status.error && <span className="status-error">Error: {status.error}</span>}
    </div>
  );
}
```

---

### Create Room Form

**Requirements:**

- Card year dropdown (2017, 2018, 2019, 2020, 2025)
- Bot difficulty dropdown (Default/Easy, Medium, Hard, Expert)
- "Fill with Bots" checkbox
- "Create Room" button
- Button disabled when disconnected

**Server Behavior:**

- `bot_difficulty: null` → Server defaults to "Easy"
- `fill_with_bots: true` → Server automatically adds bots to all empty seats after room creation
- `fill_with_bots: false` → Room creator must manually invite players or add bots

**Example:**

```typescript
function CreateRoomForm({
  status,
  createRoom,
}: {
  status: ConnectionStatus;
  createRoom: (payload: CreateRoomPayload) => boolean;
}) {
  const [cardYear, setCardYear] = useState(2025);
  const [botDifficulty, setBotDifficulty] = useState<Difficulty | 'Default'>('Default');
  const [fillWithBots, setFillWithBots] = useState(false);

  const addError = useUIStore((state) => state.addError);

  const handleCreateRoom = () => {
    const payload: CreateRoomPayload = {
      card_year: cardYear,
      bot_difficulty: botDifficulty === 'Default' ? null : botDifficulty,
      fill_with_bots: fillWithBots,
    };

    const success = createRoom(payload);
    if (!success) {
      addError('Failed to send create room request');
    }
  };

  return (
    <div className="create-room-form">
      <h3>Create New Room</h3>

      <label>
        Card Year:
        <select value={cardYear} onChange={(e) => setCardYear(Number(e.target.value))}>
          <option value={2017}>2017</option>
          <option value={2018}>2018</option>
          <option value={2019}>2019</option>
          <option value={2020}>2020</option>
          <option value={2025}>2025</option>
        </select>
      </label>

      <label>
        Bot Difficulty:
        <select
          value={botDifficulty}
          onChange={(e) => setBotDifficulty(e.target.value as Difficulty | 'Default')}
        >
          <option value="Default">Default (Easy)</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
          <option value="Expert">Expert</option>
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={fillWithBots}
          onChange={(e) => setFillWithBots(e.target.checked)}
        />
        Fill with Bots
      </label>

      <button onClick={handleCreateRoom} disabled={!status.connected}>
        Create Room
      </button>
    </div>
  );
}
```

---

### Join Room Form

**Requirements:**

- Room ID text input
- "Join Room" button
- Button disabled when disconnected or room ID empty

**Example:**

```typescript
function JoinRoomForm({
  status,
  joinRoom,
}: {
  status: ConnectionStatus;
  joinRoom: (roomId: string) => boolean;
}) {
  const [roomId, setRoomId] = useState('');

  const addError = useUIStore((state) => state.addError);

  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      addError('Room ID is required');
      return;
    }

    const success = joinRoom(roomId);
    if (!success) {
      addError('Failed to send join room request');
    }
  };

  return (
    <div className="join-room-form">
      <h3>Join Existing Room</h3>

      <label>
        Room ID:
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Enter room ID"
        />
      </label>

      <button
        onClick={handleJoinRoom}
        disabled={!status.connected || !roomId.trim()}
      >
        Join Room
      </button>
    </div>
  );
}
```

---

### Error Display

**Requirements:**

- Show errors from `uiStore.errors`
- Display below forms
- Click to dismiss (or auto-dismiss after 5 seconds)
- Red text or background

**Example:**

```typescript
function ErrorDisplay() {
  const errors = useUIStore((state) => state.errors);
  const removeError = useUIStore((state) => state.removeError);

  if (errors.length === 0) return null;

  return (
    <div className="error-container">
      {errors.map((error) => (
        <div
          key={error.id}
          className="error-message"
          onClick={() => removeError(error.id)}
        >
          ⚠ {error.message}
        </div>
      ))}
    </div>
  );
}
```

---

### Disconnect Button

**Requirements:**

- Always visible when connected
- Calls `disconnect()` from useGameSocket
- Should also call `leaveRoom()` if in a room

**Example:**

```typescript
function DisconnectButton({
  disconnect,
  leaveRoom,
  yourSeat,
}: {
  disconnect: () => void;
  leaveRoom: () => boolean;
  yourSeat: Seat | null;
}) {

  const handleDisconnect = () => {
    if (yourSeat) {
      leaveRoom(); // Leave room first
    }
    disconnect(); // Then disconnect
  };

  return (
    <button className="disconnect-btn" onClick={handleDisconnect}>
      {yourSeat ? 'Leave Room & Disconnect' : 'Disconnect'}
    </button>
  );
}
```

---

## Complete Component Example

```typescript
import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import type { Difficulty } from '@/types/bindings/generated/Difficulty';
import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';

export function ConnectionPanel({
  status,
  createRoom,
  joinRoom,
  leaveRoom,
  disconnect,
}: ConnectionPanelProps) {
  // Local state
  const [cardYear, setCardYear] = useState(2025);
  const [botDifficulty, setBotDifficulty] = useState<Difficulty | 'Default'>('Default');
  const [fillWithBots, setFillWithBots] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState('');

  // Store state
  const yourSeat = useGameStore((state) => state.yourSeat);
  const errors = useUIStore((state) => state.errors);
  const addError = useUIStore((state) => state.addError);
  const removeError = useUIStore((state) => state.removeError);

  // Handlers
  const handleCreateRoom = () => {
    const payload: CreateRoomPayload = {
      card_year: cardYear,
      bot_difficulty: botDifficulty === 'Default' ? null : botDifficulty,
      fill_with_bots: fillWithBots,
    };

    const success = createRoom(payload);
    if (!success) {
      addError('Failed to create room');
    }
  };

  const handleJoinRoom = () => {
    if (!roomIdInput.trim()) {
      addError('Room ID is required');
      return;
    }

    const success = joinRoom(roomIdInput);
    if (!success) {
      addError('Failed to join room');
    }
  };

  const handleDisconnect = () => {
    if (yourSeat) {
      leaveRoom();
    }
    disconnect();
  };

  return (
    <div className="connection-panel">
      {/* Connection Status */}
      <div className="connection-status">
        <span className={status.connected ? 'status-dot connected' : 'status-dot disconnected'}>
          ●
        </span>
        <span>
          {status.connecting && 'Connecting...'}
          {status.connected && !status.connecting && 'Connected'}
          {!status.connecting && !status.connected && 'Disconnected'}
        </span>
        {status.connected && yourSeat && <span>Seat: {yourSeat}</span>}
        {status.error && <span className="status-error">Error: {status.error}</span>}
      </div>

      {/* Create Room Form */}
      <div className="create-room-section">
        <h3>Create New Room</h3>
        <div className="form-group">
          <label>
            Card Year:
            <select value={cardYear} onChange={(e) => setCardYear(Number(e.target.value))}>
              <option value={2017}>2017</option>
              <option value={2018}>2018</option>
              <option value={2019}>2019</option>
              <option value={2020}>2020</option>
              <option value={2025}>2025</option>
            </select>
          </label>
        </div>

        <div className="form-group">
          <label>
            Bot Difficulty:
            <select
              value={botDifficulty}
              onChange={(e) => setBotDifficulty(e.target.value as Difficulty | 'Default')}
            >
              <option value="Default">Default (Easy)</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
              <option value="Expert">Expert</option>
            </select>
          </label>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={fillWithBots}
              onChange={(e) => setFillWithBots(e.target.checked)}
            />
            Fill with Bots
          </label>
        </div>

        <button onClick={handleCreateRoom} disabled={!status.connected}>
          Create Room
        </button>
      </div>

      {/* Join Room Form */}
      <div className="join-room-section">
        <h3>Join Existing Room</h3>
        <div className="form-group">
          <label>
            Room ID:
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              placeholder="Enter room ID"
            />
          </label>
        </div>

        <button
          onClick={handleJoinRoom}
          disabled={!status.connected || !roomIdInput.trim()}
        >
          Join Room
        </button>
      </div>

      {/* Disconnect Button */}
      <div className="disconnect-section">
        <button className="disconnect-btn" onClick={handleDisconnect}>
          {yourSeat ? 'Leave Room & Disconnect' : 'Disconnect'}
        </button>
      </div>

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="error-container">
          {errors.map((error) => (
            <div
              key={error.id}
              className="error-message"
              onClick={() => removeError(error.id)}
            >
              ⚠ {error.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Styling Guidelines

Use minimal CSS for basic readability:

```css
.connection-panel {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.connection-status {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.status-dot {
  font-size: 1.2rem;
}

.status-dot.connected {
  color: green;
}

.status-dot.disconnected {
  color: red;
}

.create-room-section,
.join-room-section {
  border: 1px solid #ddd;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 4px;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.form-group input[type='text'],
.form-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.form-group input[type='checkbox'] {
  margin-right: 0.5rem;
}

.status-error {
  color: #b02a37;
}

button {
  padding: 0.5rem 1rem;
  border: 1px solid #007bff;
  background-color: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

button:disabled {
  background-color: #ccc;
  border-color: #ccc;
  cursor: not-allowed;
}

.disconnect-btn {
  background-color: #dc3545;
  border-color: #dc3545;
}

.disconnect-btn:hover:not(:disabled) {
  background-color: #c82333;
}

.error-container {
  margin-top: 1rem;
}

.error-message {
  padding: 0.75rem;
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  cursor: pointer;
}
```

---

## WebSocket Message Flow

### Creating a Room

**Client → Server:**

```json
{
  "kind": "CreateRoom",
  "payload": {
    "card_year": 2025,
    "bot_difficulty": "Hard",
    "fill_with_bots": true
  }
}
```

**Server → Client (Success):**

```json
{
  "kind": "RoomJoined",
  "payload": {
    "room_id": "room_abc123",
    "seat": "East"
  }
}
```

**Server → Client (Error):**

```json
{
  "kind": "Error",
  "payload": {
    "message": "Invalid card year: 2016"
  }
}
```

### Joining a Room

**Client → Server:**

```json
{
  "kind": "JoinRoom",
  "payload": {
    "room_id": "room_abc123"
  }
}
```

**Server → Client (Success):**

```json
{
  "kind": "RoomJoined",
  "payload": {
    "room_id": "room_abc123",
    "seat": "South"
  }
}
```

---

## Testing Checklist

### Connection Flow

- [ ] Connection status displays "Disconnected" initially
- [ ] Connection status updates to "Connecting..." when connecting
- [ ] Connection status displays "Connected" when WebSocket opens
- [ ] Seat displays when assigned
- [ ] Forms are disabled when disconnected
- [ ] Forms are enabled when connected

### Create Room Flow

- [ ] Can select card year from dropdown (2017-2025)
- [ ] Can select bot difficulty (Easy, Medium, Hard, Expert)
- [ ] Can toggle "Fill with Bots" checkbox
- [ ] "Create Room" button disabled when disconnected
- [ ] "Create Room" button enabled when connected
- [ ] After creating room, seat is assigned and displayed

### Join Room Flow

- [ ] Room ID input accepts text
- [ ] "Join Room" button disabled when disconnected
- [ ] "Join Room" button disabled when room ID is empty
- [ ] "Join Room" button enabled when connected and room ID entered
- [ ] After joining room, seat is assigned and displayed
- [ ] Invalid room ID shows error message

### Error Handling

- [ ] Server errors display in error container
- [ ] Errors auto-dismiss after 5 seconds
- [ ] Clicking error dismisses it immediately
- [ ] Multiple errors can be displayed simultaneously
- [ ] Connection errors show in status (status.error)

### Disconnect Flow

- [ ] Disconnect button shows "Disconnect" when not in room
- [ ] Disconnect button shows "Leave Room & Disconnect" when in room
- [ ] Clicking disconnect closes WebSocket
- [ ] Connection status updates to "Disconnected"
- [ ] Forms become disabled after disconnect

---

## Integration with App.tsx

Update `apps/client/src/App.tsx` to use ConnectionPanel:

```typescript
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { useGameSocket } from '@/hooks/useGameSocket';

function App() {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const socket = useGameSocket({
    url: import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws',
    gameId: '',
    playerId: 'player_1',
  });

  return (
    <div className="app-container">
      <header>
        <h1>Mahjong Client</h1>
      </header>

      <main>
        {/* Always show ConnectionPanel */}
        <ConnectionPanel
          status={socket.status}
          createRoom={socket.createRoom}
          joinRoom={socket.joinRoom}
          leaveRoom={socket.leaveRoom}
          disconnect={socket.disconnect}
        />

        {/* Show game UI only when in a room */}
        {yourSeat && (
          <div className="game-ui">
            {/* Future: GameStatus, HandDisplay, etc. */}
          </div>
        )}
      </main>
    </div>
  );
}
```

---

## Success Criteria

Phase 1 is complete when:

1. ✅ ConnectionPanel component renders without errors - **COMPLETE**
2. ✅ Can connect to WebSocket server at `ws://localhost:3000/ws` - **COMPLETE**
3. ✅ Connection status displays correctly (Connected/Disconnected/Connecting) - **COMPLETE**
4. ✅ Can create room with all options (card year, bot difficulty, fill with bots) - **COMPLETE**
5. ✅ Can join existing room by ID - **COMPLETE**
6. ✅ Seat displays when assigned - **COMPLETE**
7. ✅ Errors display and auto-dismiss - **COMPLETE**
8. ✅ Can disconnect from server - **COMPLETE**
9. ✅ TypeScript compiles without errors - **COMPLETE**
10. ✅ No console errors or warnings - **COMPLETE**

### Phase 1 Implementation Status: COMPLETE

Implementation completed on: 2026-01-24

Files created/modified:

- `apps/client/src/components/ConnectionPanel.tsx` - Main component (new)
- `apps/client/src/App.tsx` - Integration with app (modified)
- `apps/client/src/App.css` - Component styling (modified)

---

## Next Steps

After Phase 1 is complete, proceed to:

- **Phase 2: Game Status Display** - Show game phase, turn indicator, wall count, player table
- **Phase 3: Hand Display** - Display your 14 tiles with selection and sorting
- **Phase 4: Turn Actions** - Discard, call, pass buttons

---

## Additional Notes

### Bot Difficulty Details

From the server documentation:

- **Easy**: Random decisions (strategically void) - Good for quick testing
- **Medium**: Uses BasicBot from mahjong_core (simple heuristics) - Moderate challenge
- **Hard**: Greedy EV maximization (no lookahead) - Strong tactical play
- **Expert**: MCTS with 10,000 iterations (deep search) - Maximum challenge, slower turns

### Card Year Validation

The server validates card years and will reject invalid values. Only these years are supported:

- 2017, 2018, 2019, 2020, 2025

Requesting any other year will return an error.

### Room ID Format

Room IDs are generated by the server as UUIDs (e.g., `"550e8400-e29b-41d4-a716-446655440000"`).

The current client does not surface `room_id` in state; only the backend and WebSocket payloads have it.

### Authentication (Future)

Currently passing hardcoded `playerId: 'player_1'`, but the socket auth flow does not use it yet. In production:

- Implement proper authentication flow
- Use JWT tokens or session tokens
- Store player identity securely
- Handle re-authentication on reconnect
