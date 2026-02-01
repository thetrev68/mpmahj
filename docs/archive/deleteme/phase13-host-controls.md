# Phase 13: Host Controls

**Priority:** MEDIUM
**Estimated Complexity:** Low-Medium
**Dependencies:** None
**Status:** ✅ COMPLETE

## Overview

Implement host-only game controls for pausing and resuming games. These features allow the game host (room creator) to manage game flow and handle interruptions in multiplayer sessions.

**Important accuracy notes:**

- Command helpers live in `apps/client/src/utils/commands.ts`.
- There is no `GameState.ts` file; state lives in `apps/client/src/store/gameStore.ts` and `apps/client/src/store/uiStore.ts`.
- The server tracks `host_seat`, but it is **not** currently sent to the client in snapshots or events.
  - You can treat the room creator as host locally when you create a room.
  - If you need host seat for joiners, add a server envelope or snapshot field.

## Commands to Implement (2)

### 1. PauseGame

**Backend Location:** [command.rs:208](../../../crates/mahjong_core/src/command.rs#L208)

**Description:** Pause the game at any time. Only the host (room creator) can pause.

**Parameters:**

- `by`: Seat - must be the host's seat

**Current Status:**

- ✅ Command builder: Created in `apps/client/src/utils/commands.ts`
- ✅ Validation: Only host can pause, can be used at any time during game (enforced server-side)
- ✅ Effect: Game enters paused state, timers stop, players cannot make moves

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

- ✅ Command builder: Created in `apps/client/src/utils/commands.ts`
- ✅ Validation: Only host can resume, only valid when game is paused (enforced server-side)
- ✅ Effect: Game returns to previous state, timers resume, players can act again

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

- [x] Only host sees pause button
- [x] Non-hosts cannot pause (button hidden)
- [ ] Pause works from any game phase (needs backend testing)
- [ ] Game state frozen while paused (server-side enforcement)
- [ ] Timers stop during pause (server-side enforcement)
- [ ] All player actions disabled (server-side enforcement)
- [x] Visual "Paused" indicator shown to all players
- [ ] Backend sends GamePaused event (needs backend testing)

### ResumeGame

- [x] Only host sees resume button when paused
- [x] Non-hosts see "Waiting for host" message
- [ ] Resume restores game to previous state (server-side enforcement)
- [ ] Timers resume from paused point (server-side enforcement)
- [ ] Player actions re-enabled (server-side enforcement)
- [x] Paused overlay cleared
- [ ] Backend sends GameResumed event (needs backend testing)
- [ ] Optional: Countdown works if implemented (NOT IMPLEMENTED)

### Edge Cases

- [ ] What if host leaves while game paused? (needs backend testing)
- [ ] Can pause during Charleston? During call window? (needs backend testing)
- [ ] Can pause during hint display? (needs backend testing)
- [ ] Multiple rapid pause/resume clicks handled (needs backend testing)
- [ ] Pause state persists across reconnection (needs backend testing)

---

## Files to Modify

### New Files

- ✅ `apps/client/src/components/PauseOverlay.tsx` - Paused state UI
- ✅ `apps/client/src/components/HostControls.tsx` - Host-only buttons (pause/resume)
- ⏭️ `apps/client/src/components/ResumeCountdown.tsx` - Optional countdown before resume (NOT IMPLEMENTED - can be added later if needed)

### Modified Files

- ✅ `apps/client/src/App.tsx` - Add host controls to game UI
- ✅ `apps/client/src/utils/commands.ts` - Add pause/resume command builders
- ✅ `apps/client/src/store/gameStore.ts` - Track paused state from events
- ⏭️ `apps/client/src/store/uiStore.ts` - Track UI-only overlay/countdown state (NOT NEEDED - pause state tracked in gameStore)
- ⏭️ `apps/client/src/hooks/useGameSocket.ts` - Pause/resume flow already arrives via events; route UI changes as needed (NO CHANGES NEEDED - events already handled)

---

## Backend Events to Handle

### Expected Server Events

- `GamePaused { by: Seat }` - Game was paused by host
- `GameResumed { by: Seat }` - Game was resumed by host

### Error Events

- `CommandRejected { player, reason }` - Non-host or invalid phase/paused state

---

## State Management

### New State Fields

```typescript
interface GameState {
  isPaused: boolean;
  pausedBy?: Seat;
  pausedAt?: number; // timestamp (client-local)
  hostSeat?: Seat; // only if client knows/controls host identity
}
```text

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

```text
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
```text

---

## Success Criteria

✅ Host can pause game at any time (UI implemented, needs backend testing)
✅ Only host can pause/resume (enforced client-side, server validation required)
✅ All players see paused state clearly (PauseOverlay implemented)
⏳ Game state frozen during pause (server-side enforcement, needs testing)
⏳ Resume restores game correctly (server-side enforcement, needs testing)
✅ Host role clearly indicated in UI (buttons only visible to host)
⏳ Edge cases handled (server-side enforcement, needs testing)
✅ Smooth UX with clear feedback (minimal but functional UI)

## Implementation Notes

- Host seat is tracked when creating a room (`GameCreated` event sets `hostSeat`)
- Server does not currently send `host_seat` in snapshots/events, so joiners won't know who is host
- If host identification is needed for joiners, backend should add `host_seat` to snapshot/envelope
- No countdown before resume (can be added later if needed)
- Pause/resume work during Charleston and Playing phases (server validates actual restrictions)
- TypeScript compilation successful ✅
