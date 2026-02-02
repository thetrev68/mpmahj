# Game Design Document - Section 4: Technical Architecture

## Overview

**Key Principles:**

- **Server-Authoritative:** Logic executes on Rust backend; frontend reflects state.
- **Event-Driven:** WebSocket stream updates state (no polling).
- **Type-Safe:** Rust types auto-generate TypeScript bindings.
- **Zero Optimistic Updates:** UI waits for server confirmation.

**Technology Stack:**

- **Core:** React 19.2, TypeScript 5.9, Vite 7.2
- **State/Network:** Zustand 5.0 (Immer), Native WebSocket
- **UI/FX:** Framer Motion 11.15, Tailwind (inferred)
- **Tooling:** ts-rs (Bindings), Vitest 4.0, ESLint 9.39, Tauri (Optional Desktop)

---

## 4.1 Type System & Code Generation

### 4.1.1 Rust → TypeScript Binding Pipeline

**Philosophy:** Backend owns type definitions. Frontend imports generated types.

**Backend (Rust):**

```rust
// crates/mahjong_core/src/tile.rs
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum Tile {
    Bam1, Bam2, Bam3, /* ... */
    Joker,
}
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

- **`Tile.ts`** - Enums (Bam1-9, Crak1-9, Dot1-9, Winds, Dragons, Flowers, Joker)
- **`GamePhase.ts`** - WaitingForPlayers, Setup, Charleston, Playing, Ended
- **`TurnStage.ts`** - Drawing, Discarding, CallWindow, AwaitingMahjong
- **`GameCommand.ts`** - All commands (DrawTile, DiscardTile, PassTiles)
- **`Event.ts`** - Wrapper (Public/Private discriminated union)
- **`GameStateSnapshot.ts`** - Full game state structure

**Type-Safe Command Builder:**

```typescript
// apps/client/src/utils/commands.ts
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

export const Commands = {
  drawTile: (player: Seat): GameCommand => ({
    DrawTile: { player },
  }),

  discardTile: (player: Seat, tile: Tile): GameCommand => ({
    DiscardTile: { player, tile },
  }),

  passTiles: (player: Seat, tiles: Tile[], blind_pass_count?: number): GameCommand => ({
    PassTiles: { player, tiles, blind_pass_count: blind_pass_count ?? null },
  }),
};
```

### 4.1.3 Tile Representation

- **Rust (u8):** 0-8 (Bams), 9-17 (Craks), 18-26 (Dots), 27-30 (Winds), 31-33 (Dragons), 34 (Flower).
- **TypeScript (String Enum):** `'Bam1' | 'Bam2' | ... | 'Joker'`

**Conversion Utilities:**

```typescript
// apps/client/src/utils/tileFormatter.ts
export function tileToString(tile: Tile): string {
  // 'Bam1' → '1B', 'RedDragon' → 'RD'
}

export function tileToImagePath(tile: Tile): string {
  // Returns path: '/assets/tiles/bam1.png'
}
```

---

## 4.2 State Management Architecture

### 4.2.1 Zustand Store Design

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

  // Actions & Selectors
  applyEvent: (event: Event) => void;
  applySnapshot: (snapshot: GameStateSnapshot) => void;
  reset: () => void;
  isMyTurn: () => boolean;
  canDiscard: () => boolean;
  canCall: () => boolean;
  isHost: () => boolean;
}

export const useGameStore = create<GameState>()(
  immer((set, get) => ({
    // ... initial state
    applyEvent: (event) =>
      set((state) => {
        const normalized = normalizeEvent(event);
        if (normalized.kind === 'Public') {
          applyPublicEvent(state, normalized.event);
        } else {
          applyPrivateEvent(state, normalized.event);
        }
      }),
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
```

**`analysisStore.ts` (AI Hints):**

```typescript
interface AnalysisState {
  hints: Record<HintVerbosity, HintData | null>;
  pendingRequests: Set<HintVerbosity>;
  lastRequestTime: number | null;
  updateHint: (verbosity: HintVerbosity, hint: HintData) => void;
}
```

### 4.2.2 Event Processing Pipeline

**Event Flow:**
`WebSocket` → `Envelope` → `useActionQueue` → `Orchestrator (Delay)` → `gameStore.applyEvent()` → `React Render`

**Event Normalization:**

```typescript
// apps/client/src/utils/events.ts
export function normalizeEvent(event: Event): NormalizedEvent {
  if ('Public' in event) return { kind: 'Public', event: event.Public };
  if ('Private' in event) return { kind: 'Private', event: event.Private };
  throw new Error('Unknown event type');
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
  }
}
```

### 4.2.3 Zero Optimistic Updates

**Anti-Pattern (DO NOT DO):**

