# VR-013 — Charleston Direction Banner + Release Hardening

**Phase:** 3 — Medium Impact, Medium Effort  
**Status:** Ready for Development
**Source:** Visual-Redesign-20220222.md §C.3, §D item 13  
**Merged Scope:** US-STAGE-007, US-STAGE-008 (cross-cutting)

## Summary

Direction banner should represent **outgoing commit timing**, not incoming staging arrival.

- Trigger banner when outgoing pass commit is acknowledged (`TilesPassing` public event via `handleTilesPassing` in `publicEventHandlers.charleston.ts`).
- Do not trigger on private incoming staged events.

This story also carries cross-cutting release hardening gates needed before staging-first frontend is considered complete. Bot-runner Charleston progression must succeed under the staging-first protocol (AC-5), and reconnect during a staging phase must restore full UI state without duplicate or missing staged tiles (AC-6).

## Acceptance Criteria

- **AC-1**: Direction banner appears on outgoing pass-direction event only.
- **AC-2**: No banner appears when incoming staging event arrives.
- **AC-3**: Banner text remains directionally correct and visually clear.
- **AC-4**: Existing animation timing/accessibility semantics are preserved (`aria-live="polite"`, timing class behavior).
- **AC-5**: Charleston staging-first flow remains bot-compatible in integrated runs.
- **AC-6**: Reconnect behavior during Charleston staging phases restores consistent UI state (no duplicated or missing staged tiles).
- **AC-7**: Regression gates required by this redesign are documented and executed.

## Connection Points

| File                                                                | Location              | Change                                                                                        |
| ------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `apps/client/src/lib/game-events/publicEventHandlers.charleston.ts` | `handleTilesPassing`  | confirm `SET_PASS_DIRECTION` is emitted only on `TilesPassing`; no dispatch on staging events |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx`        | event bus consumer    | verify `SET_PASS_DIRECTION` gate; no changes expected unless animation reset needs adjustment |
| `apps/client/src/components/game/PassAnimationLayer.tsx`            | display only          | no changes expected; verify `aria-live="polite"` and animation class behaviour are preserved  |
| `crates/mahjong_server/src/network/bot_runner.rs`                   | integration hardening | verify bot progression under staging-first protocol                                           |
| reconnect integration paths                                         | regression hardening  | ensure snapshot restore consistency                                                           |

## Test Requirements

### Integration Tests

**Target file:** `apps/client/src/features/game/Charleston.integration.test.tsx` (create if absent)

- **T-1**: Incoming staging event does not open direction banner.
- **T-2**: `TilesPassing` public event (`handleTilesPassing` in `publicEventHandlers.charleston.ts`) dispatches `SET_PASS_DIRECTION` and opens direction banner.
- **T-3**: Bot-involved Charleston reaches next stage without stalls.
- **T-4**: Reconnect during blind staging restores coherent UI state.

### Verification Checklist

- `cargo test --workspace`
- `npx vitest run`
- `npx tsc --noEmit`
- `npm run check:all`

## Out of Scope

- Reworking global animation design language.
- New backend protocol definitions.

## Dependencies

- Requires VR-006/010/011 and US-STAGE-001/002/003 completion.
