# US-071: Game Board Error Boundaries

## Status

- State: Implemented
- Priority: High
- Batch: H
- Implementation Ready: Yes

## Problem

The codebase contains zero React error boundaries. Any rendering exception in any child
component crashes the entire React tree and shows a white screen. High-complexity areas —
`PlayingPhase`, `CharlestonPhase`, `HistoryPanel`, `HintPanel`, `ScoringScreen` — have deep
component hierarchies with derived state, memoized computations, and external data
dependencies. A single bad tile index, unexpected server payload, or failed meld derivation
takes down the entire game board.

Grep for `ErrorBoundary`, `componentDidCatch`, and `getDerivedStateFromError` across the
entire `apps/client/src/` tree returns zero matches.

**Impact:** During active play, a rendering crash loses the user's game session with no
recovery path. The user sees a blank page and must manually reload, losing any unsaved state.

## Scope

**In scope:**

- Create a reusable `ErrorBoundary` component (`apps/client/src/components/ErrorBoundary.tsx`)
  using React's class component error boundary API.
- Wrap critical high-risk subtrees: `GameBoard` children, `PlayingPhase`, `CharlestonPhase`,
  right-rail hint section, and the settings modal content.
- Provide a fallback UI that shows a non-technical error message and a "Reload" or "Try Again"
  button.
- Log caught errors to `console.error` (no external error reporting in this story).
- Write tests for the ErrorBoundary component.

**Out of scope:**

- External error reporting service integration (Sentry, etc.).
- Granular per-component error boundaries for every leaf component.
- Server-side error boundary behavior (SSR is not used).
- Retry logic for recovered components (reload is sufficient).

## Acceptance Criteria

- AC-1: An `ErrorBoundary` component exists at
  `apps/client/src/components/ErrorBoundary.tsx` with a matching test file.
- AC-2: `ErrorBoundary` catches rendering errors in its children and renders a fallback UI
  instead of crashing the parent tree.
- AC-3: The fallback UI displays a user-friendly message (e.g., "Something went wrong") and a
  button that reloads the page or resets the boundary.
- AC-4: `GameBoard` wraps its main content area in an `ErrorBoundary` so that a crash in any
  phase component does not take down the entire page.
- AC-5: The Settings modal content (`DialogContent` children in `PlayingPhaseOverlays`) is
  wrapped so a crash in `AudioSettingsSection`, `HintSettingsSection`, or `AnimationSettings`
  does not crash the game.
- AC-6: The right-rail hint portal content is wrapped so a crash in `RightRailHintSection` or
  `HintPanel` does not crash the playing phase.
- AC-7: `ErrorBoundary.test.tsx` includes a test that renders a component that throws during
  render and asserts the fallback UI appears.
- AC-8: `ErrorBoundary.test.tsx` includes a test that the error is logged to `console.error`.

## Edge Cases

- EC-1: Error boundary must not swallow errors in event handlers (React does not catch those
  in boundaries — this is expected behavior, not a bug).
- EC-2: If the fallback UI itself throws, React will propagate to the next boundary up. The
  fallback must be as simple as possible (no complex state, no hooks).
- EC-3: The boundary must support a `resetKeys` prop or similar mechanism so that navigation
  between game phases resets the boundary state (otherwise a caught error in Charleston persists
  when transitioning to Playing).

## Primary Files (Expected)