```typescript
// ❌ BAD: Optimistic update
function handleDiscard(tile: Tile) {
  setHand(hand.filter((t) => t !== tile)); // Remove immediately
  sendCommand({ DiscardTile: { player, tile } });
  // Risk: Server rejection causes desync
}
```

**Correct Pattern:**

```typescript
// ✅ GOOD: Wait for server confirmation
function handleDiscard(tile: Tile) {
  setIsDiscarding(true);  // Lock UI
  sendCommand({ DiscardTile: { player, tile } });
}

// In gameStore:
case 'TileDiscarded':
  if (event.player === state.yourSeat) {
    state.yourHand = state.yourHand.filter(t => t !== event.tile);
    setIsDiscarding(false);
  }
  break;
```

---

## 4.3 WebSocket Protocol

### 4.3.1 Connection Management

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

**Command Usage:**

```typescript
const { sendCommand } = useGameSocket();
// Simple
sendCommand({ DrawTile: { player: Seat.East } });
// Complex
sendCommand({
  PassTiles: { player: yourSeat, tiles: selectedTiles, blind_pass_count: 0 },
});
```

**Reconnection Strategy:**

1. **Session Persistence:** Store `session_token` in localStorage.
2. **Backoff:** 1s, 2s, 4s, 8s... (max 30s).
3. **Resync:** On 'StateSnapshot' envelope, replace entire store state.

```typescript
// On AuthSuccess
socket.on('AuthSuccess', (payload) => {
  localStorage.setItem('mahjong_session', payload.session_token);
  if (wasReconnect && payload.seat) {
    sendCommand({ RequestState: { player: payload.seat } });
  }
});
```

---

## 4.4 Animation System

### 4.4.1 Event Orchestration

**`useActionQueue` Hook:**
Intercepts incoming events to introduce animation delays, ensuring visual sync.

```typescript
// apps/client/src/animations/orchestrator.ts
export function getEventAnimationDelay(event: Event): number {
  const normalized = normalizeEvent(event);

  if (normalized.kind === 'Public') {
    switch (normalized.event.kind) {
      case 'TileDiscarded':
        return 500; // Wait for discard animation
      case 'TilesPassing':
        return 700; // Wait for pass animation
      case 'TurnChanged':
        return 200; // Brief delay for turn indicator
      case 'CallWindowOpened':
        return 300;
      default:
        return 0;
    }
  }
  return 0; // Private events usually instant
}
```

**Queue Processing:**

```typescript
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

**Tile Discard:**

```typescript
<motion.div
  animate={isDiscarding ? { x: 200, y: 100, rotate: 7, opacity: 0.8 } : {}}
  transition={{ duration: 0.4, ease: 'easeOut' }}
  onAnimationComplete={onDiscard}
>
  <img src={tileToImagePath(tile)} />
</motion.div>
```

**Charleston Pass:**

```typescript
const arrows = {
  Right: { rotate: 0, x: 150 },
  Across: { rotate: -90, y: 150 },
  Left: { rotate: 180, x: -150 },
};
// Animate: opacity [0,1,1,0], scale [0.5,1,1,0.5]
```

---

## 4.5 Component Architecture

### 4.5.1 Component Hierarchy

```text
<App>
  ├── <ConnectionPanel>             (Room create/join)
  ├── <GameTable>
  │   ├── <Background>
  │   ├── <Wall> / <DiscardFloor>
  │   ├── <PlayerRack position="south" isUser={true}>
  │   │   ├── <ConcealedHand> (Draggable)
  │   │   ├── <ExposureArea>
  │   │   └── <ActionBar> (Draw, Discard, Call, Mahjong)
  │   ├── <OpponentRack>[] × 3
  │   └── <HUD>
  │       ├── <TurnIndicator>
  │       ├── <WallCounter>
  │       ├── <CharlestonTracker>
  │       ├── <GameMenu>
  │       └── <EventLog>
  └── <Overlays>
      ├── <JokerExchangeDialog>
      ├── <WinnerAnnouncement>
      └── <PassAnimationOverlay>
