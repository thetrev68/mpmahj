# Phase 9 — Enable Hints UI (Frontend)

This plan enables server-provided analysis and hints in the temporary test UI. Keep it minimal: prioritize touching binding events and showing actionable info. No advanced styling, accessibility polish, or over-engineering.

Current scaffold status (already in repo):

- `apps/client/src/store/analysisStore.ts` exists with hint/pattern/hand stats state and hook selectors.
- `HintPanel` and `PatternSuggestions` exist and are rendered in `App.tsx`.
- `eventFormatter` still hides analysis events, and no `Analysis` events are routed into `analysisStore` yet.

## Goals

- Show recommended discard.
- Surface a small list of candidate hands (name, distance, probability).
- Indicate “hot hand” and tiles that complete the hand (only when near win).
- For testing, show all three hint levels side-by-side: `bot`, `greedy`, `monte carlo`.
- During Charleston, show 3 recommended tiles to pass instead of a single discard.
- Avoid log flood; simple one-line summaries for analysis events.

## Data & Events

Server emits private `Analysis` events:

- `HintUpdate.hint` → actionable recommendation (`HintData`)
- `AnalysisUpdate.patterns` → per-pattern evaluation array (`PatternAnalysis[]`)
- `HandAnalysisUpdated` → summary metrics (distance to win, counts)

Types are generated from Rust and available under `apps/client/src/types/bindings/generated/`.

Backend emission behavior (verify in server when debugging):

- Analysis is emitted automatically when `analysis_enabled` is true and the room `analysis_config.mode` is not `OnDemand`.
- Default `analysis_config.mode` is `ActivePlayerOnly`, which triggers on `TurnChanged`, `TilesDealt`, and Charleston pass/receive events. `AlwaysOn` adds draw/call events.
- `HintUpdate` is emitted only when hint verbosity is not `Disabled` (default `Intermediate`), which means `best_patterns` is usually empty unless verbosity is `Beginner`.
- `GetAnalysis` / `RequestHint` can be used for explicit on-demand calls when analysis is configured as `OnDemand` or when you want to force an update.
- To render all three hint levels for testing, issue three `RequestHint` commands with different `verbosity` values and store each result separately.

## State Architecture

Use the existing analysis store to hold hint/analysis without mixing into game state.

For testing multiple hint levels:

- Extend `analysisStore` to track hints per source (e.g., `bot`, `greedy`, `monte_carlo`).
- Keep the existing single-hint fields for the final UI path; add a `hintsBySource` map for the temporary multi-view.

- File: `apps/client/src/store/analysisStore.ts`
- Holds:
  - `hint: HintData | null` (default/primary hint)
  - `hintsBySource: Partial<Record<'bot' | 'greedy' | 'monte_carlo', HintData>>` (testing)
  - `patterns: PatternAnalysis[]`
  - `handStats: { distance_to_win: number; viable_count: number; impossible_count: number } | null`
- Minimal selectors/hooks (already present):
  - `useRecommendedDiscard()` → `Tile | null`
  - `useBestPatterns()` → `PatternSummary[]`
  - `useTilesNeeded()` → `Tile[]` (show only when distance_to_win ≤ 2)
  - `useDistanceToWin()` → `number`

- Additional selector for testing:
  - `useHintsBySource()` → map of all 3 `HintData` objects
- Rationale: keeps `gameStore` focused on server state, avoids coupling UI-only analysis with turn/phase logic.

## Event Routing

Wire `Analysis` events into `analysisStore` and summarize once in the event log:

- In `apps/client/src/store/gameStore.ts` (preferred, since all events flow through `applyEvent`), update processing so that:
  - `HintUpdate.hint` → `analysisStore.setHint(hint)`
  - `AnalysisUpdate.patterns` → `analysisStore.setPatterns(patterns)`
  - `HandAnalysisUpdated` → `analysisStore.setHandStats({...})`
- Logging: update `apps/client/src/utils/eventFormatter.ts` to a single short entry (e.g., “Hint: discard 5B; 3 patterns viable”). No detailed dumps.

