# Phase 1: Infrastructure and Foundations

## Goal

Establish a stable frontend foundation that mirrors backend types, speaks the WebSocket envelope protocol, and can render tiles from the Tile(u8) model. This phase should leave the UI ready to build features without redoing core plumbing.

## 1. Type Bindings and Runtime Guards

**Source of truth:** `apps/client/src/types/bindings/generated/` (ts-rs output, do not edit).

**Tasks**

1. Verify the generated types are in sync with backend (run generator later, but for now verify the files exist):
   - `GameCommand`, `GameEvent`, `GamePhase`, `TurnStage`, `GameStateSnapshot`, `Tile`, `Meld`, `Seat`, `HouseRules`.
2. Create a single export surface:
   - `apps/client/src/types/bindings/index.ts` should re-export generated types.
3. Add runtime guards for network payloads and command/event discrimination.

**New file: `apps/client/src/types/guards.ts`**

```ts
import type { GameEvent, GameCommand, GamePhase, TurnStage, Tile } from './bindings';

export function isTile(value: unknown): value is Tile {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 36;
}

export function isGameEvent(value: unknown): value is GameEvent {
  return typeof value === 'object' && value !== null && Object.keys(value as object).length > 0;
}

export function isGameCommand(value: unknown): value is GameCommand {
  return typeof value === 'object' && value !== null && Object.keys(value as object).length > 0;
}

export function isGamePhase(value: unknown): value is GamePhase {
  return typeof value === 'string' || (typeof value === 'object' && value !== null);
}

export function isTurnStage(value: unknown): value is TurnStage {
  return typeof value === 'object' && value !== null;
}
```

## 2. WebSocket Envelope Types

The server uses an envelope format with `kind` and `payload` (see `crates/mahjong_server/src/network/messages.rs`). The client needs explicit types for:

- `Authenticate`, `AuthSuccess`, `AuthFailure`
- `CreateRoom`, `JoinRoom`, `LeaveRoom`, `CloseRoom`
- `Command`, `Event`, `StateSnapshot`
- `Ping`, `Pong`, `Error`, `RoomJoined`, `RoomLeft`, `RoomClosed`, `RoomMemberLeft`

**New file: `apps/client/src/types/envelope.ts`**

```ts
import type { GameCommand, GameEvent, GameStateSnapshot, Seat } from './bindings';

export type Envelope =
  | { kind: 'Authenticate'; payload: AuthenticatePayload }
  | { kind: 'AuthSuccess'; payload: AuthSuccessPayload }
  | { kind: 'AuthFailure'; payload: AuthFailurePayload }
  | { kind: 'CreateRoom'; payload: Record<string, never> }
  | { kind: 'JoinRoom'; payload: { room_id: string } }
  | { kind: 'LeaveRoom'; payload: Record<string, never> }
  | { kind: 'CloseRoom'; payload: Record<string, never> }
  | { kind: 'Command'; payload: { command: GameCommand } }
  | { kind: 'Event'; payload: { event: GameEvent } }
  | { kind: 'RoomJoined'; payload: { room_id: string; seat: Seat } }
  | { kind: 'RoomLeft'; payload: { room_id: string } }
  | { kind: 'RoomClosed'; payload: { room_id: string } }
  | { kind: 'RoomMemberLeft'; payload: { room_id: string; player_id: string; seat: Seat } }
  | { kind: 'StateSnapshot'; payload: { snapshot: GameStateSnapshot } }
  | { kind: 'Ping'; payload: { timestamp: string } }
  | { kind: 'Pong'; payload: { timestamp: string } }
  | { kind: 'Error'; payload: ErrorPayload };

export type AuthMethod = 'guest' | 'token' | 'jwt';

export type AuthenticatePayload = {
  method: AuthMethod;
  credentials?: { token: string };
  version: string;
};

export type AuthSuccessPayload = {
  player_id: string;
  display_name: string;
  session_token: string;
  room_id?: string;
  seat?: Seat;
};

export type AuthFailurePayload = { reason: string };

export type ErrorPayload = {
  code:
    | 'INVALID_CREDENTIALS'
    | 'ROOM_NOT_FOUND'
    | 'ROOM_FULL'
    | 'INVALID_COMMAND'
    | 'NOT_YOUR_TURN'
    | 'INVALID_TILE'
    | 'RATE_LIMIT_EXCEEDED'
    | 'UNAUTHENTICATED'
    | 'INTERNAL_ERROR';
  message: string;
  context?: unknown;
};
```

