# Phase 4: Turn Actions - Implementation Guide

## Implementation Status

**Status**: ✅ COMPLETED (2026-01-24)

**Files Implemented**:

- `apps/client/src/components/TurnActions.tsx` - Main component with all action buttons
- `apps/client/src/components/TurnActions.css` - Component styling
- `apps/client/src/utils/handBuilder.ts` - Hand payload builder for Mahjong declarations
- `apps/client/src/App.tsx` - Updated to integrate TurnActions component

**Build Status**: ✅ TypeScript compilation successful, Build successful

---

## Overview

Build **TurnActions** component: context-aware action buttons for all gameplay commands.

**Features**: Discard, Call (Pung/Kong/Quint/Sextet), Pass, Charleston (pass tiles, vote), Mahjong, Ready

---

## Quick Reference

### Action Button States

| Action            | Shown When                     | Enabled When                               | Validation                      |
| ----------------- | ------------------------------ | ------------------------------------------ | ------------------------------- |
| **Discard**       | `Playing.Discarding`           | `canDiscard() && selectedTiles.size === 1` | Tile in hand                    |
| **Call Pung**     | `Playing.CallWindow`           | `canCall() && canFormPung()`               | 2 matching tiles or jokers      |
| **Call Kong**     | `Playing.CallWindow`           | `canCall() && canFormKong()`               | 3 matching tiles or jokers      |
| **Call Quint**    | `Playing.CallWindow`           | `canCall() && canFormQuint()`              | 4 matching tiles or jokers      |
| **Call Sextet**   | `Playing.CallWindow`           | `canCall() && canFormSextet()`             | 5 matching tiles or jokers      |
| **Pass**          | `Playing.CallWindow`           | `canCall()`                                | Always valid                    |
| **Pass Tiles**    | `Charleston.*` (except Voting) | `selectedTiles.size === 3`                 | No jokers, all in hand          |
| **Courtesy Pass** | `Charleston.CourtesyAcross`    | `selectedTiles.size <= 3`                  | No jokers, all in hand          |
| **Continue**      | `Charleston.VotingToContinue`  | Always                                     | -                               |
| **Stop**          | `Charleston.VotingToContinue`  | Always                                     | -                               |
| **Mahjong**       | `Playing.*`                    | Always (server validates)                  | Must send full `Hand` structure |
| **Ready**         | `WaitingForPlayers`            | Always                                     | -                               |

### Type Imports

```typescript
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
```

### Store Access

```typescript
// gameStore
const phase = useGameStore((state) => state.phase);
const yourSeat = useGameStore((state) => state.yourSeat);
const yourHand = useGameStore((state) => state.yourHand);
const isMyTurn = useGameStore((state) => state.isMyTurn());
const canDiscard = useGameStore((state) => state.canDiscard());
const canCall = useGameStore((state) => state.canCall());

// uiStore
const selectedTiles = useUIStore((state) => state.selectedTiles);
const clearSelection = useUIStore((state) => state.clearSelection);
```

### Socket Usage

`useGameSocket` auto-connects on mount. Create it once in a parent component and pass `sendCommand` into TurnActions to avoid multiple WebSocket connections.

---

## Component Structure

**File**: `apps/client/src/components/TurnActions.tsx`

```typescript
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

export function TurnActions({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const phase = useGameStore((state) => state.phase);

  return (
    <div className="turn-actions">
      <h2>Actions</h2>
      {renderActionsForPhase(phase, sendCommand)}
    </div>
  );
}
```

### Phase-Based Rendering

```typescript
function renderActionsForPhase(
  phase: GamePhase,
  sendCommand: (command: GameCommand) => boolean
) {
  if (phase === 'WaitingForPlayers') return <ReadyButton sendCommand={sendCommand} />;

  if (typeof phase === 'object' && 'Charleston' in phase) {
    return <CharlestonActions stage={phase.Charleston} sendCommand={sendCommand} />;
  }

  if (typeof phase === 'object' && 'Playing' in phase) {
    return <PlayingActions stage={phase.Playing} sendCommand={sendCommand} />;
  }

  return <p>No actions available</p>;
}
```

---

## Action Implementations

These button implementations use `useCommandSender()` from `apps/client/src/utils/commands.ts` for validation before sending.

### 1. Ready Button (WaitingForPlayers)

```typescript
import { Commands } from '@/utils/commands';

function ReadyButton({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);

  const handleReady = () => {
    if (!yourSeat) return;
    sendCommand(Commands.readyToStart(yourSeat));
  };

  return (
    <button onClick={handleReady} disabled={!yourSeat}>
      Ready to Start
    </button>
  );
}
```

---

### 2. Discard Button (Playing.Discarding)

**Requirements**: 1 selected tile, `canDiscard()`, phase is `Discarding`

