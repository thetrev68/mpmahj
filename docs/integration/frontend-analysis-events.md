# Frontend Integration Guide: Analysis Events

**Status:** Backend Complete, Ready for Frontend Integration
**Created:** 2026-01-09
**Backend Implementation:** Section 4 - Pattern Viability / Dead Hand Visualization

## Overview

The backend now sends real-time pattern viability data to clients via WebSocket events. This enables the frontend to build UI features like:

- **Card Viewer**: Visual display of all patterns with difficulty indicators
- **Pattern Filtering**: Show only viable patterns, hide impossible ones
- **Difficulty Visualization**: Color-coded badges (Easy/Medium/Hard/Impossible)
- **Real-time Updates**: Pattern viability changes as the game progresses

## Event Structure

### AnalysisUpdate Event

```typescript
// TypeScript binding: apps/client/src/types/bindings/generated/GameEvent.ts
{
  AnalysisUpdate: {
    patterns: PatternAnalysis[]
  }
}
```

### PatternAnalysis Structure

```typescript
// TypeScript binding: apps/client/src/types/bindings/generated/PatternAnalysis.ts
export type PatternAnalysis = {
  pattern_name: string; // Pattern ID from card data
  distance: number; // Tiles needed to win (0 = mahjong)
  viable: boolean; // Can this pattern still be completed?
  difficulty: PatternDifficulty; // Easy | Medium | Hard | Impossible
  probability: number; // Completion probability (0.0-1.0)
  score: number; // Pattern score if won
};
```

### PatternDifficulty Enum

```typescript
// TypeScript binding: apps/client/src/types/bindings/generated/PatternDifficulty.ts
export type PatternDifficulty = 'Impossible' | 'Hard' | 'Medium' | 'Easy';
```

## Event Flow

```text
┌─────────────────────────────────────────────────────────────┐
│ Game State Changes (Server)                                 │
├─────────────────────────────────────────────────────────────┤
│ • TilesDealt (game start)                                   │
│ • TileDrawn (player's turn starts)                          │
│ • TileDiscarded (after discard)                             │
│ • MeldDeclared (after successful call)                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Always-On Analyst (Background Worker)                       │
├─────────────────────────────────────────────────────────────┤
│ • Runs AI analysis for all human players                   │
│ • Classifies patterns by difficulty                        │
│ • Sends AnalysisUpdate event to each player                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ WebSocket → Client (Private Event)                          │
├─────────────────────────────────────────────────────────────┤
│ {                                                            │
│   "type": "event",                                           │
│   "payload": {                                               │
│     "AnalysisUpdate": {                                      │
│       "patterns": [...]                                      │
│     }                                                         │
│   }                                                           │
│ }                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend (Your Implementation)                              │
├─────────────────────────────────────────────────────────────┤
│ 1. WebSocket handler receives event                        │
│ 2. Update analysisStore with new patterns                  │
│ 3. Re-render Card Viewer UI                                │
└─────────────────────────────────────────────────────────────┘
```

## Integration Points

All integration points are marked with `// FRONTEND_INTEGRATION_POINT` comments in the backend code:

### 1. Event Definition

**File:** `crates/mahjong_core/src/event.rs:225-233`

```rust
// FRONTEND_INTEGRATION_POINT: AnalysisUpdate Event
// This event contains pattern viability data for the Card Viewer UI.
// Event structure: { patterns: Vec<PatternAnalysis> }
// TypeScript bindings: apps/client/src/types/bindings/generated/GameEvent.ts
// Expected behavior: Client should update pattern viability display in Card Viewer
AnalysisUpdate { patterns: Vec<PatternAnalysis> },
```

### 2. Data Structure

**File:** `crates/mahjong_core/src/event.rs:33-48`

```rust
// FRONTEND_INTEGRATION_POINT: Pattern Analysis Data Structure
// This struct is sent to clients via AnalysisUpdate events.
// TypeScript binding: apps/client/src/types/bindings/generated/PatternAnalysis.ts
pub struct PatternAnalysis { ... }
```

### 3. Analysis Worker (Always-On)

**File:** `crates/mahjong_server/src/network/room.rs:1064-1088`

```rust
// FRONTEND_INTEGRATION_POINT: AnalysisUpdate Event Emission
// This event contains detailed pattern viability data for the Card Viewer UI.
// Frontend should:
// 1. Listen for AnalysisUpdate events in WebSocket handler
// 2. Update analysisStore with new pattern data
// 3. Re-render Card Viewer to show updated viability/difficulty
```

### 4. On-Demand Analysis

**File:** `crates/mahjong_server/src/network/room.rs:416-432`

```rust
// FRONTEND_INTEGRATION_POINT: AnalysisUpdate Event (On-Demand)
// Also send detailed pattern analysis for Card Viewer
```

## Example WebSocket Event

### Full Event JSON