## 3. Tile Model Utilities and Assets

**Tile is a number (0-36)** with the mapping below:

- 0-8: Bams (1-9)
- 9-17: Craks (1-9)
- 18-26: Dots (1-9)
- 27-30: Winds (E,S,W,N)
- 31-33: Dragons (Green, Red, White)
- 34: Flower
- 35: Joker
- 36: Blank (house rule)

**New file: `apps/client/src/utils/tile.ts`**

```ts
import type { Tile } from '@/types/bindings';

export type TileSuit = 'Bam' | 'Crak' | 'Dot' | 'Wind' | 'Dragon' | 'Flower' | 'Joker' | 'Blank';
export type TileRank = number | 'East' | 'South' | 'West' | 'North' | 'Green' | 'Red' | 'White';

export function decodeTile(tile: Tile): { suit: TileSuit; rank: TileRank } {
  if (tile <= 8) return { suit: 'Bam', rank: tile + 1 };
  if (tile <= 17) return { suit: 'Crak', rank: tile - 8 };
  if (tile <= 26) return { suit: 'Dot', rank: tile - 17 };
  if (tile <= 30) {
    const winds: TileRank[] = ['East', 'South', 'West', 'North'];
    return { suit: 'Wind', rank: winds[tile - 27] };
  }
  if (tile <= 33) {
    const dragons: TileRank[] = ['Green', 'Red', 'White'];
    return { suit: 'Dragon', rank: dragons[tile - 31] };
  }
  if (tile === 34) return { suit: 'Flower', rank: 1 };
  if (tile === 35) return { suit: 'Joker', rank: 1 };
  return { suit: 'Blank', rank: 1 };
}

export function tileLabel(tile: Tile): string {
  const { suit, rank } = decodeTile(tile);
  if (suit === 'Bam' || suit === 'Crak' || suit === 'Dot') return `${rank} ${suit}`;
  if (suit === 'Wind') return `${rank} Wind`;
  if (suit === 'Dragon') return `${rank} Dragon`;
  return suit;
}

export function tileAssetPath(tile: Tile): string {
  if (tile <= 8) return `/assets/tiles/Mahjong_${tile + 1}s.svg`;
  if (tile <= 17) return `/assets/tiles/Mahjong_${tile - 8}m.svg`;
  if (tile <= 26) return `/assets/tiles/Mahjong_${tile - 17}p.svg`;
  if (tile <= 30) {
    const map = ['E', 'S', 'W', 'N'];
    return `/assets/tiles/Mahjong_${map[tile - 27]}.svg`;
  }
  if (tile <= 33) {
    const map = ['H', 'R', 'T'];
    return `/assets/tiles/Mahjong_${map[tile - 31]}.svg`;
  }
  if (tile === 35) return `/assets/tiles/U+1F02A_MJjoker.svg`;
  if (tile === 34) return `/assets/tiles/Mahjong_Flower.svg`;
  return `/assets/tiles/Mahjong_Blank.svg`;
}
```

**Assets**

Place tile assets in `apps/client/src/assets/tiles/` or `public/assets/tiles/` based on bundling strategy. Ensure the filenames match the mapping above.

## 4. Network Hook and Connection Lifecycle

**File:** `apps/client/src/hooks/useGameSocket.ts`

**Responsibilities**

