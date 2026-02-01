# Pattern Viability Implementation Plan

## Document Status

**Status:** READY FOR BACKEND IMPLEMENTATION
**Created:** 2026-01-09
**Updated:** 2026-01-09 (Scoped to backend-only)
**Prerequisite:** Section 2 (Always-On Analyst) - ✅ COMPLETE
**Implements:** Gap Analysis Section 4 - Pattern Viability / Dead Hand Visualization

## Overview

**Goal:** Surface pattern viability information from the AI analysis system to clients, enabling future UI integration.

**Scope - Backend Only:** This implementation focuses on:

1. Adding difficulty classification to AI analysis
2. Creating events and data structures for client consumption
3. Generating TypeScript bindings for future frontend work
4. Testing the backend pipeline end-to-end

**Frontend work (Phases 3-6) is deferred** until UI development begins. All integration points are clearly marked with `// FRONTEND_INTEGRATION_POINT` comments.

## Quick Start

**For Backend Implementation:**

1. Read **Phase 1-4** (Backend work only)
2. Follow **Backend Implementation Sequence** section
3. Check **Backend Success Criteria** for deliverables
4. Add `// FRONTEND_INTEGRATION_POINT` comments per **Integration Point Annotations** section
5. Frontend phases (3-6) are in **Appendix** for future reference

**Key Changes from Original Plan:**

- ✅ Scoped to backend-only (Phases 1-4)
- ✅ Frontend work (Phases 3-6) moved to Appendix
- ✅ Clear integration point annotations added
- ✅ Estimated effort reduced: 9 hours (backend only) vs. 16 hours (full stack)
- ✅ TypeScript bindings generation included
- ✅ Documentation deliverable added (Phase 4)

## Architecture Summary (Backend Focus)

```text
┌─────────────────────────────────────────────────────────────┐
│ Current State (What We Have)                                │
├─────────────────────────────────────────────────────────────┤
│ mahjong_ai::StrategicEvaluation                             │
│   ├─ viable: bool ✅                                        │
│   ├─ difficulty: f64 ✅                                     │
│   ├─ probability: f64 ✅                                    │
│   └─ check_viability() ✅                                   │
│                                                              │
│ Always-On Analyst (Section 2) ✅                            │
│   └─ Analysis runs after state changes                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Backend Implementation (This Plan)                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Add PatternDifficulty enum (Easy/Medium/Hard/Impossible) │
│ 2. Add AnalysisUpdate event (WebSocket → clients)           │
│ 3. Generate TypeScript bindings                             │
│ 4. Add integration point comments                           │
│ 5. Full backend test coverage                               │
│                                                              │
│ Frontend (Deferred to Appendix)                             │
│   └─ UI integration ready when frontend development starts  │
└─────────────────────────────────────────────────────────────┘
```text

## Phase 1: Backend - Difficulty Classification

**Location:** `crates/mahjong_ai/src/evaluation.rs`

### 1.1 Add Difficulty Enum

```rust
/// Classification of pattern difficulty based on viability and probability
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum PatternDifficulty {
    /// Pattern is mathematically impossible (required tiles exhausted)
    Impossible,
    /// 4+ tiles needed, or low probability tiles (many already discarded)
    Hard,
    /// 2-3 tiles needed, moderate probability
    Medium,
    /// 0-1 tiles needed, high probability tiles available
    Easy,
}
```text

### 1.2 Update StrategicEvaluation

Add difficulty classification to `StrategicEvaluation`:

```rust
pub struct StrategicEvaluation {
    pub pattern_name: String,
    pub distance: u8,
    pub viable: bool,
    pub difficulty: f64,  // Keep existing f64 for detailed calculations
    pub difficulty_class: PatternDifficulty,  // NEW: Human-readable classification
    pub probability: f64,
    pub expected_value: f64,
}
```text

### 1.3 Implement Classification Logic

Add method to `StrategicEvaluation`:

```rust
impl StrategicEvaluation {
    /// Classify pattern difficulty based on viability, distance, and probability
    pub fn classify_difficulty(&self) -> PatternDifficulty {
        // Impossible if not viable
        if !self.viable {
            return PatternDifficulty::Impossible;
        }

        // Easy: Close to winning with high probability
        if self.distance <= 1 && self.probability >= 0.7 {
            return PatternDifficulty::Easy;
        }

        // Hard: Far from winning or very low probability
        if self.distance >= 4 || self.probability < 0.2 {
            return PatternDifficulty::Hard;
        }

        // Medium: Everything else
        PatternDifficulty::Medium
    }
}
```text