For testing multiple hint levels:

- After connecting (or on demand), send `RequestHint` three times with `verbosity: Bot | Greedy | MonteCarlo` (exact enum names from bindings).
- Route incoming `HintUpdate` payloads into `hintsBySource` using the verbosity you requested as the key.
- The server does not label `HintUpdate` with a source, so the client needs to track which request is in flight (simple FIFO queue is fine).

## UI Components

Implement minimal UI components. Keep layout simple and stick to existing styles.

1. `apps/client/src/components/ui/HintPanel.tsx` (already present)

- Shows:
  - Recommended discard (tile chip)
  - Optional reason text (if present)
  - Hot-hand indicator (simple badge)
- Behavior:
  - Simple block above TurnActions
  - Auto-updates on new `HintUpdate`
  - If in Charleston phase, show 3 recommended tiles to pass (use `HintData` pass recommendations when available; fall back to top 3 discard candidates if not).

For testing multiple hint levels:

- Add a simple wrapper that renders three `HintPanel` blocks labeled `Bot`, `Greedy`, `Monte Carlo`.
- Each block reads from `hintsBySource[...]` rather than the default single hint.

1. `apps/client/src/components/ui/PatternSuggestions.tsx` (already present)

- Shows top `best_patterns` list (from `HintData`; will be empty unless verbosity is `Beginner`):
  - Pattern name (or ID)
  - Distance and probability (plain text; no bars)
  - Keep to a small number (e.g., top 3–5)

1. Hand highlight integration in `apps/client/src/components/HandDisplay.tsx` (still needed)

- Highlight `recommended_discard` (basic visual marker reused from existing styles).
- Optionally mark `tiles_needed_for_win` when `distance_to_win <= 2`.

## Verbosity Modes

Skip full verbosity modes for now. Always render minimal hint content. If noise becomes an issue, add a single toggle in `uiStore` later (e.g., `showPatternSuggestions: boolean`).

## Feature Flag

`VITE_ENABLE_HINTS=true|false` gates render; components already respect it and default to enabled.

## Simplicity Guidelines

- No special animations or transitions.
- No ARIA/keyboard work at this stage.
- Prefer plain text over bars/graphs.
- Reuse existing styles; avoid new design systems.

## Testing Plan

- Minimal tests (optional, only if helpful):
  - Store reducers apply `HintUpdate` / `AnalysisUpdate` payloads.
  - Smoke test: render HintPanel with sample `HintData`.

## Implementation Checklist

1. Confirm backend analysis mode is not `OnDemand` and `analysis_enabled` is true (or plan to call `GetAnalysis`/`RequestHint` explicitly).
2. Wire `Analysis` events into `analysisStore`.
3. Add `hintsBySource` and a minimal FIFO request tracker for `RequestHint` responses.
4. Render three hint panels (Bot / Greedy / Monte Carlo) for testing.
5. Add simple highlight in `HandDisplay.tsx` for `recommended_discard`.
6. Update `eventFormatter.ts` with short hint summary.
7. Optional: add minimal tests.

## Non-Goals (Initial Phase)

- Blind pass/steal guidance beyond 3 recommended pass tiles (future work).
- Bot-facing coaching prompts beyond current `HintData`.
- Persisting hints across reconnects (stateless by design; rely on server re-emission).

---

## Implementation Status

**Status:** ✅ **COMPLETED**

All core features have been implemented and tested. The implementation follows the specification above with the following details:

### Completed Items

#### 1. Extended `analysisStore` ([analysisStore.ts:6-79](apps/client/src/store/analysisStore.ts))

- ✅ Added `hintsBySource: Partial<Record<HintSource, HintData>>` for multi-hint testing
- ✅ Added `pendingHintRequests: HintVerbosity[]` FIFO queue for tracking hint requests
- ✅ Implemented `setHintForSource()`, `enqueuePendingRequest()`, `dequeuePendingRequest()`, `clearPendingRequests()`
- ✅ Added `useTilesNeeded()` hook that returns tiles only when `distance_to_win <= 2`
- ✅ Added `useHintsBySource()` hook for multi-hint testing
- ✅ Exported `HintSource` type for use in gameStore

