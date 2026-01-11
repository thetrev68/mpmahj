# Roadmap (Starter)

This roadmap is a thin planning layer that references the feature map. It is
intended to be practical and short, not exhaustive.

## Guiding Intent

- Ship a playable end-to-end experience first (even if limited).
- Validate backend integration with minimal UI before polishing.
- Keep scope realistic: focus on a single cohesive vertical slice.

## Milestones

### M0: Baseline Verification (Backend + Docs)

**Goal:** Establish a reliable truth set for what is implemented today.

- Align `docs/FEATURE_MAP.md` with `docs/implementation/13-backend-gap-analysis.md`
- Verify test coverage for critical backend flows
- Tag any “unknown” features with explicit owners and next actions

**Exit criteria:**

- Feature map reflects reality for backend modules
- Known gaps are documented with clear next steps

### M1: Frontend Foundation

**Goal:** A frontend that can connect, authenticate, and render core state.

- WebSocket connection + auth handshake
- Type-safe bindings wired into UI state store
- Basic table view: seat layout, hands, discards, turn indicator

**Exit criteria:**

- A user can connect, join/create a room, and see server-driven state changes

### M2: Core Gameplay UI

**Goal:** Play a full hand via UI.

- Charleston UI and flow
- Call windows + turn actions
- Win display + scoring overlay

**Exit criteria:**

- Full game flow is playable end-to-end without dev tools

### M3: Multiplayer UX + Reconnect

**Goal:** Make real multiplayer viable.

- Lobby/session management UI
- Reconnect flow + basic error recovery
- Optional persistence hooks (if used in production)

**Exit criteria:**

- A 4-player session can start, play, and survive reconnects

### M4: Replay + History Viewer (Frontend)

**Goal:** Surface the backend history system in UI.

- Timeline/replay UI
- Event log viewer or scrubber

**Exit criteria:**

- Users can navigate past moves from a finished game

### M5: Polish + Accessibility

**Goal:** Bring experience up to release-quality.

- Accessibility pass (keyboard, screen reader)
- Mobile/responsive layout pass
- Visual polish and devtools cleanup

## Risks / Unknowns (Track Here)

- Frontend scope drift (large UX doc set)
- Features marked “partial” in backend parity gap analysis
- Missing integration tests for end-to-end flows
