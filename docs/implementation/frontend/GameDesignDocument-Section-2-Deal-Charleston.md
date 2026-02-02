# Game Design Document - Section 2: The Deal & The Charleston (ENHANCED)

## Table of Contents

- [Overview](#overview)
- [2.1 The Deal (Initialization)](#21-the-deal-initialization)
  - [2.1.1 Dice Roll Mechanic](#211-dice-roll-mechanic)
  - [2.1.2 Wall Break Logic](#212-wall-break-logic)
  - [2.1.3 Tile Distribution Sequence](#213-tile-distribution-sequence)
  - [2.1.4 Validation Checks](#214-validation-checks)
- [2.2 The Charleston (Phase 1: Compulsory)](#22-the-charleston-phase-1-compulsory)
  - [2.2.1 Global Charleston Constraints](#221-global-charleston-constraints)
  - [2.2.2 Pass 1: First Right](#222-pass-1-first-right)
  - [2.2.3 Pass 2: First Across](#223-pass-2-first-across)
  - [2.2.4 Pass 3: First Left (Blind Pass Available)](#224-pass-3-first-left-blind-pass-available)
- [2.3 Voting to Continue (Stop/Go Decision)](#23-voting-to-continue-stopgo-decision)
- [2.4 The Charleston (Phase 2: Optional Second Charleston)](#24-the-charleston-phase-2-optional-second-charleston)
  - [2.4.1 Pass 1: Second Left](#241-pass-1-second-left)
  - [2.4.2 Pass 2: Second Across](#242-pass-2-second-across)
  - [2.4.3 Pass 3: Second Right (Blind Pass Available)](#243-pass-3-second-right-blind-pass-available)
- [2.5 Blind Pass Logic ("Stealing")](#25-blind-pass-logic-stealing)
  - [2.5.1 Concept & Strategy](#251-concept--strategy)
  - [2.5.2 Backend Command Structure](#252-backend-command-structure)
  - [2.5.3 User Flow (Frontend)](#253-user-flow-frontend)
  - [2.5.4 Backend Processing](#254-backend-processing)
  - [2.5.5 IOU Scenario (Advanced Edge Case)](#255-iou-scenario-advanced-edge-case)
- [2.6 The Courtesy Pass (Negotiation)](#26-the-courtesy-pass-negotiation)
  - [2.6.1 Proposal Phase](#261-proposal-phase)
  - [2.6.2 Tile Selection Phase](#262-tile-selection-phase)
  - [2.6.3 Independent Pair Execution](#263-independent-pair-execution)
- [2.7 State Machine Summary](#27-state-machine-summary)
- [2.8 Component Breakdown (For TDD)](#28-component-breakdown-for-tdd)
- [2.9 Backend API Reference](#29-backend-api-reference)
  - [2.9.1 Commands (Frontend → Backend)](#291-commands-frontend--backend)
  - [2.9.2 Public Events (Backend → All Players)](#292-public-events-backend--all-players)
  - [2.9.3 Private Events (Backend → Specific Player(s))](#293-private-events-backend--specific-players)
- [Summary](#summary)
- [Preparation for Test-Driven Development](#preparation-for-test-driven-development)

---

## Overview

This section defines the **setup phase mechanics** from game start through the Charleston (mandatory tile exchange). These phases establish the initial game state before the main gameplay loop begins.

**Key Characteristics:**

- **Server-Driven Sequence:** All tile distributions happen server-side; UI reflects state transitions via events.
- **Strict Validation:** Tile counts, Joker restrictions, and timing constraints enforced by backend.
- **Complex State Machine:** Charleston has 10+ substages with conditional branching (voting, blind passes, IOU scenarios).
- **Private/Public Event Split:** Some events visible to all (phase changes), others private (tiles received).

**Phase Flow:**

```text
GameStarting → DiceRoll → WallBreak → Deal →
Charleston (First Right/Across/Left → Vote) →
[Optional: Second Left/Across/Right] →
Courtesy Pass → Main Game
```text

---

## 2.1 The Deal (Initialization)

### 2.1.1 Dice Roll Mechanic

**Backend Command:** `RollDice { player: Seat }`
**Precondition:** Game phase is `Setup(RollingDice)`, only East can roll.

**Process:**

1. **User Action:** East player clicks "Roll Dice" button (or auto-triggered if all players ready).
2. **Server Validation:** Confirms East seat and correct phase.
3. **Server Execution:** Generates random dice values (1-6 each), calculates sum (2-12).
4. **Event Emitted:** `PublicEvent::DiceRolled { roll: u8 }`

**Frontend Response:**

- **Animation:** Display two dice with roll animation (0.5s).
- **Visual Feedback:** Show dice sum prominently (e.g., "East rolled 7").
- **Wall Break Indicator:** Highlight the wall section where break will occur.
- **State Update:** Store `diceRoll` value for wall visualization.

### 2.1.2 Wall Break Logic

**Backend Event:** `PublicEvent::WallBroken { position: usize }`

**Calculation:**

- Count counterclockwise from East's wall: `dice_sum` stacks from the **right** end.
- Break point = index where drawing begins.
- Example: Roll = 7 → Count 7 stacks from right → Break occurs there.

**Frontend Response:**

- **Visual Gap:** Render separation in wall at calculated position.
- **Draw Direction Indicator:** Arrow showing tiles will be drawn left-to-right from break point.
- **Wall Counter Update:** Display total drawable tiles (typically 72 for 4-player game).

### 2.1.3 Tile Distribution Sequence

**Backend Process:** (No direct command, server auto-executes after wall broken)

**Dealing Algorithm:**

1. **Phase 1 (3 rounds):** Deal **4 tiles** at a time, counterclockwise:
   East → South → West → North (repeat 3×) = 12 tiles each.
2. **Phase 2 (Final round):**
   - East draws tiles at indices: 1 (top), 3 (bottom) → **14 tiles total**
   - South, West, North each draw 1 tile → **13 tiles each**

**Events Emitted:**

- `PrivateEvent::TilesDealt { your_tiles: Vec<Tile> }` → Sent individually to each player.
- `PublicEvent::CharlestonPhaseChanged { stage: CharlestonStage::FirstRight }` → Signals Charleston start.

**Frontend Response:**

- **Animation (Optional):** Tiles "fly" from wall to each player's rack (0.3s per batch).
  - Can skip animation with "Fast Deal" setting.
- **Hand Display:** Populate user's concealed hand with tiles (face-up).
- **Opponent Racks:** Show tile backs for opponents with count badge (e.g., "13").
- **Auto-Sort:** Sort user's tiles by suit/rank (configurable preference).

### 2.1.4 Validation Checks

**Tile Count Validation:**

- **Backend:** Verifies each player has exactly 13 tiles (East: 14) after deal.
- **Misdeal Detection:** If counts incorrect, emits `PublicEvent::GameError { message: "Misdeal detected" }` and resets.
- **Frontend:** Display error modal, wait for server reset command.

**Heavenly Hand Check (Rare Edge Case):**

- **Rule:** If East's initial 14-tile hand is already Mahjong, instant win.
- **Backend:** After dealing to East, runs win validation.
- **If True:** Emits `PublicEvent::MahjongDeclared { player: Seat::East, ... }` immediately.
- **Frontend:** Skip Charleston, display win screen.

**Joker Distribution:**

- Standard deck: 8 Jokers total (distributed randomly).
- Frontend displays Jokers with distinct visual (rainbow pattern).
- No special validation—Jokers treated like any tile until Charleston.

---

## 2.2 The Charleston (Phase 1: Compulsory)

This phase is mandatory. The game cannot proceed to "Play" until this sequence is complete.

### 2.2.1 Global Charleston Constraints

**Joker Lock Rule:**

- **Rule:** Jokers CANNOT be passed during Charleston (NMJL official rule).
- **Backend Validation:** `PassTiles` command rejected if tiles contain Jokers.
- **Frontend Enforcement:**
  - Joker tiles marked as `disabled` (grayed out, diagonal strike-through).
  - Click/tap on Joker shows tooltip: "Jokers cannot be passed".
  - Selection logic skips Jokers entirely.

**Tile Selection Count:**

- **Standard Pass:** Exactly 3 tiles required.
- **Blind Pass (FirstLeft/SecondRight only):** 0-3 tiles from hand + blind count = 3 total.
- **UI Validation:**
  - "Pass Tiles" button disabled until valid selection.
  - Counter shows "2/3 selected" to guide user.
  - Error state if user tries to submit wrong count.

**Timer Constraint:**

- **Default:** 60 seconds per pass stage (configurable: 30/90/120s).
- **Backend Event:** `CharlestonTimerStarted { stage, duration, started_at_ms, timer_mode }`
- **Frontend Display:**
  - Countdown timer (circular progress bar or numeric).
  - Warning at 10 seconds (color change to red, sound alert).
  - Auto-submit on timeout (passes first 3 available tiles if user hasn't selected).

### 2.2.2 Pass 1: First Right

**Backend Command:** `PassTiles { player: Seat, tiles: Vec<Tile>, blind_pass_count: None }`
**Precondition:** Charleston stage is `CharlestonStage::FirstRight`.

**User Flow:**

1. **UI State:** Charleston tracker shows "Pass Right →" with arrow pointing right.
2. **Selection:** User clicks 3 tiles from hand (tiles highlight on click).
3. **Validation:** Frontend checks:
   - Exactly 3 tiles selected.
   - No Jokers in selection.
   - User owns all tiles (cross-check with hand state).
4. **Submission:** User clicks "Pass Tiles" button.
5. **Loading State:** Button shows spinner, hand becomes non-interactive.

**Backend Processing:**

1. Validates command (tile ownership, count, no Jokers).
2. Removes tiles from player's hand.
3. Emits `PrivateEvent::TilesPassed { player, tiles }`.
4. Stores tiles in `charleston_state.pending_passes[player]`.
5. When all 4 players ready, emits `PublicEvent::PlayerReadyForPass { player }` for each.
6. Executes pass: `PublicEvent::TilesPassing { direction: PassDirection::Right }`.
7. Distributes tiles: `PrivateEvent::TilesReceived { player, tiles, from: Some(sender) }`.
8. Advances stage: `PublicEvent::CharlestonPhaseChanged { stage: CharlestonStage::FirstAcross }`.

**Frontend Response to Events:**

- **`TilesPassed`:** Remove tiles from user's hand with slide-out animation.
- **`PlayerReadyForPass`:** Show checkmark on opponent's rack ("Player ready: 3/4").
- **`TilesPassing`:** Brief animation showing tiles moving between players (directional arrows).
- **`TilesReceived`:** Tiles slide into user's hand from right side, auto-sort.
- **`CharlestonPhaseChanged`:** Update tracker to "Pass Across ↔".

### 2.2.3 Pass 2: First Across

**Same mechanics as First Right**, except:

- Direction: `PassDirection::Across`
- Visual: Arrows point up (to North for South player).
- Next stage: `CharlestonStage::FirstLeft`

### 2.2.4 Pass 3: First Left (Blind Pass Available)

**Backend Command:** `PassTiles { player, tiles, blind_pass_count: Option<u8> }`

**Key Difference:** Blind pass/steal allowed (see Section 2.5 for full logic).

**User Flow (Standard Pass):**

- Same as First Right/Across, but direction is Left (←).
- Next stage: `CharlestonStage::VotingToContinue`.

**User Flow (Blind Pass):**

- User selects 0-2 tiles from hand.
- UI shows "Blind Pass" checkbox or slider for remaining tiles.
- Example: Select 1 tile → Blind pass 2 incoming tiles.
- See Section 2.5 for detailed mechanics.

---

## 2.3 Voting to Continue (Stop/Go Decision)

**Backend Command:** `VoteCharleston { player: Seat, vote: CharlestonVote }`
**Precondition:** Charleston stage is `CharlestonStage::VotingToContinue`.

**Vote Options:**

- `CharlestonVote::Stop` → Skip Second Charleston, go to Courtesy Pass.
- `CharlestonVote::Continue` → Proceed to Second Charleston.

**User Flow:**

1. **UI Prompt:** Modal overlay appears: "Continue to Second Charleston?"
   - Buttons: "Stop" (red) / "Continue" (green).
   - Timer: 30 seconds to vote (shorter than pass timer).
   - Default: Auto-vote "Stop" on timeout (conservative choice).
2. **Vote Submission:** User clicks button → sends command.
3. **Loading State:** Button shows "Waiting for other players..." with spinner.

**Backend Processing:**

1. Records vote in `charleston_state.votes`.
2. Emits `PublicEvent::PlayerVoted { player }` (but not which vote—keeps strategy private).
3. When all 4 players voted:
   - **ANY vote = Stop:** Emits `PublicEvent::VoteResult { result: CharlestonVote::Stop }`.
   - **ALL votes = Continue:** Emits `PublicEvent::VoteResult { result: CharlestonVote::Continue }`.
4. Advances stage based on result:
   - **Stop:** → `CharlestonStage::CourtesyAcross`
   - **Continue:** → `CharlestonStage::SecondLeft`

**Frontend Response:**

- **`PlayerVoted`:** Show vote status ("3/4 players voted"), no indication of choice.
- **`VoteResult` (Stop):**
  - Display: "Charleston stopped. Proceeding to Courtesy Pass."
  - Update tracker: Skip Second Charleston icons, highlight Courtesy Pass.
- **`VoteResult` (Continue):**
  - Display: "Second Charleston starting!"
  - Update tracker: Expand to show Second Left/Across/Right stages.

**Edge Case: Deadlock Prevention:**

- If timer expires and not all players voted, auto-vote "Stop" for remaining players.
- Server never waits indefinitely (timeout = Stop).

---

## 2.4 The Charleston (Phase 2: Optional Second Charleston)

Only reached if ALL players voted "Continue" in Section 2.3.

### 2.4.1 Pass 1: Second Left

**Same mechanics as First Right**, except:

- Direction: `PassDirection::Left` (reverse of First Charleston).
- Stage: `CharlestonStage::SecondLeft`.
- Next: `CharlestonStage::SecondAcross`.

### 2.4.2 Pass 2: Second Across

- Direction: `PassDirection::Across`.
- Stage: `CharlestonStage::SecondAcross`.
- Next: `CharlestonStage::SecondRight`.

### 2.4.3 Pass 3: Second Right (Blind Pass Available)

- Direction: `PassDirection::Right`.
- **Blind Pass Allowed** (same rules as First Left—see Section 2.5).
- Next: `CharlestonStage::CourtesyAcross`.

---

## 2.5 Blind Pass Logic ("Stealing")

This is a critical edge case for TDD. It allows a player to pass tiles they haven't seen yet.

**Allowed Stages:** ONLY on `CharlestonStage::FirstLeft` and `CharlestonStage::SecondRight` (final pass of each Charleston).

### 2.5.1 Concept & Strategy

**Why it exists:**

- If you receive bad tiles from a previous pass, you can pass them forward without looking.
- Strategic: Avoids "poisoning" your hand with unwanted tiles.
- Risk: You might blindly pass away a useful tile.

**Official Rule:**

- On the last pass of each Charleston, players may select 0-3 tiles from **hand** + 0-3 tiles from **incoming tiles**.
- Total must = 3 tiles passed.
- Incoming tiles are "stolen" before the player sees them.

### 2.5.2 Backend Command Structure

```rust
PassTiles {
    player: Seat,
    tiles: Vec<Tile>,              // Tiles from hand (0-3)
    blind_pass_count: Option<u8>,  // Incoming tiles to steal (0-3)
}
```text

**Validation:**

- `tiles.len() + blind_pass_count.unwrap_or(0) == 3`
- `blind_pass_count` only allowed if stage allows blind pass.
- All `tiles` must be in player's current hand.

### 2.5.3 User Flow (Frontend)

**UI Components:**

1. **Hand Selection Area:** Standard tile selection (0-3 tiles).
2. **Blind Pass Slider/Stepper:**
   - Label: "Blind pass incoming tiles: 0/1/2/3"
   - Stepper buttons: [−] [2] [+]
   - Constraint: `hand_selected + blind_count = 3`
   - Auto-adjusts when hand selection changes.
3. **Visual Indicator:**
   - "You will pass: 1 from hand + 2 blind = 3 total"
   - Icons showing tile sources (hand icon vs. question mark icon).

**Interaction Example:**

1. User selects 1 tile from hand.
2. Blind slider auto-sets to 2 (to reach total of 3).
3. User can adjust: Deselect hand tile → slider becomes 3.
4. Confirmation modal: "You are blind passing 2 tiles. Continue?"
5. Submit → `PassTiles { tiles: [selected_tile], blind_pass_count: Some(2) }`.

### 2.5.4 Backend Processing

**Execution Steps:**

1. **Validate** command (tile ownership, counts, stage allows blind pass).
2. **Remove tiles from hand:** Extract user's selected tiles.
3. **Store in pending_passes:** `charleston_state.pending_passes[player] = selected_tiles`.
4. **Mark blind count:** `charleston_state.blind_counts[player] = blind_pass_count`.
5. **When all players ready:**
   - For each player with blind count > 0:
     - Take `blind_count` tiles from their **incoming tiles** (not yet added to hand).
     - Append to their selected tiles to create full 3-tile pass.
   - Emit `PublicEvent::BlindPassPerformed { player, blind_count, hand_count }`.
6. **Execute pass:** Distribute tiles as normal.
7. **Add remaining incoming tiles to hands:**
   - Each player receives `incoming_tiles - blind_count`.

**Example Scenario:**

- Player A selects 1 tile from hand, blind passes 2.
- Player B (who is passing to A) sends tiles: [5Bam, 3Dot, GreenDragon].
- Server takes first 2 tiles from B's pass: [5Bam, 3Dot].
- Player A's full pass = [A's selected tile, 5Bam, 3Dot].
- Player A receives: [GreenDragon] (the 1 remaining tile from incoming).

### 2.5.5 IOU Scenario (Advanced Edge Case)

**Situation:** ALL 4 players attempt to blind pass all 3 tiles.

**Problem:** No tiles available to steal (everyone's incoming pile is empty).

**NMJL Rule:** "I.O.U." flow activates:

1. Each player passes 1-2 tiles saying "I.O.U. [remaining count]".
2. First player to pick up their incoming tiles "makes good" on the debt.
3. Complicated multi-step negotiation (rarely happens in practice).

**Backend Detection:**

- If all players have `blind_pass_count == 3`, emit `PublicEvent::IOUDetected { debts }`.
- Enter substage: `CharlestonStage::IOUResolution`.
- (Full IOU implementation is complex—see backend code in `charleston.rs` for details).

**Frontend Handling:**

- Display special modal: "All players attempted full blind pass! IOU resolution required."
- Guided prompts to select 1-2 tiles for initial IOU pass.
- Most implementations: Discourage full blind pass (show warning tooltip).

---

## 2.6 The Courtesy Pass (Negotiation)

The final step before gameplay begins. This is a **pair-scoped negotiation** between opposite players (North-South, East-West).

**Backend Commands:**

- `ProposeCourtesyPass { player: Seat, tile_count: u8 }` (0-3)
- `AcceptCourtesyPass { player: Seat, tiles: Vec<Tile> }` (submit actual tiles after agreement)

**Precondition:** Charleston stage is `CharlestonStage::CourtesyAcross`.

### 2.6.1 Proposal Phase

**User Flow:**

1. **UI Prompt:** "Courtesy Pass with [Opposite Player]. How many tiles to exchange? (0-3)"
   - Buttons: [0] [1] [2] [3]
   - Explanation tooltip: "Both players propose a count. Lowest count wins."
2. **Selection:** User clicks count → sends `ProposeCourtesyPass { tile_count }`.
3. **Loading State:** "Waiting for [Opposite Player] to propose..."

**Backend Processing:**

1. Records proposal: `charleston_state.courtesy_proposals[player] = tile_count`.
2. Emits `PrivateEvent::CourtesyPassProposed { player, tile_count }` (pair-scoped—only to two players involved).
3. When BOTH players in a pair have proposed:
   - Calculate: `agreed_count = MIN(proposal_A, proposal_B)`.
   - If proposals differ: Emit `PrivateEvent::CourtesyPassMismatch { pair, proposed, agreed_count }`.
   - Emit `PrivateEvent::CourtesyPairReady { pair, tile_count: agreed_count }`.

**Frontend Response to Mismatch:**

- Display: "You proposed 3, opponent proposed 1. Agreed count: 1."
- If user's proposal > agreed count:
  - Enable tile selection for exactly `agreed_count` tiles.
  - Prompt: "Select 1 tile to exchange."
- If user's proposal = agreed count:
  - Already correct, proceed to tile selection.
- If agreed count = 0:
  - No exchange. Wait for opposite pair to finish, then advance to main game.

### 2.6.2 Tile Selection Phase

**User Flow (if agreed_count > 0):**

1. **UI State:** Hand becomes interactive, selection mode active.
2. **Selection:** User clicks `agreed_count` tiles (same constraints as Charleston—no Jokers).
3. **Validation:** Frontend checks:
   - Exactly `agreed_count` selected.
   - No Jokers.
   - User owns all tiles.
4. **Submission:** User clicks "Confirm Exchange" → `AcceptCourtesyPass { tiles }`.

**Backend Processing:**

1. Validates tiles (ownership, count matches agreed count, no Jokers).
2. Removes tiles from player's hand.
3. Stores tiles: `charleston_state.courtesy_tiles[player] = tiles`.
4. When BOTH players in pair submitted tiles:
   - Swap tiles between pair.
   - Emit `PrivateEvent::TilesPassed { player, tiles }` (to each).
   - Emit `PrivateEvent::TilesReceived { player, tiles, from: Some(opposite) }` (to each).
5. When ALL PAIRS complete (both North-South and East-West):
   - Emit `PublicEvent::CourtesyPassComplete`.
   - Advance phase: → `GamePhase::Playing(...)`.

**Frontend Response:**

- **`TilesPassed`:** Tiles slide out toward opposite player (across animation).
- **`TilesReceived`:** Tiles slide in from opposite direction.
- **`CourtesyPassComplete`:**
  - Display: "Charleston complete! Game starting."
  - Transition to main game UI (hide Charleston tracker, show turn actions).

### 2.6.3 Independent Pair Execution

**Key Detail:** North-South and East-West pairs negotiate **independently and simultaneously**.

**Example Timeline:**

- 0:00 - All players enter Courtesy Pass stage.
- 0:05 - North proposes 2, South proposes 1 → Agreed: 1.
- 0:10 - East proposes 0, West proposes 3 → Agreed: 0 (no exchange for E-W pair).
- 0:12 - North and South select and submit tiles → N-S exchange complete.
- 0:12 - E-W pair auto-advances (no tiles to exchange).
- 0:12 - Both pairs complete → `CourtesyPassComplete` emitted, game starts.

**Frontend Consideration:**

- If user's pair finishes first, show "Waiting for other pair to complete courtesy pass..." message.
- Do NOT show opposite pair's tiles or proposals (privacy).

---

## 2.7 State Machine Summary

**Charleston State Progression:**

```text
Setup(RollingDice)
  → DiceRolled event
  → Setup(WallBroken)
  → WallBroken event
  → Setup(Dealing)
  → TilesDealt events
  → Charleston(FirstRight)
  → (all players pass) → Charleston(FirstAcross)
  → (all players pass) → Charleston(FirstLeft)
  → (all players pass) → Charleston(VotingToContinue)

  [IF ANY VOTE STOP:]
  → Charleston(CourtesyAcross)
  → (pairs negotiate) → Playing(...)

  [IF ALL VOTE CONTINUE:]
  → Charleston(SecondLeft)
  → (all players pass) → Charleston(SecondAcross)
  → (all players pass) → Charleston(SecondRight)
  → (all players pass) → Charleston(CourtesyAcross)
  → (pairs negotiate) → Playing(...)
```text

**Edge States:**

- `Charleston(IOUResolution)` - If all players full blind pass.
- `Charleston(BlindPassCollect)` - Intermediate state for processing blind passes.

---

## 2.8 Component Breakdown (For TDD)

Based on Charleston mechanics, here are key components to build and test:

| Component                | Responsibility                                  | Key Props/State                                               | Test Cases                                                                    |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **`CharlestonTracker`**  | Visual progress indicator for Charleston stages | `currentStage`, `secondCharlestonEnabled`, `voteStatus`       | - Correct stage labels<br>- Arrow directions<br>- Progress percentage         |
| **`TileSelectionPanel`** | Tile selection UI during passes                 | `hand`, `maxSelection`, `disabledTiles`, `onSelectionChange`  | - Enforce count limit<br>- Disable Jokers<br>- Multi-select toggle            |
| **`BlindPassControl`**   | Slider/stepper for blind pass count             | `handSelectedCount`, `onBlindCountChange`                     | - Auto-adjust to maintain total=3<br>- Disable when not FirstLeft/SecondRight |
| **`VoteDialog`**         | Stop/Continue voting modal                      | `onVote`, `timerDuration`                                     | - Submit vote<br>- Auto-vote on timeout<br>- Disable after vote               |
| **`CourtesyPassDialog`** | Courtesy pass negotiation UI                    | `oppositePlayer`, `onPropose`, `agreedCount`, `onSubmitTiles` | - Proposal submission<br>- Mismatch display<br>- Tile selection enforcement   |
| **`PassAnimationLayer`** | Tile movement animations during passes          | `direction`, `tilesInTransit`                                 | - Directional movement<br>- Timing/easing<br>- Multi-player sync              |
| **`CharlestonTimer`**    | Countdown timer display                         | `duration`, `startTime`, `onExpire`                           | - Accurate countdown<br>- Warning states<br>- Expiry callback                 |

**Integration Test Scenarios:**

1. **Standard First Charleston:** All players pass 3 tiles each direction, vote Stop.
2. **Blind Pass:** One player blind passes 2 tiles on FirstLeft, receives 1 tile.
3. **Vote Continue:** All players vote Continue, Second Charleston executes.
4. **Courtesy Pass Mismatch:** North proposes 3, South proposes 1, negotiation resolves to 1.
5. **IOU Detection:** All players attempt full blind pass (edge case).
6. **Timer Expiry:** Player doesn't select tiles in time, auto-passes first 3 tiles.

---

## 2.9 Backend API Reference

### 2.9.1 Commands (Frontend → Backend)

- `RollDice { player }`
- `PassTiles { player, tiles, blind_pass_count }`
- `VoteCharleston { player, vote }`
- `ProposeCourtesyPass { player, tile_count }`
- `AcceptCourtesyPass { player, tiles }`

### 2.9.2 Public Events (Backend → All Players)

- `DiceRolled { roll }`
- `WallBroken { position }`
- `CharlestonPhaseChanged { stage }`
- `PlayerReadyForPass { player }`
- `TilesPassing { direction }`
- `PlayerVoted { player }`
- `VoteResult { result }`
- `BlindPassPerformed { player, blind_count, hand_count }`
- `IOUDetected { debts }`
- `CourtesyPassComplete`
- `CharlestonTimerStarted { stage, duration, started_at_ms, timer_mode }`
- `CharlestonComplete`

### 2.9.3 Private Events (Backend → Specific Player(s))

- `TilesDealt { your_tiles }`
- `TilesPassed { player, tiles }`
- `TilesReceived { player, tiles, from }`
- `CourtesyPassProposed { player, tile_count }` (pair-scoped)
- `CourtesyPassMismatch { pair, proposed, agreed_count }` (pair-scoped)
- `CourtesyPairReady { pair, tile_count }` (pair-scoped)

---

## Summary

This Deal & Charleston section defines the **most complex pre-game phase** in American Mahjong:

1. **Dice Roll → Wall Break → Deal:** Server-driven randomization with visual feedback.
2. **First Charleston (Mandatory):** 3 passes (Right/Across/Left) with Joker restrictions and timer constraints.
3. **Voting:** Unanimous "Continue" required for Second Charleston; any "Stop" skips to Courtesy Pass.
4. **Blind Pass:** Advanced mechanic allowing unseen tile forwarding on FirstLeft/SecondRight.
5. **Courtesy Pass:** Pair-scoped negotiation with "lowest count wins" logic.
6. **IOU Edge Case:** Rare scenario when all players full blind pass.

**Testing Priorities:**

1. **Unit Tests:** Tile selection constraints (count, Joker lock), blind pass calculation.
2. **Integration Tests:** Full Charleston flow with mock events, voting branches.
3. **E2E Tests:** Multi-player Charleston with real backend, timer expiry, blind passes.
4. **Edge Case Tests:** IOU detection, mismatch resolution, timer auto-submit.

**Next Section:** Section 3 will cover **Main Gameplay Loop** (drawing, discarding, calling tiles, turn progression, joker exchange).

---

## Preparation for Test-Driven Development

Before writing tests for Charleston:

1. **Generate Type Bindings:** Run `cargo test export_bindings` to sync Rust enums (`CharlestonStage`, `CharlestonVote`, `PassDirection`) to TypeScript.
2. **Mock Backend:** Create mock WebSocket server that emits Charleston events in sequence for testing without full backend.
3. **Test Data:** Prepare sample hands, tile sets, and event sequences for each Charleston stage.
4. **Visual Regression:** Screenshot tests for Charleston tracker at each stage, tile animations.
5. **Accessibility:** Test keyboard navigation through tile selection, timer announcements for screen readers.

```text

```text
```