### 1.4 Update evaluate_hand()

In `mahjong_ai/src/evaluation.rs`, ensure `difficulty_class` is set:

```rust
pub fn evaluate_hand(
    hand: &Hand,
    patterns: &[AnalysisEntry],
    context: &VisibleTiles,
) -> Vec<StrategicEvaluation> {
    patterns
        .iter()
        .map(|pattern| {
            // ... existing calculation logic ...

            let mut eval = StrategicEvaluation {
                pattern_name: pattern.name.clone(),
                distance,
                viable,
                difficulty: difficulty_score,
                difficulty_class: PatternDifficulty::Impossible, // Placeholder
                probability,
                expected_value,
            };

            // Calculate classification
            eval.difficulty_class = eval.classify_difficulty();

            eval
        })
        .collect()
}
```text

## Phase 2: Server - Send Viability to Client

**Location:** `crates/mahjong_server/src/network/room.rs`

### 2.1 Add AnalysisUpdate Event

In `crates/mahjong_core/src/event.rs`, add new event:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum GameEvent {
    // ... existing events ...

    /// Analysis update for a specific player (private event)
    /// Contains pattern viability and difficulty information
    AnalysisUpdate {
        patterns: Vec<PatternAnalysis>,
    },
}

/// Pattern analysis data sent to client
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PatternAnalysis {
    pub pattern_name: String,
    pub distance: u8,
    pub viable: bool,
    pub difficulty: PatternDifficulty,
    pub probability: f64,
    pub score: u32,  // From pattern definition
}
```text

### 2.2 Send Analysis After State Changes

In `Room::broadcast_to_player()`, add analysis updates:

```rust
impl Room {
    /// Send analysis update to a specific player
    fn send_analysis_to_player(&self, seat: Seat) -> Result<(), String> {
        // Get analysis for this seat (from Section 2 - Always-On Analyst)
        let analysis = self.analysis.get(&seat)
            .ok_or("No analysis available for seat")?;

        // Convert StrategicEvaluation -> PatternAnalysis
        let patterns: Vec<PatternAnalysis> = analysis
            .iter()
            .map(|eval| PatternAnalysis {
                pattern_name: eval.pattern_name.clone(),
                distance: eval.distance,
                viable: eval.viable,
                difficulty: eval.difficulty_class,
                probability: eval.probability,
                score: self.get_pattern_score(&eval.pattern_name),
            })
            .collect();

        // Send private event to this player
        let event = GameEvent::AnalysisUpdate { patterns };
        self.send_private_event(seat, event)?;

        Ok(())
    }

    /// Trigger analysis update after state changes
    fn update_analysis_for_all(&mut self) -> Result<(), String> {
        // Run analysis for all seats (from Section 2)
        self.run_analysis_for_all_seats()?;

        // Send updates to human players only (bots don't need UI updates)
        for seat in Seat::all() {
            if !self.bot_seats.contains(&seat) {
                self.send_analysis_to_player(seat)?;
            }
        }

        Ok(())
    }
}
```text

### 2.3 Trigger Analysis Updates

Add calls to `update_analysis_for_all()` after:

- `TilesDealt` (game start)
- `TileDrawn` (player's turn starts)
- `TileDiscarded` (after discard, before call window)
- `MeldDeclared` (after successful call)

```rust
// Example in handle_discard_tile():
fn handle_discard_tile(&mut self, seat: Seat, tile_idx: u8) -> Result<(), String> {
    // ... existing discard logic ...

    // Update analysis after discard
    self.update_analysis_for_all()?;

    Ok(())
}
```text

### 2.4 Event Visibility

Ensure `AnalysisUpdate` is marked as private (only visible to target player):

```rust
impl GameEvent {
    pub fn visibility(&self) -> EventVisibility {
        match self {
            GameEvent::AnalysisUpdate { .. } => EventVisibility::Private,
            // ... existing visibility rules ...
        }
    }
}
```text

## Phase 3: Frontend - State Management

**Location:** `apps/client/src/stores/` (Zustand stores)

### 3.1 Create Analysis Store

Create `apps/client/src/stores/analysisStore.ts`:

```typescript
import { create } from 'zustand';
import { PatternAnalysis, PatternDifficulty } from '@/types/bindings/generated';

export interface AnalysisState {
  patterns: PatternAnalysis[];

  // Filtering
  showOnlyViable: boolean;
  hideImpossible: boolean;

  // Sorting
  sortBy: 'probability' | 'score' | 'difficulty' | 'name';

