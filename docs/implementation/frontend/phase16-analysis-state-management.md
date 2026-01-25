# Phase 16: Analysis & State Management

**Priority:** MEDIUM
**Estimated Complexity:** Medium
**Dependencies:** None

## Overview

Implement advanced analysis and state management features that provide players with deeper insights into their hands and allow manual state refresh capabilities.

**Important accuracy notes:**

- Command helpers live in `apps/client/src/utils/commands.ts`.
- `GetAnalysis` returns `AnalysisEvent::HandAnalysisUpdated` and `AnalysisEvent::AnalysisUpdate` (no `AnalysisResponse`).
- `SetHintVerbosity` does not emit a confirmation event; hints update via `HintUpdate` when requested.
- `RequestState` returns a `StateSnapshot` envelope (not an event).
- There is no `Settings.tsx` component currently.

**Implementation status (current repo):**

- Analysis events (`HintUpdate`, `AnalysisUpdate`, `HandAnalysisUpdated`) are handled in `apps/client/src/store/gameStore.ts` and routed to `apps/client/src/store/analysisStore.ts`.
- Hint UI is surfaced via `HintPanel` / `MultiHintPanel` in `apps/client/src/App.tsx`.
- `RequestState` is sent on reconnect inside `apps/client/src/hooks/useGameSocket.ts`.
- Minimal UI controls are implemented for backend testing: Analyze Hand, Hint Level selector, and Refresh State.

## Commands to Implement (3)

### 1. GetAnalysis

