# 10. Frontend Architecture

The frontend is the "Presentation Layer" of the application. It is built with **React** (for UI), **Zustand** (for state), and **Framer Motion** (for animation), wrapped in **Tauri** for native deployment.

Its primary responsibility is to visualize the "Truth" provided by the server and capture user intents as "Commands".

## 10.1 Technology Stack

| Component      | Technology           | Role                                              |
| :------------- | :------------------- | :------------------------------------------------ |
| **Framework**  | **React 18+**        | Component-based UI structure.                     |
| **Build Tool** | **Vite**             | Fast development server and bundling.             |
| **Language**   | **TypeScript**       | Type safety, sharing types with Rust via `ts-rs`. |
| **State**      | **Zustand**          | Minimalist global state management.               |
| **Styling**    | **Tailwind CSS**     | Utility-first styling for rapid layout.           |
| **Animation**  | **Framer Motion**    | Declarative, physics-based animations.            |
| **Network**    | **Native WebSocket** | Real-time communication with `mahjong_server`.    |
| **Native**     | **Tauri v2**         | System integration (Windows/macOS/Mobile).        |

---

## 10.2 Directory Structure (`apps/client`)

The client application structure focuses on feature separation and clean architectural layers.

```text
apps/client/src/
├── assets/              # Static assets (images, fonts, sounds)
│   └── tiles/           # SVG/PNG definitions for tile faces
├── components/          # React Components
│   ├── game/            # Game-specific components (Table, Tile, Hand)
│   ├── ui/              # Generic UI (Buttons, Modals, Toasts)
│   └── layout/          # Page layouts (Lobby, GameRoom)
├── hooks/               # Custom React Hooks
│   ├── useGameSocket.ts # WebSocket management
│   ├── useActionQueue.ts# Animation sequencing
│   └── useKeyboard.ts   # Shortcuts
├── store/               # Zustand Stores
│   ├── gameStore.ts     # Mirrors server state (Table, Players)
│   ├── uiStore.ts       # Local UI state (selection, drag)
│   └── settingsStore.ts # User preferences (audio, theme)
├── animations/          # Framer Motion definitions
│   ├── variants.ts      # Reusable animation objects
│   └── orchestrator.ts  # Complex sequence logic
├── utils/               # Helpers
│   └── sound.ts         # Audio manager
└── types/               # TypeScript Definitions
    └── bindings/        # ⚠️ AUTO-GENERATED from Rust (do not edit)
```text

---

## 10.3 State Management Strategy

We use a **Split State** approach to separate the "Server Truth" from "Client Volatility".

### 10.3.1 The Game Store (Server Truth)

`gameStore.ts` strictly mirrors the state received from `mahjong_server`. It is updated _only_ by processing `GameEvent`s.

```typescript
interface GameStore {
  // synced from server
  phase: GamePhase;
  players: Record<Seat, PlayerPublic>;
  mySeat: Seat | null;
  turn: Seat;
  wallRemaining: number;
  discardPile: Tile[];

  // computed/derived
  isMyTurn: () => boolean;
  canCall: () => boolean;
}
```text

### 10.3.2 The UI Store (Client Volatility)

`uiStore.ts` handles purely local interaction state that the server doesn't care about.

```typescript
interface UIStore {
  selectedTiles: Set<string>; // For Charleston/Discard
  hoveredTile: string | null;
  isDragging: boolean;
  draggedTile: Tile | null;
  showCardViewer: boolean;
  sortingMode: 'suit' | 'rank';
}
```text

---

## 10.4 The Action Queue (Animation Architecture)

**The Problem**: Server events are instant (`TileDiscarded` happens at t=0), but the UI needs to show the tile flying from the hand to the center (taking 500ms). If we update the store immediately, the tile "teleports".

**The Solution**: An **Action Queue** decouples event reception from state application.

### 10.4.1 Flow Diagram

```text
[WebSocket Recv]
      ↓
[Event Parser]
      ↓
[Action Queue] ← (FIFO Buffer)
      ↓
[Action Processor]
      │
      ├─ 1. Determine Animation (e.g., "Fly Tile")
      ├─ 2. Play Sound ("Clack")
      ├─ 3. Wait for Animation Complete
      └─ 4. Commit State Update to Zustand
```text