  // Actions
  updatePatterns: (patterns: PatternAnalysis[]) => void;
  setShowOnlyViable: (show: boolean) => void;
  setHideImpossible: (hide: boolean) => void;
  setSortBy: (sort: AnalysisState['sortBy']) => void;

  // Derived state
  getFilteredPatterns: () => PatternAnalysis[];
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  patterns: [],
  showOnlyViable: false,
  hideImpossible: false,
  sortBy: 'probability',

  updatePatterns: (patterns) => set({ patterns }),

  setShowOnlyViable: (show) => set({ showOnlyViable: show }),

  setHideImpossible: (hide) => set({ hideImpossible: hide }),

  setSortBy: (sort) => set({ sortBy: sort }),

  getFilteredPatterns: () => {
    const { patterns, showOnlyViable, hideImpossible, sortBy } = get();

    let filtered = [...patterns];

    // Apply filters
    if (showOnlyViable) {
      filtered = filtered.filter((p) => p.viable);
    }

    if (hideImpossible) {
      filtered = filtered.filter((p) => p.difficulty !== 'Impossible');
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'probability':
          return b.probability - a.probability;
        case 'score':
          return b.score - a.score;
        case 'difficulty':
          return difficultyOrder(a.difficulty) - difficultyOrder(b.difficulty);
        case 'name':
          return a.pattern_name.localeCompare(b.pattern_name);
        default:
          return 0;
      }
    });

    return filtered;
  },
}));

// Helper: Difficulty sort order (Easy -> Medium -> Hard -> Impossible)
function difficultyOrder(difficulty: PatternDifficulty): number {
  const order = { Easy: 0, Medium: 1, Hard: 2, Impossible: 3 };
  return order[difficulty] ?? 999;
}
```text

### 3.2 Handle AnalysisUpdate Events

In `apps/client/src/services/websocket.ts` (or wherever events are dispatched):

```typescript
import { useAnalysisStore } from '@/stores/analysisStore';

// In your event handler:
function handleGameEvent(event: GameEvent) {
  if (event.type === 'AnalysisUpdate') {
    useAnalysisStore.getState().updatePatterns(event.patterns);
  }
  // ... other event handlers ...
}
```text

## Phase 4: Frontend - Card Viewer UI

**Location:** `apps/client/src/components/CardViewer/`

### 4.1 Pattern Card Component

Update `PatternCard.tsx` to show difficulty:

```typescript
import { PatternAnalysis, PatternDifficulty } from '@/types/bindings/generated';

interface PatternCardProps {
  pattern: PatternAnalysis;
  onClick?: () => void;
}

export function PatternCard({ pattern, onClick }: PatternCardProps) {
  const difficultyColor = getDifficultyColor(pattern.difficulty);
  const isImpossible = pattern.difficulty === 'Impossible';

  return (
    <div
      className={`pattern-card ${isImpossible ? 'opacity-50' : ''}`}
      style={{ borderColor: difficultyColor }}
      onClick={onClick}
    >
      {/* Pattern name */}
      <h3 className={isImpossible ? 'line-through' : ''}>
        {pattern.pattern_name}
      </h3>

      {/* Score badge */}
      <div className="score-badge">{pattern.score}</div>

      {/* Difficulty indicator */}
      <div
        className="difficulty-badge"
        style={{ backgroundColor: difficultyColor }}
      >
        {pattern.difficulty}
      </div>

      {/* Distance/Probability info */}
      {!isImpossible && (
        <div className="pattern-stats">
          <span>{pattern.distance} tiles away</span>
          <span>{(pattern.probability * 100).toFixed(0)}% chance</span>
        </div>
      )}

      {/* Impossible reason (tooltip) */}
      {isImpossible && (
        <div className="impossible-reason" title={getImpossibleReason(pattern)}>
          Required tiles exhausted
        </div>
      )}
    </div>
  );
}

function getDifficultyColor(difficulty: PatternDifficulty): string {
  const colors = {
    Easy: '#4ade80',      // green-400
    Medium: '#fbbf24',    // amber-400
    Hard: '#fb923c',      // orange-400
    Impossible: '#94a3b8' // slate-400
  };
  return colors[difficulty] ?? '#94a3b8';
}

function getImpossibleReason(pattern: PatternAnalysis): string {
  // Future enhancement: Add detailed reason from backend
  return `Pattern "${pattern.pattern_name}" requires tiles that have all been discarded or used in exposed melds.`;
}
```text

### 4.2 Filtering Controls

Create `CardViewerControls.tsx`:

```typescript
import { useAnalysisStore } from '@/stores/analysisStore';

