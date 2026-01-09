# 04. Client State + UI Contracts Implementation Spec

This document specifies how the client manages state and applies events.

---

## 1. State Layers

### 1.1 Game Store (Authoritative Mirror)

- Mirrors server truth
- Mutated only by applying `GameEvent`
- No optimistic updates for core game state

Key fields:

- `phase: GamePhase`
- `players: Record<Seat, PlayerPublic>`
- `mySeat: Seat | null`
- `turn: Seat`
- `wallRemaining: number`
- `discardPile: Tile[]`
- `hands: { concealed: Tile[], exposed: Meld[] }` (only for local player)

### 1.2 UI Store (Volatile)

- Local UI state
- Selection, hover, drag, modal state

Key fields:

- `selectedTiles: Set<string>`
- `draggedTile: Tile | null`
- `showCardViewer: boolean`

---

## 2. Event Application Order

Events are processed FIFO and applied in order.

Rules:

- Client must not reorder events.
- Event application is blocked while animations are running.

---

## 3. Animation Queue

- Events enqueue animation actions
- Only after animation completes is `gameStore` mutated

Pseudo-flow:

1. Receive event
2. Enqueue animation
3. Play animation (with timeout)
4. Apply event to store

Timeout Handling:

- Each animation has max duration (e.g., 2 seconds for discard, 1 second for tile draw)
- If animation doesn't complete within timeout, force completion and apply state
- User preference to disable animations (instant state updates)
- On reconnect: clear animation queue and apply all pending events immediately

---

## 4. Command Dispatch Rules

Commands are dispatched only from user intent:

- Discard
- Call/Pass
- Charleston pass
- Declare Mahjong

No command is sent unless:

- State allows it (phase/turn)
- Client has required tile in local hand

---

## 5. Seat Rotation

- Server seat order is fixed: East, South, West, North
- Local player is always rendered at bottom
- Visual seat mapping:
  - `visualIndex = (serverSeatIndex - mySeatIndex + 4) % 4`

Example:

- Server seats: East=0, South=1, West=2, North=3
- If local player is West (seat 2):
  - West (2): visualIndex = (2 - 2 + 4) % 4 = 0 (bottom)
  - North (3): visualIndex = (3 - 2 + 4) % 4 = 1 (left)
  - East (0): visualIndex = (0 - 2 + 4) % 4 = 2 (top)
  - South (1): visualIndex = (1 - 2 + 4) % 4 = 3 (right)

---

## 6. Card Viewer

- Load `cardYYYY.json` locally
- Filter by section
- Highlight potential matches

---

## 7. Reconnection Handling

- On reconnect: request state
- Replace `gameStore` entirely with server snapshot
- Clear animation queue

---

## 8. Testing Checklist

- Apply event ordering
- Animation queue defers state
- Seat rotation mapping
- Reconnect resync
