# Phase 9 — Enable Hints UI (Frontend)

This plan enables server-provided analysis and hints in the temporary test UI. Keep it minimal: prioritize touching binding events and showing actionable info. No advanced styling, accessibility polish, or over-engineering.

## Goals

- Show recommended discard.
- Surface a small list of candidate hands (name, distance, probability).
- Indicate “hot hand” and tiles that complete the hand (only when near win).
- Avoid log flood; simple one-line summaries for analysis events.

## Data & Events

Server emits private Analysis events:

- `HintUpdate.hint` → actionable recommendation (`HintData`)
- `AnalysisUpdate.patterns` → per-pattern evaluation array (`PatternAnalysis[]`)
- `HandAnalysisUpdated` → summary metrics (distance to win, counts)

Types are generated from Rust and available under `apps/client/src/types/bindings/generated/`.

## State Architecture

Create a small analysis store to hold hint/analysis without mixing into game state.

- File: `apps/client/src/store/analysisStore.ts` (new)
- Holds:
  - `hint: HintData | null`
  - `patterns: PatternAnalysis[]`
  - `handStats: { distance_to_win: number; viable_count: number; impossible_count: number } | null`
- Minimal selectors:
  - `getRecommendedDiscard()` → `Tile | null`
  - `getBestPatterns()` → `PatternSummary[]`
  - `getTilesNeeded()` → `Tile[]` (show only when distance_to_win ≤ 2)
  - `getDistanceToWin()` → `number`
- Rationale: keeps `gameStore` focused on server state, avoids coupling UI-only analysis with turn/phase logic.

## Event Routing

Wire `Analysis` events into `analysisStore` and summarize once in the event log:

- In `apps/client/src/hooks/useActionQueue.ts` (or `apps/client/src/store/gameStore.ts` if preferred), update processing so that:
  - `HintUpdate.hint` → `analysisStore.setHint(hint)`
  - `AnalysisUpdate.patterns` → `analysisStore.setPatterns(patterns)`
  - `HandAnalysisUpdated` → `analysisStore.setHandStats({...})`
- Logging: update `apps/client/src/utils/eventFormatter.ts` to a single short entry (e.g., “Hint: discard 5B; 3 patterns viable”). No detailed dumps.

## UI Components

Implement minimal UI components. Keep layout simple and stick to existing styles.

1) `apps/client/src/components/ui/HintPanel.tsx` (new)

- Shows:
  - Recommended discard (tile chip)
  - Optional reason text (if present)
  - Hot-hand indicator (simple badge)
- Behavior:
  - Simple block above TurnActions
  - Auto-updates on new `HintUpdate`

1) `apps/client/src/components/ui/PatternSuggestions.tsx` (new)

- Shows top `best_patterns` list (from `HintData`):
  - Pattern name (or ID)
  - Distance and probability (plain text; no bars)
  - Keep to a small number (e.g., top 3–5)

1) Hand highlight integration in `apps/client/src/components/HandDisplay.tsx`

- Highlight `recommended_discard` (basic visual marker reused from existing styles).
- Optionally mark `tiles_needed_for_win` when `distance_to_win <= 2`.

## Verbosity Modes

Skip full verbosity modes for now. Always render minimal hint content. If noise becomes an issue, add a single toggle in `uiStore` later (e.g., `showPatternSuggestions: boolean`).

## Feature Flag

Optional: `VITE_ENABLE_HINTS=true|false` to gate render during early testing. Not required.

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

1. Create `analysisStore.ts` (state + minimal selectors).
2. Wire `Analysis` events into `analysisStore`.
3. Build `HintPanel.tsx` and `PatternSuggestions.tsx` (plain text, small lists).
4. Add simple highlight in `HandDisplay.tsx` for `recommended_discard`.
5. Update `eventFormatter.ts` with short hint summary.
6. Optional: add `VITE_ENABLE_HINTS` and one UI toggle if needed.
7. Optional: add minimal tests.

## Non-Goals (Initial Phase)

- Charleston-phase pass hints and blind pass/steal guidance (future work).
- Bot-facing coaching prompts beyond current `HintData`.
- Persisting hints across reconnects (stateless by design; rely on server re-emission).

---

If this plan aligns with expectations, proceed to implement behind the `VITE_ENABLE_HINTS` flag, starting with the store, wiring, and initial UI scaffolding, followed by tests and incremental rollout.