export function CardViewerControls() {
  const {
    showOnlyViable,
    hideImpossible,
    sortBy,
    setShowOnlyViable,
    setHideImpossible,
    setSortBy,
  } = useAnalysisStore();

  return (
    <div className="card-viewer-controls">
      {/* Filters */}
      <div className="filters">
        <label>
          <input
            type="checkbox"
            checked={showOnlyViable}
            onChange={(e) => setShowOnlyViable(e.target.checked)}
          />
          Show only viable patterns
        </label>

        <label>
          <input
            type="checkbox"
            checked={hideImpossible}
            onChange={(e) => setHideImpossible(e.target.checked)}
          />
          Hide impossible patterns
        </label>
      </div>

      {/* Sorting */}
      <div className="sorting">
        <label>Sort by:</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
        >
          <option value="probability">Probability</option>
          <option value="score">Score</option>
          <option value="difficulty">Difficulty</option>
          <option value="name">Name</option>
        </select>
      </div>
    </div>
  );
}
```text

### 4.3 Main Card Viewer

Update `CardViewer.tsx`:

```typescript
import { useAnalysisStore } from '@/stores/analysisStore';
import { PatternCard } from './PatternCard';
import { CardViewerControls } from './CardViewerControls';

export function CardViewer() {
  const getFilteredPatterns = useAnalysisStore(state => state.getFilteredPatterns);
  const patterns = getFilteredPatterns();

  return (
    <div className="card-viewer">
      <CardViewerControls />

      <div className="pattern-grid">
        {patterns.length === 0 ? (
          <p>No patterns match your filters</p>
        ) : (
          patterns.map(pattern => (
            <PatternCard
              key={pattern.pattern_name}
              pattern={pattern}
            />
          ))
        )}
      </div>

      {/* Pattern count */}
      <div className="pattern-count">
        Showing {patterns.length} patterns
      </div>
    </div>
  );
}
```text

## Phase 5: Testing

### 5.1 Backend Tests

**File:** `crates/mahjong_ai/tests/pattern_viability.rs`

```rust
#[test]
fn test_difficulty_classification() {
    // Easy: 1 tile away, high probability
    let easy = StrategicEvaluation {
        distance: 1,
        viable: true,
        probability: 0.8,
        // ... other fields
    };
    assert_eq!(easy.classify_difficulty(), PatternDifficulty::Easy);

    // Medium: 2-3 tiles away
    let medium = StrategicEvaluation {
        distance: 2,
        viable: true,
        probability: 0.5,
        // ...
    };
    assert_eq!(medium.classify_difficulty(), PatternDifficulty::Medium);

    // Hard: Far away or low probability
    let hard = StrategicEvaluation {
        distance: 5,
        viable: true,
        probability: 0.15,
        // ...
    };
    assert_eq!(hard.classify_difficulty(), PatternDifficulty::Hard);

    // Impossible: Not viable
    let impossible = StrategicEvaluation {
        viable: false,
        // ...
    };
    assert_eq!(impossible.classify_difficulty(), PatternDifficulty::Impossible);
}

#[test]
fn test_analysis_update_event_sent() {
    // Integration test: Verify AnalysisUpdate is sent after TileDiscarded
    let mut room = create_test_room();

    // Discard a tile
    room.handle_command(Seat::East, GameCommand::DiscardTile { tile_idx: 0 })?;

    // Verify AnalysisUpdate event was sent to all players
    let events = room.get_events_for_seat(Seat::East);
    assert!(events.iter().any(|e| matches!(e, GameEvent::AnalysisUpdate { .. })));
}
```text

### 5.2 Frontend Tests

**File:** `apps/client/src/stores/analysisStore.test.ts`

```typescript
import { useAnalysisStore } from './analysisStore';
import { PatternDifficulty } from '@/types/bindings/generated';

