# Frontend Implementation Plan - Backend Coverage

This directory contains a multi-phase plan to implement UI for all backend Rust commands that are currently exposed but not yet used in the frontend.

## Overview

**Total Backend Commands**: 29
**Currently Used**: 8
**To Be Implemented**: 21

## Current Coverage (8 commands)

The following commands have working UI implementations:

1. **ReadyToStart** - Ready button during WaitingForPlayers phase
2. **PassTiles** - Charleston tile passing
3. **VoteCharleston** - Vote to continue/stop Charleston
4. **DiscardTile** - Discard tile during main game
5. **DeclareCallIntent** - Call Pung/Kong/Quint/Sextet
6. **Pass** - Decline to call on discarded tile
7. **DeclareMahjong** - Declare winning hand
8. **RequestHint** - Request hint at various verbosity levels

## Implementation Phases

### Phase 10: Core Gameplay Completeness

**Priority:** HIGH | **Complexity:** Medium | **Commands:** 4

Essential in-game actions missing from current UI:

- DrawTile
- ExchangeJoker _(command builder exists)_
- AddToExposure (upgrade Pung→Kong→Quint→Sextet)
- RollDice

**Why First?** These are fundamental gameplay mechanics needed for thorough backend testing.

---

### Phase 11: Charleston Advanced Features

**Priority:** MEDIUM | **Complexity:** Medium-High | **Commands:** 3

Advanced Charleston mechanics:

- ProposeCourtesyPass
- AcceptCourtesyPass
- ExchangeBlank (house rule)

**Dependencies:** Phase 10 (for general command pattern knowledge)

---

### Phase 12: Game Exit & Abandonment

**Priority:** HIGH | **Complexity:** Medium | **Commands:** 3

Critical game management features:

- LeaveGame
- ForfeitGame
- AbandonGame

**Why High Priority?** Essential for proper game lifecycle management and backend state cleanup testing.

---

### Phase 13: Host Controls

**Priority:** MEDIUM | **Complexity:** Low-Medium | **Commands:** 2

Host-only game management:

- PauseGame
- ResumeGame

---

### Phase 14: Smart Undo System

**Priority:** HIGH | **Complexity:** Medium-High | **Commands:** 2

Sophisticated undo with voting:

- SmartUndo
- VoteUndo

**Why High Priority?** Critical quality-of-life feature, especially for practice mode testing.

---

### Phase 15: History & Replay System

**Priority:** MEDIUM | **Complexity:** High | **Commands:** 4

Comprehensive history navigation:

- RequestHistory
- JumpToMove
- ResumeFromHistory
- ReturnToPresent

**Note:** Most complex phase due to state management requirements.

---

### Phase 16: Analysis & State Management

**Priority:** MEDIUM | **Complexity:** Medium | **Commands:** 3

Advanced insights and debugging:

- GetAnalysis
- SetHintVerbosity
- RequestState

**Integration Note:** Leverages existing [analysisStore.ts](../../../apps/client/src/store/analysisStore.ts)

---

## Priority Matrix

### Must Have (High Priority)

- **Phase 10**: Core Gameplay Completeness
- **Phase 12**: Game Exit & Abandonment
- **Phase 14**: Smart Undo System

### Should Have (Medium Priority)

- **Phase 11**: Charleston Advanced Features
- **Phase 13**: Host Controls
- **Phase 15**: History & Replay System
- **Phase 16**: Analysis & State Management

## Recommended Implementation Order

For comprehensive backend testing coverage:

1. **Start with Phase 10** - Completes core gameplay loop
2. **Then Phase 12** - Enables proper game exit testing
3. **Then Phase 14** - Adds undo for easier development/testing
4. **Then Phase 16** - Adds analysis tools to help validate gameplay
5. **Then Phase 11** - Completes Charleston phase
6. **Then Phase 13** - Adds host controls
7. **Finally Phase 15** - Adds history system (most complex)

Alternative: **Implement by complexity** (Low → High) if team prefers gradual ramp-up:

1. Phase 13 (Low-Medium)
2. Phase 10, 12, 16 (Medium)
3. Phase 11, 14 (Medium-High)
4. Phase 15 (High)

## Common Patterns Across Phases

### Command Builder Pattern

All commands follow this pattern in `Commands.ts`:

```typescript
export const Commands = {
  commandName: (player: Seat, ...params) => ({
    CommandName: { player, ...params },
  }),
};
```

### WebSocket Integration

All commands sent via:

```typescript
socket.sendCommand(Commands.commandName(player, ...params));
```

### State Management

Most phases require additions to:

- `gameStore.ts` - Game state
- `analysisStore.ts` - Analysis state (Phase 16)
- New stores as needed

### Event Handling

Each command typically has corresponding server events:

- Success events (e.g., `GamePaused`, `UndoExecuted`)
- Error events (e.g., `InvalidCommand`)
- State update events

## Testing Strategy

### Per-Phase Testing

Each phase document includes:

- Detailed testing checklist
- Edge cases to verify
- Backend event validation

### Integration Testing

After all phases:

- Full game playthrough using all commands
- Multiplayer testing (voting systems, host controls)
- Stress testing (history with many moves, complex analysis)

### Backend Validation

Ensure all 29 commands are:

- ✅ Callable from UI
- ✅ Properly validated by backend
- ✅ Generate expected events
- ✅ Update game state correctly

## Architecture Notes

### Backend Command Definition

All commands defined in: [command.rs](../../../crates/mahjong_core/src/command.rs)

### TypeScript Bindings

Auto-generated at: [GameCommand.ts](../../../apps/client/src/types/bindings/generated/GameCommand.ts)

### WebSocket Router

Routes commands at: [router.rs](../../../crates/mahjong_server/src/network/websocket/router.rs)

### Command Handler

Processes commands at: [command.rs](../../../crates/mahjong_server/src/network/websocket/command.rs)

## Success Criteria

**Phase Complete When:**

- ✅ All commands in phase have UI triggers
- ✅ Commands properly integrated with backend
- ✅ Error states handled gracefully
- ✅ UI updates reflect backend state
- ✅ Phase-specific tests pass

**Overall Success When:**

- ✅ All 21 missing commands implemented
- ✅ 100% backend command coverage via UI
- ✅ Full game lifecycle testable via frontend
- ✅ No commands orphaned or inaccessible

## Development Tips

1. **Start with command builders** in `Commands.ts`
2. **Implement UI component** for command trigger
3. **Add state management** as needed
4. **Handle backend events** in `useGameSocket.ts`
5. **Test command validation** (phase checks, turn checks)
6. **Verify state updates** after command execution
7. **Add error handling** for edge cases

## Questions or Issues?

Each phase document contains:

- Detailed specifications
- Design considerations (questions to resolve)
- Files to modify
- Testing checklists

Review individual phase documents for implementation details.
