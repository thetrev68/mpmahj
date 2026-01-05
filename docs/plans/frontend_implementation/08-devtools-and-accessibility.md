# Phase 8: Dev Tools, Accessibility, and QA

## Goal

Provide developer tooling and ensure the UI meets accessibility and QA requirements.

## 1. Developer Debug Panel

**Component**

- `apps/client/src/components/features/debug/DebugPanel.tsx`

**Features**

- Buttons to send test commands (`DrawTile`, `DiscardTile`, `Pass`).
- Toggle for showing raw `GameEvent` stream.
- Toggle for forcing mobile layout (CSS class).

## 2. Accessibility Checklist

- Keyboard navigation for all buttons and modals.
- Visible focus outlines on interactive elements.
- ARIA labels for tiles and action buttons.
- Color contrast at WCAG AA.
- `prefers-reduced-motion` support.

## 3. QA Checklists

**Functional**

- Charleston selection enforces 3 tiles.
- CallWindow respects server timer.
- Declare Mahjong only when eligible.
- Reconnect restores state without duplication.

**Regression**

- Turn indicator updates correctly.
- Discard pile order is correct.
- Tile assets map correctly for all 0-36 values.

## 4. Deliverables

1. Debug panel for development builds.
2. A11y and focus compliance across components.
3. Written QA checklist for manual validation.