- Connect/disconnect WebSocket.
- Authenticate (guest, token, or JWT).
- Handle Ping/Pong.
- Route `Event` to `ActionQueue` and `GameStore.applyEvent`.
- Handle `StateSnapshot` for reconnection.
- Handle room messages (`RoomJoined`, `RoomLeft`, `RoomMemberLeft`, `RoomClosed`).
- Provide typed command/room helpers.

**Signature**

```ts
type UseGameSocketArgs = {
  url: string;
  auth: { method: 'guest' | 'token' | 'jwt'; token?: string };
  roomId?: string;
};

export function useGameSocket(args: UseGameSocketArgs): {
  connect: () => void;
  disconnect: () => void;
  status: { connected: boolean; connecting: boolean; lastError?: string };
  sendCommand: (command: GameCommand) => void;
  createRoom: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  closeRoom: () => void;
};
```

**On connect**

1. Open socket.
2. Send `Authenticate` envelope.
3. On `AuthSuccess`, store `session_token` and (if provided) `room_id` + `seat`.
4. If `room_id` exists, send `RequestState` and expect `StateSnapshot`.

## 5. Zustand Stores

**GameStore** (`apps/client/src/store/gameStore.ts`)

```ts
type GameStore = {
  phase: GamePhase;
  currentTurn: Seat | null;
  dealer: Seat | null;
  roundNumber: number;
  remainingTiles: number;
  discardPile: DiscardInfo[];
  players: PublicPlayerInfo[];
  houseRules: HouseRules | null;
  yourSeat: Seat | null;
  yourHand: Tile[];
  applyEvent: (event: GameEvent) => void;
  applySnapshot: (snapshot: GameStateSnapshot) => void;
  isMyTurn: () => boolean;
  canCall: () => boolean;
};
```

**SessionStore** (`apps/client/src/store/sessionStore.ts`)

```ts
type SessionStore = {
  playerId: string | null;
  displayName: string | null;
  sessionToken: string | null;
  roomId: string | null;
  seat: Seat | null;
  setAuth: (payload: AuthSuccessPayload) => void;
  clearSession: () => void;
};
```

**UIStore** (`apps/client/src/store/uiStore.ts`)

```ts
type UIStore = {
  selectedTileKeys: Set<string>;
  draggedTileKey: string | null;
  activeModal: 'settings' | 'card' | 'opponent' | null;
  errors: string[];
  toasts: Array<{ id: string; type: 'info' | 'error' | 'success'; message: string }>;
  setSelectedTileKeys: (keys: Set<string>) => void;
  clearSelection: () => void;
  addError: (msg: string) => void;
  clearErrors: () => void;
};
```

## 6. Action Queue (Animation Gate)

**File:** `apps/client/src/hooks/useActionQueue.ts`

Queue incoming `GameEvent`s. Only apply events after animations are complete. Provide utilities:

- `enqueue(event: GameEvent)`
- `playAnimationFor(event)`
- `applyEvent(event)` (calls `gameStore.applyEvent`)

## 7. Testing Infrastructure

**Tooling:** Vitest + React Testing Library.

**Test Plan**

- `tile.ts` mapping correctness.
- `useGameSocket` handles AuthSuccess, Ping/Pong, and StateSnapshot.
- `gameStore.applyEvent` handles `TileDiscarded`, `TileDrawn`, `TileCalled`, `GameOver`.
- `sessionStore` persists `session_token` and `room_id`.

**Files**

- `apps/client/src/test/setup.ts`
- `apps/client/src/utils/__tests__/tile.test.ts`
- `apps/client/src/hooks/__tests__/useGameSocket.test.ts`

## Deliverables

1. Strong typing surface and guards.
2. WebSocket envelope types.
3. Tile rendering utilities aligned with Tile(u8).
4. Socket hook with auth, room ops, and snapshot handling.
5. Game/session/UI stores with event application.
6. Baseline unit tests.