```

### 4.5.2 Component Patterns

**Smart (Container):**

```typescript
function TurnActionsContainer() {
  const { currentTurn, yourSeat } = useGameStore();
  const { sendCommand } = useGameSocket();
  const isMyTurn = currentTurn === yourSeat;

  return <TurnActionsView isMyTurn={isMyTurn} onDraw={() => sendCommand(...)} />;
}
```

**Dumb (Presentational):**

```typescript
function TurnActionsView({ isMyTurn, onDraw }: Props) {
  return (
    <div className="turn-actions">
      <button disabled={!isMyTurn} onClick={onDraw}>Draw Tile</button>
    </div>
  );
}
```

**Compound Components:**

```typescript
// Charleston selection with Context
const TileSelector = {
  Root: ({ children, maxSelection }) => (
    <SelectionContext.Provider value={{...}}>{children}</SelectionContext.Provider>
  ),
  Tile: ({ tile }) => {
    const { toggle } = useContext(SelectionContext);
    return <TileDisplay onClick={() => toggle(tile)} />;
  },
  Counter: () => {
    const { selected } = useContext(SelectionContext);
    return <div>{selected.length}/3</div>;
  }
};
```

### 4.5.3 Custom Hooks

- **`useGamePhase`**: Returns boolean flags (`isSetup`, `isCharleston`, `isPlaying`) and stage data.
- **`useTileSelection(max)`**: Manages selection array, toggle logic, and max limits.
- **`useCallWindow`**: Returns active window state (`isActive`, `tile`, `timer`, `canAct`).

---

## 4.6 Testing Strategy

### 4.6.1 Testing Pyramid

1. **Unit (70%):** Components, Utils, Selectors. (Vitest + RTL)
2. **Integration (20%):** Store mutations, Socket flows. (Vitest + Mock Socket)
3. **E2E (10%):** Full game scenarios. (Playwright)

### 4.6.2 Test Examples

**Component Test (RTL):**

```typescript
it('renders tile image with correct alt text', () => {
  render(<TileDisplay tile="Bam5" />);
  const img = screen.getByAltText('5B');
  expect(img).toHaveAttribute('src', '/assets/tiles/bam5.png');
});
```

**Store Test:**

```typescript
it('applies TileDiscarded event', () => {
  const { applyEvent } = useGameStore.getState();
  applyEvent({
    Public: { kind: 'TileDiscarded', player: 'East', tile: 'Bam5' },
  });

  const pile = useGameStore.getState().discardPile;
  expect(pile[0].tile).toBe('Bam5');
});
```

**Integration Test (Mock WebSocket):**

```typescript
it('handles full command-event flow', async () => {
  const { result } = renderHook(() => useGameSocket(...));

  // 1. Send Command
  act(() => result.current.sendCommand({ DiscardTile: { player: 'East', tile: 'Bam5' } }));
  expect(mockWS.send).toHaveBeenCalledWith(expect.stringContaining('DiscardTile'));

  // 2. Simulate Response
  act(() => mockWS.simulateMessage({
    kind: 'Event',
    payload: { event: { Public: { kind: 'TileDiscarded', player: 'East', tile: 'Bam5' } } }
  }));

  // 3. Verify Store
  await waitFor(() => {
    const pile = useGameStore.getState().discardPile;
    expect(pile[0].tile).toBe('Bam5');
  });
});
```

**E2E Test (Playwright):**

```typescript
test('complete Charleston flow', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Create Room');

  // Select 3 tiles and pass
  const tiles = page.locator('.hand-rack .tile');
  await tiles.nth(0).click();
  await tiles.nth(1).click();
  await tiles.nth(2).click();
  await page.click('text=Pass Tiles');

  await expect(page.locator('.charleston-tracker')).toContainText('Pass Across');
});
```

---

## 4.7 Build & Deployment

### 4.7.1 Development & Production

**Commands:**

```bash
npm run dev      # Vite dev server (http://localhost:5173)
npm run build    # Production build (dist/)
```

**Environment Variables:**

```ini
VITE_WS_URL=ws://localhost:3000/ws
VITE_ENABLE_HINTS=true
VITE_SUPABASE_URL=https://xxxxx.supabase.co
```

### 4.7.2 Tauri Desktop Build (Optional)

```bash
npm install -D @tauri-apps/cli
npm run tauri build
# Outputs: .msi, .dmg, .AppImage
```

---

## 4.8 Known Technical Debt & Future Improvements

### Current Limitations (2026-01)

1. **Test Coverage:** Zero coverage. Priority #1.
2. **Animation Queue:** Brittle timing; needs state machine.
3. **Type Safety:** Some enums use strings instead of tagged unions.
4. **Accessibility:** Missing keyboard nav and ARIA labels.
5. **Error Handling:** Generic messages only.

### Planned Improvements

- **Phase 1:** Comprehensive Test Suite (TDD).
- **Phase 2:** Advanced Animation Orchestrator (XState), Offline Mode.
- **Phase 3:** Tauri Native Features, Spectator Mode.

---

## Appendix: File Structure Reference

```text
apps/client/
├── src/
│   ├── components/
│   │   ├── ui/               (TileDisplay, CardViewer)
│   │   ├── game/             (HandDisplay, TurnActions)
│   │   └── charleston/       (TileSelector, BlindPassControl)
│   ├── hooks/                (useGameSocket, useActionQueue)
│   ├── store/                (gameStore, uiStore)
│   ├── utils/                (tileFormatter, commands)
│   ├── types/bindings/       (Generated Rust Types)
│   └── animations/           (orchestrator.ts)
```

```text

```

```text

```
