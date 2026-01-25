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

If this plan aligns with expectations, proceed to wire analysis events, then adjust logging and hand highlights, and only add on-demand commands if the room is configured with `analysis_config.mode = OnDemand`.