```typescript
import { parseTileKey } from '@/utils/tileKey';
import { useCommandSender } from '@/utils/commands';

function DiscardButton({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const canDiscard = useGameStore((state) => state.canDiscard());
  const selectedTiles = useUIStore((state) => state.selectedTiles);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const addError = useUIStore((state) => state.addError);
  const { discard } = useCommandSender();

  const selectedArray = Array.from(selectedTiles);
  const enabled = canDiscard && selectedArray.length === 1;

  const handleDiscard = () => {
    if (!yourSeat || selectedArray.length !== 1) {
      addError('Select exactly 1 tile to discard');
      return;
    }

    const parsed = parseTileKey(selectedArray[0]);
    if (!parsed) {
      addError('Invalid tile selection');
      return;
    }

    const { command, error } = discard(parsed.tile);
    if (!command) {
      addError(error || 'Cannot discard this tile');
      return;
    }

    sendCommand(command);
    clearSelection();
  };

  return (
    <button onClick={handleDiscard} disabled={!enabled} className="action-primary">
      Discard Tile
    </button>
  );
}
```

---

### 3. Call Buttons (Playing.CallWindow)

**Meld Formation Logic**:

```typescript
function canFormPung(hand: Tile[], calledTile: Tile): boolean {
  const matchingTiles = hand.filter((t) => t === calledTile).length;
  const jokers = hand.filter((t) => t === 35).length;
  return matchingTiles + jokers >= 2;
}

function canFormKong(hand: Tile[], calledTile: Tile): boolean {
  const matchingTiles = hand.filter((t) => t === calledTile).length;
  const jokers = hand.filter((t) => t === 35).length;
  return matchingTiles + jokers >= 3;
}

function canFormQuint(hand: Tile[], calledTile: Tile): boolean {
  const matchingTiles = hand.filter((t) => t === calledTile).length;
  const jokers = hand.filter((t) => t === 35).length;
  return matchingTiles + jokers >= 4;
}

function canFormSextet(hand: Tile[], calledTile: Tile): boolean {
  const matchingTiles = hand.filter((t) => t === calledTile).length;
  const jokers = hand.filter((t) => t === 35).length;
  return matchingTiles + jokers >= 5;
}

function buildMeld(
  type: 'Pung' | 'Kong' | 'Quint' | 'Sextet',
  hand: Tile[],
  calledTile: Tile
): Meld {
  const needed = type === 'Pung' ? 2 : type === 'Kong' ? 3 : type === 'Quint' ? 4 : 5;
  const matching = hand.filter((t) => t === calledTile);
  const tiles = matching.slice(0, needed);

  // Add jokers if needed (NMJL allows all-joker melds)
  if (tiles.length < needed) {
    const jokersNeeded = needed - tiles.length;
    const jokers = hand.filter((t) => t === 35).slice(0, jokersNeeded);
    tiles.push(...jokers);
  }

  tiles.push(calledTile); // Add called tile

  const joker_assignments: Record<number, Tile> = {};
  tiles.forEach((tile, index) => {
    if (tile === 35) joker_assignments[index] = calledTile;
  });

  return {
    meld_type: type,
    tiles,
    called_tile: calledTile,
    joker_assignments,
  };
}
```

**Component**:

```typescript
function CallButtons({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const yourHand = useGameStore((state) => state.yourHand);
  const phase = useGameStore((state) => state.phase);
  const canCall = useGameStore((state) => state.canCall());
  const addError = useUIStore((state) => state.addError);
  const { call } = useCommandSender();

  if (!canCall || typeof phase !== 'object' || !('Playing' in phase)) return null;

  const stage = phase.Playing;
  if (!('CallWindow' in stage)) return null;

  const calledTile = stage.CallWindow.tile;

  const canPung = canFormPung(yourHand, calledTile);
  const canKong = canFormKong(yourHand, calledTile);
  const canQuint = canFormQuint(yourHand, calledTile);
  const canSextet = canFormSextet(yourHand, calledTile);

  const handleCall = (type: 'Pung' | 'Kong' | 'Quint' | 'Sextet') => {
    if (!yourSeat) return;
    const meld = buildMeld(type, yourHand, calledTile);
    const result = call(meld);
    if (!result.command) {
      addError(result.error || 'Cannot call');
      return;
    }
    sendCommand(result.command);
  };

  return (
    <>
      <button onClick={() => handleCall('Pung')} disabled={!canPung}>
        Call Pung
      </button>
      <button onClick={() => handleCall('Kong')} disabled={!canKong}>
        Call Kong
      </button>
      <button onClick={() => handleCall('Quint')} disabled={!canQuint}>
        Call Quint
      </button>
      <button onClick={() => handleCall('Sextet')} disabled={!canSextet}>
        Call Sextet
      </button>
    </>
  );
}
```

---

### 4. Pass Button (Playing.CallWindow)