- `apps/client/src/components/ErrorBoundary.tsx` — new
- `apps/client/src/components/ErrorBoundary.test.tsx` — new
- `apps/client/src/components/game/GameBoard.tsx` — wrap children
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx` — wrap
  settings modal content and hint portal
- `apps/client/src/components/game/RightRailHintSection.tsx` — wrap or be wrapped

## Notes for Implementer

### Minimal ErrorBoundary pattern

```tsx
interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  resetKeys?: unknown[];
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.state.hasError && this.props.resetKeys !== prevProps.resetKeys) {
      this.setState({ hasError: false });
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <DefaultFallback onReset={() => this.setState({ hasError: false })} />
        )
      );
    }
    return this.props.children;
  }
}
```

### Placement strategy

Wrap at the **phase boundary** level, not at every leaf:

- `GameBoard` → wraps the phase switch (Setup/Charleston/Playing/GameOver)
- `PlayingPhaseOverlays` → wraps `DialogContent` children
- `RightRailHintSection` → wraps the hint panel portal content

This gives fault isolation without over-engineering.

## Test Plan

- `ErrorBoundary.test.tsx`:
  - Renders children normally when no error.
  - Shows fallback when child throws during render.
  - Logs error to console.error.
  - Resets when resetKeys change.
  - Custom fallback prop is used when provided.

## Verification Commands

```bash
npx vitest run apps/client/src/components/ErrorBoundary.test.tsx
npx vitest run apps/client/src/components/game/GameBoard.test.tsx
npx tsc --noEmit
```

## Implementation Summary

- State: Complete
- Completed: 2026-03-20

### Files Changed

| File                                                                            | Action                                    |
| ------------------------------------------------------------------------------- | ----------------------------------------- |
| `apps/client/src/components/ErrorBoundary.tsx`                                  | New — reusable class-based error boundary |
| `apps/client/src/components/ErrorBoundary.test.tsx`                             | New — 6 tests                             |
| `apps/client/src/components/game/GameBoard.tsx`                                 | Wrapped phase switch + hint portal        |
| `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx` | Wrapped settings dialog content           |

### AC Walkthrough

| AC   | Status | Detail                                                              |
| ---- | ------ | ------------------------------------------------------------------- |
| AC-1 | Done   | `ErrorBoundary.tsx` + `ErrorBoundary.test.tsx` created              |
| AC-2 | Done   | `getDerivedStateFromError` catches render errors, shows fallback    |
| AC-3 | Done   | Default fallback shows "Something went wrong." + "Try Again" button |
| AC-4 | Done   | GameBoard wraps Setup/Playing/Charleston phases with `resetKeys`    |
| AC-5 | Done   | Settings `DialogContent` children wrapped in `PlayingPhaseOverlays` |
| AC-6 | Done   | `RightRailHintSection` portal wrapped in GameBoard                  |
| AC-7 | Done   | Test: child throws during render -> fallback appears                |
| AC-8 | Done   | Test: error logged to `console.error` with component stack          |

### EC Walkthrough

| EC   | Status | Detail                                                                       |
| ---- | ------ | ---------------------------------------------------------------------------- |
| EC-1 | N/A    | Event handler errors not caught by React boundaries — expected               |
| EC-2 | Done   | `DefaultFallback` is a plain function component with no hooks/state          |
| EC-3 | Done   | `resetKeys={[isSetupPhase, isPlaying, isCharleston]}` resets on phase change |

### Test Summary

- `ErrorBoundary.test.tsx`: 6 tests (children render, fallback on throw, console.error logging, resetKeys reset, custom fallback, Try Again reset)
- `GameBoard.test.tsx`: 8 existing tests pass (no regressions)
- `tsc --noEmit`: clean

### Deferred

- External error reporting (Sentry) — out of scope
- Per-leaf-component boundaries — out of scope
- Retry logic beyond page reload — out of scope

## Code Review Findings

### 2026-03-20

1. High: The right-rail boundary never resets across Charleston <-> Playing transitions, so a single hint-panel render crash can leave the rail stuck on the fallback for the rest of the game. In [GameBoard.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/GameBoard.tsx#L475), the `RightRailHintSection` portal is wrapped in an `ErrorBoundary` with no `resetKeys`. Because `showRightRailHints` stays true in both Charleston and Playing, that boundary instance can survive the phase transition called out in EC-3. A crash while rendering hints in Charleston therefore persists into Playing instead of recovering on navigation.

2. Medium: The `resetKeys` test does not actually verify recovery, so the main boundary reset behavior can regress unnoticed. In [ErrorBoundary.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/ErrorBoundary.test.tsx#L79), `userEvent.click(...)` is not awaited, and in [ErrorBoundary.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/ErrorBoundary.test.tsx#L81) the assertion checks that `screen.findByTestId(...)` returns a truthy promise rather than awaiting the element. This test passes even if the child never re-renders after `resetKeys` change.