describe('analysisStore', () => {
  beforeEach(() => {
    // Reset store
    useAnalysisStore.setState({
      patterns: [],
      showOnlyViable: false,
      hideImpossible: false,
      sortBy: 'probability',
    });
  });

  test('filters impossible patterns', () => {
    const patterns = [
      {
        pattern_name: 'A',
        viable: true,
        difficulty: 'Easy' as PatternDifficulty,
        probability: 0.9,
        score: 25,
        distance: 1,
      },
      {
        pattern_name: 'B',
        viable: false,
        difficulty: 'Impossible' as PatternDifficulty,
        probability: 0.0,
        score: 50,
        distance: 99,
      },
      {
        pattern_name: 'C',
        viable: true,
        difficulty: 'Medium' as PatternDifficulty,
        probability: 0.5,
        score: 25,
        distance: 2,
      },
    ];

    useAnalysisStore.getState().updatePatterns(patterns);
    useAnalysisStore.getState().setHideImpossible(true);

    const filtered = useAnalysisStore.getState().getFilteredPatterns();
    expect(filtered).toHaveLength(2);
    expect(filtered.find((p) => p.pattern_name === 'B')).toBeUndefined();
  });

  test('sorts by probability descending', () => {
    const patterns = [
      {
        pattern_name: 'Low',
        probability: 0.2,
        difficulty: 'Hard' as PatternDifficulty,
        viable: true,
        score: 25,
        distance: 4,
      },
      {
        pattern_name: 'High',
        probability: 0.9,
        difficulty: 'Easy' as PatternDifficulty,
        viable: true,
        score: 25,
        distance: 1,
      },
      {
        pattern_name: 'Mid',
        probability: 0.5,
        difficulty: 'Medium' as PatternDifficulty,
        viable: true,
        score: 25,
        distance: 2,
      },
    ];

    useAnalysisStore.getState().updatePatterns(patterns);
    useAnalysisStore.getState().setSortBy('probability');

    const sorted = useAnalysisStore.getState().getFilteredPatterns();
    expect(sorted[0].pattern_name).toBe('High');
    expect(sorted[1].pattern_name).toBe('Mid');
    expect(sorted[2].pattern_name).toBe('Low');
  });
});
```text

### 5.3 E2E Test

**File:** `apps/client/e2e/pattern-viability.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('Card Viewer shows pattern difficulty colors', async ({ page }) => {
  await page.goto('/game/practice');

  // Wait for analysis update
  await page.waitForSelector('.pattern-card');

  // Check that impossible patterns are grayed out
  const impossibleCards = page.locator('.pattern-card.opacity-50');
  await expect(impossibleCards.first()).toBeVisible();

  // Check that difficulty badges have correct colors
  const easyBadge = page.locator('.difficulty-badge:has-text("Easy")').first();
  const bgColor = await easyBadge.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(bgColor).toContain('rgb(74, 222, 128)'); // green-400
});

test('Filtering controls work', async ({ page }) => {
  await page.goto('/game/practice');

  // Count initial patterns
  const initialCount = await page.locator('.pattern-card').count();

  // Enable "Hide impossible" filter
  await page.check('input[type="checkbox"]:has-text("Hide impossible")');

  // Verify fewer patterns shown
  const filteredCount = await page.locator('.pattern-card').count();
  expect(filteredCount).toBeLessThan(initialCount);

  // Verify no impossible patterns visible
  const impossibleCards = page.locator('.pattern-card.opacity-50');
  await expect(impossibleCards).toHaveCount(0);
});
```text

## Phase 6: Performance Optimization

### 6.1 Debounce Analysis Updates

Prevent UI flickering from rapid updates:

```typescript
// In analysisStore.ts
import { debounce } from 'lodash-es';

const debouncedUpdate = debounce(
  (patterns: PatternAnalysis[]) => {
    useAnalysisStore.getState().updatePatterns(patterns);
  },
  500 // Max 1 update per 500ms
);

// Use in event handler:
function handleGameEvent(event: GameEvent) {
  if (event.type === 'AnalysisUpdate') {
    debouncedUpdate(event.patterns);
  }
}
```text

### 6.2 Virtual Scrolling for Long Pattern Lists

If card viewer has 500+ patterns, use virtual scrolling:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

export function CardViewer() {
  const patterns = useAnalysisStore(state => state.getFilteredPatterns());
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: patterns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Pattern card height
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="pattern-grid-container" style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <PatternCard pattern={patterns[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```text

## Backend Success Criteria

### Phase 1: Difficulty Classification

- [ ] `PatternDifficulty` enum defined with 4 levels (Easy, Medium, Hard, Impossible)
- [ ] `PatternDifficulty` includes `#[derive(TS)]` for TypeScript bindings
- [ ] `StrategicEvaluation.difficulty_class` field added
- [ ] `classify_difficulty()` method implemented with clear thresholds
- [ ] `evaluate_hand()` populates `difficulty_class` for all patterns
- [ ] TypeScript bindings generated (`cargo test export_bindings`)
- [ ] All `mahjong_ai` tests pass

