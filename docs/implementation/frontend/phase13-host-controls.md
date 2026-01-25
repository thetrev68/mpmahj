# Phase 13: Host Controls

**Priority:** MEDIUM
**Estimated Complexity:** Low-Medium
**Dependencies:** None

## Overview

Implement host-only game controls for pausing and resuming games. These features allow the game host (room creator) to manage game flow and handle interruptions in multiplayer sessions.

## Commands to Implement (2)

### 1. PauseGame

**Backend Location:** [command.rs:208](../../../crates/mahjong_core/src/command.rs#L208)

**Description:** Pause the game at any time. Only the host (room creator) can pause.

**Parameters:**

- `by`: Seat - must be the host's seat

**Current Status:**

- Command builder: Needs to be created
- Validation: Only host can pause, can be used at any time during game
- Effect: Game enters paused state, timers stop, players cannot make moves

**UI Requirements:**

- Add "Pause" button in game controls (only visible to host)
- Icon: Pause symbol (⏸) or "Pause Game" text button
- Available at all times during active game
- Click → immediate pause (no confirmation needed)
- Visual indicator when game is paused:
  - Overlay or banner: "Game Paused by Host"
  - Dim game board slightly
  - Show "Resume" button to host
  - Show "Waiting for host to resume" to other players
- Disable all game actions while paused

**Design Considerations:**

- Should pause require confirmation or be instant?
- How to indicate who is host in UI?
- Should non-hosts see pause button (disabled) or not at all?
- What happens if host disconnects while paused?

---

### 2. ResumeGame

**Backend Location:** [command.rs:217](../../../crates/mahjong_core/src/command.rs#L217)

**Description:** Resume a paused game. Only the host (room creator) can resume.

**Parameters:**

- `by`: Seat - must be the host's seat

**Current Status:**

- Command builder: Needs to be created
- Validation: Only host can resume, only valid when game is paused
- Effect: Game returns to previous state, timers resume, players can act again

**UI Requirements:**

- Add "Resume" button (only visible to host when game is paused)
- Icon: Play symbol (▶) or "Resume Game" text button
- Prominent placement in paused overlay
- Click → immediate resume (no confirmation needed)
- Clear paused state immediately
- Restore game board to full visibility
- Re-enable game actions
- Optional: Brief countdown before resume (3...2...1...Go!)

**Design Considerations:**

- Should there be a countdown before resuming?
- Notify all players that game is resuming?
- Should resume check if all players still connected?
- Auto-resume if host disconnects and reconnects?

---

## Testing Checklist

### PauseGame

- [ ] Only host sees pause button
- [ ] Non-hosts cannot pause (button hidden or disabled)
- [ ] Pause works from any game phase
- [ ] Game state frozen while paused
- [ ] Timers stop during pause
- [ ] All player actions disabled
- [ ] Visual "Paused" indicator shown to all players
- [ ] Backend sends GamePaused event

### ResumeGame

- [ ] Only host sees resume button when paused
- [ ] Non-hosts see "Waiting for host" message
- [ ] Resume restores game to previous state
- [ ] Timers resume from paused point
- [ ] Player actions re-enabled
- [ ] Paused overlay cleared
- [ ] Backend sends GameResumed event
- [ ] Optional: Countdown works if implemented

### Edge Cases

- [ ] What if host leaves while game paused?
- [ ] Can pause during Charleston? During call window?
- [ ] Can pause during hint display?
- [ ] Multiple rapid pause/resume clicks handled
- [ ] Pause state persists across reconnection

---

## Files to Modify

### New Files

- `apps/client/src/components/PauseOverlay.tsx` - Paused state UI
- `apps/client/src/components/HostControls.tsx` - Host-only buttons (pause/resume)
- `apps/client/src/components/ResumeCountdown.tsx` - Optional countdown before resume

### Modified Files

- `apps/client/src/App.tsx` - Add host controls to game UI
- `apps/client/src/api/Commands.ts` - Add pause/resume command builders
- `apps/client/src/store/gameStore.ts` - Add paused state, host tracking
- `apps/client/src/hooks/useGameSocket.ts` - Handle GamePaused/GameResumed events
- `apps/client/src/types/GameState.ts` - Add paused flag to state

---

## Backend Events to Handle

### Expected Server Events

- `GamePaused { by: Seat }` - Game was paused by host
- `GameResumed { by: Seat }` - Game was resumed by host

### Error Events

- `InvalidCommand { reason: "NotHost" }` - Non-host tried to pause/resume
- `InvalidCommand { reason: "NotPaused" }` - Tried to resume when not paused
- `InvalidCommand { reason: "AlreadyPaused" }` - Tried to pause when already paused

---

## State Management

### New State Fields

```typescript
interface GameState {
  isPaused: boolean;
  pausedBy?: Seat;
  pausedAt?: number; // timestamp
  hostSeat: Seat; // who is the room creator
}
```

### Host Determination

- Need to track who created the room (host)
- Host role should be visible in UI (crown icon, "HOST" label, etc.)
- Host role persists even if they're not East

---

## UI/UX Design

### Pause Button Location

- Option A: Top-right corner next to settings/menu
- Option B: In game control panel with other actions
- Option C: Floating action button (FAB)

### Paused Overlay Design

```
┌─────────────────────────────────┐
│                                 │
│      ⏸  GAME PAUSED             │
│                                 │
│   Paused by: [Host Name]        │
│                                 │
│   [Resume Game]  (host only)    │
│                                 │
│   Waiting for host to resume... │
│   (non-hosts)                   │
│                                 │
└─────────────────────────────────┘
```

---

## Success Criteria

✅ Host can pause game at any time
✅ Only host can pause/resume (enforced client and server-side)
✅ All players see paused state clearly
✅ Game state frozen during pause (no actions possible)
✅ Resume restores game correctly
✅ Host role clearly indicated in UI
✅ Edge cases handled (host disconnect, etc.)
✅ Smooth UX with clear feedback
