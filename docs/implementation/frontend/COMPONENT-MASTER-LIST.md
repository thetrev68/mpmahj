# Frontend Component Master List - SIMPLIFIED

**Last Updated**: 2026-01-31
**Philosophy**: Focus on game-specific components, use libraries for generic UI

---

## Strategy

### ✅ Use shadcn/ui for Generic UI

**DO NOT spec/build these** - use [shadcn/ui](https://ui.shadcn.com/) directly:

````bash
npx shadcn-ui@latest add button input dialog tooltip select checkbox radio switch slider tabs badge card alert
```text

Generic components from shadcn/ui (Radix UI + Tailwind):

- Button, Input, Select, Checkbox, Radio, Switch
- Modal/Dialog, Tooltip, Alert/Toast
- Card, Badge, Tabs, Slider
- Spinner/Loading states

### 📝 Spec Only Game Components

Create **simple specs** (~50-150 lines) for Mahjong-specific components only.

---

## Game-Specific Components

### 1. Core Tile & Board (8 components)

| Component         | Description                      | User Stories   | Priority     | Lines |
| ----------------- | -------------------------------- | -------------- | ------------ | ----- |
| `<Tile>`          | Single tile with suit/rank/state | All            | **CRITICAL** | ~100  |
| `<TileImage>`     | Tile SVG/asset renderer          | All            | **CRITICAL** | ~50   |
| `<TileGroup>`     | Meld display (Pung/Kong)         | US-013, US-016 | HIGH         | ~80   |
| `<ConcealedHand>` | Player's hand with selection     | US-002, US-009 | **CRITICAL** | ~150  |
| `<ExposedMelds>`  | Public melds area                | US-013         | **CRITICAL** | ~100  |
| `<DiscardPile>`   | Discard grid layout              | US-010, US-019 | **CRITICAL** | ~80   |
| `<GameBoard>`     | Main 4-player layout             | All            | **CRITICAL** | ~120  |
| `<PlayerRack>`    | Single player area               | All            | **CRITICAL** | ~100  |

**Subtotal**: 8 components, ~780 lines

---

### 2. Charleston Phase (5 components)

| Component              | Description                         | User Stories   | Priority     | Lines |
| ---------------------- | ----------------------------------- | -------------- | ------------ | ----- |
| `<CharlestonTracker>`  | Phase indicator (Right/Across/Left) | US-002-008     | HIGH         | ~80   |
| `<CharlestonTimer>`    | Countdown timer (60s default)       | US-002, US-036 | HIGH         | ~60   |
| `<TileSelectionPanel>` | 3-tile selection UI                 | US-002-004     | **CRITICAL** | ~120  |
| `<PassAnimationLayer>` | Tile passing animations             | US-002-004     | MEDIUM       | ~100  |
| `<VotePanel>`          | Charleston voting UI                | US-005         | MEDIUM       | ~80   |

**Subtotal**: 5 components, ~440 lines

---

### 3. Turn Flow & Actions (6 components)

| Component                 | Description                    | User Stories   | Priority     | Lines |
| ------------------------- | ------------------------------ | -------------- | ------------ | ----- |
| `<ActionBar>`             | Bottom action buttons          | All            | **CRITICAL** | ~100  |
| `<TurnIndicator>`         | Current player highlight       | US-009, US-010 | HIGH         | ~60   |
| `<CallWindowPanel>`       | Pung/Kong/Mahjong buttons      | US-011, US-013 | **CRITICAL** | ~120  |
| `<CallPriorityIndicator>` | Multiple callers visualization | US-012         | MEDIUM       | ~80   |
| `<Wall>`                  | Wall with break indicator      | US-001         | HIGH         | ~120  |
| `<WallCounter>`           | Remaining tiles display        | US-001, US-009 | MEDIUM       | ~50   |

**Subtotal**: 6 components, ~530 lines

---

### 4. Setup & Winning (4 components)

| Component             | Description            | User Stories   | Priority | Lines |
| --------------------- | ---------------------- | -------------- | -------- | ----- |
| `<DiceOverlay>`       | Dice roll animation    | US-001         | MEDIUM   | ~80   |
| `<WinnerCelebration>` | Mahjong celebration UI | US-018, US-019 | MEDIUM   | ~100  |
| `<ScoreDisplay>`      | Score breakdown        | US-018, US-019 | MEDIUM   | ~100  |
| `<PatternDisplay>`    | Winning pattern card   | US-018, US-019 | LOW      | ~80   |

**Subtotal**: 4 components, ~360 lines

---

### 5. Room & Lobby (5 components)

| Component          | Description             | User Stories   | Priority     | Lines |
| ------------------ | ----------------------- | -------------- | ------------ | ----- |
| `<RoomList>`       | Available rooms list    | US-030         | **CRITICAL** | ~100  |
| `<RoomCard>`       | Individual room display | US-030         | HIGH         | ~80   |
| `<CreateRoomForm>` | Room creation modal     | US-029         | **CRITICAL** | ~150  |
| `<SeatSelector>`   | Seat selection UI       | US-030         | HIGH         | ~80   |
| `<LobbyLayout>`    | Main lobby screen       | US-029, US-030 | HIGH         | ~100  |

**Subtotal**: 5 components, ~510 lines

---

### 6. Settings (3 components)

| Component             | Description          | User Stories | Priority | Lines |
| --------------------- | -------------------- | ------------ | -------- | ----- |
| `<HouseRulesPanel>`   | House rules config   | US-034       | HIGH     | ~120  |
| `<AnimationSettings>` | Animation mode/speed | US-035       | MEDIUM   | ~80   |
| `<TimerConfigPanel>`  | Timer settings       | US-036       | MEDIUM   | ~80   |

**Subtotal**: 3 components, ~280 lines

---

### 7. Advanced Features (Optional - Low Priority)

| Component           | Description           | User Stories   | Priority | Lines |
| ------------------- | --------------------- | -------------- | -------- | ----- |
| `<HintPanel>`       | AI hint display       | US-027, US-028 | LOW      | ~100  |
| `<MoveHistoryList>` | Move history timeline | US-024         | LOW      | ~100  |
| `<HistoryScrubber>` | Jump to move scrubber | US-025, US-026 | LOW      | ~80   |
| `<UndoVotePanel>`   | Undo voting UI        | US-022, US-023 | LOW      | ~80   |

**Subtotal**: 4 components, ~360 lines

---

### 8. Custom Hooks (7 hooks)

| Hook                     | Description             | User Stories   | Priority     | Lines |
| ------------------------ | ----------------------- | -------------- | ------------ | ----- |
| `useSoundEffects()`      | Play sound effects      | US-001, US-018 | HIGH         | ~60   |
| `useTileSelection()`     | Tile selection logic    | US-002-004     | **CRITICAL** | ~100  |
| `useActionQueue()`       | Animation orchestration | US-001, US-002 | HIGH         | ~120  |
| `useGameSocket()`        | WebSocket connection    | All            | **CRITICAL** | ~150  |
| `useTimer()`             | Countdown timer         | US-002, US-036 | HIGH         | ~80   |
| `useAnimationSettings()` | Animation preferences   | US-035         | MEDIUM       | ~50   |
| `useKeyboardShortcuts()` | Global shortcuts        | All            | MEDIUM       | ~80   |

**Subtotal**: 7 hooks, ~640 lines

---

## Total Component Count

| Category               | Count  | Est. Lines | Status                    |
| ---------------------- | ------ | ---------- | ------------------------- |
| Generic UI (shadcn/ui) | ~15    | 0          | ✅ Use library            |
| Core Tile & Board      | 8      | ~780       | 📝 Need specs             |
| Charleston Phase       | 5      | ~440       | 📝 Need specs             |
| Turn Flow & Actions    | 6      | ~530       | 📝 Need specs             |
| Setup & Winning        | 4      | ~360       | 📝 Need specs             |
| Room & Lobby           | 5      | ~510       | 📝 Need specs             |
| Settings               | 3      | ~280       | 📝 Need specs             |
| Advanced (Optional)    | 4      | ~360       | 📝 Low priority           |
| Custom Hooks           | 7      | ~640       | 📝 Need specs             |
| **TOTAL CUSTOM**       | **42** | **~3,900** | vs 153 components before! |

**Previous Plan**: 153 components @ ~400 lines each = **61,200 lines** 😱
**New Plan**: 42 components @ ~90 lines each = **3,900 lines** ✅

**Savings**: **93% reduction in component complexity!**

---

## Implementation Priority

### Phase 1: MVP Core (Week 1-2)

1. ✅ Install shadcn/ui components
2. `<Tile>` + `<TileImage>` - Foundation
3. `<ConcealedHand>` - Player's hand
4. `<GameBoard>` + `<PlayerRack>` - Layout
5. `<ActionBar>` - Actions
6. `useGameSocket()` - Backend connection
7. `useTileSelection()` - Selection logic

**Goal**: Can display a game board with tiles

### Phase 2: Basic Gameplay (Week 3-4)

1. `<DiscardPile>` - Discards
2. `<ExposedMelds>` - Melds
3. `<TurnIndicator>` - Turn flow
4. `<CallWindowPanel>` - Calling
5. `<Wall>` + `<WallCounter>` - Wall
6. `<DiceOverlay>` - Dice roll
7. `useSoundEffects()` - Audio

**Goal**: Can play a basic turn (draw, discard)

### Phase 3: Charleston (Week 5-6)

1. `<TileSelectionPanel>` - Selection
2. `<CharlestonTracker>` - Phase indicator
3. `<CharlestonTimer>` - Timer
4. `<PassAnimationLayer>` - Animations
5. `<VotePanel>` - Voting
6. `useTimer()` - Timer logic

**Goal**: Can complete Charleston

### Phase 4: Room System (Week 7-8)

1. `<LobbyLayout>` - Lobby
2. `<RoomList>` + `<RoomCard>` - Room list
3. `<CreateRoomForm>` - Room creation
4. `<SeatSelector>` - Seat selection

**Goal**: Can create/join rooms

### Phase 5: Winning & Settings (Week 9-10)

1. `<WinnerCelebration>` + `<ScoreDisplay>` - Winning
2. `<PatternDisplay>` - Patterns
3. `<HouseRulesPanel>` - House rules
4. `<AnimationSettings>` + `<TimerConfigPanel>` - Settings
5. `useAnimationSettings()` - Animation prefs

**Goal**: Complete game flow

### Phase 6: Polish & Advanced (Week 11-12)

1. `<HintPanel>` - Hints (optional)
2. `<MoveHistoryList>` - History (optional)
3. `<UndoVotePanel>` - Undo (optional)
4. `useKeyboardShortcuts()` - Shortcuts
5. `useActionQueue()` - Animation polish

**Goal**: Production-ready

---

## Simplified Spec Template

```markdown
# ComponentName

## Purpose

1-2 sentences explaining what this component does.

## User Stories

- US-XXX: Story name
- US-YYY: Story name

## Props

\`\`\`typescript
interface ComponentNameProps {
// Only key props, not every possible variant
value: Type;
onChange: (value: Type) => void;
disabled?: boolean;
}
\`\`\`

## Behavior

- Key interaction 1
- Key interaction 2
- Edge case handling

## Visual Requirements

- Layout description (not CSS code)
- States: default, hover, active, disabled
- Accessibility: ARIA attributes, keyboard support

## Related Components

- Uses: <OtherComponent>
- Used by: <ParentComponent>

## Implementation Notes

- Any critical details
- Performance considerations (if relevant)
```text

**Target**: 50-150 lines per spec (not 700!)

---

## What Was Deleted

### ❌ Over-Specified Components (Use shadcn/ui Instead)

Deleted from custom specs - use library:

- Button, Input, Select, Checkbox, Radio, Switch, Slider
- Modal, Dialog, Tooltip, Alert, Toast
- Card, Badge, Tabs, Spinner
- Label, HelperText, Divider
- Grid, FlexContainer

### ❌ Over-Granular Presentational Components

Merged into larger components:

- SelectionCounter → part of `<TileSelectionPanel>`
- UndoButton → use shadcn/ui Button
- HintButton → use shadcn/ui Button
- LoadingOverlay → use shadcn/ui Spinner
- IconButton → use shadcn/ui Button

### ❌ Unnecessary Integration Components

Removed - logic goes in hooks instead:

- CharlestonIntegration → `useCharlestonFlow()` hook
- PlayingPhaseIntegration → `useTurnFlow()` hook
- MahjongFlowIntegration → `useMahjongFlow()` hook

---

## Next Actions

1. ✅ Install shadcn/ui: `npx shadcn-ui@latest init`
2. ✅ Add generic components: `npx shadcn-ui@latest add button input dialog tooltip ...`
3. 📝 Create simplified specs for 42 game components
4. 🎨 Start implementation with Phase 1 (MVP Core)

---

## Comparison

| Metric      | Previous  | New          | Improvement        |
| ----------- | --------- | ------------ | ------------------ |
| Components  | 153       | 42           | **72% fewer**      |
| Est. Lines  | 61,200    | 3,900        | **93% less**       |
| Generic UI  | Custom    | Library      | **100% saved**     |
| Spec Length | 700 lines | 50-150 lines | **79-93% shorter** |

**Status**: ✅ Simplified and ready for implementation!
````