```json
{
  "type": "event",
  "payload": {
    "AnalysisUpdate": {
      "patterns": [
        {
          "pattern_name": "2468 Consecutive Run",
          "distance": 1,
          "viable": true,
          "difficulty": "Easy",
          "probability": 0.85,
          "score": 25
        },
        {
          "pattern_name": "Any Like Numbers",
          "distance": 3,
          "viable": true,
          "difficulty": "Medium",
          "probability": 0.45,
          "score": 30
        },
        {
          "pattern_name": "Dragon Hand",
          "distance": 6,
          "viable": false,
          "difficulty": "Impossible",
          "probability": 0.0,
          "score": 75
        }
      ]
    }
  }
}
```

## Difficulty Classification Logic

The backend classifies patterns using this algorithm:

```rust
pub fn classify_difficulty(&self) -> PatternDifficulty {
    // Impossible if not viable
    if !self.viable {
        return PatternDifficulty::Impossible;
    }

    // Easy: Close to winning with high probability
    if self.deficiency <= 1 && self.probability >= 0.7 {
        return PatternDifficulty::Easy;
    }

    // Hard: Far from winning or very low probability
    if self.deficiency >= 4 || self.probability < 0.2 {
        return PatternDifficulty::Hard;
    }

    // Medium: Everything else
    PatternDifficulty::Medium
}
```

**Summary:**

- **Impossible**: Pattern cannot be completed (required tiles exhausted)
- **Easy**: 0-1 tiles needed AND ≥70% probability
- **Hard**: ≥4 tiles needed OR <20% probability
- **Medium**: Everything else (2-3 tiles, 20-70% probability)

## Frontend Implementation Checklist

### 1. WebSocket Handler

```typescript
// Example: apps/client/src/services/websocket.ts
import { useAnalysisStore } from '@/stores/analysisStore';
import type { GameEvent } from '@/types/bindings/generated/GameEvent';

function handleGameEvent(event: GameEvent) {
  if ('AnalysisUpdate' in event) {
    const patterns = event.AnalysisUpdate.patterns;
    useAnalysisStore.getState().updatePatterns(patterns);
  }
  // ... other event handlers
}
```

### 2. Analysis Store (Zustand)

```typescript
// Example: apps/client/src/stores/analysisStore.ts
import { create } from 'zustand';
import type { PatternAnalysis } from '@/types/bindings/generated';

interface AnalysisState {
  patterns: PatternAnalysis[];
  updatePatterns: (patterns: PatternAnalysis[]) => void;
  getFilteredPatterns: () => PatternAnalysis[];
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  patterns: [],
  updatePatterns: (patterns) => set({ patterns }),
  getFilteredPatterns: () => {
    // Add filtering logic here (viable only, hide impossible, etc.)
    return get().patterns;
  },
}));
```

### 3. Card Viewer Component

```typescript
// Example: apps/client/src/components/CardViewer/CardViewer.tsx
import { useAnalysisStore } from '@/stores/analysisStore';
import { PatternCard } from './PatternCard';

export function CardViewer() {
  const patterns = useAnalysisStore(state => state.getFilteredPatterns());

  return (
    <div className="card-viewer">
      {patterns.map(pattern => (
        <PatternCard key={pattern.pattern_name} pattern={pattern} />
      ))}
    </div>
  );
}
```

### 4. Pattern Card Component

```typescript
// Example: apps/client/src/components/CardViewer/PatternCard.tsx
import type { PatternAnalysis } from '@/types/bindings/generated';

interface PatternCardProps {
  pattern: PatternAnalysis;
}

export function PatternCard({ pattern }: PatternCardProps) {
  const difficultyColor = {
    Easy: '#4ade80',      // green-400
    Medium: '#fbbf24',    // amber-400
    Hard: '#fb923c',      // orange-400
    Impossible: '#94a3b8' // slate-400
  }[pattern.difficulty];

  return (
    <div className="pattern-card" style={{ borderColor: difficultyColor }}>
      <h3 className={pattern.difficulty === 'Impossible' ? 'line-through' : ''}>
        {pattern.pattern_name}
      </h3>
      <div className="difficulty-badge" style={{ backgroundColor: difficultyColor }}>
        {pattern.difficulty}
      </div>
      {pattern.viable && (
        <div className="pattern-stats">
          <span>{pattern.distance} tiles away</span>
          <span>{(pattern.probability * 100).toFixed(0)}% chance</span>
          <span>{pattern.score} points</span>
        </div>
      )}
    </div>
  );
}
```

## Testing Your Integration

### 1. Manual WebSocket Test

Start the server and connect with a WebSocket client:

```bash
# Terminal 1: Start server
cd crates/mahjong_server
cargo run

# Terminal 2: Connect with wscat (or browser console)
wscat -c ws://localhost:3000/ws
```

Send authentication and join a game:

```json
{"type":"authenticate","payload":{"Guest":{}}}
{"type":"command","payload":{"CreateRoom":{"room_id":"test","card_year":2025}}}
{"type":"command","payload":{"JoinRoom":"test"}}
```