### 10.4.2 Implementation

```typescript
// hooks/useActionQueue.ts
export function useActionQueue() {
  const [queue, setQueue] = useState<GameEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (queue.length > 0 && !isProcessing) {
      processNext(queue[0]);
    }
  }, [queue, isProcessing]);

  const processNext = async (event: GameEvent) => {
    setIsProcessing(true);

    // 1. Identify Animation
    const anim = getAnimationForEvent(event);

    // 2. Execute Animation (Visuals only)
    await anim.play();

    // 3. Update "Real" State
    useGameStore.getState().applyEvent(event);

    // 4. Cleanup
    setQueue((prev) => prev.slice(1));
    setIsProcessing(false);
  };
}
```text

---

## 10.5 Component Architecture

### 10.5.1 The Table (Responsive Design)

The `Table` component renders the 4-player layout. It uses a CSS Grid or Flexbox approach that rotates based on the user's seat.

- **Seat Rotation**: The local player is _always_ at the bottom.
- **Transformation**: `(server_seat - my_seat) % 4` determines visual position (Bottom, Right, Top, Left).

### 10.5.2 The Tile

The most complex visual component.

- **Props**: `suit`, `rank`, `size`, `interactive`, `hidden`.
- **Interactions**: Click (select), Drag (Framer Motion `drag`), Hover (tooltip).
- **Assets**: SVG-based faces for scalability.
- **Motion**: Uses `layoutId` from Framer Motion to automatically animate position changes (e.g., sorting hand).

### 10.5.3 The Charleston Interface

An overlay that appears during `GamePhase::Charleston`.

- **Selection**: Limits selection to exactly 3 tiles.
- **Direction**: Visual arrows indicating pass direction.
- **Blind Pass**: Checkbox for "Blind Pass" when applicable.

---

## 10.6 Network Layer

The client uses a custom hook `useGameSocket` to manage the WebSocket connection.

### 10.6.1 Connection Lifecycle

1. **Connect**: On app mount or game join.
2. **Authenticate**: Send handshake (if auth implemented).
3. **Heartbeat**: Ping/Pong to keep connection alive.
4. **Reconnect**: Exponential backoff on disconnect.

### 10.6.2 Command Dispatch

Strictly typed wrappers around the `Command` enum ensure valid data is sent.

```typescript
// utils/commands.ts
export const sendDiscard = (socket: WebSocket, tile: Tile) => {
  const cmd: Command = {
    type: 'DiscardTile',
    player: useGameStore.getState().mySeat,
    tile,
  };
  socket.send(JSON.stringify(cmd));
};
```text

---

## 10.7 "The Card" Viewer

Displaying the NMJL card requires a flexible, data-driven component since the card changes annually.

- **Data Source**: JSON loaded from `data/cards/cardYYYY.json`.
- **Filtering**:
  - Filter by Section (e.g., "2468", "Winds - Dragons").
  - **Hand Matching**: Highlight patterns that match a subset of the player's current tiles (Client-side logic).
- **Interaction**: Click a pattern to "pin" it (highlighting needed tiles in the hand).

---

## 10.8 Tauri & Native Integration

When running in Tauri, the client accesses native capabilities via the Rust bridge.

### 10.8.1 Haptics

- **Scenario**: It's your turn, or you successfully called a tile.
- **Implementation**: Call `tauri::plugin::haptics` on mobile; ignored on desktop.

### 10.8.2 Window Management

- **Desktop**: Custom title bar (frameless window).
- **Shortcuts**: `Ctrl+S` (Sort), `Space` (Draw/Pass).

---

## 10.9 Performance Considerations

1. **Render Loop**: Only the `Table` and `Hand` subscribe to high-frequency updates.
2. **Asset Loading**: Tile images are preloaded or used as Sprites.
3. **Animation Budget**: Framer Motion is efficient, but we limit concurrent animations on mobile devices.
4. **Re-renders**: `useGameStore` selectors are granular (e.g., `useGameStore(state => state.turn)`) to prevent full-app re-renders on minor state changes.
