# Phase 4: Polish, Performance, and Mobile Quality

## Goal

Deliver a production-quality experience with smooth animation, clear feedback, mobile ergonomics, and stable performance.

## 1. Mobile Interaction Polish

- Swipe up on selected tile to discard (only in `Discarding` stage).
- Swipe down on hand to auto-sort (optional UX).
- Tap/hold to open tile details (tooltip or small popover).
- Safe area padding: apply `env(safe-area-inset-top|bottom)`.
- Large touch targets for action buttons (min 44px).

## 2. Audio and Haptics

### Audio

- Tile draw: soft click
- Discard: clack
- Your turn: chime
- Error: short buzz

### Haptics (Tauri)

- On `TurnChanged` to your seat: light pulse
- On `CallWindowOpened` where you can act: strong pulse
- On `CommandRejected`: error pattern

## 3. Animation Budget

- Use the Action Queue to sequence animations.
- Avoid more than 6 concurrent tile animations on mobile.
- Reduce motion for users with `prefers-reduced-motion`.

## 4. Performance Tuning

- `Tile` should be `React.memo`.
- Use `useMemo` for heavy computed lists (pattern matching, discard grids).
- Do not render opponent concealed tiles individually; use a single stacked tile back element.
- Avoid deep store subscriptions; use selectors.

## 5. Error Handling

- Map `Envelope.Error` and `GameEvent.CommandRejected` to user-friendly toasts.
- Show a connection banner on disconnect.
- Offer "Reconnect" button when socket closes.

## 6. Visual Consistency

- Align with `docs/architecture/frontend/11-ui-ux-design.md`.
- Ensure consistent spacing and tile sizes across layouts.
- Add shadows and depth only where needed for clarity.

## 7. End-to-End Test Pass

### Manual scenario

1. Create room, join with 4 clients.
2. Complete Charleston with a blind pass.
3. Draw, discard, call a Pung.
4. Declare Mahjong.
5. Verify final scoring view and GameOver overlay.
6. Reconnect a client mid-game and verify snapshot sync.

### Automation (optional)

- Playwright tests for lobby, join, and basic turn loop.

## Deliverables

1. Mobile gestures and safe area layout.
2. Audio and haptics tied to events.
3. Animations sequenced by Action Queue.
4. Connection/error UX.
5. End-to-end verification.
