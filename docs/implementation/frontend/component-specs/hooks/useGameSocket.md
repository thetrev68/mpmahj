# useGameSocket Hook

## Purpose

Manages WebSocket connection to the Rust backend using the required `{ kind, payload }` envelope. Handles auth-first handshake, command sending, and FIFO event application. This is the critical communication layer between frontend and backend.

## User Stories

- **All stories** (US-001 through US-036) - Every game action uses this

## API

````typescript
interface UseGameSocketReturn {
  /** Send a game command to the backend */
  sendCommand: (command: GameCommand) => Promise<void>;

  /** Connection state */
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: Error | null;

  /** Manually reconnect */
  reconnect: () => void;

  /** Current room/game ID */
  roomId: string | null;
  gameId: string | null;
}

function useGameSocket(): UseGameSocketReturn;
```text

## Behavior

**Connection Lifecycle**:

1. Auto-connect on mount
2. Immediately send `Authenticate` as the first message (required)
3. Auto-reconnect on disconnect (exponential backoff: 1s, 2s, 4s, 8s max)
4. Clean up on unmount

**Command Sending**:

- Queue commands if not connected
- Send when connection established and authenticated
- Timeout after 10s with error

**Event Handling**:

- Listen for all backend events via `{ kind: 'Event', payload: { event } }`
- Apply events to the client store in FIFO order (server-authoritative)
- Private events are already filtered by the server
- Analysis events are private to the requesting player

**Error Handling**:

- Connection errors → show "Reconnecting..." toast
- Command errors → show error toast
- Auth errors → redirect to login

## Implementation Notes

**WebSocket Setup**:

```typescript
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

const ws = useRef<WebSocket | null>(null);
const [isConnected, setIsConnected] = useState(false);
const [isConnecting, setIsConnecting] = useState(false);
const reconnectAttempts = useRef(0);
const heartbeatInterval = useRef<number | null>(null);
```text

**Connect**:

```typescript
const connect = useCallback(() => {
  setIsConnecting(true);

  ws.current = new WebSocket(WS_URL);

  ws.current.onopen = () => {
    console.log('[WS] Connected');
    setIsConnected(true);
    setIsConnecting(false);
    reconnectAttempts.current = 0;

    // Auth-first handshake (required)
    ws.current?.send(
      JSON.stringify({
        kind: 'Authenticate',
        payload: { method: 'guest', version: '0.1.0' },
      })
    );
  };

  ws.current.onmessage = (event) => {
    const envelope = JSON.parse(event.data);
    handleIncomingEnvelope(envelope);
  };

  ws.current.onclose = () => {
    console.log('[WS] Disconnected');
    setIsConnected(false);
    cleanup();
    scheduleReconnect();
  };

  ws.current.onerror = (error) => {
    console.error('[WS] Error:', error);
    setConnectionError(error);
  };
}, []);
```text

**Reconnect Logic**:

```typescript
const scheduleReconnect = useCallback(() => {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 8000);
  reconnectAttempts.current++;

  console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

  setTimeout(() => {
    if (!isConnected) {
      connect();
    }
  }, delay);
}, [isConnected, connect]);
```text

**Send Command**:

```typescript
const sendCommand = useCallback(
  (command: GameCommand) => {
    return new Promise<void>((resolve, reject) => {
      if (!isConnected || !ws.current) {
        reject(new Error('Not connected'));
        return;
      }

      try {
        const message = JSON.stringify({
          kind: 'Command',
          payload: { command },
        });
        ws.current.send(message);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },
  [isConnected]
);
```text

**Handle Events**:

```typescript
const handleIncomingEnvelope = useCallback((envelope: { kind: string; payload: any }) => {
  if (envelope.kind !== 'Event') return;
  const event = envelope.payload.event;

  // Update Zustand store (FIFO, server-authoritative)
  useGameStore.getState().handleEvent(event);

  // Log for debugging
  console.log('[WS] Event received:', event);
}, []);
```text

**Cleanup**:

```typescript
useEffect(() => {
  connect();

  return () => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }
    if (ws.current) {
      ws.current.close();
    }
  };
}, [connect]);
```text

## Example Usage

```typescript
import { useGameSocket } from '@/hooks/useGameSocket';

function RollDiceButton() {
  const { sendCommand, isConnected } = useGameSocket();
  const [isRolling, setIsRolling] = useState(false);

  const handleRoll = async () => {
    setIsRolling(true);

    try {
      await sendCommand({ RollDice: { player: 'East' } });
    } catch (error) {
      console.error('Failed to roll dice:', error);
      toast.error('Failed to roll dice');
    } finally {
      setIsRolling(false);
    }
  };

  return (
    <Button
      onClick={handleRoll}
      disabled={!isConnected || isRolling}
    >
      {isConnected ? 'Roll Dice' : 'Connecting...'}
    </Button>
  );
}
```text

## Security

**Auth Token**:

- Include auth token in WebSocket handshake
- Server validates on connection

**Message Validation**:

- Validate all incoming events match expected schema
- Reject malformed messages

**Rate Limiting**:

- Backend enforces rate limits
- Frontend shows warning if rate limited

## Edge Cases

**Connection Lost During Action**:

- Queue command, send when reconnected
- Show "Action queued, reconnecting..." message

**Duplicate Events**:

- Use event IDs to deduplicate
- Ignore events already processed

**Stale Connection**:

- If no messages for 60s, assume dead and reconnect
- Heartbeat keeps connection alive

---

**Spec version**: 1.0
**Lines**: ~140
````
