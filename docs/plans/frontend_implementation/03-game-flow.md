# Phase 3: Game Flow and Logic Integration

## Goal

Wire UI components to backend game phases, commands, and events. This phase implements the full gameplay loop: setup, Charleston, main play, calls, special actions, scoring, and game over.

## 1. Phase Map (Backend -> UI)

`GamePhase` union from bindings:

- `"WaitingForPlayers"`
- `{ Setup: SetupStage }`
- `{ Charleston: CharlestonStage }`
- `{ Playing: TurnStage }`
- `{ Scoring: WinContext }`
- `{ GameOver: GameResult }`

UI should react only to server events; no optimistic state updates.

## 2. Setup Phase

**Events**

- `GameCreated`, `PlayerJoined`, `GameStarting`
- `DiceRolled`, `WallBroken`
- `TilesDealt`

**UI**

- Lobby screen shows seats as `PlayerJoined` arrive.
- Setup overlay: "East roll dice" button for East only.
- Show dice roll and wall break animation.
- Initial hand display after `TilesDealt`.
- Show "Ready" button -> send `GameCommand.ReadyToStart`.

**Command**

```ts
const cmd: GameCommand = { ReadyToStart: { player: mySeat } };
```

## 3. Charleston Phase

**Events**

- `CharlestonPhaseChanged`
- `PlayerReadyForPass`, `TilesPassing`, `TilesReceived`
- `PlayerVoted`, `VoteResult`, `CharlestonComplete`

**Stages**

- `FirstRight`, `FirstAcross`, `FirstLeft`
- `SecondLeft`, `SecondAcross`, `SecondRight`
- `CourtesyAcross`
- `VotingToContinue`

**Key UI rules**

- Exactly 3 tiles must be selected for normal passes.
- Blind pass is available only on `FirstLeft` and `SecondRight`.
- Jokers cannot be passed.
- Courtesy pass allows 0-3 tiles, negotiated with across player.

**Commands**

```ts
const passCmd: GameCommand = {
  PassTiles: {
    player: mySeat,
    tiles: selectedTiles,
    blind_pass_count: blindCount ?? null,
  },
};

const voteCmd: GameCommand = {
  VoteCharleston: { player: mySeat, vote: 'Continue' },
};

const proposeCmd: GameCommand = {
  ProposeCourtesyPass: { player: mySeat, tile_count: 2 },
};

const acceptCmd: GameCommand = {
  AcceptCourtesyPass: { player: mySeat, tiles: courtesyTiles },
};
```

**UI components**

- `CharlestonOverlay.tsx` handles selection, pass direction arrow, and vote screen.
- `CharlestonStatusBar.tsx` shows ready counts and timer.

## 4. Main Play (TurnStage)

`TurnStage` union:

- `{ Drawing: { player } }`
- `{ Discarding: { player } }`
- `{ CallWindow: { tile, discarded_by, can_act, timer } }`

**Events**

- `TurnChanged`
- `TileDrawn`
- `TileDiscarded`
- `CallWindowOpened`, `CallWindowClosed`
- `TileCalled`

**Draw / Discard**

- Show `Draw` button only for `TurnStage.Drawing` and `player === mySeat`.
- Wait for `TileDrawn` event to add tile to hand.
- Show `Discard` button only for `TurnStage.Discarding` and selected tile is set.
- Do not remove tile locally until `TileDiscarded` arrives.

**Call Window**

- Open modal when event `CallWindowOpened` or `TurnStage.CallWindow` updates.
- Timer is server-owned (use `timer` value from `TurnStage.CallWindow`).
- Buttons enabled only if seat is in `can_act`.

**Call command**

```ts
const callCmd: GameCommand = {
  CallTile: { player: mySeat, meld: buildMeldFromSelection() },
};

const passCmd: GameCommand = { Pass: { player: mySeat } };
```

## 5. Special Actions

### 5.1 Joker Exchange

**Command**

```ts
const exchangeCmd: GameCommand = {
  ExchangeJoker: {
    player: mySeat,
    target_seat: targetSeat,
    meld_index: meldIndex,
    replacement: tileId,
  },
};
```

**Event**

- `JokerExchanged` updates target meld and adds Joker to your hand.

### 5.2 Blank Exchange (House Rule)

**Command**

```ts
const blankCmd: GameCommand = {
  ExchangeBlank: { player: mySeat, discard_index: discardIndex },
};
```

**Event**

- `BlankExchanged` indicates success (no tile revealed to others).

## 6. Mahjong Declaration and Scoring

**Command**

```ts
const declareCmd: GameCommand = {
  DeclareMahjong: {
    player: mySeat,
    hand: currentHand,
    winning_tile: winningTile ?? null,
  },
};
```

**Events**

- `MahjongDeclared`
- `HandValidated` (valid/invalid with optional pattern name)
- `GameOver` (final result)

**UI**

- Show scoring overlay during `GamePhase.Scoring`.
- If `HandValidated.valid === false`, show error toast.
- On `GameOver`, render final scoreboard and replay options.

## 7. NMJL Card Viewer

**File:** `apps/client/src/components/features/card/CardViewer.tsx`

**Data source:** `public/cards/cardYYYY.json` via `utils/cardLoader.ts`.

**UI**

- Section tabs (2468, Quints, Singles, Winds-Dragons, etc).
- Pattern list with tile visualization (Tile ids to images).
- Optional highlight when `patternMatchScore(hand) > threshold`.

## 8. Event Application Strategy

Centralize all event handling in `gameStore.applyEvent`. Example sketch:

```ts
applyEvent(event) {
  if ('TileDiscarded' in event) {
    // remove tile from player's hand and push to discard pile
  }
  if ('TileDrawn' in event) {
    // add tile to your hand if tile is present
  }
  if ('PhaseChanged' in event) {
    // update phase
  }
}
```

## Deliverables

1. All phase UI transitions wired to events and commands.
2. Charleston overlay with blind pass and courtesy pass support.
3. CallWindow modal with server timer and call filtering.
4. Joker exchange and blank exchange UI flows.
5. Scoring and game over overlays.