```typescript
function PassButton({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const canCall = useGameStore((state) => state.canCall());
  const { pass } = useCommandSender();

  const handlePass = () => {
    if (!yourSeat) return;
    const result = pass();
    if (result.command) {
      sendCommand(result.command);
    }
  };

  return (
    <button onClick={handlePass} disabled={!canCall} className="action-neutral">
      Pass
    </button>
  );
}
```

---

### 5. Charleston Pass Button

**Requirements**: 3 selected tiles (0-3 for courtesy), no jokers

Note: This MVP uses `PassTiles` for CourtesyAcross via `useCommandSender().charlestonPass`. The core engine also supports `ProposeCourtesyPass`/`AcceptCourtesyPass` if you decide to implement the negotiation flow later.

```typescript
function CharlestonPassButton({
  stage,
  sendCommand,
}: {
  stage: CharlestonStage;
  sendCommand: (command: GameCommand) => boolean;
}) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const selectedTiles = useUIStore((state) => state.selectedTiles);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const addError = useUIStore((state) => state.addError);
  const { charlestonPass } = useCommandSender();

  const isCourtesy = stage === 'CourtesyAcross';
  const selectedArray = Array.from(selectedTiles);
  const requiredCount = isCourtesy ? 'up to 3' : 'exactly 3';

  const enabled = isCourtesy
    ? selectedArray.length <= 3
    : selectedArray.length === 3;

  const handlePass = () => {
    if (!yourSeat) return;

    if (!isCourtesy && selectedArray.length !== 3) {
      addError(`Select exactly 3 tiles to pass`);
      return;
    }

    // Parse tile keys to get tile values
    const tiles: Tile[] = selectedArray
      .map((key) => parseTileKey(key))
      .filter((parsed): parsed is { tile: Tile; index: number } => parsed !== null)
      .map((parsed) => parsed.tile);

    const result = charlestonPass(tiles);
    if (!result.command) {
      addError(result.error || 'Cannot pass tiles');
      return;
    }

    sendCommand(result.command);
    clearSelection();
  };

  return (
    <button onClick={handlePass} disabled={!enabled} className="action-primary">
      {isCourtesy ? 'Courtesy Pass' : 'Pass Tiles'} ({requiredCount})
    </button>
  );
}
```

---

### 6. Charleston Vote Buttons

```typescript
function CharlestonVoteButtons({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const { charlestonVote } = useCommandSender();

  const handleVote = (vote: 'Continue' | 'Stop') => {
    if (!yourSeat) return;
    const result = charlestonVote(vote);
    if (result.command) {
      sendCommand(result.command);
    }
  };

  return (
    <>
      <button onClick={() => handleVote('Continue')}>Continue Charleston</button>
      <button onClick={() => handleVote('Stop')}>Stop Charleston</button>
    </>
  );
}
```

---

### 7. Mahjong Button

**Always available during Playing phase** (server validates win)

Use the shared helper in `docs/implementation/frontend/hand-helper-snippet.md` to build the `Hand` payload.

```typescript
import { buildHand } from '@/utils/handBuilder';

function MahjongButton({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const yourHand = useGameStore((state) => state.yourHand);
  const players = useGameStore((state) => state.players);
  const phase = useGameStore((state) => state.phase);
  const { declareMahjong } = useCommandSender();

  if (typeof phase !== 'object' || !('Playing' in phase)) return null;

  const handleMahjong = () => {
    if (!yourSeat) return;

    const exposed = players[yourSeat]?.exposed_melds ?? [];
    const hand = buildHand(yourHand, exposed);
    const result = declareMahjong(hand, null);
    if (result.command) {
      sendCommand(result.command);
    }
  };

  return (
    <button onClick={handleMahjong} className="action-special">
      Declare Mahjong
    </button>
  );
}
```

---

## Complete Component

**File**: `apps/client/src/components/TurnActions.tsx`

