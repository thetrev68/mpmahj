# Game Design Document - Section 3: Gameplay Mechanics

## Table of Contents

- [Overview](#overview)
- [3.1 The Core Loop (Turn-Based)](#31-the-core-loop-turn-based)
  - [3.1.1 Step 1: The Draw](#311-step-1-the-draw)
  - [3.1.2 Step 2: Action Phase (Discarding)](#312-step-2-action-phase-discarding)
  - [3.1.3 Step 3: Call Window Resolution](#313-step-3-call-window-resolution)
- [3.2 The Call System](#32-the-call-system)
  - [3.2.1 Call Validation](#321-call-validation)
  - [3.2.2 Wall Closure Rule](#322-wall-closure-rule)
  - [3.2.3 Turn Order Skipping](#323-turn-order-skipping)
- [3.3 Joker Mechanics](#33-joker-mechanics)
  - [3.3.1 Joker Usage Rules](#331-joker-usage-rules)
  - [3.3.2 Joker Exchange (Redemption)](#332-joker-exchange-redemption)
  - [3.3.3 Multiple Exchanges & Finesse](#333-multiple-exchanges--finesse)
- [3.4 Meld Upgrading](#34-meld-upgrading)
- [3.5 Winning the Game](#35-winning-the-game)
  - [3.5.1 Self-Draw vs. Called Mahjong](#351-self-draw-vs-called-mahjong)
  - [3.5.2 Pattern Validation](#352-pattern-validation)
  - [3.5.3 Score Calculation & Payout](#353-score-calculation--payout)
- [3.6 Dead Hand (Disqualification)](#36-dead-hand-disqualification)
- [3.7 Game End States](#37-game-end-states)
- [3.8 State Machine Summary](#38-state-machine-summary)
- [3.9 Component Breakdown (For TDD)](#39-component-breakdown-for-tdd)
- [3.10 Backend API Reference](#310-backend-api-reference)
  - [3.10.1 Commands (Frontend → Backend)](#3101-commands-frontend--backend)
  - [3.10.2 Public Events (Backend → All Players)](#3102-public-events-backend--all-players)
  - [3.10.3 Private Events (Backend → Specific Player)](#3103-private-events-backend--specific-player)
- [Summary](#summary)
- [Preparation for Test-Driven Development](#preparation-for-test-driven-development)

---

## Overview

This section defines the **main gameplay loop** after Charleston completes. This is the core turn-based mechanic where players draw tiles, build patterns, and compete to complete a winning hand.

**Key Characteristics:**

- **Turn-Based with Interruptions:** Active player draws → discards, but OTHER players can interrupt by calling discard.
- **Priority System:** Mahjong (win) > Meld > Turn order for conflict resolution.
- **State-Driven UI:** Turn stage dictates which actions are valid (draw, discard, call, pass).
- **Tile Count Enforcement:** 13 tiles normally, 14 on your turn; violations trigger dead hand state.
- **Joker Exchange Mechanic:** Unique to American Mahjong—players can steal exposed Jokers with matching tiles.

**Phase Flow:**

```text
Playing(Drawing) → Playing(Discarding) → Playing(CallWindow) →
  [If no calls: next player Drawing]
  [If call: caller Discarding]
  [If Mahjong: Game ends]
  [If wall empty: Wall Game (draw)]
```

---

## 3.1 The Core Loop (Turn-Based)

The standard flow when no interruptions occur.

### 3.1.1 Step 1: The Draw

**Backend Command:** `DrawTile { player: Seat }`
**Precondition:** Game phase is `Playing(TurnStage::Drawing { player })`.

**Process:**

1. **User Action:** Player clicks "Draw" button or auto-draw (if enabled).
2. **Server Validation:** Confirms correct player, phase, wall has tiles, player has 13 tiles.
3. **Server Execution:** Pops next tile from wall, adds to player's hand, decrements wall count.
4. **Events Emitted:**
   - `PublicEvent::TileDrawnPublic { remaining_tiles }` → All players (tile value hidden)
   - `PrivateEvent::TileDrawnPrivate { tile, remaining_tiles }` → Drawer only
   - `PublicEvent::TurnChanged { player, stage: TurnStage::Discarding { player } }`

**Frontend Response:**

- **`TileDrawnPublic`:** Animate tile from wall to opponent's rack, update wall counter.
- **`TileDrawnPrivate`:** Animate tile face-up to user's rack with pulsing highlight (2-3s), position slightly separated from hand.
- **`TurnChanged`:** Enable discard UI, enable "Exchange Joker" buttons, enable "Mahjong" button if hand complete.

#### Special Case: East's First Turn

- East starts with 14 tiles after deal, skips `Drawing` stage entirely.
- First phase: `Playing(TurnStage::Discarding { player: Seat::East })`.

### 3.1.2 Step 2: Action Phase (Discarding)

**Backend Command:** `DiscardTile { player: Seat, tile: Tile }`
**Precondition:** Game phase is `Playing(TurnStage::Discarding { player })`.

**Player Options (before discarding):**

1. **Joker Exchange** (Optional): `ExchangeJoker { player, target_seat, meld_index, replacement }` - See Section 3.3. Can perform multiple exchanges.
2. **Meld Upgrade** (Optional): `AddToExposure { player, meld_index, tile }` - Upgrade Pung → Kong → Quint → Sextet. See Section 3.4.
3. **Declare Mahjong** (If hand complete): `DeclareMahjong { player, hand, winning_tile: None }` - See Section 3.5.
4. **Discard** (Mandatory if not declaring Mahjong): Must reduce hand to 13 tiles, tile from concealed hand only.

**Discard Flow:**

**User Interaction:**

1. **Selection:** Click/drag tile from hand (visual feedback: tile lifts, cursor changes).
2. **Drag-to-Floor:** Drag tile to discard zone, or double-click shortcut.
3. **Confirmation (Optional):** If enabled, show "Discard [TileName]?" modal.
4. **Submission:** Release tile → sends `DiscardTile` command.

**Backend Processing:**

1. Validates tile is in player's concealed hand.
2. Removes tile from hand, adds to discard pile.
3. Emits events: `PublicEvent::TileDiscarded { player, tile }`, `PublicEvent::TurnChanged { player, stage: TurnStage::CallWindow { ... } }`, `PublicEvent::CallWindowOpened { tile, discarded_by, can_call, timer, started_at_ms, timer_mode }`.

**Frontend Response:**

- **`TileDiscarded`:** Animate tile to discard floor (0.4s with rotation), announce tile name, show tile face-up with slight rotation, highlight recent discard.
- **`CallWindowOpened`:** Show circular countdown (default: 5s), show action panel for other players (Call dropdown with Pung/Kong/Quint/Sextet/Mahjong options, Pass button), show "Waiting..." for discarder.

**"Down is Down" Rule:** Once `DiscardTile` command sent, tile is committed—no undo without SmartUndo vote.

### 3.1.3 Step 3: Call Window Resolution

The Call Window is an interrupt-driven substage where OTHER players can claim the discarded tile.

**Backend Mechanism:** Intent buffering with priority resolution.

**Commands Available:**

- `DeclareCallIntent { player, intent: CallIntentKind }` - Express desire to call (Mahjong or Meld).
- `Pass { player }` - Explicitly decline call.

**Intent Buffering Process:**

1. **Players Declare Intents:** Multiple players can click "Call" during window, stored in `pending_intents`. Players can change mind (click "Pass" to cancel).
2. **Window Closes When:** Timer expires (default: 5s), all eligible players pass, or next player draws tile (wall closure rule).
3. **Server Resolves:** Priority algorithm:
   - **Priority 1:** Mahjong beats all other calls.
   - **Priority 2:** Among Mahjong calls, closest in turn order wins.
   - **Priority 3:** Among Meld calls, closest in turn order wins.
4. **Resolution Event:** `PublicEvent::CallResolved { resolution }`

**Priority Examples:**

| Scenario | Discarded By | Intents                       | Winner | Reason                                 |
| -------- | ------------ | ----------------------------- | ------ | -------------------------------------- |
| 1        | East         | South: Meld, North: Mahjong   | North  | Mahjong > Meld                         |
| 2        | East         | South: Meld, West: Meld       | South  | South is next in turn (E→S→W→N)        |
| 3        | East         | North: Mahjong, West: Mahjong | North  | North is next after East               |
| 4        | South        | West: Meld, East: Mahjong     | East   | Mahjong > Meld (turn order irrelevant) |

**Frontend UI During Call Window:**

**For Eligible Players (not discarder):**

1. **Call Button:** Dropdown with meld options (smart filtered to only show valid types), Mahjong option highlighted in gold if completes winning hand.
2. **Pass Button:** Explicitly decline (auto-pass if timer expires).
3. **Visual Feedback:** Discarded tile pulses/glows, timer countdown, warning at 3s mark.

**For Discarder:** Passive view "Waiting for other players to decide...", optional anonymous count "2 players considering call".

**After Resolution:**

- **No Calls:** `CallWindowClosed` emitted, turn passes to next player clockwise.
- **Call Successful (Meld):** `CallResolved` and `TileCalled` emitted, caller becomes active player (turn jump), called tile + matching tiles move to exposure area, caller must now discard.
- **Call Successful (Mahjong):** `CallResolved` and `MahjongDeclared` emitted, enter `AwaitingMahjong` substage.

---

## 3.2 The Call System

### 3.2.1 Call Validation

**Frontend Pre-Validation (UX Optimization):**

- Before showing "Call Pung" button, check: Player has at least 2 matching tiles in concealed hand (for Pung), 3 for Kong, 4 for Quint, 5 for Sextet.
- **Joker Substitution:** Jokers count as matching tiles (e.g., 1× RedDragon + 2× Joker = valid Pung).

**Backend Validation:**

- Confirms player owns required tiles, validates meld shape matches called tile, checks player isn't in dead hand state, rejects if player is discarder.

### 3.2.2 Wall Closure Rule

**NMJL Official Rule:** If next player in turn order picks a tile from the wall (draws), call window closes **immediately**, even if timer hasn't expired.

**Why:** Prevents indefinite delays—next player can "force close" window by drawing.

**Implementation:**

- **Backend:** When `DrawTile` command received during call window, if sender is next player in turn order → close window, proceed to that player's turn. If not next player → reject command.
- **Frontend:** Only enable "Draw" button for next player during call window, labeled "Draw (closes call window)".

**Example Timeline:** East discards 3Bam → Call window opens for South/West/North (5s timer) → South (next player) clicks "Draw" at 2s mark → Call window closes immediately (West and North lose chance to call).

### 3.2.3 Turn Order Skipping

When a call succeeds, turn order jumps to the caller, skipping intermediate players.

**Example:** Normal Order: East → South → West → North → East. Scenario: East discards, North calls. Result: North becomes active player (South and West skipped). Next Turn: After North discards, turn proceeds to East.

**Frontend Visualization:** Turn indicator jumps from East to North (skip animation), briefly show "Turn skipped (North called)" message.

---

## 3.3 Joker Mechanics

### 3.3.1 Joker Usage Rules

**Wildcard Logic:**

- **Valid Uses:** Jokers can substitute for any tile in a **Pung (3), Kong (4), Quint (5), or Sextet (6)**.
- **Restrictions:** CANNOT use Jokers for Singles (except specific card patterns like "Jokers and Singles"), CANNOT use Jokers for Pairs (except literal "Joker Pair" patterns), CAN use multiple Jokers in one meld (e.g., 1× GreenDragon + 2× Joker = valid Pung).
- **Pattern-Specific Exceptions:** Some NMJL card patterns explicitly allow Joker pairs or Joker singles. Frontend should highlight these exceptions when viewing card patterns.

### 3.3.2 Joker Exchange (Redemption)

**Backend Command:** `ExchangeJoker { player, target_seat, meld_index, replacement }`

**Precondition:** Game phase is `Playing(TurnStage::Discarding { player })` (during player's turn, after drawing but before discarding).

**Process:**

1. **User Action:** Player clicks a Joker in an **opponent's** exposed meld (visual highlight: Joker glows, tooltip shows "Exchange with [TileName]?").
2. **Tile Selection:** UI prompts user to select replacement tile from their hand (validation: replacement must match tile Joker represents).
3. **Submission:** User confirms → sends `ExchangeJoker` command.

**Backend Validation:** Confirms it's player's turn, verifies player owns replacement tile, checks replacement matches Joker's represented tile, validates target meld exists and contains a Joker.

**Backend Execution:**

1. Remove replacement tile from player's concealed hand.
2. Remove Joker from target player's exposed meld.
3. Add replacement tile to target player's meld (in Joker's position).
4. Add Joker to player's concealed hand.
5. Emit `PublicEvent::JokerExchanged { player, target_seat, joker, replacement }`.

**Frontend Response:** Animate replacement tile from player's hand to opponent's exposure area, simultaneously animate Joker from opponent's exposure to player's hand (0.5s crossfade), play "clink" sound, update both players' racks visually.

### 3.3.3 Multiple Exchanges & Finesse

**Multiple Exchanges in One Turn:** Player can exchange multiple Jokers in one turn (before discarding). Example: Player draws tile (now has 14), exchanges Joker A from North's meld, exchanges Joker B from West's meld, now has 2 Jokers in hand, must discard to end turn. Frontend UX: After first exchange, Joker buttons remain active on other exposed Jokers, "Discard" button disabled until player finishes exchanges (or clicks "Done Exchanging").

**"Finesse" Move (Joker Exchange for Mahjong):** Strategic rule: If a player exchanges a Joker and that exchange completes their winning hand, it counts as a **self-draw** (not a called win). Payout Impact: Self-draw = all opponents pay **2×** pattern value; Called win = only discarder pays **2×**, others pay **1×**. Example: Player needs 4Dot to complete Mahjong, opponent has exposed [4Dot, Joker, 4Dot], player exchanges Joker with 4Dot from hand → Completes Mahjong → All opponents pay double (self-draw bonus). Backend Handling: After `ExchangeJoker` executes, check if player's hand is now Mahjong. If yes, enable "Declare Mahjong" button (winning_tile = None for self-draw).

---

## 3.4 Meld Upgrading

**Backend Command:** `AddToExposure { player, meld_index, tile }`

**Concept:** Player adds a tile from their concealed hand to an existing exposed meld, upgrading it: Pung (3) → Kong (4) → Quint (5) → Sextet (6).

**Precondition:** Game phase: `Playing(TurnStage::Discarding { player })`, player has an exposed meld at `meld_index`, player has a tile in hand that matches meld.

**Use Cases:** Draw matching tile (player draws 4th/5th/6th matching tile, upgrades meld), Strategic Exposure (increase hand value—some patterns reward larger melds), Clear Dead Tile (if tile doesn't fit current pattern, park it in exposed meld).

**Process:**

1. **User Action:** Player clicks existing exposed meld → "Upgrade" button appears.
2. **Tile Selection:** UI highlights matching tiles in hand (only those that can upgrade meld).
3. **Submission:** User selects tile → sends `AddToExposure` command.

**Backend Processing:** Validates tile ownership and meld existence, confirms tile matches meld type, removes tile from concealed hand, adds tile to exposed meld, updates meld type (Pung → Kong, etc.), emits `PublicEvent::MeldUpgraded { player, meld_index, new_meld_type }`.

**Frontend Response:** Animate tile from concealed hand to exposed meld (0.4s), visual representation grows (3 tiles → 4 tiles), meld label changes (e.g., "Pung" → "Kong").

**Special Rule: Replacement Draw:** NMJL Rule: After upgrading to Kong/Quint/Sextet, player draws a **replacement tile** from the dead wall. Backend automatically triggers replacement draw. Event: `PrivateEvent::ReplacementDrawn { player, tile, reason: MeldUpgrade }`. Frontend: Show replacement tile animation from dead wall (not regular wall).

---

## 3.5 Winning the Game

### 3.5.1 Self-Draw vs. Called Mahjong

**Self-Draw Mahjong:**

**Backend Command:** `DeclareMahjong { player, hand, winning_tile: None }`

**Trigger:** Player completes hand by drawing a tile (or Joker exchange) during their turn.

**Process:**

1. **Detection:** Frontend checks if hand matches any pattern on NMJL card after each draw (Hint System: if AI assist enabled, highlight "You can declare Mahjong!" message; Manual Check: "Check for Mahjong" button available anytime during player's turn).
2. **User Action:** Player clicks "Mahjong" button.
3. **Hand Submission:** Frontend sends entire hand state + `winning_tile: None`.

**Backend Validation:** Confirms player has exactly 14 tiles, validates hand matches a pattern from current year's card, checks all tiles are legal. If valid: Emit `PublicEvent::MahjongDeclared { player }`, calculate score, emit `PublicEvent::GameEnded { result }`. If invalid: Emit `PrivateEvent::MahjongInvalid { player, reason }`, Penalty: Player declared in error → **Dead Hand**.

**Frontend Response (Valid):** Animate all tiles flip face-up and rearrange to match pattern, show winning overlay with pattern name, score breakdown, celebration animation.

**Frontend Response (Invalid):** Show error modal "Invalid Mahjong declaration. Hand does not match any pattern.", show dead hand notification.

**Called Mahjong (Winning on Discard):**

**Backend Command:** `DeclareMahjong { player, hand, winning_tile: Some(tile) }`

**Trigger:** Player completes hand by calling an opponent's discard.

**Process:**

1. **Call Intent:** During call window, player clicks "Call → Mahjong".
2. **Command:** `DeclareCallIntent { player, intent: CallIntentKind::Mahjong }`.
3. **Priority Resolution:** If multiple players call Mahjong, closest in turn order wins.
4. **Await Validation:** Server emits `PublicEvent::CallResolved { resolution }`.
5. **Stage Transition:** → `Playing(TurnStage::AwaitingMahjong { caller, tile, discarded_by })`.
6. **Mahjong Declaration:** Winner must send `DeclareMahjong` with full hand + called tile.

**Key Difference from Self-Draw:** `winning_tile: Some(called_tile)` → Indicates win on discard. **Payout:** Only discarder pays 2×, others pay 1× (vs. all pay 2× for self-draw).

**Backend Validation:** Same as self-draw, plus: Confirms `winning_tile` matches tile in `AwaitingMahjong` stage, validates hand + called tile = 14 tiles total.

**Frontend Flow:** Call Window → Player clicks "Mahjong" → Resolution (if player wins priority, display "You called Mahjong! Declare your hand.") → Hand Display (show full hand UI for player to confirm) → Submission (Player clicks "Declare" → sends `DeclareMahjong`) → Validation Wait ("Validating hand..." spinner) → Result (Either win screen or invalid error).

### 3.5.2 Pattern Validation

**Validation Algorithm:**

1. **Tile Histogram:** Convert hand to tile count array (same as runtime card format).
2. **Pattern Matching:** Compare against all ~6000 concrete patterns in `runtime_card2025.json`.
3. **Joker Permutations:** If hand contains Jokers, test all legal substitutions.
4. **Match Found:** Return pattern ID, score, category.
5. **No Match:** Return error: "Hand does not match any pattern".

**Frontend Preparation:** Card Viewer Integration (display matched pattern on win screen), Pattern Highlight (show which tiles contributed to which part of pattern).

### 3.5.3 Score Calculation & Payout

**Base Score:** Determined by matched pattern (e.g., 25 points, 30 points, 50 points).

**Multipliers:**

1. **Concealed Hand Bonus:** If no exposed melds, multiply by 2.
2. **Jokerless Bonus:** If no Jokers used, multiply by 2.
3. **Self-Draw Bonus:** If won by drawing (not calling), multiply payout by 2.

**Payout Matrix:**

| Win Type  | Base | Concealed? | Jokerless? | Who Pays                      | Payment                   |
| --------- | ---- | ---------- | ---------- | ----------------------------- | ------------------------- |
| Self-Draw | 25   | No         | No         | All 3 opponents               | 25 × 2 = 50 each          |
| Self-Draw | 25   | Yes        | No         | All 3 opponents               | 25 × 2 × 2 = 100 each     |
| Self-Draw | 25   | No         | Yes        | All 3 opponents               | 25 × 2 × 2 = 100 each     |
| Self-Draw | 25   | Yes        | Yes        | All 3 opponents               | 25 × 2 × 2 × 2 = 200 each |
| Called    | 25   | No         | No         | Discarder: 50<br>Others: 25   | Discarder pays 2×         |
| Called    | 25   | Yes        | Yes        | Discarder: 200<br>Others: 100 | All multipliers apply     |

**Backend Event:** `PublicEvent::GameEnded { result: GameResult::Win { winner, pattern, score, payments } }`.

**Frontend Display:** Scoreboard (show payments from each player), Running Totals (update cumulative scores for session), Replay Option ("Play Another Hand" button—dealer rotates clockwise).

---

## 3.6 Dead Hand (Disqualification)

### Triggers

**Automatic Detection:**

1. **Wrong Tile Count:** Player has <13 or >14 tiles at any time (detected server-side on each action). Common Cause: Miscounting during Charleston, calling incorrectly.
2. **Invalid Mahjong Declaration:** Player declares Mahjong, validation fails. NMJL Rule: "Mahjong in error" = dead hand penalty.
3. **Illegal Exposure:** Player calls a tile for a meld they cannot legally form. Example: Calling 5Bam for Pung but only having 1× 5Bam in hand.

**Manual Declaration (Rare):** Command: `DeclareDeadHand { player }` (for self-reporting errors). Use Case: Player realizes they miscounted, voluntarily goes dead to avoid rule violation.

### Consequences

**Backend State Change:** Set `player.status = PlayerStatus::DeadHand`, Emit `PublicEvent::PlayerStatusChanged { player, status: DeadHand, reason }`.

**Gameplay Impact:**

1. **Frozen Actions:** Dead player CANNOT: Draw tiles, Discard tiles, Call discards, Declare Mahjong, Exchange Jokers.
2. **Passive Participation:** Dead player MUST: Pay winner at end of game (if someone else wins), Remain at table until game ends.
3. **Exposed Jokers Remain Active:** NMJL Rule: Other players CAN still exchange Jokers from a dead player's melds. Dead player's exposed tiles stay visible and redeemable.

**Frontend Response:** Visual Indicator (Dead player's rack grayed out with "DEAD HAND" overlay, red border around player's info panel, crossed-out tile or skull symbol), UI Disablement (All action buttons disabled for dead player, tiles become non-interactive), Notification ("You are in Dead Hand state. You cannot act but must pay winner.").

### Dead Hand Recovery

**NMJL Standard Rules:** Dead hand is **permanent** for the current game. Cannot be undone (even with SmartUndo). Player stays dead until game ends or is abandoned.

**House Rule Variant (Optional):** Some groups allow "dead hand redemption" if player can prove tiles were miscounted accidentally. Not implemented in default ruleset (too complex to validate).

---

## 3.7 Game End States

### Mahjong (Win)

Covered in Section 3.5. Summary: Player declares Mahjong, Validation succeeds, Score calculated, Payments distributed, Option to play another hand (dealer rotates).

### Wall Game (Draw)

**Trigger:** Wall depletes to 0 tiles without anyone declaring Mahjong.

**Backend Detection:** On `DrawTile` command, check `table.wall.remaining_tiles()`. If 0, emit `PublicEvent::GameEnded { result: GameResult::Draw { reason: WallExhausted } }`. Transition phase: → `GamePhase::Ended`.

**Frontend Response:** Overlay "Wall Game – No Winner", Message "The wall has been exhausted without a winner.", Scoreboard (No payments—all scores stay same), Option "Reshuffle & Replay" button (no dealer rotation—same dealer).

### Abandoned Game

**Trigger:** Manual abandonment via `AbandonGame` command.

**Reasons:** `InsufficientPlayers` (A player left/disconnected), `MutualAgreement` (All players agree to stop), `DeadHandCount` (Too many dead hands—house rule).

**Voting:** Majority Required: 3 out of 4 players must agree (or instant if only 1 player remains). Commands: `AbandonGame { player, reason }`, `VoteAbandon { player, vote: Agree/Disagree }`.

**Backend Process:** First player sends `AbandonGame`, Server emits `PublicEvent::AbandonRequested { requester, reason }`, Other players send `VoteAbandon`, When majority reached, emit `PublicEvent::GameEnded { result: Abandoned }`.

**Frontend:** Abandon Modal ("Player [Name] requests to abandon game. Reason: [Reason]. Agree?" with [Agree] [Disagree] buttons), Result (If approved, return all players to lobby with "Game Abandoned" notice).

---

## 3.8 State Machine Summary

**Main Gameplay Phase Progression:**

```text
Playing(Drawing { player })
  → DrawTile command
  → Playing(Discarding { player })

  [Player can perform:]
  - ExchangeJoker (multiple times)
  - AddToExposure (multiple times)
  - DeclareMahjong (if complete)
  - DiscardTile (mandatory if not Mahjong)

  → DiscardTile command
  → Playing(CallWindow { tile, discarded_by, can_act, ... })

  [Other players can:]
  - DeclareCallIntent (Mahjong or Meld)
  - Pass

  [Window closes when:]
  - All pass
  - Timer expires
  - Next player draws (wall closure)

  [Resolution paths:]

  PATH 1: No calls
  → CallWindowClosed
  → Playing(Drawing { player: next_in_turn })

  PATH 2: Meld call wins
  → CallResolved { resolution }
  → TileCalled { player: caller, meld }
  → Playing(Discarding { player: caller })
  [Turn skips intermediate players]

  PATH 3: Mahjong call wins
  → CallResolved { resolution }
  → Playing(AwaitingMahjong { caller, tile, discarded_by })
  → DeclareMahjong command
    → [Valid] → GameEnded { result: Win }
    → [Invalid] → Dead Hand, continue game

  PATH 4: Wall exhausted
  → DrawTile fails (no tiles)
  → GameEnded { result: Draw }
```

---

## 3.9 Component Breakdown (For TDD)

Based on gameplay mechanics, here are key components to build and test:

| Component                | Responsibility                  | Key Props/State                                | Test Cases                                                                                  |
| ------------------------ | ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **`TurnIndicator`**      | Shows whose turn it is          | `activePlayer`, `turnStage`                    | - Highlight active player<br>- Stage labels (Draw/Discard/Call)<br>- Turn jump animation    |
| **`DrawButton`**         | Trigger tile draw               | `isActivePlayer`, `canDraw`, `onDraw`          | - Disable when not player's turn<br>- Auto-draw option<br>- Wall closure during call window |
| **`DiscardPanel`**       | Tile discard interface          | `hand`, `selectedTile`, `onDiscard`            | - Drag-to-floor<br>- Double-click shortcut<br>- Confirmation modal                          |
| **`CallWindowTimer`**    | Countdown during call window    | `duration`, `startTime`, `onExpire`            | - Accurate countdown<br>- Warning states<br>- Auto-close triggers                           |
| **`CallActionPanel`**    | Call/Pass buttons during window | `availableActions`, `onCall`, `onPass`         | - Filter meld types<br>- Mahjong detection<br>- Intent buffering                            |
| **`JokerExchangeUI`**    | Joker redemption interface      | `exposedMelds`, `hand`, `onExchange`           | - Click exposed Joker<br>- Select replacement<br>- Validation feedback                      |
| **`MeldUpgradeButton`**  | Upgrade exposed meld            | `exposedMeld`, `matchingTiles`, `onUpgrade`    | - Detect upgradeable melds<br>- Tile selection<br>- Replacement draw                        |
| **`MahjongDeclaration`** | Win declaration modal           | `hand`, `pattern`, `onDeclare`                 | - Pattern validation<br>- Score preview<br>- Invalid handling                               |
| **`DeadHandOverlay`**    | Dead hand status indicator      | `player`, `reason`                             | - Visual grayout<br>- Action disablement<br>- Reason display                                |
| **`WallCounter`**        | Remaining tiles display         | `remaining`, `threshold`                       | - Live updates<br>- Color coding<br>- Wall game alert                                       |
| **`DiscardPile`**        | Discard zone visualization      | `discards`, `recentDiscard`, `callableDiscard` | - Chronological layout<br>- Highlight recent<br>- Call window glow                          |

**Integration Test Scenarios:**

1. **Standard Turn:** Draw → Discard → No calls → Next player draws.
2. **Meld Call:** Discard → Call intent → Priority resolution → Caller discards.
3. **Mahjong (Self-Draw):** Draw → Detect win → Declare → Validation → Win screen.
4. **Mahjong (Called):** Discard → Call Mahjong → Validation → Win/Invalid.
5. **Joker Exchange:** Draw → Click exposed Joker → Select replacement → Exchange animation.
6. **Meld Upgrade:** Draw matching tile → Upgrade Kong → Replacement draw → Discard.
7. **Dead Hand Trigger:** Invalid Mahjong → Dead hand state → Action disablement.
8. **Wall Game:** Exhaust tiles → Wall game declared → Draw screen.
9. **Priority Conflict:** Multiple call intents → Priority resolution → Winner announced.
10. **Wall Closure:** Call window open → Next player draws → Window closes early.

---

## 3.10 Backend API Reference

### 3.10.1 Commands (Frontend → Backend)

- `DrawTile { player }`
- `DiscardTile { player, tile }`
- `DeclareCallIntent { player, intent }`
- `Pass { player }`
- `DeclareMahjong { player, hand, winning_tile }`
- `ExchangeJoker { player, target_seat, meld_index, replacement }`
- `AddToExposure { player, meld_index, tile }`
- `AbandonGame { player, reason }`
- `VoteAbandon { player, vote }`

### 3.10.2 Public Events (Backend → All Players)

- `TurnChanged { player, stage }`
- `TileDrawnPublic { remaining_tiles }`
- `TileDiscarded { player, tile }`
- `CallWindowOpened { tile, discarded_by, can_call, timer, started_at_ms, timer_mode }`
- `CallWindowClosed`
- `CallResolved { resolution }`
- `TileCalled { player, meld, called_tile }`
- `JokerExchanged { player, target_seat, joker, replacement }`
- `MeldUpgraded { player, meld_index, new_meld_type }`
- `MahjongDeclared { player }`
- `GameEnded { result }`
- `PlayerStatusChanged { player, status, reason }`
- `AbandonRequested { requester, reason }`

### 3.10.3 Private Events (Backend → Specific Player)

- `TileDrawnPrivate { tile, remaining_tiles }`
- `ReplacementDrawn { player, tile, reason }`
- `MahjongInvalid { player, reason }`

---

## Summary

This Gameplay Mechanics section defines the **core turn-based loop** and special actions:

1. **Draw → Discard Loop:** Standard turn progression with tile count enforcement.
2. **Call Window System:** Intent buffering with priority resolution (Mahjong > Meld, turn order).
3. **Joker Exchange:** Unique American Mahjong mechanic for stealing exposed Jokers.
4. **Meld Upgrading:** Adding tiles to existing exposures (Pung → Kong → Quint → Sextet).
5. **Mahjong Declaration:** Self-draw vs. called win with different payouts.
6. **Dead Hand:** Penalty state for tile count errors or invalid Mahjong declarations.
7. **End States:** Win, Wall Game (draw), or Abandon.

**Testing Priorities:**

1. **Unit Tests:** Call priority algorithm, tile count validation, pattern matching.
2. **Integration Tests:** Full turn cycles, call window flows, Joker exchange.
3. **E2E Tests:** Multi-player games from Charleston to win, dead hand scenarios.
4. **Edge Case Tests:** Simultaneous call intents, wall closure, replacement draws.

**Next Section:** Section 4 will cover **Advanced Features** (Undo system, history/replay, AI hints, analytics, multiplayer sync).

---

## Preparation for Test-Driven Development

Before writing tests for gameplay:

1. **Generate Type Bindings:** Run `cargo test export_bindings` to sync `TurnStage`, `CallIntentKind`, `GameResult` to TypeScript.
2. **Mock Call Window:** Create mock server that simulates call window timing and priority resolution.
3. **Pattern Test Data:** Prepare sample winning hands for each pattern category (2025, Consecutive Run, Singles and Pairs, etc.).
4. **Dead Hand Scenarios:** Create test cases for each dead hand trigger (tile count, invalid Mahjong, illegal call).
5. **Animation Timing:** Define consistent animation durations for draw/discard/call/exchange (0.3-0.5s).
6. **Accessibility:** Test keyboard shortcuts (D for draw, 1-9 for tile selection, M for Mahjong, P for pass).

```

```