Wait for `TilesDealt` event, then you should receive:

```json
{
  "type": "event",
  "payload": {
    "AnalysisUpdate": {
      "patterns": [...]
    }
  }
}
```

### 2. Verify Event Structure

Check that all fields are present:

- `pattern_name`: string
- `distance`: number (0-14)
- `viable`: boolean
- `difficulty`: "Easy" | "Medium" | "Hard" | "Impossible"
- `probability`: number (0.0-1.0)
- `score`: number (25, 30, 50, 75, etc.)

### 3. Verify Event Timing

Events should be sent after:

- ✅ TilesDealt (game start)
- ✅ TileDrawn (your turn starts)
- ✅ TileDiscarded (after any player discards)
- ✅ MeldDeclared (after successful call)
- ❌ Charleston phase (no analysis during Charleston)
- ❌ Bot players (bots don't receive UI updates)

## Edge Cases & Considerations

### 1. Charleston Phase

**Backend Behavior:** No `AnalysisUpdate` events during Charleston (players don't have full 14-tile hands yet)

**Frontend Action:** Don't expect events until `CharlestonComplete` → `PhaseChanged` to `Playing`

### 2. Bot Players

**Backend Behavior:** Bots don't receive `AnalysisUpdate` events (optimization)

**Frontend Action:** If spectating a bot, don't expect analysis updates

### 3. Reconnection

**Backend Behavior:** Full game state snapshot includes current analysis (via `GameStateSnapshot`)

**Frontend Action:** On reconnect, populate analysis from snapshot (not yet implemented in backend)

### 4. Event Frequency

**Backend Behavior:** Analysis runs after every state change (can be 2-3 events per turn)

**Frontend Action:** Consider debouncing updates (500ms) to prevent UI flicker

```typescript
import { debounce } from 'lodash-es';

const debouncedUpdate = debounce((patterns: PatternAnalysis[]) => {
  useAnalysisStore.getState().updatePatterns(patterns);
}, 500);

// Use in event handler
function handleGameEvent(event: GameEvent) {
  if ('AnalysisUpdate' in event) {
    debouncedUpdate(event.AnalysisUpdate.patterns);
  }
}
```

## Performance Notes

### Backend

- Analysis runs in a **background worker thread** (non-blocking)
- Pattern evaluation: ~500 patterns × 4 players = **<10ms per update**
- Event payload size: ~500 patterns × ~100 bytes = **~50KB per player**

### Frontend

- **Virtual scrolling** recommended if displaying 500+ patterns simultaneously
- Use `React.memo()` or `useMemo()` to prevent unnecessary re-renders
- Consider pagination or "show top 20 patterns" by default

## Troubleshooting

### Issue: Not receiving AnalysisUpdate events

**Check:**

1. Is analysis enabled? (default: yes, unless `house_rules.analysis_enabled = false`)
2. Are you in the Playing phase? (events don't fire during Charleston)
3. Are you a human player? (bots don't receive events)
4. Is WebSocket connection healthy? (check console for disconnects)

### Issue: PatternAnalysis fields are undefined/null

**Check:**

1. TypeScript bindings up-to-date? Run `cargo test export_bindings` in `mahjong_core`
2. Correct import path? Should be `@/types/bindings/generated/PatternAnalysis`

### Issue: UI flickers on every update

**Solution:** Add debouncing (see Event Frequency section above)

## Next Steps

Once you've integrated the events, consider building:

1. **Pattern Comparison**: Show which tiles overlap between top 2-3 patterns
2. **Historical Tracking**: Graph how pattern difficulty changed throughout the game
3. **AI Hints**: "Bot 2 is likely pursuing 'Consecutive Run' based on discards"
4. **Dead Hand Detection**: Alert when all patterns become Impossible

## Related Files

### Backend

- `crates/mahjong_core/src/event.rs` - Event definitions
- `crates/mahjong_ai/src/evaluation.rs` - Difficulty classification logic
- `crates/mahjong_server/src/network/room.rs` - Event emission logic
- `crates/mahjong_server/src/analysis.rs` - Always-On Analyst implementation

### Frontend (to be implemented)

- `apps/client/src/types/bindings/generated/GameEvent.ts` - Auto-generated event types
- `apps/client/src/types/bindings/generated/PatternAnalysis.ts` - Auto-generated data type
- `apps/client/src/types/bindings/generated/PatternDifficulty.ts` - Auto-generated enum

## Questions?

If you have questions about the backend implementation or need clarification on the event structure, check:

1. This document
2. Integration point comments in the code (`// FRONTEND_INTEGRATION_POINT`)
3. Implementation plan: `docs/implementation/14-pattern-viability-implementation.md`
4. Gap analysis: `docs/implementation/13-backend-gap-analysis.md`

---

**Ready for Frontend Implementation!** 🚀
