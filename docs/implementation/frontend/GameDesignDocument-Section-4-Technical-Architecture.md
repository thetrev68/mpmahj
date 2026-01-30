# Game Design Document - Section 4: Technical Architecture

## Table of Contents

- [Overview](#overview)
- [4.1 Type System & Code Generation](#41-type-system--code-generation)
  - [4.1.1 Rust → TypeScript Binding Pipeline](#411-rust--typescript-binding-pipeline)
  - [4.1.2 Core Generated Types](#412-core-generated-types)
  - [4.1.3 Tile Representation](#413-tile-representation)
- [4.2 State Management Architecture](#42-state-management-architecture)
  - [4.2.1 Zustand Store Design](#421-zustand-store-design)
  - [4.2.2 Event Processing Pipeline](#422-event-processing-pipeline)
  - [4.2.3 Zero Optimistic Updates](#423-zero-optimistic-updates)
- [4.3 WebSocket Protocol](#43-websocket-protocol)
  - [4.3.1 Connection Management](#431-connection-management)
  - [4.3.2 Command Sending & Reconnection](#432-command-sending--reconnection)
- [4.4 Animation System](#44-animation-system)
  - [4.4.1 Event Orchestration](#441-event-orchestration)
  - [4.4.2 Framer Motion Integration](#442-framer-motion-integration)
- [4.5 Component Architecture](#45-component-architecture)
  - [4.5.1 Component Hierarchy](#451-component-hierarchy)
  - [4.5.2 Component Patterns](#452-component-patterns)
  - [4.5.3 Custom Hooks](#453-custom-hooks)
- [4.6 Testing Strategy](#46-testing-strategy)
  - [4.6.1 Testing Pyramid](#461-testing-pyramid)
  - [4.6.2 Test Examples](#462-test-examples)
- [4.7 Build & Deployment](#47-build--deployment)
  - [4.7.1 Development & Production](#471-development--production)
  - [4.7.2 Tauri Desktop Build (Optional)](#472-tauri-desktop-build-optional)
- [4.8 Known Technical Debt & Future Improvements](#48-known-technical-debt--future-improvements)
- [Summary](#summary)
- [Appendix: File Structure Reference](#appendix-file-structure-reference)

---

## Overview

This section defines the **frontend technical architecture**, tooling, and implementation patterns for the American Mahjong application. The architecture is designed for real-time multiplayer with server-authoritative state management.

**Key Principles:**

- **Server-Authoritative:** All game logic executes on Rust backend; frontend displays state.
- **Event-Driven Updates:** WebSocket event stream updates local state (no REST polling).
- **Type-Safe Contract:** Rust types auto-generate TypeScript bindings for API safety.
- **Zero Optimistic Updates:** Wait for server confirmation before updating UI (prevents desyncs).
- **Responsive Design:** Single codebase for desktop/tablet (mobile landscape-only).

**Technology Stack:**

- **Framework:** React 19.2 + TypeScript 5.9
- **Build Tool:** Vite 7.2
- **State Management:** Zustand 5.0 (with Immer middleware)
- **Networking:** WebSocket (native browser API, no socket.io)
- **Animation:** Framer Motion 11.15
- **Type Generation:** ts-rs (from Rust → TypeScript)
- **Testing:** Vitest 4.0 + React Testing Library (to be implemented)
- **Linting:** ESLint 9.39 + Prettier
- **Desktop Build (Optional):** Tauri (for native app distribution)

---

## 4.1 Type System & Code Generation

### 4.1.1 Rust → TypeScript Binding Pipeline

**Philosophy:** Backend owns type definitions. Frontend imports generated types—**never** hand-writes duplicate types.

**Generation Process:**

**Backend (Rust):**

```rust
// crates/mahjong_core/src/tile.rs
use ts_rs::TS;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum Tile {
    Bam1, Bam2, Bam3, /* ... */
    Joker,
}
```

**Generate Bindings:**

```bash
cd crates/mahjong_core
cargo test export_bindings
# Outputs: apps/client/src/types/bindings/generated/Tile.ts
```

**Frontend (TypeScript):**

```typescript
// apps/client/src/components/TileDisplay.tsx
import type { Tile } from '@/types/bindings/generated/Tile';

function TileDisplay({ tile }: { tile: Tile }) {
  switch (tile) {
    case 'Bam1': return <BambooOne />;
    case 'Joker': return <JokerTile />;
    // ...
  }
}
```

### 4.1.2 Core Generated Types

**Location:** `apps/client/src/types/bindings/generated/`

**Key Type Files:**

- **`Tile.ts`** - Tile enum (Bam1-9, Crak1-9, Dot1-9, Winds, Dragons, Flowers, Joker, Blanks)
- **`GamePhase.ts`** - Phase enum (WaitingForPlayers, Setup, Charleston, Playing, Ended)
- **`TurnStage.ts`** - Turn substage (Drawing, Discarding, CallWindow, AwaitingMahjong)
- **`CharlestonStage.ts`** - Charleston substage (FirstRight, FirstAcross, FirstLeft, etc.)
- **`GameCommand.ts`** - All commands (DrawTile, DiscardTile, PassTiles, etc.)
- **`Event.ts`** - Event wrapper (Public/Private discriminated union)
- **`PublicEvent.ts`** - Events visible to all players (TileDiscarded, TurnChanged, etc.)
- **`PrivateEvent.ts`** - Events visible to specific players (TilesDealt, TileDrawnPrivate, etc.)
- **`GameStateSnapshot.ts`** - Full game state structure
- **`Seat.ts`** - Player position enum (East, South, West, North)
- **`Meld.ts`** - Exposed meld structure (type, tiles)
- **`HouseRules.ts`** - Game configuration

**Type-Safe Command Builder:**

```typescript
// apps/client/src/utils/commands.ts
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

export const Commands = {
  drawTile: (player: Seat): GameCommand => ({
    DrawTile: { player }
  }),
  
  discardTile: (player: Seat, tile: Tile): GameCommand => ({
    DiscardTile: { player, tile }
  }),
  
  passTiles: (player: Seat, tiles: Tile[], blind_pass_count?: number): GameCommand => ({
    PassTiles: { player, tiles, blind_pass_count: blind_pass_count ?? null }
  }),
  
  // ... other command builders
};
```

### 4.1.3 Tile Representation

**Rust Format (u8 index 0-41):** Backend uses tile indices for performance (histogram operations). Mapping: 0-8 = Bams, 9-17 = Craks, 18-26 = Dots, 27-30 = Winds, 31-33 = Dragons, 34 = Flower, 35-40 = Blanks/padding.

**TypeScript Format (Enum Variants):** Frontend uses string enums for readability. Example: `'Bam1' | 'Bam2' | ... | 'Joker'`

**Conversion Utilities:**

```typescript
// apps/client/src/utils/tileFormatter.ts
export function tileToString(tile: Tile): string {
  // 'Bam1' → '1B', 'RedDragon' → 'RD', etc.
}

export function tileToImagePath(tile: Tile): string {
  // Returns path to tile asset: '/assets/tiles/bam1.png'
}
```

---

## 4.2 State Management Architecture

### 4.2.1 Zustand Store Design

**Philosophy:** Single source of truth mirroring server state. No client-side game logic.

**Store Structure:**

**`gameStore.ts` (Main Game State):**

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface GameState {
  // Core Game State
  phase: GamePhase;
  currentTurn: Seat | null;
  dealer: Seat | null;
  roundNumber: number;
  remainingTiles: number;
  discardPile: DiscardInfo[];
  
  // Player Data
  players: Record<Seat, PublicPlayerInfo>;
  meldSources: Record<Seat, Array<Seat | null>>;
  yourSeat: Seat | null;
  yourHand: Tile[];
  
  // Metadata
  houseRules: HouseRules | null;
  isPaused: boolean;
  pausedBy: Seat | null;
  hostSeat: Seat | null;
  
  // State Mutations
  applyEvent: (event: Event) => void;
  applySnapshot: (snapshot: GameStateSnapshot) => void;
  reset: () => void;
  
  // Computed Selectors
  isMyTurn: () => boolean;
  canDiscard: () => boolean;
  canCall: () => boolean;
  isHost: () => boolean;
}

export const useGameStore = create<GameState>()(
  immer((set, get) => ({
    // Initial state...
    
    applyEvent: (event) => set((state) => {
      const normalized = normalizeEvent(event);
      
      if (normalized.kind === 'Public') {
        applyPublicEvent(state, normalized.event);
      } else {
        applyPrivateEvent(state, normalized.event);
      }
    }),
    
    // ...
  }))
);
```

**`uiStore.ts` (UI-Only State):**

```typescript
interface UIState {
  selectedTiles: Tile[];
  showCardViewer: boolean;
  showGameMenu: boolean;
  showHistoryPanel: boolean;
  errors: Array<{ id: string; message: string }>;
  
  setSelectedTiles: (tiles: Tile[]) => void;
  toggleCardViewer: () => void;
  addError: (message: string) => void;
  clearErrors: () => void;
}

export const useUIStore = create<UIState>()(/* ... */);
```

**`analysisStore.ts` (AI Hints State):**

```typescript
interface AnalysisState {
  hints: Record<HintVerbosity, HintData | null>;
  pendingRequests: Set<HintVerbosity>;
  lastRequestTime: number | null;
  
  updateHint: (verbosity: HintVerbosity, hint: HintData) => void;
  clearPendingRequests: () => void;
}

export const analysisStore = create<AnalysisState>()(/* ... */);
```

**`authStore.ts` (Authentication State):**

```typescript
interface AuthState {
  user: User | null;
  jwt: string | null;
  session: Session | null;
  
  checkSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(/* ... */);
```

### 4.2.2 Event Processing Pipeline

**Event Flow:**

```text
WebSocket Message
  → useGameSocket parses Envelope
  → Extracts Event
  → useActionQueue.enqueueEvent()
  → Animation orchestrator intercepts
  → Delays/queues animations
  → Calls gameStore.applyEvent()
  → State updated
  → React re-renders
```

**Event Normalization:**

```typescript
// apps/client/src/utils/events.ts
export function normalizeEvent(event: Event): NormalizedEvent {
  if ('Public' in event) {
    return { kind: 'Public', event: event.Public };
  } else if ('Private' in event) {
    return { kind: 'Private', event: event.Private };
  } else {
    throw new Error('Unknown event type');
  }
}
```

**State Mutation Handlers:**

```typescript
function applyPublicEvent(state: Draft<GameState>, event: PublicEvent) {
  switch (event.kind) {
    case 'TileDiscarded':
      state.discardPile.push({
        tile: event.tile,
        player: event.player,
        timestamp: Date.now(),
      });
      break;
    
    case 'TurnChanged':
      state.currentTurn = event.player;
      state.phase = { Playing: event.stage };
      break;
    
    case 'CharlestonPhaseChanged':
      state.phase = { Charleston: event.stage };
      break;
    
    // ... 40+ event handlers
  }
}
```

### 4.2.3 Zero Optimistic Updates

**Anti-Pattern (DO NOT DO):**

```typescript
// ❌ BAD: Optimistic update
function handleDiscard(tile: Tile) {
  setHand(hand.filter(t => t !== tile));  // Remove tile from UI immediately
  sendCommand({ DiscardTile: { player, tile } });  // Send command
  // Problem: If server rejects, UI is out of sync!
}
```

**Correct Pattern:**

```typescript
// ✅ GOOD: Wait for server confirmation
function handleDiscard(tile: Tile) {
  setIsDiscarding(true);  // Show loading state
  sendCommand({ DiscardTile: { player, tile } });  // Send command
  
  // Wait for TileDiscarded event
  // State update happens in gameStore.applyEvent()
  // React re-renders automatically
}

// Event handler (in gameStore)
case 'TileDiscarded':
  if (event.player === state.yourSeat) {
    state.yourHand = state.yourHand.filter(t => t !== event.tile);  // Server confirmed discard
    setIsDiscarding(false);
  }
  break;
```

**Why This Matters:** Network latency (command may be rejected), race conditions (multiple commands in flight), replay/history (optimistic updates break).

---

## 4.3 WebSocket Protocol

### 4.3.1 Connection Management

**`useGameSocket` Hook:**

```typescript
const socket = useGameSocket({
  url: 'ws://localhost:3000/ws',
  gameId: roomId,
  playerId: user.id,
  authToken: jwt,
  authMethod: 'jwt',
});

// Returns: { status, sendCommand, createRoom, joinRoom, leaveRoom, disconnect }
```

**Connection Lifecycle:**

```text
Disconnected
  → connect()
  → Connecting
  → WebSocket.OPEN
  → Send Authenticate envelope
  → Receive AuthSuccess
  → Connected
  [If reconnect: Send RequestState]
  
[On error:]
  → Exponential backoff (1s, 2s, 4s, 8s, ... max 30s)
  → Max 10 attempts
  → If fails: Show "Reconnection failed" modal
```

**Envelope Structure:**

```typescript
// Server → Client
type InboundEnvelope =
  | { kind: 'AuthSuccess'; payload: { session_token: string; ... } }
  | { kind: 'Event'; payload: { event: Event } }
  | { kind: 'StateSnapshot'; payload: { snapshot: GameStateSnapshot } }
  | { kind: 'Error'; payload: { message: string } }
  | { kind: 'RoomJoined'; payload: { room_id: string; seat: Seat } }
  | { kind: 'Ping'; payload: { timestamp: string } };

// Client → Server
type OutboundEnvelope =
  | { kind: 'Authenticate'; payload: { method: 'jwt'; credentials: { token: string } } }
  | { kind: 'Command'; payload: { command: GameCommand } }
  | { kind: 'CreateRoom'; payload: CreateRoomPayload }
  | { kind: 'JoinRoom'; payload: { room_id: string } }
  | { kind: 'LeaveRoom'; payload: {} }
  | { kind: 'Pong'; payload: { timestamp: string } };
```

### 4.3.2 Command Sending & Reconnection

**Simple Command:**

```typescript
const { sendCommand } = useGameSocket(/* ... */);

// Draw tile
sendCommand({ DrawTile: { player: Seat.East } });

// Discard tile
sendCommand({ DiscardTile: { player: Seat.East, tile: 'Bam5' } });
```

**Complex Command (Charleston Pass):**

```typescript
const selectedTiles: Tile[] = ['Bam1', 'Crak3', 'Dot7'];
const blindPassCount = 0; // Standard pass

sendCommand({
  PassTiles: {
    player: yourSeat,
    tiles: selectedTiles,
    blind_pass_count: blindPassCount > 0 ? blindPassCount : null,
  }
});
```

**Command Queue (Not Needed):** Commands are sent immediately, not queued. Backend enforces turn order—invalid commands rejected with Error envelope.

**Reconnection Strategy:**

**Session Persistence:**

```typescript
// Store session token across page reloads
const sessionTokenRef = useRef<string | null>(
  localStorage.getItem('mahjong_session')
);

// On AuthSuccess, save token
socket.on('AuthSuccess', (payload) => {
  sessionTokenRef.current = payload.session_token;
  localStorage.setItem('mahjong_session', payload.session_token);
  
  // If reconnecting, request current state
  if (wasReconnect && payload.seat) {
    sendCommand({ RequestState: { player: payload.seat } });
  }
});
```

**Exponential Backoff:**

```typescript
function reconnect() {
  const delay = Math.min(
    BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY
  );
  
  setTimeout(() => {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      connect();
      reconnectAttempts++;
    } else {
      showReconnectionFailedModal();
    }
  }, delay);
}
```

**State Resync:**

```typescript
// On reconnect, backend sends StateSnapshot
case 'StateSnapshot':
  gameStore.replaceFromSnapshot(envelope.payload.snapshot);
  // Resets entire store to server state (no merging)
  break;
```

---

## 4.4 Animation System

### 4.4.1 Event Orchestration

**Problem:** Events arrive faster than animations can play (e.g., Charleston pass completes in 50ms, but animation needs 600ms).

**Solution:** Animation queue with configurable delays.

**`useActionQueue` Hook:**

```typescript
const { enqueueEvent, clearQueue } = useActionQueue();

// In useGameSocket message handler:
case 'Event':
  enqueueEvent(envelope.payload.event);
  // Event queued with animation delay, not applied immediately
  break;
```

**Orchestrator Logic:**

```typescript
// apps/client/src/animations/orchestrator.ts
export function getEventAnimationDelay(event: Event): number {
  const normalized = normalizeEvent(event);
  
  if (normalized.kind === 'Public') {
    switch (normalized.event.kind) {
      case 'TileDiscarded': return 500; // Wait for discard animation
      case 'TilesPassing': return 700;  // Wait for pass animation
      case 'TurnChanged': return 200;   // Brief delay for turn indicator
      case 'CallWindowOpened': return 300;
      default: return 0; // Instant
    }
  }
  
  return 0; // Private events usually instant
}
```

**Queue Processing:**

```typescript
// Process one event at a time
useEffect(() => {
  if (queue.length > 0 && !isProcessing) {
    const event = queue[0];
    const delay = getEventAnimationDelay(event);
    
    setIsProcessing(true);
    
    setTimeout(() => {
      gameStore.applyEvent(event);
      dequeueEvent();
      setIsProcessing(false);
    }, delay);
  }
}, [queue, isProcessing]);
```

### 4.4.2 Framer Motion Integration

**Tile Discard Animation:**

```typescript
import { motion } from 'framer-motion';

function Tile({ tile, onDiscard }: TileProps) {
  const [isDiscarding, setIsDiscarding] = useState(false);
  
  return (
    <motion.div
      animate={isDiscarding ? {
        x: 200,      // Slide to center
        y: 100,
        rotate: 7,   // Slight rotation
        opacity: 0.8,
      } : {}}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      onAnimationComplete={() => {
        if (isDiscarding) {
          onDiscard();
          setIsDiscarding(false);
        }
      }}
    >
      <img src={tileToImagePath(tile)} alt={tileToString(tile)} />
    </motion.div>
  );
}
```

**Charleston Pass Animation:**

```typescript
function PassAnimation({ direction }: { direction: PassDirection }) {
  const arrows = {
    Right: { rotate: 0, x: 150 },
    Across: { rotate: -90, y: 150 },
    Left: { rotate: 180, x: -150 },
  };
  
  return (
    <motion.div
      className="pass-arrow"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0.5, 1, 1, 0.5],
        ...arrows[direction],
      }}
      transition={{ duration: 0.7 }}
    />
  );
}
```

**Stagger Animations (Dealing):**

```typescript
function HandRack({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="hand-rack">
      {tiles.map((tile, index) => (
        <motion.div
          key={tileKey(tile, index)}
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: index * 0.05, // Stagger 50ms per tile
            duration: 0.3,
          }}
        >
          <TileDisplay tile={tile} />
        </motion.div>
      ))}
    </div>
  );
}
```

---

## 4.5 Component Architecture

### 4.5.1 Component Hierarchy

```text
<App>
  ├── <AuthForm>                    (Supabase login, if enabled)
  ├── <ConnectionPanel>             (Room create/join, connection status)
  ├── <GameTable>
  │   ├── <Background>              (Green felt texture)
  │   ├── <Wall>
  │   │   └── <WallSection>[] × 4   (East/South/West/North walls)
  │   ├── <DiscardFloor>
  │   │   └── <DiscardedTile>[]
  │   ├── <PlayerRack position="south" isUser={true}>
  │   │   ├── <ConcealedHand>
  │   │   │   └── <Tile>[] (draggable, selectable)
  │   │   ├── <ExposureArea>
  │   │   │   └── <MeldDisplay>[]
  │   │   └── <ActionBar>
  │   │       ├── <DrawButton>
  │   │       ├── <DiscardButton>
  │   │       ├── <CallButton>
  │   │       └── <MahjongButton>
  │   ├── <OpponentRack>[] × 3      (East/North/West)
  │   │   ├── <ConcealedArea>       (tile backs + count)
  │   │   ├── <ExposureArea>
  │   │   └── <InfoPanel>
  │   └── <HUD>
  │       ├── <TurnIndicator>
  │       ├── <WallCounter>
  │       ├── <CharlestonTracker>
  │       ├── <GameMenu>
  │       ├── <CardViewer>
  │       ├── <EventLog>
  │       └── <HintPanel>
  ├── <Overlays>
  │   ├── <JokerExchangeDialog>
  │   ├── <MeldUpgradeDialog>
  │   ├── <CourtesyPassDialog>
  │   ├── <VoteDialog>
  │   ├── <WinnerAnnouncement>
  │   ├── <PauseOverlay>
  │   └── <UndoVoteDialog>
  └── <AnimationLayer>
      └── <PassAnimationOverlay>
```

### 4.5.2 Component Patterns

**Smart vs. Dumb Components:**

**Smart (Container):**

```typescript
// Connects to store, handles business logic
function TurnActionsContainer() {
  const { currentTurn, yourSeat, phase } = useGameStore();
  const { sendCommand } = useGameSocket();
  
  const isMyTurn = currentTurn === yourSeat;
  const canDraw = phase === 'Playing' && phase.Drawing?.player === yourSeat;
  
  return (
    <TurnActionsView
      isMyTurn={isMyTurn}
      canDraw={canDraw}
      onDraw={() => sendCommand({ DrawTile: { player: yourSeat } })}
    />
  );
}
```

**Dumb (Presentational):**

```typescript
// Pure UI, no store access
interface TurnActionsViewProps {
  isMyTurn: boolean;
  canDraw: boolean;
  onDraw: () => void;
}

function TurnActionsView({ isMyTurn, canDraw, onDraw }: TurnActionsViewProps) {
  return (
    <div className="turn-actions">
      <button disabled={!canDraw} onClick={onDraw}>
        Draw Tile
      </button>
    </div>
  );
}
```

**Compound Components:**

```typescript
// Charleston tile selection with context
const TileSelector = {
  Root: function Root({ children, maxSelection }) {
    const [selected, setSelected] = useState<Tile[]>([]);
    
    return (
      <SelectionContext.Provider value={{ selected, setSelected, maxSelection }}>
        {children}
      </SelectionContext.Provider>
    );
  },
  
  Tile: function Tile({ tile }) {
    const { selected, setSelected, maxSelection } = useContext(SelectionContext);
    const isSelected = selected.includes(tile);
    
    const handleClick = () => {
      if (isSelected) {
        setSelected(selected.filter(t => t !== tile));
      } else if (selected.length < maxSelection) {
        setSelected([...selected, tile]);
      }
    };
    
    return <TileDisplay tile={tile} selected={isSelected} onClick={handleClick} />;
  },
  
  Counter: function Counter() {
    const { selected, maxSelection } = useContext(SelectionContext);
    return <div>{selected.length}/{maxSelection} selected</div>;
  },
};

// Usage:
<TileSelector.Root maxSelection={3}>
  <TileSelector.Counter />
  {hand.map(tile => <TileSelector.Tile key={tile} tile={tile} />)}
</TileSelector.Root>
```

### 4.5.3 Custom Hooks

**`useGamePhase`:**

```typescript
export function useGamePhase() {
  const phase = useGameStore(state => state.phase);
  
  return {
    isWaitingForPlayers: phase === 'WaitingForPlayers',
    isSetup: 'Setup' in phase,
    isCharleston: 'Charleston' in phase,
    isPlaying: 'Playing' in phase,
    isEnded: 'Ended' in phase,
    
    charlestonStage: 'Charleston' in phase ? phase.Charleston : null,
    turnStage: 'Playing' in phase ? phase.Playing : null,
  };
}
```

**`useTileSelection`:**

```typescript
export function useTileSelection(maxSelection: number) {
  const [selected, setSelected] = useState<Tile[]>([]);
  
  const toggle = (tile: Tile) => {
    if (selected.includes(tile)) {
      setSelected(selected.filter(t => t !== tile));
    } else if (selected.length < maxSelection) {
      setSelected([...selected, tile]);
    }
  };
  
  const clear = () => setSelected([]);
  const isSelected = (tile: Tile) => selected.includes(tile);
  const canSelect = selected.length < maxSelection;
  
  return { selected, toggle, clear, isSelected, canSelect };
}
```

**`useCallWindow`:**

```typescript
export function useCallWindow() {
  const phase = useGameStore(state => state.phase);
  
  if ('Playing' in phase && 'CallWindow' in phase.Playing) {
    const window = phase.Playing.CallWindow;
    return {
      isActive: true,
      tile: window.tile,
      discardedBy: window.discarded_by,
      canAct: window.can_act,
      timer: window.timer,
    };
  }
  
  return { isActive: false, tile: null, discardedBy: null, canAct: [], timer: 0 };
}
```

---

## 4.6 Testing Strategy

### 4.6.1 Testing Pyramid

```text
      /\
     /E2E\         ← Playwright (full flows)
   /------\
  /Integration\   ← Vitest + Mock WebSocket
/--------------\
/  Unit Tests   \ ← Vitest + RTL
```

**Unit Tests (70%):** Component rendering, utility functions (tileFormatter, phaseHelpers), event normalization, state selectors.

**Integration Tests (20%):** Store mutations (applyEvent), command/event flows with mock WebSocket, multi-component interactions, animation orchestration.

**E2E Tests (10%):** Full game scenarios (Charleston → Play → Win), reconnection flows, history/replay navigation.

### 4.6.2 Test Examples

**Component Test (React Testing Library):**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TileDisplay } from './TileDisplay';

describe('TileDisplay', () => {
  it('renders tile image with correct alt text', () => {
    render(<TileDisplay tile="Bam5" />);
    const img = screen.getByAltText('5B');
    expect(img).toHaveAttribute('src', '/assets/tiles/bam5.png');
  });
  
  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<TileDisplay tile="Joker" onClick={onClick} />);
    fireEvent.click(screen.getByRole('img'));
    expect(onClick).toHaveBeenCalledOnce();
  });
  
  it('applies selected styling', () => {
    render(<TileDisplay tile="RedDragon" selected />);
    expect(screen.getByRole('img').parentElement).toHaveClass('selected');
  });
});
```

**Utility Test:**

```typescript
import { tileToString, tileToImagePath } from './tileFormatter';

describe('tileFormatter', () => {
  it('formats Bam tiles', () => {
    expect(tileToString('Bam1')).toBe('1B');
    expect(tileToString('Bam9')).toBe('9B');
  });
  
  it('formats Dragon tiles', () => {
    expect(tileToString('RedDragon')).toBe('RD');
    expect(tileToString('Soap')).toBe('Soap');
  });
  
  it('returns correct image paths', () => {
    expect(tileToImagePath('Crak3')).toBe('/assets/tiles/crak3.png');
    expect(tileToImagePath('Joker')).toBe('/assets/tiles/joker.png');
  });
});
```

**Store Test:**

```typescript
import { useGameStore } from './gameStore';

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });
  
  it('applies TileDiscarded event', () => {
    const { applyEvent } = useGameStore.getState();
    
    applyEvent({
      Public: {
        kind: 'TileDiscarded',
        player: 'East',
        tile: 'Bam5',
      }
    });
    
    const pile = useGameStore.getState().discardPile;
    expect(pile).toHaveLength(1);
    expect(pile[0].tile).toBe('Bam5');
    expect(pile[0].player).toBe('East');
  });
  
  it('updates phase on CharlestonPhaseChanged', () => {
    const { applyEvent } = useGameStore.getState();
    
    applyEvent({
      Public: {
        kind: 'CharlestonPhaseChanged',
        stage: 'FirstAcross',
      }
    });
    
    const phase = useGameStore.getState().phase;
    expect(phase).toEqual({ Charleston: 'FirstAcross' });
  });
});
```

**Integration Test (Mock WebSocket):**

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGameSocket } from './useGameSocket';

class MockWebSocket {
  onmessage: ((event: MessageEvent) => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  readyState = WebSocket.OPEN;
  
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

describe('useGameSocket integration', () => {
  let mockWS: MockWebSocket;
  
  beforeEach(() => {
    mockWS = new MockWebSocket();
    global.WebSocket = vi.fn(() => mockWS) as any;
  });
  
  it('handles full command-event flow', async () => {
    const { result } = renderHook(() => useGameSocket({
      url: 'ws://test',
      gameId: 'room1',
      playerId: 'player1',
    }));
    
    // Simulate auth success
    act(() => {
      mockWS.simulateMessage({
        kind: 'AuthSuccess',
        payload: { session_token: 'abc123', seat: 'East' }
      });
    });
    
    // Send discard command
    act(() => {
      result.current.sendCommand({ DiscardTile: { player: 'East', tile: 'Bam5' } });
    });
    
    // Verify command sent
    expect(mockWS.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: { command: { DiscardTile: { player: 'East', tile: 'Bam5' } } }
      })
    );
    
    // Simulate event response
    act(() => {
      mockWS.simulateMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              kind: 'TileDiscarded',
              player: 'East',
              tile: 'Bam5'
            }
          }
        }
      });
    });
    
    // Verify store updated
    await waitFor(() => {
      const pile = useGameStore.getState().discardPile;
      expect(pile[pile.length - 1].tile).toBe('Bam5');
    });
  });
});
```

**E2E Test (Playwright - To Be Implemented):**

```typescript
import { test, expect } from '@playwright/test';

test('complete Charleston flow', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Create room
  await page.click('text=Create Room');
  await expect(page.locator('.game-status')).toContainText('Waiting for players');
  
  // Start game (with bots)
  await page.click('text=Fill with Bots');
  await page.click('text=Start Game');
  
  // Dice roll
  await expect(page.locator('.dice-overlay')).toBeVisible();
  await page.click('text=Roll Dice');
  await expect(page.locator('.wall-counter')).toContainText('tiles remaining');
  
  // Charleston First Right
  await expect(page.locator('.charleston-tracker')).toContainText('Pass Right');
  
  const tiles = page.locator('.hand-rack .tile');
  await tiles.nth(0).click();
  await tiles.nth(1).click();
  await tiles.nth(2).click();
  
  await expect(page.locator('.selection-counter')).toContainText('3/3');
  await page.click('text=Pass Tiles');
  
  // Wait for pass animation
  await expect(page.locator('.charleston-tracker')).toContainText('Pass Across', {
    timeout: 1000,
  });
  
  // Continue through Charleston...
  // (Full flow would continue to main game)
});
```

---

## 4.7 Build & Deployment

### 4.7.1 Development & Production

**Local Dev Server:**

```bash
cd apps/client
npm run dev
# Vite dev server at http://localhost:5173
# Hot module replacement enabled
```

**Environment Variables:**

```bash
# apps/client/.env.development
VITE_WS_URL=ws://localhost:3000/ws
VITE_ENABLE_HINTS=true
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx
```

**Production Build:**

```bash
npm run build
# Output: apps/client/dist/
# - index.html
# - assets/
#   - index-[hash].js
#   - index-[hash].css
```

**Build Optimizations:** Code splitting (automatic by Vite), tree shaking (dead code elimination), minification (Terser for JS, cssnano for CSS), asset hashing (cache busting via [hash] in filenames).

**Deployment Targets:** Vercel (`vercel.json` configured for SPA routing), Netlify (`_redirects` for SPA fallback), Static Hosting (Cloudflare Pages, AWS S3+CloudFront).

### 4.7.2 Tauri Desktop Build (Optional)

**Install Tauri CLI:**

```bash
npm install -D @tauri-apps/cli
```

**Build Native App:**

```bash
npm run tauri build
# Outputs: src-tauri/target/release/bundle/
# - .msi (Windows)
# - .dmg (macOS)
# - .AppImage (Linux)
```

**Advantages:** Native window controls, system tray, offline mode (with local AI, no server required), better performance (no browser overhead).

---

## 4.8 Known Technical Debt & Future Improvements

### Current Limitations (As of 2026-01)

1. **No Test Coverage:** Unit/integration/E2E tests not yet implemented. Priority: Add tests before new feature development.
2. **Animation Queue Complexity:** Current orchestrator is functional but brittle. Consider dedicated animation state machine library (XState).
3. **Type Safety Gaps:** Some Rust enums use string variants (e.g., `Tile`) instead of tagged unions. May cause runtime errors if backend adds new tile types.
4. **Accessibility:** Keyboard navigation incomplete (no tab order, ARIA labels), screen reader support minimal, color-blind mode not implemented.
5. **Performance:** No React.memo or useMemo optimizations (acceptable for now, but needed at scale), tile asset preloading not implemented (lazy loads on first render).
6. **Error Handling:** Generic error messages ("Command failed") without actionable feedback. Need specific error codes from backend (e.g., `ERR_INVALID_TILE_COUNT`).

### Planned Improvements

**Phase 1 (Pre-TDD):** Add comprehensive test suite (Sections 1-3 as test specs), implement accessibility (keyboard shortcuts, ARIA, screen reader), improve error messages (map backend errors to user-friendly text).

**Phase 2 (Post-MVP):** Optimize animations (state machine, configurable speeds), add replay/history UI (timeline scrubber, step-by-step), implement offline mode (local AI, IndexedDB state persistence).

**Phase 3 (Advanced):** Tauri desktop app with native features (notifications, hotkeys), multiplayer lobby system (room browser, spectator mode), advanced analytics (pattern frequency, win rate by player).

---

## Summary

This Technical Architecture section establishes the **implementation foundation**:

1. **Type-Safe Contract:** Rust → TypeScript bindings ensure API compatibility.
2. **Server-Authoritative State:** Zustand stores mirror backend state with zero optimistic updates.
3. **Event-Driven Updates:** WebSocket event stream updates local state via Immer mutations.
4. **Animation Orchestration:** Queue system with configurable delays prevents event/animation desyncs.
5. **Component Architecture:** Smart/dumb pattern with compound components and custom hooks.
6. **Testing Strategy:** Unit (70%) + Integration (20%) + E2E (10%) pyramid.
7. **Build Tooling:** Vite for fast dev + optimized production builds.

**Key Takeaways for TDD:**

- Generate TypeScript types from Rust before writing component tests.
- Mock WebSocket in integration tests (don't require backend running).
- Test event handlers in isolation (applyEvent with specific event payloads).
- Use React Testing Library for component tests (user-centric queries).
- Write E2E tests for happy paths only (Charleston → Play → Win).

**Next Steps:**

1. Review Sections 1-3 as test specifications.
2. Create test stubs for all components in Section 1.9, 2.8, 3.9 tables.
3. Implement tests before building new UI (true TDD).
4. Iterate on architecture based on test feedback.

**Note:** This architecture reflects current state as of 2026-01. Some details (error handling patterns, animation timing values) may need fine-tuning during implementation. Treat this as a living document—update as codebase evolves.

---

## Appendix: File Structure Reference

```text
apps/client/
├── src/
│   ├── components/
│   │   ├── ui/               (Presentational components)
│   │   │   ├── CardViewer.tsx
│   │   │   ├── HintPanel.tsx
│   │   │   └── TileDisplay.tsx
│   │   ├── game/             (Game-specific containers)
│   │   │   ├── HandDisplay.tsx
│   │   │   ├── TurnActions.tsx
│   │   │   └── DiscardPile.tsx
│   │   ├── charleston/       (Charleston phase)
│   │   │   ├── TileSelector.tsx
│   │   │   ├── BlindPassControl.tsx
│   │   │   └── CourtesyPassDialog.tsx
│   │   └── AuthForm.tsx
│   ├── hooks/
│   │   ├── useGameSocket.ts
│   │   ├── useActionQueue.ts
│   │   ├── useGamePhase.ts
│   │   └── useTileSelection.ts
│   ├── store/
│   │   ├── gameStore.ts      (Main game state)
│   │   ├── uiStore.ts        (UI-only state)
│   │   ├── analysisStore.ts  (AI hints)
│   │   └── authStore.ts      (Supabase auth)
│   ├── utils/
│   │   ├── tileFormatter.ts
│   │   ├── phaseHelpers.ts
│   │   ├── events.ts
│   │   ├── commands.ts
│   │   └── eventFormatter.ts
│   ├── types/
│   │   └── bindings/
│   │       └── generated/    (Auto-generated from Rust)
│   │           ├── Tile.ts
│   │           ├── GameCommand.ts
│   │           ├── Event.ts
│   │           └── ...
│   ├── animations/
│   │   └── orchestrator.ts
│   ├── assets/
│   │   ├── tiles/            (Tile images)
│   │   └── sounds/           (Audio cues)
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
├── public/
│   └── data/
│       └── cards/            (NMJL card data - copied from root)
├── package.json
├── vite.config.ts
├── tsconfig.json
└── .env.development
```