**Backend Location:** [command.rs:149](../../../crates/mahjong_core/src/command.rs#L149)

**Description:** Request full hand analysis with all pattern evaluations, probabilities, and scores.

**Current Status:**

- Command builder: **Implemented** in `apps/client/src/utils/commands.ts`
- Validation: Always allowed during active game
- Returns: Complete analysis with viable patterns, win probabilities, optimal discards, etc.
- Analysis storage: **Implemented** via `analysisStore` for `AnalysisUpdate` and `HandAnalysisUpdated`
- UI: **Implemented** minimal analysis panel and trigger button

**UI Requirements:**

- Add "Analyze Hand" button in game controls
- Display analysis in dedicated panel/modal:
  - **Viable Patterns**: All possible winning patterns from current hand
  - **Win Probability**: Estimated chance of winning with each pattern
  - **Pattern Scores**: Point value for each pattern
  - **Recommended Discards**: Which tiles to discard for best odds
  - **Dead Tiles**: Tiles that reduce win probability
  - **Waiting Status**: Whether hand is waiting (1-away from win)
  - **Outs Count**: How many tiles can complete the hand
- Visualization:
  - Show each pattern with tiles laid out
  - Highlight differences between patterns
  - Color-code by probability (green=high, yellow=medium, red=low)
- Update analysis when hand changes (optional real-time mode)

**Design Considerations:**

- Should analysis auto-update or require manual refresh?
- How much detail to show beginners vs experts?
- Should this be always visible or on-demand?
- Performance: Cache analysis results?

---

### 2. SetHintVerbosity

**Backend Location:** [command.rs:163](../../../crates/mahjong_core/src/command.rs#L163)

**Description:** Set hint verbosity preference for the current game session.

**Parameters:**

- `verbosity`: HintVerbosity enum (Disabled, Beginner, Intermediate, Expert)

**Current Status:**

- Command builder: **Implemented** in `apps/client/src/utils/commands.ts`
- Validation: Always allowed
- Current implementation: Hint verbosity selector added in `apps/client/src/App.tsx`
- Effect: Changes detail level of hints for remainder of game

**UI Requirements:**

- Add hint verbosity selector in game settings
- Options:
  - **Disabled**: No hints shown
  - **Beginner**: Simple suggestions with explanations
  - **Intermediate**: Moderate detail with strategic tips
  - **Expert**: Detailed analysis with probabilities
- UI Elements:
  - Dropdown or radio buttons
  - Current verbosity level always visible
  - Change takes effect immediately
  - Show example of each verbosity level (optional)
- Location: Settings menu or quick-access toggle

**Design Considerations:**

- Should this persist across games (localStorage)?
- Or reset to default each new game?
- Should changing verbosity re-request current hint?
- How to communicate difference between levels?

---

### 3. RequestState

**Backend Location:** [command.rs:144](../../../crates/mahjong_core/src/command.rs#L144)

**Description:** Request current game state for UI refresh (beyond automatic reconnection).

**Current Status:**

- Command builder: **Implemented** in `apps/client/src/utils/commands.ts`
- Validation: Always allowed
- Current use: **Implemented** in `apps/client/src/hooks/useGameSocket.ts` for reconnection flow
- UI: Manual "Refresh State" button added in `apps/client/src/App.tsx`
- Effect: Server sends complete current game state

**UI Requirements:**

- Add "Refresh State" button in settings/debug menu
- Use cases:
  - UI desync from server
  - Debug/development
  - Manual sync request
  - Verify state consistency
- Button behavior:
  - Click → request state
  - Show loading spinner
  - Update all UI components
  - Show success notification
- Mostly for debug/troubleshooting, not core gameplay

**Design Considerations:**

- Should this be hidden in production? (dev-only feature)
- Or always available for bug reporting?
- Should it show a diff of what changed?
- Log state requests for debugging?

---

## Testing Checklist

### GetAnalysis

- [ ] "Analyze Hand" button appears during active game
- [ ] Analysis panel shows all viable patterns
- [ ] Win probabilities calculated correctly
- [ ] Recommended discards make strategic sense
- [ ] Waiting status accurate
- [ ] Outs count correct
- [ ] Analysis updates when hand changes (if auto-update enabled)
- [ ] Performance acceptable for complex hands

### SetHintVerbosity

- [ ] Verbosity selector appears in settings
- [ ] Can select all 4 levels (Disabled, Beginner, Intermediate, Expert)
- [ ] Change takes effect immediately
- [ ] Hints reflect new verbosity level
- [ ] Disabled setting stops hints
- [ ] Beginner shows simple explanations
- [ ] Intermediate shows moderate detail
- [ ] Expert shows full analysis

### RequestState

- [ ] "Refresh State" button available (dev mode or always)
- [ ] Clicking requests full state from server
- [ ] All UI components update with fresh state
- [ ] No data loss during refresh
- [ ] State consistency verified
- [ ] Can be used for debugging desyncs

---

## Files to Modify

### New Files

- `apps/client/src/components/HandAnalysisPanel.tsx` - Full analysis display
- `apps/client/src/components/PatternVisualization.tsx` - Show pattern layouts
- `apps/client/src/components/HintVerbositySelector.tsx` - Verbosity dropdown
- `apps/client/src/components/AnalysisButton.tsx` - Trigger analysis
- `apps/client/src/hooks/useHandAnalysis.ts` - Manage analysis state
- `apps/client/src/components/HandAnalysisPanel.css` - Minimal panel styles

### Modified Files

- `apps/client/src/App.tsx` - Add analysis panel, verbosity selector
- `apps/client/src/App.css` - Add analysis controls styles
- `apps/client/src/utils/commands.ts` - Add command builders for all 3
- `apps/client/src/store/gameStore.ts` - Track last snapshot time for refresh feedback
- `apps/client/src/store/analysisStore.ts` - Integrate GetAnalysis data (hint/analysis wiring exists)
- `apps/client/src/hooks/useGameSocket.ts` - Handle analysis/state events (analysis events are handled via `gameStore`)
- (Add a settings UI component or place controls in existing panels)

---

## Backend Events to Handle

### Expected Server Events

- `AnalysisUpdate { patterns: PatternAnalysis[] }` - Full analysis data
- `HandAnalysisUpdated { distance_to_win, viable_count, impossible_count }` - Summary stats
- `HintUpdate { hint: HintData }` - Updated hint after `RequestHint`
- `StateSnapshot` envelope (not an event) after `RequestState`

### Error Events

- `CommandRejected { player, reason }` - Invalid request (phase not active, etc.)

---

## Type Definitions

### HandAnalysis Types

```typescript
Use generated types:

- `PatternAnalysis` (from bindings)
- `HintData` (from bindings)
```

### HintVerbosity Enum

```typescript
enum HintVerbosity {
  Disabled = 'Disabled',
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Expert = 'Expert',
}
```

---

## UI/UX Design

### Hand Analysis Panel

```text
┌──────────────────────────────────────┐
│ Hand Analysis                    [X] │
├──────────────────────────────────────┤
│                                      │
│ Viable Patterns (3):                │
│                                      │
│ 🟢 Consecutive Run (65%)             │
│    [1D 2D 3D][4D 5D 6D][7B 8B 9B]... │
│    Score: 25 pts | Outs: 12 tiles    │
│                                      │
│ 🟡 Pung Heaven (35%)                 │
│    [5D 5D 5D][8B 8B 8B][NEWS NEWS]   │
│    Score: 40 pts | Outs: 6 tiles     │
│                                      │
│ Recommended Discard: 9 Crak          │
│ Dead Tiles: Red Dragon, 1 Bam       │
│                                      │
│ Status: 1-away from win (Waiting)   │
└──────────────────────────────────────┘
```

### Hint Verbosity Selector

```text
Hint Level: [Beginner ▼]
            ├ Disabled
            ├ Beginner  ←
            ├ Intermediate
            └ Expert
```

---

## Integration with Existing Analysis Store

**Current State**: You have [analysisStore.ts](../../../apps/client/src/store/analysisStore.ts) which stores:

- `useShowHandAnalysis`
- `useShowDistanceToWin`
- `useDistanceToWin` (selected by user)
- Various analysis flags

**Integration Plan**:

- `GetAnalysis` command should populate `analysisStore` data
- `useHandAnalysis` hook can trigger `GetAnalysis` when analysis panel opens
- Existing distance-to-win logic can leverage full analysis data
- Consider whether to auto-fetch analysis or require explicit user action

---

## Success Criteria

✅ GetAnalysis provides comprehensive hand insights
✅ Analysis panel clearly shows all viable patterns
✅ Win probabilities and recommendations are accurate
✅ SetHintVerbosity changes hint detail level in real-time
✅ All 4 verbosity levels work correctly
✅ RequestState successfully refreshes entire game state
✅ Analysis integrates with existing analysisStore
✅ UI performance remains smooth even with complex analysis
✅ Beginners can understand analysis output
✅ Experts get detailed strategic information