```typescript
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import type { GamePhase, TurnStage, CharlestonStage, Tile, Meld, GameCommand } from '@/types/bindings/generated';
import './TurnActions.css';

export function TurnActions({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const phase = useGameStore((state) => state.phase);

  return (
    <div className="turn-actions">
      <h2>Actions</h2>
      <div className="actions-container">
        {phase === 'WaitingForPlayers' && <ReadyButton sendCommand={sendCommand} />}

        {typeof phase === 'object' && 'Charleston' in phase && (
          <CharlestonActions stage={phase.Charleston} sendCommand={sendCommand} />
        )}

        {typeof phase === 'object' && 'Playing' in phase && (
          <PlayingActions stage={phase.Playing} sendCommand={sendCommand} />
        )}

        {!phase || typeof phase === 'string' && phase !== 'WaitingForPlayers' && (
          <p className="no-actions">No actions available</p>
        )}
      </div>
    </div>
  );
}

function CharlestonActions({
  stage,
  sendCommand,
}: {
  stage: CharlestonStage;
  sendCommand: (command: GameCommand) => boolean;
}) {
  if (stage === 'VotingToContinue') return <CharlestonVoteButtons sendCommand={sendCommand} />;
  if (stage === 'Complete') return <p>Charleston complete</p>;

  return <CharlestonPassButton stage={stage} sendCommand={sendCommand} />;
}

function PlayingActions({
  stage,
  sendCommand,
}: {
  stage: TurnStage;
  sendCommand: (command: GameCommand) => boolean;
}) {
  const canDiscard = useGameStore((state) => state.canDiscard());
  const canCall = useGameStore((state) => state.canCall());

  return (
    <>
      {canDiscard && <DiscardButton sendCommand={sendCommand} />}
      {canCall && (
        <>
          <CallButtons sendCommand={sendCommand} />
          <PassButton sendCommand={sendCommand} />
        </>
      )}
      <MahjongButton sendCommand={sendCommand} />
    </>
  );
}

// ... (Include all button implementations from above)
```

---

## Styling

**File**: `apps/client/src/components/TurnActions.css`

```css
.turn-actions {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 1rem;
  background-color: #f9f9f9;
}

.turn-actions h2 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
}

.actions-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.actions-container button {
  padding: 0.6rem 1.2rem;
  border: 2px solid #007bff;
  background-color: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.actions-container button:hover:not(:disabled) {
  background-color: #0056b3;
}

.actions-container button:disabled {
  background-color: #ccc;
  border-color: #999;
  cursor: not-allowed;
  opacity: 0.6;
}

.action-primary {
  background-color: #28a745;
  border-color: #28a745;
}

.action-primary:hover:not(:disabled) {
  background-color: #1e7e34;
}

.action-neutral {
  background-color: #6c757d;
  border-color: #6c757d;
}

.action-neutral:hover:not(:disabled) {
  background-color: #545b62;
}

.action-special {
  background-color: #ffc107;
  border-color: #ffc107;
  color: #333;
}

.action-special:hover:not(:disabled) {
  background-color: #e0a800;
}

.no-actions {
  color: #999;
  font-style: italic;
  margin: 0;
}
```

---

## Integration with App.tsx

Use a single `useGameSocket` instance in `App.tsx` and pass `sendCommand` into `TurnActions` (and any other components that need to send commands).

```typescript
import { TurnActions } from '@/components/TurnActions';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useGameStore } from '@/store/gameStore';

function App() {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const phase = useGameStore((state) => state.phase);
  const { sendCommand } = useGameSocket({
    url: import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws',
    gameId: '',
    playerId: 'player_1',
  });

  // Show TurnActions when in room and not in Setup/GameOver
  const showActions = yourSeat && phase !== 'GameOver';

  return (
    <div className="app-container">
      <ConnectionPanel />
      {yourSeat && <GameStatus />}
      {yourHand.length > 0 && <HandDisplay />}
      {showActions && <TurnActions sendCommand={sendCommand} />}
    </div>
  );
}
```

---

## Testing Checklist

### Discard

- [ ] Button shown only during `Discarding` phase when `isMyTurn()`
- [ ] Enabled only when 1 tile selected
- [ ] Sends correct tile to server
- [ ] Clears selection after send
- [ ] Error shown if no tile selected

### Call Window

- [ ] Call buttons shown only during `CallWindow` when `canCall()`
- [ ] Pung enabled when 2+ matching tiles in hand
- [ ] Kong enabled when 3+ matching tiles
- [ ] Quint enabled when 4+ matching or with jokers
- [ ] Pass always enabled during call window
- [ ] Correct meld built and sent to server

### Charleston

- [ ] Pass button shown during Charleston stages (not Voting)
- [ ] Required 3 tiles for normal pass
- [ ] Allowed 0-3 for courtesy pass
- [ ] Error if jokers selected
- [ ] Clears selection after send
- [ ] Vote buttons shown during Voting stage
- [ ] Both votes send correctly

### Other

- [ ] Ready button shown in WaitingForPlayers
- [ ] Mahjong always available during Playing
- [ ] No actions shown during Setup/Scoring/GameOver
- [ ] All buttons disabled when `yourSeat` is null

---

## Success Criteria

1. ✅ All action buttons render in correct phases
2. ✅ All buttons enable/disable correctly
3. ✅ Commands send valid GameCommand structures
4. ✅ Selection cleared after actions that use it
5. ✅ Errors shown for invalid actions
6. ✅ TypeScript compiles without errors
7. ✅ Full game playable (Ready → Charleston → Playing → Mahjong)

---

## Next Steps

- **Phase 5: Event Log** - Display recent game events
- **Phase 6: Discard Pile** - Show 4-player discard piles