### Phase 2: Event Pipeline

- [ ] `AnalysisUpdate` event variant added to `GameEvent` enum
- [ ] `PatternAnalysis` struct defined (simplified version of `StrategicEvaluation`)
- [ ] Both types include `#[derive(TS)]` for frontend bindings
- [ ] Event visibility set to `EventVisibility::Private` (player-specific)
- [ ] `send_analysis_to_player()` implemented in `Room`
- [ ] `update_analysis_for_all()` implemented in `Room`
- [ ] Analysis triggers added after:
  - `TilesDealt` (game start)
  - `TileDrawn` (player's turn starts)
  - `TileDiscarded` (after discard completes)
  - `MeldDeclared` (after successful call)
- [ ] Charleston phase guard (no analysis during Charleston)
- [ ] Bot players excluded from `AnalysisUpdate` events
- [ ] TypeScript bindings generated for new types
- [ ] All `mahjong_server` tests pass

### Phase 3: Testing

- [ ] Unit tests for `classify_difficulty()` (all 4 difficulty levels)
- [ ] Integration test: `AnalysisUpdate` sent after discard
- [ ] Integration test: Event privacy (only target player receives)
- [ ] Integration test: Charleston phase skip
- [ ] Integration test: Bots don't receive events
- [ ] Integration test: Event ordering (analysis after state change)
- [ ] Integration test: Pattern name consistency
- [ ] Manual WebSocket test: Observe `AnalysisUpdate` events in real game
- [ ] Performance benchmark: `send_analysis_to_player()` < 5ms

### Phase 4: Documentation

- [ ] `docs/integration/frontend-analysis-events.md` created
- [ ] All integration points annotated with `// FRONTEND_INTEGRATION_POINT` comments
- [ ] Example WebSocket event JSON documented
- [ ] Frontend integration checklist created
- [ ] Gap analysis doc updated with completion status
- [ ] TypeScript bindings README updated

## Backend Implementation Sequence

> **NOTE:** This implementation is BACKEND ONLY - Frontend phases (3-6) are deferred until UI development begins.

### Phase 1: Backend - Difficulty Classification (2 hours)

**Files to modify:**

- `crates/mahjong_ai/src/evaluation.rs`

**Steps:**

1. Add `PatternDifficulty` enum (with `#[ts(export)]`)
2. Add `difficulty_class: PatternDifficulty` field to `StrategicEvaluation`
3. Implement `classify_difficulty()` method
4. Update `evaluate_hand()` to populate `difficulty_class`
5. Run TypeScript binding export: `cargo test export_bindings`

**Deliverable:** `PatternDifficulty` enum available for frontend, all analysis includes classification

### Phase 2: Server - Event Pipeline (3 hours)

**Files to modify:**

- `crates/mahjong_core/src/event.rs`
- `crates/mahjong_server/src/network/room.rs`

**Steps:**

1. Add `AnalysisUpdate` event variant to `GameEvent` (with `#[ts(export)]`)
2. Add `PatternAnalysis` struct (with `#[ts(export)]`)
3. Add visibility handling for `AnalysisUpdate` → `EventVisibility::Private`
4. Implement `send_analysis_to_player()` in `Room`
5. Implement `update_analysis_for_all()` in `Room`
6. Add analysis triggers after state changes:
   - After `TilesDealt`
   - After `TileDrawn`
   - After `TileDiscarded`
   - After `MeldDeclared`
7. Add Charleston phase guard (skip analysis during Charleston)
8. Run TypeScript binding export: `cargo test export_bindings`

**Integration Point:** Add `// FRONTEND_INTEGRATION_POINT` comments at all event emission sites

**Deliverable:** Server sends `AnalysisUpdate` events to clients with pattern viability data

### Phase 3: Testing & Validation (3 hours)

**New test files:**

- `crates/mahjong_ai/tests/pattern_viability.rs`
- `crates/mahjong_server/tests/analysis_events.rs`

**Steps:**

1. Write unit tests for `classify_difficulty()`
2. Write integration test: verify `AnalysisUpdate` sent after discard
3. Write integration test: verify event privacy (only target player receives)
4. Write integration test: verify Charleston phase skip
5. Manual WebSocket test: connect client, observe `AnalysisUpdate` events

**Deliverable:** Full backend test coverage, WebSocket event validation

### Phase 4: Documentation & Frontend Prep (1 hour)

**Files to create/update:**

- `docs/integration/frontend-analysis-events.md` (new)
- Update gap analysis doc with completion status

**Steps:**

1. Document `AnalysisUpdate` event structure
2. Document expected frontend behavior
3. Create example WebSocket event JSON
4. List all integration point comments in code
5. Update TypeScript bindings README

**Deliverable:** Frontend developer onboarding guide ready

**Total Backend Effort:** 9 hours (~1 day)

## Integration Point Annotations

To make frontend integration seamless, add clear comments at all integration points:

### Comment Convention

```rust
// FRONTEND_INTEGRATION_POINT: AnalysisUpdate Event
// This event contains pattern viability data for the Card Viewer UI.
// Event structure: { patterns: Vec<PatternAnalysis> }
// TypeScript bindings: apps/client/src/types/bindings/generated/GameEvent.ts
// Expected behavior: Client should update pattern viability display in Card Viewer
self.send_private_event(seat, GameEvent::AnalysisUpdate { patterns })?;
```text

### Integration Points to Annotate

1. **Event Emission Sites** (`crates/mahjong_server/src/network/room.rs`):
   - Where `AnalysisUpdate` is sent
   - Where analysis triggers fire (after TileDrawn, TileDiscarded, etc.)

2. **Data Structure Definitions** (`crates/mahjong_core/src/event.rs`):
   - `AnalysisUpdate` event variant
   - `PatternAnalysis` struct

3. **TypeScript Bindings** (auto-generated):
   - Note in comments which `.ts` files will be created
   - Document expected frontend usage

4. **Test Files**:
   - Document how frontend can verify events are received
   - Provide example WebSocket message format

### Example: Annotated Code

```rust
impl Room {
    fn update_analysis_for_all(&mut self) -> Result<(), String> {
        // FRONTEND_INTEGRATION_POINT: Analysis Pipeline
        // This function runs AI analysis for all players and sends AnalysisUpdate events.
        //
        // Frontend should:
        // 1. Listen for AnalysisUpdate events in WebSocket handler
        // 2. Update analysisStore with new pattern data
        // 3. Re-render Card Viewer to show updated viability/difficulty
        //
        // TypeScript binding: PatternAnalysis[] in GameEvent.AnalysisUpdate

        // Only send analysis during Playing phase
        if !matches!(self.table.phase, GamePhase::Playing) {
            return Ok(());
        }

        // Run analysis for all seats (from Section 2)
        self.run_analysis_for_all_seats()?;

        // Send updates to human players only
        for seat in Seat::all() {
            if !self.bot_seats.contains(&seat) {
                self.send_analysis_to_player(seat)?;
            }
        }

        Ok(())
    }
}
```text

## Backend Edge Cases & Considerations

### 1. Charleston Phase Guard

**Problem:** During Charleston, players don't have full 14-tile hands yet
**Solution:** Skip analysis updates until Playing phase starts

```rust
fn update_analysis_for_all(&mut self) -> Result<(), String> {
    // Only send analysis during Playing phase
    if !matches!(self.table.phase, GamePhase::Playing) {
        return Ok(());
    }

    // ... rest of analysis logic
}
```text

**Test:** Verify no `AnalysisUpdate` events sent during Charleston phases

### 2. Pattern Name Consistency

**Problem:** Backend sends pattern names that might not match expectations
**Solution:** Ensure pattern names are consistent across the system

Pattern names must match between:

- `data/cards/unified_card2025.json` (source of truth)
- `mahjong_ai::StrategicEvaluation.pattern_name`
- `PatternAnalysis.pattern_name` (event payload)

**Test:** Integration test comparing pattern names from card data vs. analysis output

### 3. Reconnection Support

**Problem:** Player reconnects mid-game, misses analysis updates
**Solution:** Send full analysis in `GameStateSnapshot`

```rust
pub struct GameStateSnapshot {
    // ... existing fields

    /// Analysis data for the requesting player (if in Playing phase)
    /// Contains pattern viability for Card Viewer initialization
    pub analysis: Option<Vec<PatternAnalysis>>,
}
```text

**Implementation:** In `Room::create_snapshot_for_seat()`, include current analysis if available

### 4. Bot Players

**Problem:** Bots don't need UI updates, wasting bandwidth
**Solution:** Skip `AnalysisUpdate` events for bot-controlled seats

```rust
for seat in Seat::all() {
    if !self.bot_seats.contains(&seat) {
        self.send_analysis_to_player(seat)?; // Human players only
    }
}
```text

**Test:** Verify bots don't receive `AnalysisUpdate` events

### 5. Analysis Performance

**Problem:** Running analysis for 4 players × 500 patterns after every discard could be slow
**Solution:** Leverage existing Always-On Analyst optimizations

- Analysis already runs incrementally (Section 2 implementation)
- Results are cached in `Room.analysis: HashMap<Seat, Vec<StrategicEvaluation>>`
- Only need to convert to `PatternAnalysis` format (lightweight)

**Test:** Benchmark `send_analysis_to_player()` - should be < 5ms (just data conversion)

### 6. Event Ordering

**Problem:** Client might receive `AnalysisUpdate` before `TileDiscarded`
**Solution:** Ensure analysis events sent AFTER game state events

```rust
// Correct order:
self.broadcast_event(GameEvent::TileDiscarded { ... })?;
self.update_analysis_for_all()?; // Analysis AFTER state change
```text

**Test:** Verify event sequence in integration tests

## Dependencies

**Crates:**

- `serde` and `serde_json` (already in use)
- `ts-rs` for TypeScript bindings (already in use)

**NPM Packages:**

- `zustand` (already in use for stores)
- `lodash-es` (for debounce) - add if not present
- `@tanstack/react-virtual` (for virtual scrolling) - add if needed

## Migration Notes

**Breaking Changes:** None - this is additive functionality

**Database Migrations:** None - analysis is computed in-memory

**Client Updates Required:** Yes - clients must handle new `AnalysisUpdate` event

## Future Enhancements (Out of Scope)

1. **Detailed Impossible Reasons**
   - "This pattern needs 4× White Dragon, but all 4 are in Bot 2's exposed Kong"
   - Requires tracking which tiles are where (more complex)

2. **Pattern Comparison**
   - "Compare Pattern A vs Pattern B" side-by-side
   - Show which tiles overlap, which conflict

3. **Historical Difficulty Trends**
   - Graph showing how pattern difficulty changed throughout the game
   - Visualize "this pattern became impossible on turn 23"

4. **AI Difficulty Hints**
   - "Bot 2 is likely pursuing 'Consecutive Run' (based on discards)"
   - Defensive play suggestions

## Questions for Review

1. **Difficulty Thresholds**: Are the classification thresholds (distance ≤ 1 for Easy, etc.) balanced?
2. **Update Frequency**: Is debouncing at 500ms the right balance between responsiveness and performance?
3. **Default Filters**: Should "Hide impossible" be ON by default? (Reduce clutter for beginners)
4. **Color Scheme**: Do the green/yellow/orange/gray colors meet accessibility standards (contrast ratios)?

---

## Summary

**Backend Implementation Ready:** This plan focuses exclusively on backend work that can be done independently of frontend development.

**Deliverables:**

1. Pattern difficulty classification system
2. `AnalysisUpdate` events sent to clients via WebSocket
3. TypeScript bindings auto-generated for frontend consumption
4. Full test coverage and documentation
5. Clear integration points marked in code

**When Frontend is Ready:** Developers can reference Phases 3-6 (see Appendix below) for UI implementation guidance.

**Estimated Backend Completion:** 1 day (9 hours)

---

## Appendix: Frontend Implementation (Future Work)

> **NOTE:** The sections below (Phases 3-6) are preserved for future reference but are NOT part of the current backend-only implementation.

### Deferred Phase 3: Frontend State Management

See lines 265-363 for full `analysisStore` implementation.

**Key Points:**

- Zustand store for pattern analysis state
- Filtering: `showOnlyViable`, `hideImpossible`
- Sorting: by probability, score, difficulty, name
- Event handler for `AnalysisUpdate` WebSocket messages

### Deferred Phase 4: Frontend Card Viewer UI

See lines 365-536 for full component implementation.

**Key Components:**

- `PatternCard` - Individual pattern display with difficulty colors
- `CardViewerControls` - Filter/sort controls
- `CardViewer` - Main container with grid layout

**Color Scheme:**

- Easy: Green (#4ade80)
- Medium: Yellow (#fbbf24)
- Hard: Orange (#fb923c)
- Impossible: Gray (#94a3b8)

### Deferred Phase 5: Frontend Testing

See lines 597-690 for test examples.

**Coverage:**

- Store unit tests (filtering, sorting logic)
- E2E tests (UI rendering, interactions)

### Deferred Phase 6: Performance Optimization

See lines 692-756 for optimization strategies.

**Key Optimizations:**

- Debounce analysis updates (500ms)
- Virtual scrolling for 500+ patterns
- Client-side caching

---

**Ready for Backend Implementation:** Phases 1-4 (backend only) can begin immediately.
