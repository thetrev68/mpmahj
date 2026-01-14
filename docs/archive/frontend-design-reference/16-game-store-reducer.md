# 16. Game Store Reducer Specification

TODO:

- Add session persistence (token/room) + reconnect UX wiring.
- Build the UI fixture JSON set + dev gallery plan.

This document defines the authoritative frontend reducer used by the game store (`apps/client/src/store/gameStore.ts`). It specifies the target state shape, event handling rules, and mutation logic for all server events.

## 16.1 Goals and Constraints

- The game store mirrors server truth. No optimistic updates.
- All updates flow from `GameEvent` or `GameStateSnapshot`.
- Use Tile ids (`Tile` is `u8` 0-36) throughout.
- Keep UI-only state in `uiStore`.
- Reducer must be deterministic and idempotent when replaying events.

## 16.2 Target State Shape

Prefer a normalized shape derived from bindings:

```ts
type GameStoreState = {
  phase: GamePhase;
  currentTurn: Seat | null;
  dealer: Seat | null;
  roundNumber: number;
  remainingTiles: number;
  discardPile: DiscardInfo[];
  players: Record<Seat, PublicPlayerInfo>;
  houseRules: HouseRules | null;
  yourSeat: Seat | null;
  yourHand: Tile[];
};
```

Notes:

- `GameStateSnapshot` uses `players: PublicPlayerInfo[]`. Normalize by seat in store.
- `discardPile` uses `DiscardInfo[]` (from bindings), not raw `Tile[]`.
- The current store in `apps/client/src/store/gameStore.ts` uses `event.type` and outdated shapes. This doc defines the intended reducer that matches the generated bindings.

## 16.3 Snapshot Application

### Function

```ts
applySnapshot(snapshot: GameStateSnapshot): void
```

### Rules

- Replace every field with snapshot values.
- Normalize `players` array into `Record<Seat, PublicPlayerInfo>`.
- Clear any queued animation events (Action Queue) before applying.

## 16.4 Event Handling Conventions

Events are unions with tagged keys (ts-rs output), so reducers should use `in` checks:

```ts
if ('TileDiscarded' in event) {
  const { player, tile } = event.TileDiscarded;
}
```

Avoid `event.type` and string switches unless you re-map events before reducing.

## 16.5 Event -> Mutation Map

### Game Lifecycle

- `GameCreated`
  - Reset state to initial values (clear hand, discards, players).

- `PlayerJoined`
  - Insert or update `players[seat]` with `PublicPlayerInfo`.
  - If seat already exists, keep `exposed_melds` from latest data.

- `GameStarting`
  - No state change (phase update arrives via `PhaseChanged`).

### Setup Phase

- `DiceRolled`
  - Optional: store `setupDiceRoll` in UI store if needed.

- `WallBroken`
  - Optional: store wall break animation info in UI store.

- `TilesDealt`
  - Replace `yourHand` with `your_tiles`.
  - For `players`, set `tile_count` to 13 for others, `yourHand.length` for you.

### Charleston Phase

- `CharlestonPhaseChanged`
  - `phase = { Charleston: stage }`.

- `PlayerReadyForPass`
  - Track ready seats in UI store (not game store).

- `TilesPassing`
  - Optional: trigger animation. No game store mutation.

- `TilesReceived`
  - If event player equals `yourSeat`, add tiles to `yourHand` and update your tile count.

- `PlayerVoted` / `VoteResult` / `CharlestonComplete`
  - UI-only status, no mutation until `PhaseChanged`.

### Main Play

- `PhaseChanged`
  - `phase = event.phase`.

- `TurnChanged`
  - `currentTurn = event.player`.

- `TileDrawn`
  - `remainingTiles = remaining_tiles`.
  - If `tile` present, append to `yourHand` and update your tile count.

- `TileDiscarded`
  - Append to `discardPile` (as `DiscardInfo` if available, otherwise wrap with seat).
  - If discarder is you, remove one instance from `yourHand`.
  - Decrement discarder `tile_count`.

- `CallWindowOpened`
  - Store call state in UI store (eligible seats and timer).

- `CallWindowClosed`
  - Clear call state in UI store.

- `TileCalled`
  - Add `meld` to caller `exposed_melds`.
  - Remove called tile from discard pile (last match).
  - If caller is you, remove the meld tiles excluding `called_tile` from `yourHand`.
  - Adjust caller `tile_count` by `-meld.tiles.length + 1`.

### Special Actions

- `JokerExchanged`
  - Update target seat meld to replace `joker` with `replacement`.
  - If you are exchanger, remove `replacement` from `yourHand`, add `joker`.
  - If you are target, update your exposed melds accordingly.

- `BlankExchanged`
  - No public tile mutation (secret exchange).
  - If you are the exchanger, update `yourHand` when server provides a private event (if added later).

### Win / Scoring

- `MahjongDeclared`
  - Phase transition comes via `PhaseChanged`.

- `HandValidated`
  - No game store mutation unless you cache validation results.

- `GameOver`
  - `phase = { GameOver: result }`.

### Errors

- `CommandRejected`
  - No game store mutation; add toast in UI store.

## 16.6 Helpers and Utilities

Recommended helper utilities to keep reducer simple:

- `removeFirstTile(hand: Tile[], tile: Tile): void`
- `removeTiles(hand: Tile[], tiles: Tile[]): void`
- `normalizePlayers(list: PublicPlayerInfo[]): Record<Seat, PublicPlayerInfo>`

## 16.7 Expected Integration Points

- `useActionQueue` should call `applyEvent` only after animations complete.
- `useGameSocket` should call `applySnapshot` on `StateSnapshot`.
- `uiStore` should track ephemeral state: call window, selection, toasts, ready votes.

## 16.8 References

- `apps/client/src/types/bindings/generated/GameEvent.ts`
- `apps/client/src/types/bindings/generated/GameStateSnapshot.ts`
- `docs/architecture/frontend/14-command-event-ui-map.md`