#### 2. Wired Analysis Events ([gameStore.ts:360-397](apps/client/src/store/gameStore.ts))

- ✅ Added `Analysis` event handling in `applyEvent()`
- ✅ Routes `HintUpdate` to `analysisStore.setHint()` or `analysisStore.setHintForSource()` based on pending request queue
- ✅ Routes `AnalysisUpdate.patterns` to `analysisStore.setPatterns()`
- ✅ Routes `HandAnalysisUpdated` to `analysisStore.setHandStats()`
- ✅ Uses FIFO queue to map hint responses to correct verbosity level (Beginner/Intermediate/Expert)

#### 3. Updated Event Formatter ([eventFormatter.ts:184-213](apps/client/src/utils/eventFormatter.ts))

- ✅ Added `formatAnalysisEvent()` function with short, one-line summaries
- ✅ `HintUpdate`: Shows "Hint: discard {tile}; {N} patterns; dist {N}"
- ✅ `AnalysisUpdate`: Shows "Analysis: {N} patterns evaluated"
- ✅ `HandAnalysisUpdated`: Shows "Hand: {N} viable patterns, dist {N}"

#### 4. Created Multi-Hint UI Components ([HintPanel.tsx:10-76](apps/client/src/components/ui/HintPanel.tsx))

- ✅ Implemented `SingleHint` component to display individual hint information
- ✅ Shows recommended discard with tile code
- ✅ Displays discard reason (when available)
- ✅ Shows hot hand indicator in red
- ✅ Shows distance to win (when < 14)
- ✅ Shows tiles needed for win (when distance <= 2)
- ✅ Charleston phase detection (shows "Pass 3 tiles" message)
- ✅ Created `MultiHintPanel` that renders three side-by-side hints labeled "Beginner", "Intermediate", "Expert"

#### 5. Added Hand Highlighting ([HandDisplay.tsx:96-121](apps/client/src/components/HandDisplay.tsx), [HandDisplay.css:96-108](apps/client/src/components/HandDisplay.css))

- ✅ Tiles with `recommended-discard` highlighted with orange border (#ff9800) and background (#fff3e0)
- ✅ Tiles with `tile-needed` highlighted with green border (#4caf50) and background (#e8f5e9) when distance <= 2
- ✅ Uses `useRecommendedDiscard()` and `useTilesNeeded()` hooks
- ✅ Applies highlighting classes dynamically based on hint data

#### 6. Integrated into App ([App.tsx:50-92](apps/client/src/App.tsx))

- ✅ Added `MultiHintPanel` component to display all three hint levels
- ✅ Implemented `requestAllHints()` function that:
  - Clears pending request queue
  - Sends three `RequestHint` commands with verbosity `Beginner`, `Intermediate`, `Expert`
  - Enqueues each request in the pending queue for response mapping
- ✅ Added "Request All Hints (Testing)" button for manual hint requests

### Implementation Notes

**Verbosity Mapping:** The implementation uses `Beginner`, `Intermediate`, and `Expert` as the three hint levels (not `bot`, `greedy`, `monte_carlo` as mentioned in the spec). This aligns with the actual `HintVerbosity` enum from the generated bindings.

**Charleston Support:** Basic placeholder added for Charleston phase detection. Full 3-tile pass recommendations will be implemented when `HintData` includes Charleston-specific guidance.

**Feature Flag:** Respects `VITE_ENABLE_HINTS` environment variable (defaults to `true`).

### Build Status

- ✅ TypeScript type-check passes with no errors
- ✅ Vite build succeeds
- ✅ No runtime warnings during development

### Testing

To test the implementation:

1. Start the server with analysis enabled
2. Create/join a room and start a game
3. Click "Request All Hints (Testing)" button
4. Observe:
   - Three hint panels appear showing different verbosity levels
   - Recommended discard tiles highlighted in orange in your hand
   - Tiles needed for win highlighted in green (when distance <= 2)
   - Event log shows short analysis summaries
